import { Card, CardId } from "../domain/card";
import { Hand } from "../domain/hand";
import { Variant } from "../domain/variant";
import { RemoveCardFromHandUseCase } from "./remove-card-from-hand.usecase";

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

  return new RemoveCardFromHandUseCase({
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

describe("RemoveCardFromHandUseCase", () => {
  it("removes the card, keeping the order of the rest", async () => {
    await expect(
      createUseCase(7).execute("variant", handOf("a", "b", "c"), "b"),
    ).resolves.toEqual(handOf("a", "c"));
  });

  it("drops the removed card's own choice", async () => {
    await expect(
      createUseCase(7).execute(
        "variant",
        { cardIds: ["adder", "a"], choices: { adder: { cardId: "army" } } },
        "adder",
      ),
    ).resolves.toEqual(handOf("a"));
  });

  it("keeps choices the removal leaves valid", async () => {
    const hand: Hand = {
      cardIds: ["adder", "a"],
      choices: { adder: { cardId: "army" } },
    };

    await expect(
      createUseCase(7).execute("variant", hand, "a"),
    ).resolves.toEqual({
      cardIds: ["adder"],
      choices: { adder: { cardId: "army" } },
    });
  });

  it("fails for an unknown variant", async () => {
    await expect(
      createUseCase(7).execute("unknown", handOf("a"), "a"),
    ).rejects.toThrow("Unknown variant: unknown");
  });
});
