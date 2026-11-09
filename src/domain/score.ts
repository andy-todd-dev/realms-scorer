import { Card, CardEffect, CardId, Suit } from "./card";
import { withoutBlankedCards } from "./blanking";
import { matches, othersIn } from "./card-matching";
import {
  bindChoices,
  ChoiceReport,
  ChoiceRules,
  Choices,
  firePreScoring,
  NO_CHOICE_RULES,
} from "./choices";
import { withPenaltiesCleared } from "./clearing";
import { conditionHolds } from "./conditions";

/*
  Rulebook Q&A: "Follow any instructions which call for the clearing of a penalty or part of a penalty. Finally, apply
  all penalties, beginning with cards not blanked by any other cards."

  Island: "Clears the penalty on any one Flood or Flame." The player chooses the card, and the app never chooses for
  them. Until they do, the card has no effect.

  Necromancer: "At the end of the game, you may take one army, leader, wizard, or beast from the discard area and add it
  to your hand as an eighth card." Ruled by the user, not quoted: this takes place before scoring, before clearing and
  other choices, so a blanked Necromancer still has its eighth card. The app can't see the discard area, so any card in
  the variant's deck that isn't in the hand counts as being there.

  Shapeshifter: "May duplicate the name and suit of any one Artifact, Leader, Wizard, Weapon, or Beast in the game. Does
  not take the bonus, penalty, or base strength of the card duplicated." Ruled by the user: this is a pre-scoring
  ability. It may duplicate a card that is also in the hand, giving two cards of that name.

  Mirage: "May duplicate the name and suit of any one Army, Land, Weather, Flood, or Flame in the game. Does not take the
  bonus, penalty, or base strength of the card duplicated." Ruled by the user: a pre-scoring ability, as Shapeshifter's
  is.

  Doppelgänger: "May duplicate the name, base strength, suit, and penalty (but not bonus) of any one other card in your
  hand." Ruled by the user: this is a pre-scoring ability, though the card prints it as its bonus. The penalty taken
  replaces the Doppelgänger's own, and is then cleared or applied as any other penalty would be.

  Collector: "+10 if 3 different cards in the same suit, +40 if 4, +100 if 5." Ruled by the user: within a suit only
  the highest tier pays, but each suit that reaches a tier pays. Collector counts itself, "different" means a different
  name, so a card that took another's name doesn't add to the count, and Wild counts as a suit.

  Ruled by the user: each variant lists the cards whose pre-scoring effects fire before everything else, in its own
  order. For the base game: Necromancer, Doppelgänger, Mirage, Shapeshifter, then Book of Changes. A card's other
  effects, and the choices of other cards such as Island's, take effect at their normal time: Island's when penalties
  are cleared.

  Our interpretation of how these fit together, so scoring runs in this order:
  1. Fire pre-scoring effects (choices.ts): the variant's listed cards, in order, each with its choice checked against
     the hand the cards before it left. Necromancer adds its card to the hand here.
  2. Bind the other choices (choices.ts): check each against the hand step 1 left, and fill in each card's effects on
     "the chosen card" with the card chosen. Nothing takes effect here. A pending choice, or one that no longer fits,
     targets nothing. Commands keep the stored choices valid, so this check is a safety net.
  3. Clear penalties, and suit words from penalties (clearing.ts). A card that is later blanked still clears, so a
     blanked Island still clears the card it chose.
  4. Apply blanks, both those that target other cards and self-blanks, in rounds. Each round settles the cards whose
     fate no longer depends on unsettled cards, so blanked cards neither blank others nor trigger their self-blanks.
     Cards never settled are caught in a loop, or blanked only by cards in one, and are blanked (blanking.ts).
  5. Add up points using only the cards left after step 4.
  Steps 3 to 5 know nothing of choices (scoreBoundHand).
*/

// Returns the length of the longest run of consecutive base strengths. Duplicate strengths neither break nor extend a run.
function longestBaseStrengthRun(cards: readonly Card[]): number {
  const strengths = new Set(cards.map(({ baseStrength }) => baseStrength));

  return Math.max(
    0,
    ...[...strengths].map((strength) => {
      let length = 1;

      while (strengths.has(strength + length)) {
        length += 1;
      }

      return length;
    }),
  );
}

// Returns the points of the highest tier that the longest run in the hand reaches. Tiers don't add up, only the longest run pays, and a run longer than the top tier pays nothing extra.
function baseStrengthRunPoints(
  tiers: Extract<CardEffect, { kind: "baseStrengthRun" }>["tiers"],
  cards: readonly Card[],
): number {
  const run = longestBaseStrengthRun(cards);

  return tiers
    .filter(({ length }) => length <= run)
    .reduce((best, tier) => (tier.length > best.length ? tier : best), {
      length: 0,
      points: 0,
    }).points;
}

// For each suit, the number of differently named cards of it. A card that took another's name counts as that card.
function differentlyNamedCardsPerSuit(
  cards: readonly Card[],
): ReadonlyMap<Suit, number> {
  const namesPerSuit = new Map<Suit, Set<CardId>>();

  cards.forEach((card) => {
    const names = namesPerSuit.get(card.suit) ?? new Set<CardId>();

    names.add(card.namedAs ?? card.id);
    namesPerSuit.set(card.suit, names);
  });

  return new Map([...namesPerSuit].map(([suit, names]) => [suit, names.size]));
}

