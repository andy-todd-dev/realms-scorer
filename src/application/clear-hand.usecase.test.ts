import { Card } from "../domain/card";
import { Variant } from "../domain/variant";
import { ClearHandUseCase } from "./clear-hand.usecase";
import { catalogOf, handState } from "./testing/hand-state";

const island: Card = {
  id: "island",
  name: "Island",
  suit: "flood",
  baseStrength: 14,
  choice: { kind: "cardInHand", from: [{ suit: "flood" }] },
};
const swamp: Card = {
  id: "swamp",
  name: "Swamp",
  suit: "flood",
  baseStrength: 18,
};
const variant: Variant = {
  id: "variant",
  name: "Variant",
  deckId: "deck",
  handSize: 7,
  preScoring: [],
};

describe("ClearHandUseCase", () => {
  it("empties the hand, with its choices, and rescores it", async () => {
    const { hands, scores, ports } = handState({
      cardCatalog: catalogOf([island, swamp]),
      variant,
      hand: {
        cardIds: ["island", "swamp"],
        choices: { island: { cardId: "swamp" } },
      },
    });

    await new ClearHandUseCase(ports).execute();

    expect(hands.get()).toEqual({ cardIds: [], choices: {} });
    expect(scores.get()).toMatchObject({ total: 0 });
  });
});
