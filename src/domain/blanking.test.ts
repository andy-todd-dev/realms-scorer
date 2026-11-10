import { blankReasons, withoutBlankedCards } from "./blanking";
import { Card, CardEffect } from "./card";

const card = (
  id: string,
  suit: Card["suit"],
  effects: readonly CardEffect[] = [],
): Card => ({
  id,
  name: id,
  suit,
  baseStrength: 1,
  ...(effects.length > 0 && { penalty: { text: "", effects } }),
});

const anArmy = card("army-1", "army");
const anotherArmy = card("army-2", "army");
const aLand = card("land-1", "land");

// Every ordering of the cards, as which cards are blanked must not depend on their order.
const orderings = (cards: readonly Card[]): Card[][] =>
  cards.length <= 1
    ? [[...cards]]
    : cards.flatMap((item, index) =>
        orderings([...cards.slice(0, index), ...cards.slice(index + 1)]).map(
          (rest) => [item, ...rest],
        ),
      );

// Checks that exactly the named cards stay in play, whatever order the hand is in.
const expectInPlay = (cards: readonly Card[], ids: readonly string[]) => {
  orderings(cards).forEach((ordering) => {
    expect(
      withoutBlankedCards(ordering)
        .map(({ id }) => id)
        .sort(),
    ).toEqual([...ids].sort());
  });
};

