import { Mutex } from "async-mutex";
import { Card, CardId } from "../../domain/card";
import { emptyHand, Hand } from "../../domain/hand";
import { HandScore } from "../../domain/score";
import { Variant, VariantId } from "../../domain/variant";
import { RescoreUseCase } from "../rescore.usecase";
import { InMemoryStore } from "./in-memory-store";

type CardCatalog = {
  getAll(deckId: string): Promise<Card[]>;
  getByIds(deckId: string, cardIds: readonly CardId[]): Promise<Card[]>;
};

// Serves these cards as every deck, failing for a card that isn't among them.
export const catalogOf = (cards: readonly Card[]): CardCatalog => ({
  getAll: async () => [...cards],
  getByIds: async (_, cardIds) =>
    cardIds.map((id) => {
      const found = cards.find((card) => card.id === id);
      if (!found) {
        throw new Error(`Unknown card: ${id}`);
      }
      return found;
    }),
});

/*
  What the use cases that change the hand need, held in memory: the hand, the current variant and the latest score,
  one lock, and the real Rescore, so a test can check the whole change. Only the variant given is known.
*/
export function handState({
  cardCatalog,
  variant,
  hand = emptyHand(),
  variantId = variant.id,
}: {
  cardCatalog: CardCatalog;
  variant: Variant;
  hand?: Hand;
  variantId?: VariantId;
}) {
  const hands = new InMemoryStore(hand);
  const scores = new InMemoryStore<HandScore | null>(null);
  const currentVariant = new InMemoryStore(variantId);
  const variantCatalog = {
    getById: async (id: VariantId) => {
      if (id !== variant.id) {
        throw new Error(`Unknown variant: ${id}`);
      }
      return variant;
    },
  };
  const rescore = new RescoreUseCase({
    hands,
    scores,
    variant: currentVariant,
    cardCatalog,
    variantCatalog,
  });

  return {
    hands,
    scores,
    ports: {
      hands,
      variant: currentVariant,
      handLock: new Mutex(),
      rescore,
      cardCatalog,
      variantCatalog,
    },
  };
}
