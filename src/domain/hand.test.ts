import {
  addCardToHand,
  isHandFull,
  chooseCard,
  emptyHand,
  Hand,
  isCardInHand,
  removeCardFromHand,
} from "./hand";

const handOf = (...cardIds: string[]): Hand => ({ cardIds, choices: {} });

describe("emptyHand", () => {
  it("has no cards and no choices", () => {
    expect(emptyHand()).toEqual({ cardIds: [], choices: {} });
  });
});

describe("removeCardFromHand", () => {
  it("removes the card, keeping the order of the rest", () => {
    expect(
      removeCardFromHand(handOf("king", "queen", "knights"), "queen"),
    ).toEqual(handOf("king", "knights"));
  });

  it("leaves the hand unchanged when the card isn't in it", () => {
    const hand = handOf("king");

    expect(removeCardFromHand(hand, "queen")).toBe(hand);
  });

  it("keeps the choices, which the caller checks", () => {
    const hand: Hand = {
      cardIds: ["island", "swamp"],
      choices: { island: { cardId: "swamp" } },
    };

    expect(removeCardFromHand(hand, "swamp")).toEqual({
      cardIds: ["island"],
      choices: { island: { cardId: "swamp" } },
    });
  });
});

describe("addCardToHand", () => {
  it("adds a card to the end of the hand", () => {
    expect(addCardToHand(handOf("king"), "queen", 7)).toEqual(
      handOf("king", "queen"),
    );
  });

  it("leaves the hand unchanged when the card is already in it", () => {
    const hand = handOf("king");

    expect(addCardToHand(hand, "king", 7)).toBe(hand);
  });

  it("keeps the choices already made", () => {
    const hand: Hand = {
      cardIds: ["island", "swamp"],
      choices: { island: { cardId: "swamp" } },
    };

    expect(addCardToHand(hand, "candle", 7).choices).toEqual({
      island: { cardId: "swamp" },
    });
  });
});

describe("chooseCard", () => {
  it("records the choice", () => {
    expect(chooseCard(handOf("island", "swamp"), "island", "swamp")).toEqual({
      cardIds: ["island", "swamp"],
      choices: { island: { cardId: "swamp" } },
    });
  });

  it("replaces an earlier choice for the same card", () => {
    const hand: Hand = {
      cardIds: ["island", "swamp", "candle"],
      choices: { island: { cardId: "swamp" } },
    };

    expect(chooseCard(hand, "island", "candle").choices).toEqual({
      island: { cardId: "candle" },
    });
  });
});

describe("chooseCard with a suit", () => {
  it("records the suit with the card", () => {
    expect(
      chooseCard(handOf("book", "swamp"), "book", "swamp", "flame").choices,
    ).toEqual({ book: { cardId: "swamp", suit: "flame" } });
  });
});

describe("isCardInHand", () => {
  it("reports whether the card is in the hand", () => {
    expect(isCardInHand(handOf("king"), "king")).toBe(true);
    expect(isCardInHand(handOf("king"), "queen")).toBe(false);
  });
});

describe("the hand size", () => {
  const handOfThree = handOf("a", "b", "c");

  it("is full at the given size", () => {
    expect(isHandFull(handOf("a", "b"), 3)).toBe(false);
    expect(isHandFull(handOfThree, 3)).toBe(true);
    expect(isHandFull(handOfThree, 4)).toBe(false);
  });

  it("rejects adding a card to a full hand", () => {
    expect(() => addCardToHand(handOfThree, "d", 3)).toThrow(
      "The hand is full, so d can't be added",
    );
  });

  it("still allows adding a card already in a full hand, which changes nothing", () => {
    expect(addCardToHand(handOfThree, "a", 3)).toBe(handOfThree);
  });

  it("doesn't count a card chosen for an effect to add", () => {
    const hand: Hand = {
      cardIds: ["necromancer", "b"],
      choices: { necromancer: { cardId: "dragon" } },
    };

    expect(addCardToHand(hand, "c", 3).cardIds).toHaveLength(3);
  });
});
