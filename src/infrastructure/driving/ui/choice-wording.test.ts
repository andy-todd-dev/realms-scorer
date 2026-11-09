import {
  choiceInstruction,
  chosenText,
  describeTargets,
  noChoiceText,
  suitInstruction,
} from "./choice-wording";

describe("describeTargets", () => {
  it("names a single suit", () => {
    expect(describeTargets([{ suit: "flood", exceptNames: [] }])).toBe("Flood");
  });

  it("joins two with or", () => {
    expect(
      describeTargets([
        { suit: "flood", exceptNames: [] },
        { suit: "flame", exceptNames: [] },
      ]),
    ).toBe("Flood or Flame");
  });

  it("lists more than two without a comma before or", () => {
    expect(
      describeTargets([
        { suit: "army", exceptNames: [] },
        { suit: "land", exceptNames: [] },
        { suit: "flame", exceptNames: [] },
      ]),
    ).toBe("Army, Land or Flame");
  });

  it("names the cards a suit leaves out", () => {
    expect(
      describeTargets([
        { suit: "land", exceptNames: ["Mountain"] },
        { suit: "flame", exceptNames: ["Lightning", "Candle"] },
      ]),
    ).toBe("Land other than Mountain or Flame other than Lightning and Candle");
  });

  it("names specific cards", () => {
    expect(
      describeTargets([
        { cardName: "Swamp" },
        { suit: "flame", exceptNames: [] },
      ]),
    ).toBe("Swamp or Flame");
  });

  describe("with every suit", () => {
    const everySuit = [
      "army",
      "leader",
      "wizard",
      "weapon",
      "artifact",
      "beast",
      "land",
      "weather",
      "flood",
      "flame",
      "wild",
    ] as const;

    it("says any card will do", () => {
      const targets = everySuit.map((suit) => ({ suit, exceptNames: [] }));

      expect(describeTargets(targets)).toBe("card");
      expect(choiceInstruction(targets, "hand")).toBe(
        "Choose one card in your hand.",
      );
    });

    it("lists the suits when one leaves cards out", () => {
      const targets = everySuit.map((suit) => ({
        suit,
        exceptNames: suit === "land" ? ["Mountain"] : [],
      }));

      expect(describeTargets(targets)).toContain("Land other than Mountain");
    });
  });
});

describe("choiceInstruction", () => {
  it("asks for one of the targets from the hand", () => {
    expect(
      choiceInstruction(
        [
          { suit: "flood", exceptNames: [] },
          { suit: "flame", exceptNames: [] },
        ],
        "hand",
      ),
    ).toBe("Choose one Flood or Flame in your hand.");
  });

  it("asks for one of the targets from the discard area", () => {
    expect(
      choiceInstruction(
        [
          { suit: "army", exceptNames: [] },
          { suit: "beast", exceptNames: [] },
        ],
        "discardArea",
      ),
    ).toBe("Choose one Army or Beast from the discard area.");
  });

  it("asks for one of the targets in the game", () => {
    expect(
      choiceInstruction(
        [
          { suit: "leader", exceptNames: [] },
          { suit: "beast", exceptNames: [] },
        ],
        "game",
      ),
    ).toBe("Choose one Leader or Beast in the game.");
  });
});

describe("noChoiceText", () => {
  it("says which cards to add", () => {
    expect(
      noChoiceText(
        [
          { suit: "flood", exceptNames: [] },
          { suit: "flame", exceptNames: [] },
        ],
        "hand",
      ),
    ).toBe("No Flood or Flame in your hand yet. Add one, then come back.");
  });

  it("says when the discard area has none left", () => {
    expect(
      noChoiceText([{ suit: "army", exceptNames: [] }], "discardArea"),
    ).toBe(
      "Every Army is in your hand, so there's none to take from the discard area.",
    );
  });
});

describe("chosenText", () => {
  it("names the card, with the suit chosen for it when there is one", () => {
    expect(chosenText("Swamp", null)).toBe("Swamp");
    expect(chosenText("Swamp", "flame")).toBe("Swamp → Flame");
  });
});

describe("suitInstruction", () => {
  it("names the card whose suit is chosen", () => {
    expect(suitInstruction("Swamp")).toBe("Choose a new suit for Swamp.");
  });
});
