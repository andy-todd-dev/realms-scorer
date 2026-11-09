import {
  Card,
  CardAbility,
  CardChoice,
  CardEffect,
  CardId,
  CardMatcher,
  PreScoringEffect,
  Suit,
  TakenAttribute,
} from "./card";
import { matches, othersIn } from "./card-matching";

// A choice made for a card: the card chosen, and the suit chosen for it, for a choice that includes a suit.
export type Choice = {
  readonly cardId: CardId;
  readonly suit?: Suit;
};

// The choices made for cards in a hand: each choosing card's ID, mapped to its choice.
export type Choices = Readonly<Record<CardId, Choice>>;

/*
  What resolving found for a card with a choice: the card chosen, or null while pending, and the cards that may be
  chosen. A choice that includes a suit also reports the suit chosen, and the suits each option may be given, which
  leave out the suit it has. It is pending, with neither chosen, until both are made.
*/
export type ChoiceReport = {
  readonly chosenId: CardId | null;
  readonly optionIds: readonly CardId[];
  readonly chosenSuit?: Suit | null;
  readonly suitOptions?: Readonly<Record<CardId, readonly Suit[]>>;
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

// The suits each option may be given, for a choice that includes a suit: the choice's suits, less the option's own.
function suitOptionsFor(
  suits: readonly Suit[],
  options: readonly Card[],
): Readonly<Record<CardId, readonly Suit[]>> {
  return Object.fromEntries(
    options.map((option) => [
      option.id,
      suits.filter((suit) => suit !== option.suit),
    ]),
  );
}

/*
  The chosen card among the options, and the suit chosen for it, or undefined while pending. A choice that no longer
  fits the hand counts as pending: it is never replaced with another. For a choice that includes a suit, the suit must be
  one the card may be given; for any other, no suit may be given.
*/
function chosenCard(
  chooser: Card,
  options: readonly Card[],
  suitOptions: Readonly<Record<CardId, readonly Suit[]>> | undefined,
  choices: Choices,
): { card: Card; suit: Suit | undefined } | undefined {
  const choice = choices[chooser.id];
  const card = options.find(({ id }) => id === choice?.cardId);

  if (!card || !choice) {
    return undefined;
  }

  const suitFits = suitOptions
    ? choice.suit !== undefined && suitOptions[card.id].includes(choice.suit)
    : choice.suit === undefined;

  return suitFits ? { card, suit: choice.suit } : undefined;
}

// Fills in the chosen card's ID in a matcher for the chosen card. While the choice is pending, it is dropped, so it targets nothing.
function resolveMatchers(
  matchers: readonly CardMatcher[],
  chosenId: CardId | null,
): readonly CardMatcher[] {
  return matchers.flatMap((matcher): readonly CardMatcher[] => {
    if (!("chosen" in matcher)) {
      return [matcher];
    }

    return chosenId === null ? [] : [{ chosen: true, id: chosenId }];
  });
}

// Resolves the chosen card in an effect's targets, or in what a sum adds up. Add other places here as cards need them.
function resolveEffect(
  effect: CardEffect,
  chosenId: CardId | null,
): CardEffect {
  // While pending, the matcher stays unresolved, so the sum matches nothing.
  if (effect.kind === "sum" && "chosen" in effect.of && chosenId !== null) {
    return { ...effect, of: { chosen: true, id: chosenId } };
  }

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
): {
  report: ChoiceReport;
  chosen: Card | undefined;
  chosenSuit: Suit | undefined;
} {
  const options = choiceOptions(chooser, hand, deckCards);
  const suits = chooser.choice?.suits;
  const suitOptions = suits && suitOptionsFor(suits, options);
  const chosen = chosenCard(chooser, options, suitOptions, choices);

  return {
    report: {
      chosenId: chosen?.card.id ?? null,
      optionIds: options.map(({ id }) => id),
      ...(suitOptions && { chosenSuit: chosen?.suit ?? null, suitOptions }),
    },
    chosen: chosen?.card,
    chosenSuit: chosen?.suit,
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
      case "baseStrength":
        return { ...taker, baseStrength: from.baseStrength };
      case "penalty": {
        const { penalty: _ownPenalty, ...rest } = taker;

        return from.penalty ? { ...rest, penalty: from.penalty } : rest;
      }
    }
  }, card);
}

// What one pre-scoring effect does to the hand. New kinds go here.
function fireEffect(
  state: PreScoredHand,
  effect: PreScoringEffect,
  card: Card,
  chosen: Card | undefined,
  chosenSuit: Suit | undefined,
): PreScoredHand {
  switch (effect.kind) {
    case "give":
      return chosen && chosenSuit
        ? {
            ...state,
            cards: state.cards.map((other) =>
              other.id === chosen.id ? { ...other, suit: chosenSuit } : other,
            ),
          }
        : state;
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
    (current, effect) =>
      fireEffect(current, effect, card, checked?.chosen, checked?.chosenSuit),
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

/*
  Checks if the chooser, a card in the hand, may make the choice, given the hand and the other choices made. A choice
  that includes a suit needs a suit the chosen card may be given, and any other choice needs no suit.
*/
export function isValidChoice(
  chooserId: CardId,
  { cardId, suit }: Choice,
  cards: readonly Card[],
  choices: Choices,
  rules: ChoiceRules,
): boolean {
  const report = cards.some(({ id }) => id === chooserId)
    ? resolveChoices(cards, choices, rules).choices[chooserId]
    : undefined;

  if (!report?.optionIds.includes(cardId)) {
    return false;
  }

  return report.suitOptions
    ? suit !== undefined && report.suitOptions[cardId].includes(suit)
    : suit === undefined;
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
      ([chooserId, { cardId, suit }]) =>
        cards.some(({ id }) => id === chooserId) &&
        reports[chooserId]?.chosenId === cardId &&
        (reports[chooserId]?.chosenSuit ?? undefined) === suit,
    ),
  );
}
