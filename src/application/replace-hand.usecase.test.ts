import { Card, CardId } from "../domain/card";
import { Hand } from "../domain/hand";
import { Variant } from "../domain/variant";
import { ReplaceHandUseCase } from "./replace-hand.usecase";
import { catalogOf, handState } from "./testing/hand-state";

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

const handOf = (...cardIds: CardId[]): Hand => ({ cardIds, choices: {} });

function setUp(hand = handOf()) {
  const state = handState({ cardCatalog: catalogOf(deck), variant, hand });

  return { ...state, useCase: new ReplaceHandUseCase(state.ports) };
}

describe("ReplaceHandUseCase", () => {
  it("makes a hand of just the given cards, and rescores it", async () => {
    const { hands, scores, useCase } = setUp(handOf("island"));

    await useCase.execute(["a", "swamp"]);

    expect(hands.get()).toEqual(handOf("a", "swamp"));
    expect(scores.get()).toMatchObject({ total: 2 });
  });

  it("leaves a card that needs a choice pending", async () => {
    const { hands, useCase } = setUp({
      cardIds: ["island", "swamp"],
      choices: { island: { cardId: "swamp" } },
    });

    await useCase.execute(["island", "swamp"]);

    expect(hands.get()).toEqual(handOf("island", "swamp"));
  });

  it("takes each card once", async () => {
    const { hands, useCase } = setUp();

    await useCase.execute(["a", "a"]);

    expect(hands.get()).toEqual(handOf("a"));
  });

  it("rejects more cards than the variant's hand size, leaving the hand as it was", async () => {
    const { hands, useCase } = setUp(handOf("a"));

    await expect(useCase.execute(["a", "swamp", "island"])).rejects.toThrow(
      "The hand is full, so island can't be added",
    );
    expect(hands.get()).toEqual(handOf("a"));
  });

  it("rejects a card that isn't in the variant's deck", async () => {
    const { useCase } = setUp();

    await expect(useCase.execute(["unknown"])).rejects.toThrow(
      "Unknown card: unknown",
    );
  });
});
