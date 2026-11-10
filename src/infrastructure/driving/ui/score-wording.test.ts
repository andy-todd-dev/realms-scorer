import type { BreakdownLine, ScoreReasonView } from "../state/selectors";
import { describeScoreLine } from "./score-wording";

const bonus = (reason: ScoreReasonView): BreakdownLine => ({
  ability: "bonus",
  value: "",
  reason,
});

const penalty = (reason: ScoreReasonView): BreakdownLine => ({
  ability: "penalty",
  value: "",
  reason,
});

const NO_CONDITION = { withNames: [], without: [], allSuitsDifferent: false };

describe("describeScoreLine", () => {
  describe("points for each card", () => {
    it("names the cards of a suit counted, with the suit plural", () => {
      expect(
        describeScoreLine(
          bonus({
            kind: "each",
            each: 10,
            counts: { suit: "land" },
            names: ["Bell Tower", "Mountain"],
            withNames: [],
          }),
        ),
      ).toBe("+10 × 2 Lands (Bell Tower, Mountain)");
    });

    it("uses the singular for one card, and a minus sign for a penalty", () => {
      expect(
        describeScoreLine(
          penalty({
            kind: "each",
            each: -3,
            counts: { suit: "army" },
            names: ["Rangers"],
            withNames: [],
          }),
        ),
      ).toBe("−3 × 1 Army (Rangers)");
    });

    it("doesn't repeat the name of a specific card counted", () => {
      expect(
        describeScoreLine(
          bonus({
            kind: "each",
            each: 12,
            counts: { cardName: "Elven Archers" },
            names: ["Elven Archers"],
            withNames: [],
          }),
        ),
      ).toBe("+12 × 1 Elven Archers");
    });

    it("names a card that counted as the card by taking its name", () => {
      expect(
        describeScoreLine(
          bonus({
            kind: "each",
            each: 12,
            counts: { cardName: "Elven Archers" },
            names: ["Shapeshifter"],
            withNames: [],
          }),
        ),
      ).toBe("+12 × 1 Elven Archers (Shapeshifter)");
    });

    it("names the cards a condition needed", () => {
      expect(
        describeScoreLine(
          bonus({
            kind: "each",
            each: 20,
            counts: { suit: "army" },
            names: ["Knights", "Rangers"],
            withNames: ["Queen"],
          }),
        ),
      ).toBe("+20 × 2 Armies (Knights, Rangers) with Queen");
    });

    it("keeps an uncountable suit's name", () => {
      expect(
        describeScoreLine(
          bonus({
            kind: "each",
            each: 15,
            counts: { suit: "weather" },
            names: ["Rainstorm", "Smoke"],
            withNames: [],
          }),
        ),
      ).toBe("+15 × 2 Weather (Rainstorm, Smoke)");
    });
  });

  describe("conditions", () => {
    it("names the cards present", () => {
      expect(
        describeScoreLine(
          bonus({
            kind: "condition",
            ...NO_CONDITION,
            withNames: ["Smoke", "Wildfire"],
          }),
        ),
      ).toBe("With Smoke and Wildfire");
    });

    it("names what was missing", () => {
      expect(
        describeScoreLine(
          penalty({
            kind: "condition",
            ...NO_CONDITION,
            without: [{ suit: "wizard" }],
          }),
        ),
      ).toBe("With no Wizard");
      expect(
        describeScoreLine(
          bonus({
            kind: "condition",
            ...NO_CONDITION,
            without: [{ cardName: "Queen" }],
          }),
        ),
      ).toBe("With no Queen");
    });

    it("says every card is a different suit", () => {
      expect(
        describeScoreLine(
          bonus({
            kind: "condition",
            ...NO_CONDITION,
            allSuitsDifferent: true,
          }),
        ),
      ).toBe("Every card a different suit");
    });

    it("joins several parts", () => {
      expect(
        describeScoreLine(
          bonus({
            kind: "condition",
            withNames: ["Rainstorm"],
            without: [{ suit: "flood" }],
            allSuitsDifferent: false,
          }),
        ),
      ).toBe("With Rainstorm, with no Flood");
    });
  });

  it("names points that need nothing by their ability", () => {
    expect(describeScoreLine(bonus({ kind: "flat" }))).toBe("Bonus");
    expect(describeScoreLine(penalty({ kind: "flat" }))).toBe("Penalty");
  });

  it("names the cards whose base strengths are summed", () => {
    expect(
      describeScoreLine(
        bonus({
          kind: "sum",
          counts: { suit: "army" },
          names: ["Knights", "Rangers"],
        }),
      ),
    ).toBe("Base strength of Armies (Knights, Rangers)");
    expect(
      describeScoreLine(
        bonus({
          kind: "sum",
          counts: { cardName: "Sword of Keth" },
          names: ["Sword of Keth"],
        }),
      ),
    ).toBe("Base strength of Sword of Keth");
  });

  it("names the cards in a run", () => {
    expect(
      describeScoreLine(
        bonus({
          kind: "run",
          length: 3,
          names: ["Candle", "Forest", "Gem of Order"],
        }),
      ),
    ).toBe("3-card run (Candle, Forest, Gem of Order)");
  });

  it("names the cards in a set", () => {
    expect(
      describeScoreLine(
        bonus({
          kind: "set",
          suit: "wizard",
          names: ["Collector", "Enchantress", "Necromancer"],
        }),
      ),
    ).toBe("3 different Wizards (Collector, Enchantress, Necromancer)");
  });
});
