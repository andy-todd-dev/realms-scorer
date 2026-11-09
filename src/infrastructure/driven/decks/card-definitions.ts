import type {
  Card,
  CardChoice,
  CardEffect,
  CardIdMatcher,
  CardMatcher,
  ChosenCardMatcher,
  ChosenSuitMatcher,
  EffectCondition,
  PreScoringEffect,
  Suit,
  TakenAttribute,
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

// Every suit, Wild included. Add any new suit here.
export const allSuitNames: readonly Suit[] = [
  "army",
  "leader",
  "wizard",
  "weapon",
  "artifact",
  "beast",
  "land",
  "weather",
  "flood",
  "flame",
  "wild",
];

// Every card has exactly one suit, so this reaches every card.
export const allSuits: readonly CardMatcher[] = allSuitNames.map(suit);

// The card the player chose for the card with this effect. The card needs a choice, made with chooseCard.
export const chosenCard: ChosenCardMatcher = { chosen: true };

// The suit the player chose for the card with this effect. The card needs a choice that includes a suit, made with andSuit.
export const chosenSuit: ChosenSuitMatcher = { chosenSuit: true };

// Where a choice takes its card from, for chooseCard.
type ChoiceSource = CardChoice["kind"];

// Another card in the hand.
export const fromHand: ChoiceSource = "cardInHand";

// A card from the discard area, which joins the hand before scoring.
export const fromDiscardArea: ChoiceSource = "cardInDiscardArea";

// Any other card in the game, in the hand or not.
export const fromGame: ChoiceSource = "cardInGame";

// A choice of a card from the source, matching any of the matchers.
export const chooseCard = (
  source: ChoiceSource,
  ...from: CardMatcher[]
): CardChoice => ({ kind: source, from });

// A choice that also has the player choose one of these suits for the chosen card, less the suit it already has.
export const andSuit = (choice: CardChoice, ...suits: Suit[]): CardChoice => ({
  ...choice,
  suits,
});

// A pre-scoring effect that adds the chosen card to the hand. The card needs a choice, made with chooseCard, and the variant must list it for pre-scoring, or it never fires.
export const addToHand = (card: ChosenCardMatcher): PreScoringEffect => ({
  kind: "addToHand",
  card,
});

// A pre-scoring effect that takes the listed attributes of the chosen card, keeping everything else the card's own. The card needs a choice, made with chooseCard, and the variant must list it for pre-scoring, or it never fires.
export const take = (
  from: ChosenCardMatcher,
  ...attributes: TakenAttribute[]
): PreScoringEffect => ({ kind: "take", from, attributes });

// A pre-scoring effect that gives the chosen card the chosen suit, keeping everything else its own. The card needs a choice made with chooseCard and andSuit, and the variant must list it for pre-scoring, or it never fires.
export const give = (
  to: ChosenCardMatcher,
  suit: ChosenSuitMatcher,
): PreScoringEffect => ({ kind: "give", to, suit });

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

// For each suit, the points of the highest tier its number of differently named cards reaches, counting the owner.
export const sameSuitSet = (
  tiers: readonly { count: number; points: number }[],
): CardEffect => ({ kind: "sameSuitSet", tiers });

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
