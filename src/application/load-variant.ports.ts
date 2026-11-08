import { Card } from "../domain/card";
import { DeckId } from "../domain/deck";
import { Variant, VariantId } from "../domain/variant";

export interface CardCatalog {
  getAll(deckId: DeckId): Promise<Card[]>;
}

export interface VariantCatalog {
  getById(variantId: VariantId): Promise<Variant>;
}

export interface LoadVariantPorts {
  cardCatalog: CardCatalog;
  variantCatalog: VariantCatalog;
}
