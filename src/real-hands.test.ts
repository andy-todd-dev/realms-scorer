import { ScoreHandUseCase } from "./application/score-hand.usecase";
import { InMemoryCardCatalog } from "./infrastructure/driven/in-memory-card-catalog";

// Hands scored with the real cards, so they check the card definitions as well as the rules.
describe("scoring real hands", () => {
  const scoreHand = new ScoreHandUseCase({
    cardCatalog: new InMemoryCardCatalog(),
  });

  // Every ordering of the hand, as the score must not depend on the order cards were added.
  const orderings = <T>(items: readonly T[]): T[][] =>
    items.length <= 1
      ? [[...items]]
      : items.flatMap((item, index) =>
          orderings([...items.slice(0, index), ...items.slice(index + 1)]).map(
            (rest) => [item, ...rest],
          ),
        );

  const expectScore = async (
    cardIds: readonly string[],
    expected: number,
    choices: Readonly<Record<string, string>> = {},
  ) => {
    for (const ordering of orderings(cardIds)) {
      await expect(
        scoreHand.execute({ cardIds: ordering, choices }),
      ).resolves.toMatchObject({ total: expected });
    }
  };

  /*
    Rulebook Q&A: "You have a Blizzard (blanks Floods), a Great Flood (blanks Flames and Lands), a Wildfire (blanks
    Lands), and Cavern (clears penalties on Weather). The Cavern clears the penalty from the Blizzard first. Since the
    penalty is cleared, the Great Flood is unaffected by the Blizzard, so it quenches the Wildfire and drowns the Cavern.
    However, even though they are blanked, the Cavern still has successfully cleared the Blizzard penalty. The active
    cards in the hand are the Blizzard and the Flood. If you did not have the Cavern, then the Flood would be blanked and
    the Blizzard and Wildfire would both be active."
  */
  describe("rulebook example: Blizzard, Great Flood, Wildfire and Cavern", () => {
    it("keeps the Blizzard and Great Flood with the Cavern", async () => {
      // Blizzard 30 + Great Flood 32. The Wildfire is blanked, so the Blizzard's -5 per Flame doesn't apply.
      await expectScore(["blizzard", "great-flood", "wildfire", "cavern"], 62);
    });

    it("keeps the Blizzard and Wildfire without the Cavern, as a blanked Great Flood blanks nothing", async () => {
      // Blizzard 30 - 5 for the Wildfire, + Wildfire 40.
      await expectScore(["blizzard", "great-flood", "wildfire"], 65);
    });
  });

  /*
    Not an official ruling. The official app gives 15 or 50 for this hand depending on the order the cards are entered
    in (BGG thread 2722369). We follow the rulebook's "A card which has been blanked has no suit" and the designer's
    description of blanked cards as blank pieces of paper to the rest of the hand: Smoke blanks itself without a Flame,
    so it is no Weather, and the War Dirigible survives.
  */
  describe("Elven Archers, War Dirigible and Smoke", () => {
    it("keeps the War Dirigible when the Smoke blanks itself, as a blanked Smoke is no Weather", async () => {
      // Elven Archers 10 + 5 for no Weather, + War Dirigible 35.
      await expectScore(["elven-archers", "war-dirigible", "smoke"], 50);
    });

    it("blanks the War Dirigible when a Flame keeps the Smoke in play", async () => {
      // Elven Archers 10 + Smoke 27 + Candle 2.
      await expectScore(
        ["elven-archers", "war-dirigible", "smoke", "candle"],
        39,
      );
    });
  });

  describe("Island", () => {
    it("clears the penalty on the Flood it chose", async () => {
      // Island 14 + Swamp 18 (its -3 for the Candle cleared) + Candle 2.
      await expectScore(["island", "swamp", "candle"], 34, { island: "swamp" });
    });

    it("clears nothing until a card is chosen", async () => {
      // Island 14 + Swamp 18 - 3 for the Candle, + Candle 2.
      await expectScore(["island", "swamp", "candle"], 31);
    });

    it("stops the Great Flood blanking when it clears its penalty", async () => {
      // Island 14 + Great Flood 32 + Candle 2, which is no longer blanked.
      await expectScore(["island", "great-flood", "candle"], 48, {
        island: "great-flood",
      });
      // Island 14 + Great Flood 32, with the Candle blanked.
      await expectScore(["island", "great-flood", "candle"], 46, {
        island: "candle",
      });
    });
  });

  // Designer ruling (BGG thread 1827436): the Rangers don't blank the War Dirigible, and it no longer needs an Army.
  it("keeps the War Dirigible with the Rangers and no other Army", async () => {
    // Rangers 5 + War Dirigible 35.
    await expectScore(["rangers", "war-dirigible"], 40);
  });
});
