import { CardId } from "./card";
import { DeckId } from "./deck";

export type VariantId = string;

// A way of playing the game: the cards it uses, and the rules that differ between variants.
export type Variant = {
  readonly id: VariantId;
  readonly name: string;
  readonly deckId: DeckId;
  // The most cards the player can put in the hand. Cards an effect adds to the hand during scoring don't count towards it.
  readonly handSize: number;
  // The cards whose pre-scoring effects fire, in this order, before anything else in scoring. Each sees the hand as the cards before it left it. A card left out never fires its pre-scoring effects.
  readonly preScoring: readonly CardId[];
};
