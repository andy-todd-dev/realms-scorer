import { Card, CardId } from "../domain/card";
import { DeckId } from "../domain/deck";
import { Variant, VariantId } from "../domain/variant";

export interface CardCatalog {
  // Every card in the deck, for choices from the discard area.
  getAll(deckId: DeckId): Promise<Card[]>;
  getByIds(deckId: DeckId, cardIds: readonly CardId[]): Promise<Card[]>;
}

export interface VariantCatalog {
  getById(variantId: VariantId): Promise<Variant>;
}

export interface RemoveCardFromHandPorts {
  cardCatalog: CardCatalog;
  variantCatalog: VariantCatalog;
}