// Adds up, for each suit, the points of the highest tier its count reaches. Tiers don't add up within a suit.
function sameSuitSetPoints(
  tiers: Extract<CardEffect, { kind: "sameSuitSet" }>["tiers"],
  cards: readonly Card[],
): number {
  return [...differentlyNamedCardsPerSuit(cards).values()].reduce(
    (total, count) =>
      total +
      tiers
        .filter((tier) => tier.count <= count)
        .reduce((best, tier) => (tier.count > best.count ? tier : best), {
          count: 0,
          points: 0,
        }).points,
    0,
  );
}

// Calculates the points contributed by a specific effect of the specified card, based on the other cards in the hand.
function effectPoints(
  effect: CardEffect,
  card: Card,
  others: readonly Card[],
): number {
  if (effect.kind === "baseStrengthRun") {
    return baseStrengthRunPoints(effect.tiers, [card, ...others]);
  }

  if (effect.kind === "sameSuitSet") {
    return sameSuitSetPoints(effect.tiers, [card, ...others]);
  }

  if (effect.kind === "sum") {
    return others
      .filter((other) => matches(other, effect.of))
      .reduce((total, other) => total + other[effect.attribute], 0);
  }

  if (effect.kind !== "points") {
    return 0;
  }

  if (effect.when && !conditionHolds(effect.when, card, others)) {
    return 0;
  }

  const { per } = effect;

  return per
    ? effect.points * others.filter((other) => matches(other, per)).length
    : effect.points;
}

export type CardScore = {
  readonly cardId: CardId;
  readonly blanked: boolean;
  readonly base: number;
  readonly bonus: number;
  // Zero or negative.
  readonly penalty: number;
  readonly total: number;
  // Only for a card that an effect added to the hand: the card whose effect added it.
  readonly addedBy?: CardId;
  // Only for a card that took another card's suit: the suit it was scored as.
  readonly suit?: Suit;
  // Only for cards that need a choice: the card chosen, or null while pending, and the cards that may be chosen.
  readonly choice?: ChoiceReport;
};

export type HandScore = {
  // In the order the cards were given, then any cards that effects added to the hand.
  readonly cards: readonly CardScore[];
  readonly base: number;
  readonly bonus: number;
  readonly penalty: number;
  readonly total: number;
};

// Adds up the points from some effects of the specified card.
function sumOfEffects(
  effects: readonly CardEffect[] | undefined,
  card: Card,
  others: readonly Card[],
): number {
  return (effects ?? []).reduce(
    (total, effect) => total + effectPoints(effect, card, others),
    0,
  );
}

const BLANKED = { blanked: true, base: 0, bonus: 0, penalty: 0, total: 0 };

// Scores a hand whose choices are already bound (steps 3 to 5), card by card in the order given.
function scoreBoundHand(cards: readonly Card[]): readonly CardScore[] {
  // Clearing takes place before any penalties are applied
  const cleared = withPenaltiesCleared(cards);

  // Filter out blanked cards
  const remaining = withoutBlankedCards(cleared);

  // Score each card based on what is left
  return cards.map(({ id }): CardScore => {
    const card = remaining.find((other) => other.id === id);

    if (!card) {
      return { cardId: id, ...BLANKED };
    }

    const others = othersIn(remaining, card);
    const bonus = sumOfEffects(card.bonus?.effects, card, others);
    const penalty = sumOfEffects(card.penalty?.effects, card, others);

    return {
      cardId: id,
      blanked: false,
      base: card.baseStrength,
      bonus,
      penalty,
      total: card.baseStrength + bonus + penalty,
    };
  });
}

/*
  Scores a hand of cards, card by card. Points from a card's bonus count as bonus and points from its penalty count as
  penalty. A blanked card is listed, scoring nothing. Choices map each choosing card to the card the player chose. The
  rules come from the variant: the cards listed for pre-scoring, and the discard area, which can be the variant's whole
  deck.
*/
export function scoreHand(
  cards: readonly Card[],
  choices: Choices = {},
  rules: ChoiceRules = NO_CHOICE_RULES,
): HandScore {
  const preScored = firePreScoring(cards, choices, rules);
  const bound = bindChoices(preScored, choices, rules);

  const cardScores = scoreBoundHand(bound.cards).map((cardScore, index) => {
    const addedBy = bound.addedBy[cardScore.cardId];
    const report = bound.choices[cardScore.cardId];
    const { suit } = bound.cards[index];
    const original = cards.find(({ id }) => id === cardScore.cardId);

    return {
      ...cardScore,
      ...(addedBy !== undefined && { addedBy }),
      ...(original && original.suit !== suit && { suit }),
      ...(report && { choice: report }),
    };
  });

  const sum = (key: "base" | "bonus" | "penalty" | "total") =>
    cardScores.reduce((total, cardScore) => total + cardScore[key], 0);

  return {
    cards: cardScores,
    base: sum("base"),
    bonus: sum("bonus"),
    penalty: sum("penalty"),
    total: sum("total"),
  };
}

// Calculates the total score for a hand of cards
export function calculateScore(
  cards: readonly Card[],
  choices: Choices = {},
  rules: ChoiceRules = NO_CHOICE_RULES,
): number {
  return scoreHand(cards, choices, rules).total;
}
