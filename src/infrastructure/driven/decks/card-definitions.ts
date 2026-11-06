import type {
  Card,
  CardChoice,
  CardEffect,
  CardIdMatcher,
  CardMatcher,
  ChosenCardMatcher,
  EffectCondition,
  Suit,
  SuitMatcher,
} from "../../../domain/card";

export type CardDefinition = Omit<Card, "id">;

export const suit = (suitName: Suit): SuitMatcher => ({ suit: suitName });

export const except = (
  matcher: SuitMatcher,
  ...cards: CardIdMatcher[]
): SuitMatcher => ({
  ...matcher,
  except: [...(matcher.except ?? []), ...cards.map(({ cardId }) => cardId)],
});

// Every card has exactly one suit, so this reaches every card. Add any new suit here.
export const allSuits: readonly CardMatcher[] = [
  suit("army"),
  suit("leader"),
  suit("wizard"),
  suit("weapon"),
  suit("artifact"),
  suit("beast"),
  suit("land"),
  suit("weather"),
  suit("flood"),
  suit("flame"),
  suit("wild"),
];

// The card the player chose for the card with this effect. The card needs a choice, such as chooseCardInHand.
export const chosenCard: ChosenCardMatcher = { chosen: true };

// A choice of another card in the hand, matching any of the matchers.
export const chooseCardInHand = (...from: CardMatcher[]): CardChoice => ({
  kind: "cardInHand",
  from,
});

export const present = (matcher: CardMatcher): EffectCondition => ({
  present: matcher,
});

export const absent = (matcher: CardMatcher): EffectCondition => ({
  absent: matcher,
});

export const allOf = (...conditions: EffectCondition[]): EffectCondition => ({
  allOf: conditions,
});

export const anyOf = (...conditions: EffectCondition[]): EffectCondition => ({
  anyOf: conditions,
});

export const allSuitsDifferent: EffectCondition = { allSuitsDifferent: true };

export const points = (
  amount: number,
  options: { per?: CardMatcher; when?: EffectCondition } = {},
): CardEffect => ({ kind: "points", points: amount, ...options });

export const sum = (
  of: CardMatcher,
  attribute: "baseStrength",
): CardEffect => ({ kind: "sum", of, attribute });

export const baseStrengthRun = (
  tiers: readonly { length: number; points: number }[],
): CardEffect => ({ kind: "baseStrengthRun", tiers });

export const blank = (...targets: CardMatcher[]): CardEffect => ({
  kind: "blank",
  targets,
});

export const blankSelf = ({ when }: { when: EffectCondition }): CardEffect => ({
  kind: "blankSelf",
  when,
});

export const clearPenalty = (...targets: CardMatcher[]): CardEffect => ({
  kind: "clearPenalty",
  targets,
});

// With no targets, this clears the word from every other card's penalties.
export const clearPenaltySuitWord = (
  suitName: Suit,
  ...targets: CardMatcher[]
): CardEffect => ({
  kind: "clearPenaltySuitWord",
  suit: suitName,
  ...(targets.length > 0 && { targets }),
});
