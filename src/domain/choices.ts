import {
  Card,
  CardAbility,
  CardChoice,
  CardEffect,
  CardId,
  CardMatcher,
  PreScoringEffect,
  TakenAttribute,
} from "./card";
import { matches, othersIn } from "./card-matching";

// The choices made for cards in a hand: each choosing card's ID, mapped to the ID of the card it chose.
export type Choices = Readonly<Record<CardId, CardId>>;

// What resolving found for a card with a choice: the card chosen, or null while pending, and the cards that may be chosen.
export type ChoiceReport = {
  readonly chosenId: CardId | null;
  readonly optionIds: readonly CardId[];
};

// The variant's rules and cards that choices need.
export type ChoiceRules = {
  // The variant's whole deck. A choice from the discard area may take those not in the hand, and a choice from the game any but the chooser.
  readonly deckCards: readonly Card[];
  // The cards whose pre-scoring effects fire, in this order.
  readonly preScoring: readonly CardId[];
};

export const NO_CHOICE_RULES: ChoiceRules = {
  deckCards: [],
  preScoring: [],
};

// Each card with a choice that has been checked, mapped to what checking found for it.
type ChoiceReports = Readonly<Record<CardId, ChoiceReport>>;

// The hand once pre-scoring effects have fired.
export type PreScoredHand = {
  // The cards in the hand, then any that pre-scoring effects added.
  readonly cards: readonly Card[];
  // Each card a pre-scoring effect added to the hand, mapped to the card whose effect added it.
  readonly addedBy: Readonly<Record<CardId, CardId>>;
  // The choices of the cards that fired, each checked at its place in the variant's order.
  readonly choices: ChoiceReports;
};

// The hand once every choice is bound: each effect on "the chosen card" targets the card chosen, or nothing while pending.
export type BoundHand = PreScoredHand & {
  // Every card with a choice.
  readonly choices: ChoiceReports;
};

// Returns the cards the chooser could take from where its choice looks, given the hand as it stands, before matching.
function candidatesFor(
  chooser: Card,
  kind: CardChoice["kind"],
  hand: readonly Card[],
  deckCards: readonly Card[],
): readonly Card[] {
  switch (kind) {
    case "cardInHand":
      return othersIn(hand, chooser);
    case "cardInDiscardArea":
      return deckCards.filter(
        (candidate) =>
          candidate.id !== chooser.id &&
          !hand.some((card) => card.id === candidate.id),
      );
    case "cardInGame":
      return deckCards.filter((candidate) => candidate.id !== chooser.id);
  }
}

// Returns the cards the chooser may choose, given the hand as it stands: other cards in it, cards in the discard area that aren't in it, or any other card in the game.
function choiceOptions(
  chooser: Card,
  hand: readonly Card[],
  deckCards: readonly Card[],
): readonly Card[] {
  const { choice } = chooser;

  if (!choice) {
    return [];
  }

  const candidates = candidatesFor(chooser, choice.kind, hand, deckCards);

  return candidates.filter((candidate) =>
    choice.from.some((matcher) => matches(candidate, matcher)),
  );
}

// The chosen card among the options, or undefined while pending. A choice that no longer fits the hand counts as pending: it is never replaced with another.
function chosenCard(
  chooser: Card,
  options: readonly Card[],
  choices: Choices,
): Card | undefined {
  const targetId = choices[chooser.id];

  return options.find(({ id }) => id === targetId);
}

// Replaces a matcher for the chosen card with the chosen card's ID. While the choice is pending, it is dropped, so it targets nothing.
function resolveMatchers(
  matchers: readonly CardMatcher[],
  chosenId: CardId | null,
): readonly CardMatcher[] {
  return matchers.flatMap((matcher): readonly CardMatcher[] => {
    if (!("chosen" in matcher)) {
      return [matcher];
    }

    return chosenId === null ? [] : [{ cardId: chosenId }];
  });
}

// Resolves the chosen card in an effect's targets. Only targets can name the chosen card so far; add other places here as cards need them.
function resolveEffect(
  effect: CardEffect,
  chosenId: CardId | null,
): CardEffect {
  if (effect.kind === "blank" || effect.kind === "clearPenalty") {
    return { ...effect, targets: resolveMatchers(effect.targets, chosenId) };
  }

  if (effect.kind === "clearPenaltySuitWord" && effect.targets) {
    return { ...effect, targets: resolveMatchers(effect.targets, chosenId) };
  }

  return effect;
}

function resolveAbility(
  ability: CardAbility | undefined,
  chosenId: CardId | null,
): CardAbility | undefined {
  return (
    ability && {
      ...ability,
      effects: ability.effects.map((effect) => resolveEffect(effect, chosenId)),
    }
  );
}

function withChosenCardResolved(card: Card, chosenId: CardId | null): Card {
  const { bonus, penalty, ...rest } = card;
  const resolvedBonus = resolveAbility(bonus, chosenId);
  const resolvedPenalty = resolveAbility(penalty, chosenId);

  return {
    ...rest,
    ...(resolvedBonus && { bonus: resolvedBonus }),
    ...(resolvedPenalty && { penalty: resolvedPenalty }),
  };
}

