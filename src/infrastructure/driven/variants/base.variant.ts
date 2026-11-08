import type { Variant } from "../../../domain/variant";
import { BASE_DECK, BaseCardId } from "../decks/base.cards";

// The variant's own fields, with the cards it lists for pre-scoring checked against the base deck.
type BaseVariant = Variant & { readonly preScoring: readonly BaseCardId[] };

export const BASE_VARIANT: BaseVariant = {
  id: "base",
  name: "Base game",
  deckId: BASE_DECK.id,
  handSize: 7,
  preScoring: [
    "necromancer",
    "doppelganger",
    "mirage",
    "shapeshifter",
    "book-of-changes",
  ],
};
