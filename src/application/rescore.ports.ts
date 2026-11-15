import { Card, CardId } from "../domain/card";
import { DeckId } from "../domain/deck";
import { Hand } from "../domain/hand";
import { HandScore } from "../domain/score";
import { Variant, VariantId } from "../domain/variant";

export interface CurrentHand {
  get(): Hand;
}

// The score of the hand as it was last scored, or null when scoring it failed.
export interface LatestScore {
  save(score: HandScore | null): void;
}

export interface CurrentVariant {
  get(): VariantId;
}

export interface CardCatalog {
  // Every card in the deck, for choices from the discard area.
  getAll(deckId: DeckId): Promise<Card[]>;
  getByIds(deckId: DeckId, cardIds: readonly CardId[]): Promise<Card[]>;
}

export interface VariantCatalog {
  getById(variantId: VariantId): Promise<Variant>;
}

export interface RescorePorts {
  hands: CurrentHand;
  scores: LatestScore;
  variant: CurrentVariant;
  cardCatalog: CardCatalog;
  variantCatalog: VariantCatalog;
}