describe("withoutBlankedCards", () => {
  it("keeps every card when nothing blanks", () => {
    expect(withoutBlankedCards([])).toEqual([]);
    expectInPlay([anArmy, aLand], ["army-1", "land-1"]);
  });

  it("keeps the remaining cards in their original order", () => {
    const blanksLands = card("blanks-lands", "wizard", [
      { kind: "blank", targets: [{ suit: "land" }] },
    ]);

    expect(
      withoutBlankedCards([anArmy, aLand, blanksLands, anotherArmy]),
    ).toEqual([anArmy, blanksLands, anotherArmy]);
  });

  describe("blank effects", () => {
    const blanker = card("blanker", "beast", [
      { kind: "blank", targets: [{ suit: "army" }, { suit: "beast" }] },
    ]);

    it("blanks each targeted card", () => {
      expectInPlay([blanker, anArmy, anotherArmy], ["blanker"]);
    });

    it("leaves other suits alone", () => {
      expectInPlay([blanker, aLand], ["blanker", "land-1"]);
    });

    it("doesn't blank the card itself", () => {
      expectInPlay([blanker], ["blanker"]);
    });

    it("blanks other cards of the blanking card's suit", () => {
      expectInPlay([blanker, card("beast", "beast")], ["blanker"]);
    });

    it("targets a card by ID", () => {
      const subject = card("subject", "wizard", [
        { kind: "blank", targets: [{ cardId: "army-1" }] },
      ]);

      expectInPlay([subject, anArmy, anotherArmy], ["subject", "army-2"]);
    });

    it("blanks both cards when each would blank the other", () => {
      const blanksLeaders = card("land-blanks-leaders", "land", [
        { kind: "blank", targets: [{ suit: "leader" }] },
      ]);
      const blanksLands = card("leader-blanks-lands", "leader", [
        { kind: "blank", targets: [{ suit: "land" }] },
      ]);

      expectInPlay([blanksLeaders, blanksLands], []);
      expectInPlay([blanksLeaders, blanksLands, anArmy], ["army-1"]);
    });
  });

  describe("blankSelf effects", () => {
    const blankedWithoutArmy = card("blanked-without-army", "weapon", [
      { kind: "blankSelf", when: { absent: { suit: "army" } } },
    ]);
    const blankedWithLand = card("blanked-with-land", "weapon", [
      { kind: "blankSelf", when: { present: { suit: "land" } } },
    ]);

    it("blanks the card when the condition holds", () => {
      expectInPlay([blankedWithoutArmy], []);
      expectInPlay([blankedWithoutArmy, aLand], ["land-1"]);
    });

    it("leaves the card alone when the condition doesn't hold", () => {
      expectInPlay(
        [blankedWithoutArmy, anArmy],
        ["blanked-without-army", "army-1"],
      );
    });

    it("can be blanked by being with a card", () => {
      expectInPlay([blankedWithLand], ["blanked-with-land"]);
      expectInPlay([blankedWithLand, aLand], ["land-1"]);
    });

    it("checks the condition against cards not blanked by others", () => {
      const blanksArmies = card("blanks-armies", "wizard", [
        { kind: "blank", targets: [{ suit: "army" }] },
      ]);

      expectInPlay(
        [blankedWithoutArmy, anArmy, blanksArmies],
        ["blanks-armies"],
      );
    });

    it("lets a blanked card that would have triggered the condition save it", () => {
      const blanksLands = card("blanks-lands", "wizard", [
        { kind: "blank", targets: [{ suit: "land" }] },
      ]);

      expectInPlay(
        [blankedWithLand, aLand, blanksLands],
        ["blanked-with-land", "blanks-lands"],
      );
    });

    it("blanks cards whose self-blanks depend on each other", () => {
      const blankedWithWizard = card("blanked-with-wizard", "weapon", [
        { kind: "blankSelf", when: { present: { suit: "wizard" } } },
      ]);
      const blankedWithWeapon = card("blanked-with-weapon", "wizard", [
        { kind: "blankSelf", when: { present: { suit: "weapon" } } },
      ]);

      expectInPlay([blankedWithWizard, blankedWithWeapon, anArmy], ["army-1"]);
    });
  });

  // Rulebook: "A card which has been blanked has no suit, no bonuses or penalties", and penalties apply "beginning with
  // cards not blanked by any other cards". Its Blizzard, Great Flood and Wildfire example relies on this.
  describe("blanked cards have no effect on other cards", () => {
    it("doesn't let a card blanked by another card blank others", () => {
      const blanksArmies = card("blanks-armies", "wizard", [
        { kind: "blank", targets: [{ suit: "army" }] },
      ]);
      const armyBlankingLands = card("army-blanks-lands", "army", [
        { kind: "blank", targets: [{ suit: "land" }] },
      ]);

      expectInPlay(
        [blanksArmies, armyBlankingLands, aLand],
        ["blanks-armies", "land-1"],
      );
    });

    it("doesn't let a self-blanked card blank others", () => {
      const subject = card("subject", "weapon", [
        { kind: "blankSelf", when: { absent: { suit: "army" } } },
        { kind: "blank", targets: [{ suit: "land" }] },
      ]);

      expectInPlay([subject, aLand], ["land-1"]);
    });

    it("doesn't let a self-blanked card trigger another card's self-blank", () => {
      const blankedWithoutFlame = card("blanked-without-flame", "weather", [
        { kind: "blankSelf", when: { absent: { suit: "flame" } } },
      ]);
      const blankedWithWeather = card("blanked-with-weather", "weapon", [
        { kind: "blankSelf", when: { present: { suit: "weather" } } },
      ]);

      expectInPlay(
        [blankedWithoutFlame, blankedWithWeather],
        ["blanked-with-weather"],
      );
    });

    it("lets a self-blanked card's absence blank another card", () => {
      const blankedWithoutArmy = card("blanked-without-army", "weapon", [
        { kind: "blankSelf", when: { absent: { suit: "army" } } },
      ]);
      const blankedWithoutWeapon = card("blanked-without-weapon", "wizard", [
        { kind: "blankSelf", when: { absent: { suit: "weapon" } } },
      ]);

      expectInPlay([blankedWithoutArmy, blankedWithoutWeapon], []);
      expectInPlay(
        [blankedWithoutArmy, blankedWithoutWeapon, anArmy],
        ["blanked-without-army", "blanked-without-weapon", "army-1"],
      );
    });
  });
});

