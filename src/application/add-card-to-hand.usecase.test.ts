import { Mutex } from "async-mutex";
import { Card, CardId } from "../domain/card";
import { Hand } from "../domain/hand";
import { HandScore } from "../domain/score";
import { Variant, VariantId } from "../domain/variant";
import { AddCardToHandUseCase } from "./add-card-to-hand.usecase";
import { RescoreUseCase } from "./rescore.usecase";
import { InMemoryStore } from "./testing/in-memory-store";

const card = (id: string, suit: Card["suit"]): Card => ({
  id,
  name: id,
  suit,
  baseStrength: 1,
});

// Before scoring, takes one Army from the discard area into the hand.
const adder: Card = {
  ...card("adder", "wizard"),
  preScoring: [{ kind: "addToHand", card: { chosen: true } }],
  choice: { kind: "cardInDiscardArea", from: [{ suit: "army" }] },
};
const deck = [
  adder,
  card("army", "army"),
  card("a", "land"),
  card("b", "land"),
  card("c", "land"),
];

const handOf = (...cardIds: CardId[]): Hand => ({ cardIds, choices: {} });

// Holds the hand, variant and score in memory, and adds cards from the deck to a hand of the given size.
function setUp({
  hand = handOf(),
  handSize = 7,
  variantId = "variant",
}: { hand?: Hand; handSize?: number; variantId?: VariantId } = {}) {
  const variant: Variant = {
    id: "variant",
    name: "Variant",
    deckId: "deck",
    handSize,
    preScoring: ["adder"],
  };
  const catalogs = {
    cardCatalog: {
      getAll: async () => deck,
      getByIds: async (_: string, cardIds: readonly CardId[]) =>
        cardIds.map((id) => {
          const found = deck.find((deckCard) => deckCard.id === id);
          if (!found) {
            throw new Error(`Unknown card: ${id}`);
          }
          return found;
        }),
    },
    variantCatalog: {
      getById: async (id: VariantId) => {
        if (id !== variant.id) {
          throw new Error(`Unknown variant: ${id}`);
        }
        return variant;
      },
    },
  };
  const hands = new InMemoryStore(hand);
  const scores = new InMemoryStore<HandScore | null>(null);
  const currentVariant = new InMemoryStore(variantId);
  const rescore = new RescoreUseCase({
    hands,
    scores,
    variant: currentVariant,
    ...catalogs,
  });
  const useCase = new AddCardToHandUseCase({
    hands,
    variant: currentVariant,
    handLock: new Mutex(),
    rescore,
    ...catalogs,
  });

  return { hands, scores, useCase };
}

describe("AddCardToHandUseCase", () => {
  it("adds the card to the hand and rescores it", async () => {
    const { hands, scores, useCase } = setUp({ hand: handOf("a") });

    await useCase.execute("b");

    expect(hands.get()).toEqual(handOf("a", "b"));
    expect(scores.get()).toMatchObject({ total: 2 });
  });

  it("keeps both cards when two are added at once", async () => {
    const { hands, useCase } = setUp();

    await Promise.all([useCase.execute("a"), useCase.execute("b")]);

    expect(hands.get()).toEqual(handOf("a", "b"));
  });

  it("rejects a card when the hand is at the variant's hand size, leaving the hand and score as they were", async () => {
    const { hands, scores, useCase } = setUp({
      hand: handOf("a", "b"),
      handSize: 2,
    });

    await expect(useCase.execute("c")).rejects.toThrow(
      "The hand is full, so c can't be added",
    );
    expect(hands.get()).toEqual(handOf("a", "b"));
    expect(scores.get()).toBeNull();
  });

  it("rejects a card that isn't in the variant's deck", async () => {
    const { hands, useCase } = setUp();

    await expect(useCase.execute("unknown")).rejects.toThrow(
      "Unknown card: unknown",
    );
    expect(hands.get()).toEqual(handOf());
  });

  it("drops a choice from the discard area of the card added", async () => {
    const { hands, useCase } = setUp({
      hand: { cardIds: ["adder"], choices: { adder: { cardId: "army" } } },
    });

    await useCase.execute("army");

    expect(hands.get()).toEqual(handOf("adder", "army"));
  });

  it("keeps choices the card leaves valid", async () => {
    const { hands, useCase } = setUp({
      hand: { cardIds: ["adder"], choices: { adder: { cardId: "army" } } },
    });

    await useCase.execute("a");

    expect(hands.get()).toEqual({
      cardIds: ["adder", "a"],
      choices: { adder: { cardId: "army" } },
    });
  });

  it("fails for an unknown variant", async () => {
    const { useCase } = setUp({ variantId: "unknown" });

    await expect(useCase.execute("a")).rejects.toThrow(
      "Unknown variant: unknown",
    );
  });

  it("lets the next change run after one fails", async () => {
    const { hands, useCase } = setUp({ hand: handOf("a"), handSize: 2 });

    await expect(useCase.execute("unknown")).rejects.toThrow();
    await useCase.execute("b");

    expect(hands.get()).toEqual(handOf("a", "b"));
  });
});
