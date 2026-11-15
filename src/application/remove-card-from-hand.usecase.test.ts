import { Card, CardId } from "../domain/card";
import { Hand } from "../domain/hand";
import { Variant } from "../domain/variant";
import { RemoveCardFromHandUseCase } from "./remove-card-from-hand.usecase";
import { catalogOf, handState } from "./testing/hand-state";

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
const variant: Variant = {
  id: "variant",
  name: "Variant",
  deckId: "deck",
  handSize: 7,
  preScoring: ["adder"],
};

const handOf = (...cardIds: CardId[]): Hand => ({ cardIds, choices: {} });

function setUp(hand: Hand, variantId = variant.id) {
  const state = handState({
    cardCatalog: catalogOf(deck),
    variant,
    hand,
    variantId,
  });

  return { ...state, useCase: new RemoveCardFromHandUseCase(state.ports) };
}

describe("RemoveCardFromHandUseCase", () => {
  it("removes the card, keeping the order of the rest, and rescores", async () => {
    const { hands, scores, useCase } = setUp(handOf("a", "b", "c"));

    await useCase.execute("b");

    expect(hands.get()).toEqual(handOf("a", "c"));
    expect(scores.get()).toMatchObject({ total: 2 });
  });

  it("drops the removed card's own choice", async () => {
    const { hands, useCase } = setUp({
      cardIds: ["adder", "a"],
      choices: { adder: { cardId: "army" } },
    });

    await useCase.execute("adder");

    expect(hands.get()).toEqual(handOf("a"));
  });

  it("keeps choices the removal leaves valid", async () => {
    const { hands, useCase } = setUp({
      cardIds: ["adder", "a"],
      choices: { adder: { cardId: "army" } },
    });

    await useCase.execute("a");

    expect(hands.get()).toEqual({
      cardIds: ["adder"],
      choices: { adder: { cardId: "army" } },
    });
  });

  it("keeps both removals when two cards are removed at once", async () => {
    const { hands, useCase } = setUp(handOf("a", "b", "c"));

    await Promise.all([useCase.execute("a"), useCase.execute("b")]);

    expect(hands.get()).toEqual(handOf("c"));
  });

  it("fails for an unknown variant, leaving the hand as it was", async () => {
    const { hands, useCase } = setUp(handOf("a"), "unknown");

    await expect(useCase.execute("a")).rejects.toThrow(
      "Unknown variant: unknown",
    );
    expect(hands.get()).toEqual(handOf("a"));
  });
});
