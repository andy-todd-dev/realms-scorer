import { Card } from "./card";
import {
  ChoiceRules,
  isValidChoice,
  withInvalidChoicesDropped,
} from "./choices";

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
        { adder: { cardId: "army-1" }, clearer: { cardId: "army-2" } },
        rules,
      ),
    ).toEqual({ adder: { cardId: "army-1" }, clearer: { cardId: "army-2" } });
  });

  it("drops the choice of a card no longer in the hand", () => {
    expect(
      withInvalidChoicesDropped(
        [anArmy],
        { clearer: { cardId: "army-1" } },
        rules,
      ),
    ).toEqual({});
  });

  it("drops a choice of a card removed from the hand", () => {
    expect(
      withInvalidChoicesDropped(
        [clearer],
        { clearer: { cardId: "army-1" } },
        rules,
      ),
    ).toEqual({});
  });

  it("drops a choice from the discard area of a card now in the hand", () => {
    expect(
      withInvalidChoicesDropped(
        [adder, anArmy],
        { adder: { cardId: "army-1" } },
        rules,
      ),
    ).toEqual({});
  });

  it("keeps a choice of the card pre-scoring adds", () => {
    expect(
      withInvalidChoicesDropped(
        [adder, clearer],
        { adder: { cardId: "army-1" }, clearer: { cardId: "army-1" } },
        rules,
      ),
    ).toEqual({ adder: { cardId: "army-1" }, clearer: { cardId: "army-1" } });
  });

  it("drops a choice of the card pre-scoring added, once the adder chooses another", () => {
    expect(
      withInvalidChoicesDropped(
        [adder, clearer],
        { adder: { cardId: "army-2" }, clearer: { cardId: "army-1" } },
        rules,
      ),
    ).toEqual({ adder: { cardId: "army-2" } });
  });

  it("keeps a choice of the card added by hand, when the adder's choice of it is dropped", () => {
    expect(
      withInvalidChoicesDropped(
        [adder, clearer, anArmy],
        { adder: { cardId: "army-1" }, clearer: { cardId: "army-1" } },
        rules,
      ),
    ).toEqual({ clearer: { cardId: "army-1" } });
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
      withInvalidChoicesDropped(
        [taker],
        { taker: { cardId: "army-1" } },
        gameRules,
      ),
    ).toEqual({ taker: { cardId: "army-1" } });
    expect(
      withInvalidChoicesDropped(
        [taker, anArmy],
        { taker: { cardId: "army-1" } },
        gameRules,
      ),
    ).toEqual({ taker: { cardId: "army-1" } });
  });
});

describe("choices that include a suit", () => {
  // Before scoring, gives one other card in the hand an Army, Flood or Flame suit.
  const giver: Card = {
    ...card("giver", "artifact"),
    preScoring: [
      { kind: "give", to: { chosen: true }, suit: { chosenSuit: true } },
    ],
    choice: {
      kind: "cardInHand",
      from: [{ suit: "army" }, { suit: "wild" }],
      suits: ["army", "flood", "flame"],
    },
  };
  // Before scoring, takes the suit of any Army or Flood in the game.
  const taker: Card = {
    ...card("taker", "wild"),
    preScoring: [
      { kind: "take", from: { chosen: true }, attributes: ["suit"] },
    ],
    choice: { kind: "cardInGame", from: [{ suit: "army" }, { suit: "flood" }] },
  };
  const aFlood = card("flood-1", "flood");
  const suitRules: ChoiceRules = {
    deckCards: [giver, taker, anArmy, aFlood],
    preScoring: ["taker", "giver"],
  };

  it("needs a suit the chosen card may be given", () => {
    const valid = (choice: Parameters<typeof isValidChoice>[1]) =>
      isValidChoice("giver", choice, [giver, anArmy], {}, suitRules);

    expect(valid({ cardId: "army-1", suit: "flood" })).toBe(true);
    // No suit, the card's own suit, or one the choice doesn't include
    expect(valid({ cardId: "army-1" })).toBe(false);
    expect(valid({ cardId: "army-1", suit: "army" })).toBe(false);
    expect(valid({ cardId: "army-1", suit: "beast" })).toBe(false);
    // The giver itself
    expect(valid({ cardId: "giver", suit: "flood" })).toBe(false);
  });

  it("rejects a suit for a choice that doesn't include one", () => {
    expect(
      isValidChoice(
        "clearer",
        { cardId: "army-1", suit: "flood" },
        [clearer, anArmy],
        {},
        rules,
      ),
    ).toBe(false);
  });

  it("drops the choice once an earlier pre-scoring card gives the chosen card the chosen suit", () => {
    const choices = {
      taker: { cardId: "army-1" },
      giver: { cardId: "taker", suit: "flood" as const },
    };

    // The taker is an Army, so it may become a Flood
    expect(
      withInvalidChoicesDropped([taker, giver], choices, suitRules),
    ).toEqual(choices);
    // The taker is now a Flood already, and no longer an option at all
    expect(
      withInvalidChoicesDropped(
        [taker, giver],
        { ...choices, taker: { cardId: "flood-1" } },
        suitRules,
      ),
    ).toEqual({ taker: { cardId: "flood-1" } });
  });
});
