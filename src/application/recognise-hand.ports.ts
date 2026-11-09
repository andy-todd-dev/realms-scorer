import { Card, CardId } from "../domain/card";
import { DeckId } from "../domain/deck";
import { Variant, VariantId } from "../domain/variant";

export interface CardCatalog {
  getAll(deckId: DeckId): Promise<Card[]>;
}

export interface VariantCatalog {
  getById(variantId: VariantId): Promise<Variant>;
}

// A card the recognizer could find in a photo.
export type NamedCard = { readonly id: CardId; readonly name: string };

// A card found in a photo: the card itself when the recognizer is sure, or the cards it most likely is, best first.
export type CardMatch = {
  readonly candidates: readonly CardId[];
  readonly confident: boolean;
};

export interface CardRecognizer {
  // Finds which of the cards are in the photo, at most maxCards of them.
  recognise(
    imageUri: string,
    cards: readonly NamedCard[],
    maxCards: number,
  ): Promise<CardMatch[]>;
}

export interface RecogniseHandPorts {
  cardCatalog: CardCatalog;
  cardRecognizer: CardRecognizer;
  variantCatalog: VariantCatalog;
}
