import {
  addCardToHand,
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

  it("drops the removed card's own choice", () => {
    const hand: Hand = {
      cardIds: ["island", "swamp"],
      choices: { island: "swamp" },
    };

    expect(removeCardFromHand(hand, "island")).toEqual(handOf("swamp"));
  });

  it("drops a choice of the removed card, so its chooser is pending again", () => {
    const hand: Hand = {
      cardIds: ["island", "swamp", "candle"],
      choices: { island: "swamp" },
    };

    expect(removeCardFromHand(hand, "swamp")).toEqual(
      handOf("island", "candle"),
    );
  });

  it("keeps choices that don't involve the removed card", () => {
    const hand: Hand = {
      cardIds: ["island", "swamp", "candle"],
      choices: { island: "swamp" },
    };

    expect(removeCardFromHand(hand, "candle")).toEqual({
      cardIds: ["island", "swamp"],
      choices: { island: "swamp" },
    });
  });
});

describe("addCardToHand", () => {
  it("adds a card to the end of the hand", () => {
    expect(addCardToHand(handOf("king"), "queen")).toEqual(
      handOf("king", "queen"),
    );
  });

  it("leaves the hand unchanged when the card is already in it", () => {
    const hand = handOf("king");

    expect(addCardToHand(hand, "king")).toBe(hand);
  });

  it("keeps the choices already made", () => {
    const hand: Hand = {
      cardIds: ["island", "swamp"],
      choices: { island: "swamp" },
    };

    expect(addCardToHand(hand, "candle").choices).toEqual({ island: "swamp" });
  });
});

describe("chooseCard", () => {
  it("records the choice", () => {
    expect(chooseCard(handOf("island", "swamp"), "island", "swamp")).toEqual({
      cardIds: ["island", "swamp"],
      choices: { island: "swamp" },
    });
  });

  it("replaces an earlier choice for the same card", () => {
    const hand: Hand = {
      cardIds: ["island", "swamp", "candle"],
      choices: { island: "swamp" },
    };

    expect(chooseCard(hand, "island", "candle").choices).toEqual({
      island: "candle",
    });
  });
});

describe("isCardInHand", () => {
  it("reports whether the card is in the hand", () => {
    expect(isCardInHand(handOf("king"), "king")).toBe(true);
    expect(isCardInHand(handOf("king"), "queen")).toBe(false);
  });
});
