import {
  choiceInstruction,
  describeTargets,
  noChoiceText,
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
});

describe("choiceInstruction", () => {
  it("asks for one of the targets from the hand", () => {
    expect(
      choiceInstruction([
        { suit: "flood", exceptNames: [] },
        { suit: "flame", exceptNames: [] },
      ]),
    ).toBe("Choose one Flood or Flame in your hand.");
  });
});

describe("noChoiceText", () => {
  it("says which cards to add", () => {
    expect(
      noChoiceText([
        { suit: "flood", exceptNames: [] },
        { suit: "flame", exceptNames: [] },
      ]),
    ).toBe("No Flood or Flame in your hand yet. Add one, then come back.");
  });
});
