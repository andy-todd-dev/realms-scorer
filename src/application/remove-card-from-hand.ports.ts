import { Card, CardId } from "../domain/card";
import { DeckId } from "../domain/deck";
import { Hand } from "../domain/hand";
import { Variant, VariantId } from "../domain/variant";

export interface Hands {
  get(): Hand;
  save(hand: Hand): void;
}

export interface CurrentVariant {
  get(): VariantId;
}

// Runs one change to the hand at a time, so overlapping changes can't overwrite each other.
export interface HandLock {
  runExclusive<T>(change: () => Promise<T>): Promise<T>;
}

export interface Rescore {
  execute(): Promise<void>;
}

export interface CardCatalog {
  // Every card in the deck, for choices from the discard area.
  getAll(deckId: DeckId): Promise<Card[]>;
  getByIds(deckId: DeckId, cardIds: readonly CardId[]): Promise<Card[]>;
}

export interface VariantCatalog {
  getById(variantId: VariantId): Promise<Variant>;
}

export interface RemoveCardFromHandPorts {
  hands: Hands;
  variant: CurrentVariant;
  handLock: HandLock;
  rescore: Rescore;
  cardCatalog: CardCatalog;
  variantCatalog: VariantCatalog;
}
