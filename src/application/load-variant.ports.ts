import { Card } from "../domain/card";
import { DeckId } from "../domain/deck";
import { Variant, VariantId } from "../domain/variant";
import type { LoadedVariant } from "./load-variant.usecase";

// The variant the player is playing, which the app starts with a default for.
export interface CurrentVariant {
  get(): VariantId;
}

// How far loading the current variant has got, with what the UI shows of it once loaded.
export interface LoadedVariantStore {
  save(loaded: LoadedVariant): void;
}

export interface Rescore {
  execute(): Promise<void>;
}

export interface CardCatalog {
  getAll(deckId: DeckId): Promise<Card[]>;
}

export interface VariantCatalog {
  getById(variantId: VariantId): Promise<Variant>;
}

export interface LoadVariantPorts {
  variant: CurrentVariant;
  loadedVariant: LoadedVariantStore;
  rescore: Rescore;
  cardCatalog: CardCatalog;
  variantCatalog: VariantCatalog;
}
