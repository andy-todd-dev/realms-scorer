import { Card, CardId } from "../domain/card";
import { Hand } from "../domain/hand";
import { Variant } from "../domain/variant";
import { ReplaceHandUseCase } from "./replace-hand.usecase";

const card = (id: string, suit: Card["suit"]): Card => ({
  id,
  name: id,
  suit,
  baseStrength: 1,
});

// Clears the penalty on a Flood in the hand of the player's choice.
const island: Card = {
  ...card("island", "flood"),
  choice: { kind: "cardInHand", from: [{ suit: "flood" }] },
};
const deck = [island, card("swamp", "flood"), card("a", "land")];

const variant: Variant = {
  id: "variant",
  name: "Variant",
  deckId: "deck",
  handSize: 2,
  preScoring: [],
};

const useCase = new ReplaceHandUseCase({
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
  variantCatalog: { getById: async () => variant },
});

const handOf = (...cardIds: CardId[]): Hand => ({ cardIds, choices: {} });

describe("ReplaceHandUseCase", () => {
  it("makes a hand of just the given cards", async () => {
    await expect(useCase.execute("variant", ["a", "swamp"])).resolves.toEqual(
      handOf("a", "swamp"),
    );
  });

  it("leaves a card that needs a choice pending", async () => {
    await expect(
      useCase.execute("variant", ["island", "swamp"]),
    ).resolves.toEqual(handOf("island", "swamp"));
  });

  it("takes each card once", async () => {
    await expect(useCase.execute("variant", ["a", "a"])).resolves.toEqual(
      handOf("a"),
    );
  });

  it("rejects more cards than the variant's hand size", async () => {
    await expect(
      useCase.execute("variant", ["a", "swamp", "island"]),
    ).rejects.toThrow("The hand is full, so island can't be added");
  });

  it("rejects a card that isn't in the variant's deck", async () => {
    await expect(useCase.execute("variant", ["unknown"])).rejects.toThrow(
      "Unknown card: unknown",
    );
  });
});