// Checks a card's choice against the hand as it stands.
function checkChoice(
  chooser: Card,
  hand: readonly Card[],
  choices: Choices,
  deckCards: readonly Card[],
): { report: ChoiceReport; chosen: Card | undefined } {
  const options = choiceOptions(chooser, hand, deckCards);
  const chosen = chosenCard(chooser, options, choices);

  return {
    report: {
      chosenId: chosen?.id ?? null,
      optionIds: options.map(({ id }) => id),
    },
    chosen,
  };
}

// The card with the listed attributes taken from another. Taking the name makes rules naming the other card match this one.
function withAttributesTaken(
  card: Card,
  from: Card,
  attributes: readonly TakenAttribute[],
): Card {
  return attributes.reduce((taker, attribute): Card => {
    switch (attribute) {
      case "name":
        return { ...taker, name: from.name, namedAs: from.id };
      case "suit":
        return { ...taker, suit: from.suit };
    }
  }, card);
}

// What one pre-scoring effect does to the hand. New kinds, such as changing a suit, go here.
function fireEffect(
  state: PreScoredHand,
  effect: PreScoringEffect,
  card: Card,
  chosen: Card | undefined,
): PreScoredHand {
  switch (effect.kind) {
    case "take":
      return chosen
        ? {
            ...state,
            cards: state.cards.map((other) =>
              other.id === card.id
                ? withAttributesTaken(other, chosen, effect.attributes)
                : other,
            ),
          }
        : state;
    case "addToHand":
      return chosen && !state.cards.some(({ id }) => id === chosen.id)
        ? {
            ...state,
            cards: [...state.cards, chosen],
            addedBy: { ...state.addedBy, [chosen.id]: card.id },
          }
        : state;
  }
}

// One listed card's turn: check its choice against the hand so far, then fire its pre-scoring effects in order.
function fireCard(
  state: PreScoredHand,
  card: Card,
  choices: Choices,
  deckCards: readonly Card[],
): PreScoredHand {
  const checked = card.choice
    ? checkChoice(card, state.cards, choices, deckCards)
    : undefined;
  const withReport = checked
    ? { ...state, choices: { ...state.choices, [card.id]: checked.report } }
    : state;

  return (card.preScoring ?? []).reduce(
    (current, effect) => fireEffect(current, effect, card, checked?.chosen),
    withReport,
  );
}

/*
  Fires the pre-scoring effects of the cards the variant lists, in its order. Each listed card in the hand with
  pre-scoring effects has its choice checked against the hand as the cards before it left it, then fires them with the
  card chosen. Pre-scoring effects of cards the variant doesn't list never fire, and a card listed twice fires once.
*/
export function firePreScoring(
  cards: readonly Card[],
  choices: Choices,
  { deckCards, preScoring }: ChoiceRules,
): PreScoredHand {
  const start: PreScoredHand = { cards, addedBy: {}, choices: {} };

  return [...new Set(preScoring)].reduce((state, cardId) => {
    const card = state.cards.find(({ id }) => id === cardId);

    return card?.preScoring ? fireCard(state, card, choices, deckCards) : state;
  }, start);
}

/*
  Checks every other choice against the hand pre-scoring left, then binds each card's effects on "the chosen card" to
  the card chosen. This only fills in the chosen cards: nothing takes effect here. A pending choice, or one that no
  longer fits, targets nothing.
*/
export function bindChoices(
  preScored: PreScoredHand,
  choices: Choices,
  { deckCards }: ChoiceRules,
): BoundHand {
  const reports: ChoiceReports = {
    ...preScored.choices,
    ...Object.fromEntries(
      preScored.cards
        .filter((card) => card.choice && !preScored.choices[card.id])
        .map((card) => [
          card.id,
          checkChoice(card, preScored.cards, choices, deckCards).report,
        ]),
    ),
  };

  return {
    ...preScored,
    cards: preScored.cards.map((card) =>
      card.choice
        ? withChosenCardResolved(card, reports[card.id]?.chosenId ?? null)
        : card,
    ),
    choices: reports,
  };
}

// Fires pre-scoring, then binds the choices, as scoring does.
function resolveChoices(
  cards: readonly Card[],
  choices: Choices,
  rules: ChoiceRules,
): BoundHand {
  return bindChoices(firePreScoring(cards, choices, rules), choices, rules);
}

// Checks if the chooser, a card in the hand, may choose the target, given the hand and the other choices made.
export function isValidChoice(
  chooserId: CardId,
  targetId: CardId,
  cards: readonly Card[],
  choices: Choices,
  rules: ChoiceRules,
): boolean {
  return (
    cards.some(({ id }) => id === chooserId) &&
    (resolveChoices(cards, choices, rules).choices[
      chooserId
    ]?.optionIds.includes(targetId) ??
      false)
  );
}

/*
  Keeps only the choices that still fit the hand, checked as scoring checks them, so that commands can keep the stored
  choices valid. A choice is dropped when its card isn't in the hand, or its chosen card no longer fits: removed from the
  hand, added to it from the discard area, or brought in by another choice that changed. A dropped choice is pending,
  and never comes back by itself.
*/
export function withInvalidChoicesDropped(
  cards: readonly Card[],
  choices: Choices,
  rules: ChoiceRules,
): Choices {
  const { choices: reports } = resolveChoices(cards, choices, rules);

  return Object.fromEntries(
    Object.entries(choices).filter(
      ([chooserId, targetId]) =>
        cards.some(({ id }) => id === chooserId) &&
        reports[chooserId]?.chosenId === targetId,
    ),
  );
}
