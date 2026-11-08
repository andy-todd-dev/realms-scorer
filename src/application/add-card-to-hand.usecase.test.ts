import { Card, CardId } from "../domain/card";
import { Hand } from "../domain/hand";
import { Variant } from "../domain/variant";
import { AddCardToHandUseCase } from "./add-card-to-hand.usecase";

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

const createUseCase = (handSize: number) => {
  const variant: Variant = {
    id: "variant",
    name: "Variant",
    deckId: "deck",
    handSize,
    preScoring: ["adder"],
  };

  return new AddCardToHandUseCase({
    cardCatalog: {
      getAll: async () => deck,
      getByIds: async (_, cardIds) =>
        cardIds.map((id) => {
          const found = deck.find((deckCard) => deckCard.id === id);
          if (!found) {
            throw new Error(`Unknown card: ${id}`);
          }
          return found;
        }),
    },
    variantCatalog: {
      getById: async (variantId) => {
        if (variantId !== variant.id) {
          throw new Error(`Unknown variant: ${variantId}`);
        }
        return variant;
      },
    },
  });
};

const handOf = (...cardIds: CardId[]): Hand => ({ cardIds, choices: {} });

describe("AddCardToHandUseCase", () => {
  it("adds a card while the hand has room under the variant's hand size", async () => {
    await expect(
      createUseCase(2).execute("variant", handOf("a"), "b"),
    ).resolves.toEqual(handOf("a", "b"));
  });

  it("rejects a card when the hand is at the variant's hand size", async () => {
    await expect(
      createUseCase(2).execute("variant", handOf("a", "b"), "c"),
    ).rejects.toThrow("The hand is full, so c can't be added");
  });

  it("rejects a card that isn't in the variant's deck", async () => {
    await expect(
      createUseCase(2).execute("variant", handOf(), "unknown"),
    ).rejects.toThrow("Unknown card: unknown");
  });

  it("drops a choice from the discard area of the card added", async () => {
    await expect(
      createUseCase(7).execute(
        "variant",
        { cardIds: ["adder"], choices: { adder: "army" } },
        "army",
      ),
    ).resolves.toEqual(handOf("adder", "army"));
  });

  it("keeps choices the card leaves valid", async () => {
    const hand: Hand = { cardIds: ["adder"], choices: { adder: "army" } };

    await expect(
      createUseCase(7).execute("variant", hand, "a"),
    ).resolves.toEqual({ cardIds: ["adder", "a"], choices: { adder: "army" } });
  });

  it("fails for an unknown variant", async () => {
    await expect(
      createUseCase(2).execute("unknown", handOf(), "a"),
    ).rejects.toThrow("Unknown variant: unknown");
  });
});