describe("blankReasons", () => {
  const blanksArmies = card("blanks-armies", "wizard", [
    { kind: "blank", targets: [{ suit: "army" }] },
  ]);
  const alsoBlanksArmies = card("also-blanks-armies", "flood", [
    { kind: "blank", targets: [{ suit: "army" }] },
  ]);
  const blankedWithoutLand = card("blanked-without-land", "army", [
    { kind: "blankSelf", when: { absent: { suit: "land" } } },
  ]);
  const blankedWithFlood = card("blanked-with-flood", "weapon", [
    { kind: "blankSelf", when: { present: { suit: "flood" } } },
  ]);
  const NONE = { byCardIds: [], self: [], loopCardIds: [] };

  // Checks the reasons are the same whatever order the hand is in.
  const expectReasons = (
    cards: readonly Card[],
    expected: ReturnType<typeof blankReasons>,
  ) => {
    orderings(cards).forEach((ordering) => {
      expect(blankReasons(ordering)).toEqual(expected);
    });
  };

  it("gives cards in play no reason", () => {
    expectReasons([anArmy, aLand], {});
  });

  it("names the card that blanked a card", () => {
    expectReasons([anArmy, blanksArmies], {
      "army-1": { ...NONE, byCardIds: ["blanks-armies"] },
    });
  });

  it("names every card that blanked a card", () => {
    expect(blankReasons([anArmy, blanksArmies, alsoBlanksArmies])).toEqual({
      "army-1": {
        ...NONE,
        byCardIds: ["blanks-armies", "also-blanks-armies"],
      },
    });
  });

  it("reports a self-blank for a missing suit", () => {
    expectReasons([blankedWithoutLand], {
      "blanked-without-land": {
        ...NONE,
        self: [
          {
            withCardIds: [],
            without: [{ suit: "land" }],
            allSuitsDifferent: false,
          },
        ],
      },
    });
  });

  it("names the cards that triggered a self-blank", () => {
    expectReasons([blankedWithFlood, alsoBlanksArmies], {
      "blanked-with-flood": {
        ...NONE,
        self: [
          {
            withCardIds: ["also-blanks-armies"],
            without: [],
            allSuitsDifferent: false,
          },
        ],
      },
    });
  });

  it("reports both a blanking card and a self-blank", () => {
    expectReasons([blankedWithoutLand, blanksArmies], {
      "blanked-without-land": {
        byCardIds: ["blanks-armies"],
        self: [
          {
            withCardIds: [],
            without: [{ suit: "land" }],
            allSuitsDifferent: false,
          },
        ],
        loopCardIds: [],
      },
    });
  });

  it("names the other card in a loop of blanks", () => {
    const blanksLeaders = card("land-blanks-leaders", "land", [
      { kind: "blank", targets: [{ suit: "leader" }] },
    ]);
    const blanksLands = card("leader-blanks-lands", "leader", [
      { kind: "blank", targets: [{ suit: "land" }] },
    ]);

    expectReasons([blanksLeaders, blanksLands, anArmy], {
      "land-blanks-leaders": { ...NONE, loopCardIds: ["leader-blanks-lands"] },
      "leader-blanks-lands": { ...NONE, loopCardIds: ["land-blanks-leaders"] },
    });
  });

  it("names the loop card that a card blanked only by a loop depends on", () => {
    const blanksLeadersAndArmies = card("land-blanks", "land", [
      { kind: "blank", targets: [{ suit: "leader" }, { suit: "army" }] },
    ]);
    const blanksLands = card("leader-blanks-lands", "leader", [
      { kind: "blank", targets: [{ suit: "land" }] },
    ]);

    expect(
      blankReasons([blanksLeadersAndArmies, blanksLands, anArmy])["army-1"],
    ).toEqual({ ...NONE, loopCardIds: ["land-blanks"] });
  });

  it("names the other card in a loop of self-blanks", () => {
    const blankedWithWizard = card("blanked-with-wizard", "weapon", [
      { kind: "blankSelf", when: { present: { suit: "wizard" } } },
    ]);
    const blankedWithWeapon = card("blanked-with-weapon", "wizard", [
      { kind: "blankSelf", when: { present: { suit: "weapon" } } },
    ]);

    expectReasons([blankedWithWizard, blankedWithWeapon], {
      "blanked-with-wizard": { ...NONE, loopCardIds: ["blanked-with-weapon"] },
      "blanked-with-weapon": { ...NONE, loopCardIds: ["blanked-with-wizard"] },
    });
  });
});
