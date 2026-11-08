import { Card } from "./card";
import { ChoiceRules, withInvalidChoicesDropped } from "./choices";

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
// Clears the penalty on one Army in the hand.
const clearer: Card = {
  ...card("clearer", "flood"),
  bonus: {
    text: "",
    effects: [{ kind: "clearPenalty", targets: [{ chosen: true }] }],
  },
  choice: { kind: "cardInHand", from: [{ suit: "army" }] },
};
const anArmy = card("army-1", "army");
const anotherArmy = card("army-2", "army");

const rules: ChoiceRules = {
  deckCards: [anArmy, anotherArmy],
  preScoring: ["adder"],
};

describe("withInvalidChoicesDropped", () => {
  it("keeps choices that still fit", () => {
    expect(
      withInvalidChoicesDropped(
        [adder, clearer, anotherArmy],
        { adder: "army-1", clearer: "army-2" },
        rules,
      ),
    ).toEqual({ adder: "army-1", clearer: "army-2" });
  });

  it("drops the choice of a card no longer in the hand", () => {
    expect(
      withInvalidChoicesDropped([anArmy], { clearer: "army-1" }, rules),
    ).toEqual({});
  });

  it("drops a choice of a card removed from the hand", () => {
    expect(
      withInvalidChoicesDropped([clearer], { clearer: "army-1" }, rules),
    ).toEqual({});
  });

  it("drops a choice from the discard area of a card now in the hand", () => {
    expect(
      withInvalidChoicesDropped([adder, anArmy], { adder: "army-1" }, rules),
    ).toEqual({});
  });

  it("keeps a choice of the card pre-scoring adds", () => {
    expect(
      withInvalidChoicesDropped(
        [adder, clearer],
        { adder: "army-1", clearer: "army-1" },
        rules,
      ),
    ).toEqual({ adder: "army-1", clearer: "army-1" });
  });

  it("drops a choice of the card pre-scoring added, once the adder chooses another", () => {
    expect(
      withInvalidChoicesDropped(
        [adder, clearer],
        { adder: "army-2", clearer: "army-1" },
        rules,
      ),
    ).toEqual({ adder: "army-2" });
  });

  it("keeps a choice of the card added by hand, when the adder's choice of it is dropped", () => {
    expect(
      withInvalidChoicesDropped(
        [adder, clearer, anArmy],
        { adder: "army-1", clearer: "army-1" },
        rules,
      ),
    ).toEqual({ clearer: "army-1" });
  });

  it("keeps a choice from the game whether its card is in the hand or not", () => {
    // Takes the name and suit of any Army in the game.
    const taker: Card = {
      ...card("taker", "wild"),
      preScoring: [
        { kind: "take", from: { chosen: true }, attributes: ["name", "suit"] },
      ],
      choice: { kind: "cardInGame", from: [{ suit: "army" }] },
    };
    const gameRules = { deckCards: [taker, anArmy], preScoring: ["taker"] };

    expect(
      withInvalidChoicesDropped([taker], { taker: "army-1" }, gameRules),
    ).toEqual({ taker: "army-1" });
    expect(
      withInvalidChoicesDropped(
        [taker, anArmy],
        { taker: "army-1" },
        gameRules,
      ),
    ).toEqual({ taker: "army-1" });
  });
});
