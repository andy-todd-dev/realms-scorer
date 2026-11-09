import { Card, CardEffect, EffectCondition } from "./card";
import { calculateScore, scoreHand } from "./score";

const card = (
  id: string,
  suit: Card["suit"],
  baseStrength: number,
  effects: readonly CardEffect[] = [],
): Card => ({
  id,
  name: id,
  suit,
  baseStrength,
  ...(effects.length > 0 && { bonus: { text: "", effects } }),
});

const anArmy = card("army-1", "army", 10);
const anotherArmy = card("army-2", "army", 20);
const aLeader = card("leader-1", "leader", 3);
const aLand = card("land-1", "land", 4);

const pointsPerArmy: CardEffect = {
  kind: "points",
  points: 5,
  per: { suit: "army" },
};

describe("calculateScore", () => {
  it("scores no cards as 0", () => {
    expect(calculateScore([])).toBe(0);
  });

  it("adds the base strengths of the cards together", () => {
    expect(calculateScore([anArmy, aLeader])).toBe(13);
  });

  describe("points effects", () => {
    it("adds flat points", () => {
      const subject = card("subject", "wizard", 1, [
        { kind: "points", points: 2 },
      ]);

      expect(calculateScore([subject])).toBe(3);
    });

    it("subtracts negative points", () => {
      const subject = card("subject", "wizard", 10, [
        { kind: "points", points: -8 },
      ]);

      expect(calculateScore([subject])).toBe(2);
    });

    it("counts effects from both the bonus and the penalty", () => {
      const subject: Card = {
        ...card("subject", "wizard", 10),
        bonus: { text: "", effects: [{ kind: "points", points: 5 }] },
        penalty: { text: "", effects: [{ kind: "points", points: -2 }] },
      };

      expect(calculateScore([subject])).toBe(13);
    });
  });

  describe("per", () => {
    it("scales with each matching card", () => {
      const subject = card("subject", "wizard", 1, [pointsPerArmy]);

      expect(calculateScore([subject, anArmy, anotherArmy])).toBe(41);
    });

    it("gives nothing without a matching card", () => {
      const subject = card("subject", "wizard", 1, [pointsPerArmy]);

      expect(calculateScore([subject, aLand])).toBe(5);
    });

    it("matches by card ID", () => {
      const subject = card("subject", "wizard", 1, [
        { kind: "points", points: 5, per: { cardId: "army-1" } },
      ]);

      expect(calculateScore([subject, anArmy, anotherArmy])).toBe(36);
    });

    it("doesn't count the card itself", () => {
      const subject = card("subject", "army", 1, [pointsPerArmy]);

      expect(calculateScore([subject])).toBe(1);
    });
  });

  describe("when", () => {
    const withLeader = card("subject", "wizard", 1, [
      { kind: "points", points: 5, when: { present: { suit: "leader" } } },
    ]);
    const withoutLeader = card("subject", "wizard", 1, [
      { kind: "points", points: 5, when: { absent: { suit: "leader" } } },
    ]);
    const withNamedCard = card("subject", "wizard", 1, [
      { kind: "points", points: 5, when: { present: { cardId: "land-1" } } },
    ]);

    it("applies a present condition only when a card matches", () => {
      expect(calculateScore([withLeader, aLeader])).toBe(9);
      expect(calculateScore([withLeader, aLand])).toBe(5);
    });

    it("applies an absent condition only when no card matches", () => {
      expect(calculateScore([withoutLeader, aLand])).toBe(10);
      expect(calculateScore([withoutLeader, aLeader])).toBe(4);
    });

    it("matches by card ID", () => {
      expect(calculateScore([withNamedCard, aLand])).toBe(10);
      expect(calculateScore([withNamedCard, aLeader])).toBe(4);
    });

    it("doesn't let the card satisfy its own condition", () => {
      const subject = card("subject", "leader", 1, [
        { kind: "points", points: 5, when: { present: { suit: "leader" } } },
      ]);

      expect(calculateScore([subject])).toBe(1);
    });

    it("applies only the matching amount of mutually exclusive effects", () => {
      const subject = card("subject", "wizard", 1, [
        {
          kind: "points",
          points: 5,
          per: { suit: "army" },
          when: { absent: { suit: "land" } },
        },
        {
          kind: "points",
          points: 20,
          per: { suit: "army" },
          when: { present: { suit: "land" } },
        },
      ]);

      expect(calculateScore([subject, anArmy])).toBe(16);
      expect(calculateScore([subject, anArmy, aLand])).toBe(35);
    });
  });

  describe("blanked cards in scoring", () => {
    const blanker = card("blanker", "beast", 30, [
      { kind: "blank", targets: [{ suit: "army" }, { suit: "beast" }] },
    ]);

    it("ignores the effects of a blanked card", () => {
      const penalised = card("penalised", "army", 10, [
        { kind: "points", points: -8 },
      ]);

      expect(calculateScore([blanker, penalised])).toBe(30);
    });

    it("doesn't count a blanked card toward per", () => {
      const subject = card("subject", "wizard", 1, [pointsPerArmy]);

      expect(calculateScore([blanker, subject, anArmy])).toBe(31);
    });

    it("doesn't let a blanked card satisfy a condition", () => {
      const subject = card("subject", "wizard", 1, [
        { kind: "points", points: 5, when: { present: { suit: "army" } } },
      ]);

      expect(calculateScore([blanker, subject, anArmy])).toBe(31);
    });

    it("treats a blanked card as absent", () => {
      const subject = card("subject", "wizard", 1, [
        { kind: "points", points: -1, when: { absent: { suit: "army" } } },
      ]);

      expect(calculateScore([blanker, subject, anArmy])).toBe(30);
    });
  });

  describe("allOf conditions", () => {
    const subject = card("subject", "wizard", 1, [
      {
        kind: "points",
        points: 50,
        when: {
          allOf: [
            { present: { cardId: "land-1" } },
            { present: { suit: "leader" } },
          ],
        },
      },
    ]);

    it("applies when every condition holds", () => {
      expect(calculateScore([subject, aLand, aLeader])).toBe(58);
    });

    it("doesn't apply when any condition fails", () => {
      expect(calculateScore([subject, aLand])).toBe(5);
      expect(calculateScore([subject, aLeader])).toBe(4);
    });

    it("applies only once however many cards match", () => {
      const anotherLeader = card("leader-2", "leader", 2);

      expect(calculateScore([subject, aLand, aLeader, anotherLeader])).toBe(60);
    });

    it("can combine present and absent", () => {
      const mixed = card("subject", "wizard", 1, [
        {
          kind: "points",
          points: 5,
          when: {
            allOf: [
              { present: { suit: "land" } },
              { absent: { suit: "leader" } },
            ],
          },
        },
      ]);

      expect(calculateScore([mixed, aLand])).toBe(10);
      expect(calculateScore([mixed, aLand, aLeader])).toBe(8);
    });

    it("doesn't let a blanked card satisfy a condition", () => {
      const blanksLeaders = card("blanker", "beast", 30, [
        { kind: "blank", targets: [{ suit: "leader" }] },
      ]);

      expect(calculateScore([subject, aLand, aLeader, blanksLeaders])).toBe(35);
    });
  });

  describe("anyOf conditions", () => {
    const withArmyOrLand: EffectCondition = {
      anyOf: [{ present: { suit: "army" } }, { present: { suit: "land" } }],
    };
    const subject = card("subject", "wizard", 1, [
      { kind: "points", points: 5, when: withArmyOrLand },
    ]);

    it("doesn't apply when no condition holds", () => {
      expect(calculateScore([subject, aLeader])).toBe(4); // 1 + 3
    });

    it("applies when the first condition holds", () => {
      expect(calculateScore([subject, anArmy])).toBe(16); // (1 + 5) + 10
    });

    it("applies when a later condition holds", () => {
      expect(calculateScore([subject, aLand])).toBe(10); // (1 + 5) + 4
    });

    it("applies only once when several conditions hold", () => {
      expect(calculateScore([subject, anArmy, aLand])).toBe(20); // (1 + 5) + 10 + 4
    });

    it("doesn't count a blanked card", () => {
      const blanksArmies = card("blanker", "weapon", 1, [
        { kind: "blank", targets: [{ suit: "army" }] },
      ]);

      expect(calculateScore([subject, anArmy, blanksArmies])).toBe(2); // 1 + 1, Army blanked
    });

    it("can be excluded by another clause through allOf", () => {
      const unlessLeader = card("subject", "wizard", 1, [
        {
          kind: "points",
          points: 5,
          when: { allOf: [{ absent: { suit: "leader" } }, withArmyOrLand] },
        },
      ]);

      expect(calculateScore([unlessLeader, anArmy])).toBe(16); // (1 + 5) + 10
      expect(calculateScore([unlessLeader, anArmy, aLeader])).toBe(14); // 1 + 10 + 3
    });

    it("stops being excluded when the excluding card is blanked", () => {
      const unlessLeader = card("subject", "wizard", 1, [
        {
          kind: "points",
          points: 5,
          when: { allOf: [{ absent: { suit: "leader" } }, withArmyOrLand] },
        },
      ]);
      const blanksLeaders = card("blanker", "weapon", 1, [
        { kind: "blank", targets: [{ suit: "leader" }] },
      ]);

      expect(
        calculateScore([unlessLeader, anArmy, aLeader, blanksLeaders]),
      ).toBe(17); // (1 + 5) + 10 + 1, Leader blanked
    });

    it("works as a self-blank condition", () => {
      const blanked = card("subject", "wizard", 1, [
        { kind: "blankSelf", when: withArmyOrLand },
      ]);

      expect(calculateScore([blanked, anArmy])).toBe(10); // Army 10, subject blanked
      expect(calculateScore([blanked, aLeader])).toBe(4); // 1 + 3
    });
  });

  describe("clearPenalty effects", () => {
    const clearsFloods = card("clearer", "land", 9, [
      { kind: "clearPenalty", targets: [{ suit: "flood" }] },
    ]);
    const penalisedFlood: Card = {
      ...card("flood-1", "flood", 5),
      bonus: { text: "", effects: [{ kind: "points", points: 3 }] },
      penalty: { text: "", effects: [{ kind: "points", points: -10 }] },
    };
    const blankingFlood: Card = {
      ...card("flood-2", "flood", 5),
      penalty: {
        text: "",
        effects: [{ kind: "blank", targets: [{ suit: "land" }] }],
      },
    };

    it("removes the penalty of each targeted card, keeping its bonus", () => {
      expect(calculateScore([penalisedFlood])).toBe(-2);
      expect(calculateScore([clearsFloods, penalisedFlood])).toBe(17);
    });

    it("leaves other suits' penalties alone", () => {
      const penalisedArmy: Card = {
        ...card("army-3", "army", 5),
        penalty: { text: "", effects: [{ kind: "points", points: -2 }] },
      };

      expect(calculateScore([clearsFloods, penalisedArmy])).toBe(12);
    });

    it("resolves before blanks, so a cleared penalty blanks nothing", () => {
      expect(calculateScore([blankingFlood, aLand])).toBe(5);
      expect(calculateScore([clearsFloods, blankingFlood])).toBe(14);
    });

    it("still clears when the clearing card is later blanked", () => {
      const blanksLands = card("blanker", "wizard", 1, [
        { kind: "blank", targets: [{ suit: "land" }] },
      ]);

      expect(calculateScore([clearsFloods, penalisedFlood, blanksLands])).toBe(
        9,
      );
    });

    it("leaves a cleared card's suit and name counting for other cards", () => {
      const subject = card("subject", "wizard", 1, [
        { kind: "points", points: 5, per: { suit: "flood" } },
        { kind: "points", points: 7, when: { present: { cardId: "flood-1" } } },
      ]);

      expect(calculateScore([clearsFloods, penalisedFlood, subject])).toBe(30);
    });

    it("doesn't clear the clearing card's own penalty", () => {
      const clearsOwnSuit: Card = {
        ...card("flood-3", "flood", 5),
        bonus: {
          text: "",
          effects: [{ kind: "clearPenalty", targets: [{ suit: "flood" }] }],
        },
        penalty: { text: "", effects: [{ kind: "points", points: -2 }] },
      };

      expect(calculateScore([clearsOwnSuit])).toBe(3);
    });

    it("doesn't apply a clear when no card matches", () => {
      expect(calculateScore([clearsFloods, aLand])).toBe(13);
    });
  });

  describe("choices of a card to clear", () => {
    // Clears the penalty on one Flood or Flame in the hand, chosen by the player.
    const chooser: Card = {
      ...card("chooser", "flood", 14, [
        { kind: "clearPenalty", targets: [{ chosen: true }] },
      ]),
      choice: {
        kind: "cardInHand",
        from: [{ suit: "flood" }, { suit: "flame" }],
      },
    };
    const penalisedFlood: Card = {
      ...card("flood-1", "flood", 5),
      penalty: { text: "", effects: [{ kind: "points", points: -10 }] },
    };
    const penalisedFlame: Card = {
      ...card("flame-1", "flame", 6),
      penalty: { text: "", effects: [{ kind: "points", points: -4 }] },
    };
    const penalisedArmy: Card = {
      ...card("army-3", "army", 7),
      penalty: { text: "", effects: [{ kind: "points", points: -3 }] },
    };

    it("clears the penalty of the chosen card only", () => {
      // 14 + Flood 5 (cleared) + Flame (6 - 4)
      expect(
        calculateScore([chooser, penalisedFlood, penalisedFlame], {
          chooser: { cardId: "flood-1" },
        }),
      ).toBe(21);
    });

    it("clears nothing while the choice is pending", () => {
      // 14 + Flood (5 - 10) + Flame (6 - 4)
      expect(calculateScore([chooser, penalisedFlood, penalisedFlame])).toBe(
        11,
      );
    });

    it("ignores a choice of a card that doesn't match", () => {
      // 14 + Army (7 - 3) + Flood (5 - 10)
      expect(
        calculateScore([chooser, penalisedArmy, penalisedFlood], {
          chooser: { cardId: "army-3" },
        }),
      ).toBe(13);
    });

    it("ignores a choice of a card that isn't in the hand", () => {
      // 14 + Flood (5 - 10)
      expect(
        calculateScore([chooser, penalisedFlood], {
          chooser: { cardId: "flame-1" },
        }),
      ).toBe(9);
    });

    it("reports the chosen card and the other cards that match", () => {
      const { cards } = scoreHand(
        [chooser, penalisedFlood, penalisedArmy, penalisedFlame],
        { chooser: { cardId: "flame-1" } },
      );

      expect(cards[0].choice).toEqual({
        chosenId: "flame-1",
        optionIds: ["flood-1", "flame-1"],
      });
    });

    it("reports an invalid choice as pending", () => {
      const { cards } = scoreHand([chooser, penalisedArmy], {
        chooser: { cardId: "army-3" },
      });

      expect(cards[0].choice).toEqual({ chosenId: null, optionIds: [] });
    });

    it("still clears when the choosing card is later blanked", () => {
      const blanksChooser = card("blanker", "wizard", 1, [
        { kind: "blank", targets: [{ cardId: "chooser" }] },
      ]);

      // Chooser blanked + Flood 5 (cleared) + 1
      const handScore = scoreHand([chooser, penalisedFlood, blanksChooser], {
        chooser: { cardId: "flood-1" },
      });

      expect(handScore.total).toBe(6);
      expect(handScore.cards[0]).toEqual({
        cardId: "chooser",
        blanked: true,
        base: 0,
        bonus: 0,
        penalty: 0,
        total: 0,
        choice: { chosenId: "flood-1", optionIds: ["flood-1"] },
      });
    });

    it("stops the chosen card blanking others when it clears a blank", () => {
      const blankingFlame: Card = {
        ...card("flame-2", "flame", 6),
        penalty: {
          text: "",
          effects: [{ kind: "blank", targets: [{ suit: "land" }] }],
        },
      };

      // 14 + Flame 6, with the Land blanked
      expect(calculateScore([chooser, blankingFlame, aLand])).toBe(20);
      // 14 + Flame 6 (cleared) + Land 4
      expect(
        calculateScore([chooser, blankingFlame, aLand], {
          chooser: { cardId: "flame-2" },
        }),
      ).toBe(24);
    });
  });

  describe("pre-scoring addToHand effects", () => {
    // Before scoring, takes one Army or Beast from the discard area into the hand, chosen by the player.
    const adder: Card = {
      ...card("adder", "wizard", 3),
      preScoring: [{ kind: "addToHand", card: { chosen: true } }],
      choice: {
        kind: "cardInDiscardArea",
        from: [{ suit: "army" }, { suit: "beast" }],
      },
    };
    const aBeast = card("beast-1", "beast", 8);
    const deckCards = [aBeast, anArmy, aLand];
    const rules = { deckCards, preScoring: ["adder"] };
    const penalisedArmy: Card = {
      ...card("army-3", "army", 7),
      penalty: { text: "", effects: [{ kind: "points", points: -3 }] },
    };
    // Clears the penalty on one Army in the hand, chosen by the player.
    const clearer: Card = {
      ...card("clearer", "flood", 1, [
        { kind: "clearPenalty", targets: [{ chosen: true }] },
      ]),
      choice: { kind: "cardInHand", from: [{ suit: "army" }] },
    };

    it("adds the chosen card to the hand", () => {
      // 3 + Beast 8
      expect(
        calculateScore([adder], { adder: { cardId: "beast-1" } }, rules),
      ).toBe(11);
    });

    it("adds nothing while the choice is pending", () => {
      expect(calculateScore([adder], {}, rules)).toBe(3);
    });

    it("adds nothing when the variant doesn't list the card", () => {
      expect(
        calculateScore(
          [adder],
          { adder: { cardId: "beast-1" } },
          { deckCards, preScoring: [] },
        ),
      ).toBe(3);
    });

    it("ignores listed cards that aren't in the hand", () => {
      expect(
        calculateScore(
          [adder],
          { adder: { cardId: "beast-1" } },
          { deckCards, preScoring: ["absent", "adder", "also-absent"] },
        ),
      ).toBe(11);
    });

    it("ignores a choice of a card that doesn't match", () => {
      expect(
        calculateScore([adder], { adder: { cardId: "land-1" } }, rules),
      ).toBe(3);
    });

    it("ignores a choice of a card that is already in the hand", () => {
      // 3 + Beast 8, counted once
      expect(
        calculateScore(
          [adder, aBeast],
          { adder: { cardId: "beast-1" } },
          rules,
        ),
      ).toBe(11);
    });

    it("ignores a choice of a card that isn't in the discard area", () => {
      expect(
        calculateScore(
          [adder],
          { adder: { cardId: "beast-1" } },
          { deckCards: [anArmy], preScoring: ["adder"] },
        ),
      ).toBe(3);
    });

    it("counts the added card for other cards", () => {
      const perArmy = card("counter", "leader", 1, [pointsPerArmy]);

      // 3 + (1 + 5 for the Army) + Army 10
      expect(
        calculateScore(
          [adder, perArmy],
          { adder: { cardId: "army-1" } },
          rules,
        ),
      ).toBe(19);
    });

    it("lets a card in the hand blank the added card", () => {
      const blanksArmies = card("blanker", "flood", 2, [
        { kind: "blank", targets: [{ suit: "army" }] },
      ]);

      // 3 + 2, with the Army blanked
      expect(
        calculateScore(
          [adder, blanksArmies],
          { adder: { cardId: "army-1" } },
          rules,
        ),
      ).toBe(5);
    });

    it("keeps the added card when the adding card is blanked", () => {
      const blanksWizards = card("blanker", "land", 4, [
        { kind: "blank", targets: [{ suit: "wizard" }] },
      ]);

      // Adder blanked + 4 + Beast 8
      expect(
        calculateScore(
          [adder, blanksWizards],
          { adder: { cardId: "beast-1" } },
          rules,
        ),
      ).toBe(12);
    });

    it("keeps the added card when it blanks the adding card", () => {
      const beastBlankingWizards = card("beast-2", "beast", 35, [
        { kind: "blank", targets: [{ suit: "wizard" }] },
      ]);

      // Adder blanked + Beast 35
      expect(
        calculateScore(
          [adder],
          { adder: { cardId: "beast-2" } },
          { deckCards: [beastBlankingWizards], preScoring: ["adder"] },
        ),
      ).toBe(35);
    });

    it("lets an unlisted choice choose the added card, as it resolves afterwards", () => {
      const penalisedRules = {
        deckCards: [penalisedArmy],
        preScoring: ["adder"],
      };

      // 3 + 1 + Army (7 - 3)
      expect(
        calculateScore(
          [adder, clearer],
          { adder: { cardId: "army-3" } },
          penalisedRules,
        ),
      ).toBe(8);
      // 3 + 1 + Army 7 (cleared)
      expect(
        calculateScore(
          [adder, clearer],
          { adder: { cardId: "army-3" }, clearer: { cardId: "army-3" } },
          penalisedRules,
        ),
      ).toBe(11);
    });

    it("fires in the variant's order, each against the hand the cards before it left", () => {
      // Another card that adds an Army or Beast, so the two compete for the same card.
      const secondAdder: Card = { ...adder, id: "second", name: "second" };
      const hand = [adder, secondAdder];
      const choices = {
        adder: { cardId: "beast-1" },
        second: { cardId: "beast-1" },
      };

      const adderFirst = scoreHand(hand, choices, {
        deckCards,
        preScoring: ["adder", "second"],
      });
      const secondFirst = scoreHand(hand, choices, {
        deckCards,
        preScoring: ["second", "adder"],
      });

      // The first in the order takes the Beast, so the other's choice no longer fits. 3 + 3 + Beast 8
      expect(adderFirst.total).toBe(14);
      expect(
        adderFirst.cards.map(({ cardId, addedBy, choice }) => [
          cardId,
          addedBy,
          choice?.chosenId,
        ]),
      ).toEqual([
        ["adder", undefined, "beast-1"],
        ["second", undefined, null],
        ["beast-1", "adder", undefined],
      ]);
      expect(
        secondFirst.cards.map(({ cardId, addedBy, choice }) => [
          cardId,
          addedBy,
          choice?.chosenId,
        ]),
      ).toEqual([
        ["adder", undefined, null],
        ["second", undefined, "beast-1"],
        ["beast-1", "second", undefined],
      ]);
    });

    it("scores a listed card's bonus at the normal time, with the cards then in play", () => {
      // Also +5 for each Army, which counts the Army it added.
      const adderWithBonus: Card = {
        ...adder,
        bonus: { text: "", effects: [pointsPerArmy] },
      };
      const blanksArmies = card("blanker", "flood", 2, [
        { kind: "blank", targets: [{ suit: "army" }] },
      ]);

      // (3 + 5) + Army 10
      expect(
        calculateScore(
          [adderWithBonus],
          { adder: { cardId: "army-1" } },
          rules,
        ),
      ).toBe(18);
      // The Army is added, then blanked, so the bonus counts none. 3 + 2
      expect(
        calculateScore(
          [adderWithBonus, blanksArmies],
          { adder: { cardId: "army-1" } },
          rules,
        ),
      ).toBe(5);
    });

    it("doesn't check a listed card's choice early unless it has pre-scoring effects", () => {
      const penalisedRules = {
        deckCards: [penalisedArmy],
        preScoring: ["clearer", "adder"],
      };

      // The clearer is listed first, but has no pre-scoring effects, so its choice is checked after the Army is added.
      // 3 + 1 + Army 7 (cleared)
      expect(
        calculateScore(
          [adder, clearer],
          { adder: { cardId: "army-3" }, clearer: { cardId: "army-3" } },
          penalisedRules,
        ),
      ).toBe(11);
    });

    it("lists the added card after the hand, with the card that added it", () => {
      const { cards } = scoreHand(
        [adder, anotherArmy],
        { adder: { cardId: "army-1" } },
        {
          deckCards: [aBeast, anArmy, aLand, adder, anotherArmy],
          preScoring: ["adder"],
        },
      );

      expect(cards).toEqual([
        {
          cardId: "adder",
          blanked: false,
          base: 3,
          bonus: 0,
          penalty: 0,
          total: 3,
          // Matching cards in the discard area, leaving out those in the hand
          choice: { chosenId: "army-1", optionIds: ["beast-1", "army-1"] },
        },
        {
          cardId: "army-2",
          blanked: false,
          base: 20,
          bonus: 0,
          penalty: 0,
          total: 20,
        },
        {
          cardId: "army-1",
          blanked: false,
          base: 10,
          bonus: 0,
          penalty: 0,
          total: 10,
          addedBy: "adder",
        },
      ]);
    });

    it("reports a choice of a card now in the hand as pending", () => {
      const { cards } = scoreHand(
        [adder, aBeast],
        { adder: { cardId: "beast-1" } },
        rules,
      );

      expect(cards).toHaveLength(2);
      expect(cards[0].choice).toEqual({
        chosenId: null,
        optionIds: ["army-1"],
      });
    });
  });

  describe("pre-scoring take effects", () => {
    // Before scoring, takes the name and suit of any one Beast or Leader in the game.
    const taker: Card = {
      ...card("taker", "wild", 0),
      preScoring: [
        { kind: "take", from: { chosen: true }, attributes: ["name", "suit"] },
      ],
      choice: {
        kind: "cardInGame",
        from: [{ suit: "beast" }, { suit: "leader" }],
      },
    };
    // A Beast with a bonus, which the taker mustn't take.
    const bigBeast = card("beast-9", "beast", 30, [
      { kind: "points", points: 10 },
    ]);
    const aBeast = card("beast-1", "beast", 8);
    const rules = {
      deckCards: [taker, bigBeast, aLeader],
      preScoring: ["taker"],
    };

    it("takes the chosen card's suit, which counts for other cards", () => {
      const perBeast = card("counter", "land", 1, [
        { kind: "points", points: 5, per: { suit: "beast" } },
      ]);

      // 0 + (1 + 5 for the taker as a Beast)
      expect(
        calculateScore(
          [taker, perBeast],
          { taker: { cardId: "beast-9" } },
          rules,
        ),
      ).toBe(6);
      // Pending: the taker is still Wild. 0 + 1
      expect(calculateScore([taker, perBeast], {}, rules)).toBe(1);
    });

    it("keeps its own base strength, bonus and penalty, and reports the suit it took", () => {
      const { cards } = scoreHand(
        [taker],
        { taker: { cardId: "beast-9" } },
        rules,
      );

      expect(cards[0]).toEqual({
        cardId: "taker",
        blanked: false,
        base: 0,
        bonus: 0,
        penalty: 0,
        total: 0,
        suit: "beast",
        choice: { chosenId: "beast-9", optionIds: ["beast-9", "leader-1"] },
      });
    });

    it("takes the chosen card's name, so rules naming that card match it", () => {
      const withNamed = card("namer", "land", 1, [
        {
          kind: "points",
          points: 20,
          when: { present: { cardId: "beast-9" } },
        },
      ]);

      // 0 + (1 + 20)
      expect(
        calculateScore(
          [taker, withNamed],
          { taker: { cardId: "beast-9" } },
          rules,
        ),
      ).toBe(21);
      expect(calculateScore([taker, withNamed], {}, rules)).toBe(1);
    });

    it("is left out of a blank that leaves out the card it named, but only when it took the name", () => {
      const blanksOtherBeasts = card("blanker", "flood", 2, [
        { kind: "blank", targets: [{ suit: "beast", except: ["beast-9"] }] },
      ]);
      const suitOnly: Card = {
        ...taker,
        preScoring: [
          { kind: "take", from: { chosen: true }, attributes: ["suit"] },
        ],
      };
      const hand = [blanksOtherBeasts, aBeast];

      // Taker 0 as beast-9, kept + 2, with the other Beast blanked
      expect(
        scoreHand([taker, ...hand], { taker: { cardId: "beast-9" } }, rules)
          .cards[0].blanked,
      ).toBe(false);
      // Only the suit, so it's just another Beast, and blanked
      expect(
        scoreHand([suitOnly, ...hand], { taker: { cardId: "beast-9" } }, rules)
          .cards[0].blanked,
      ).toBe(true);
    });

    it("isn't blanked by a rule for its old suit once it takes another", () => {
      const blanksWild = card("blanker", "flood", 2, [
        { kind: "blank", targets: [{ suit: "wild" }] },
      ]);

      expect(
        scoreHand([taker, blanksWild], { taker: { cardId: "leader-1" } }, rules)
          .cards[0].blanked,
      ).toBe(false);
      expect(scoreHand([taker, blanksWild], {}, rules).cards[0].blanked).toBe(
        true,
      );
    });

    it("may take a card that is also in the hand, giving two cards of that name", () => {
      const perNamed = card("per-named", "land", 1, [
        { kind: "points", points: 3, per: { cardId: "beast-9" } },
      ]);

      // Taker 0 + Beast (30 + 10) + (1 + 3 for each of the two)
      expect(
        calculateScore(
          [taker, bigBeast, perNamed],
          { taker: { cardId: "beast-9" } },
          rules,
        ),
      ).toBe(47);
    });

    it("takes nothing when the variant doesn't list the card", () => {
      const perBeast = card("counter", "land", 1, [
        { kind: "points", points: 5, per: { suit: "beast" } },
      ]);

      expect(
        calculateScore(
          [taker, perBeast],
          { taker: { cardId: "beast-9" } },
          { ...rules, preScoring: [] },
        ),
      ).toBe(1);
    });
  });

  describe("pre-scoring take of base strength and penalty", () => {
    // Before scoring, takes the name, base strength, suit and penalty of any one Army or Land in the hand. Its own penalty is replaced.
    const duplicator: Card = {
      ...card("duplicator", "wild", 0),
      penalty: { text: "", effects: [{ kind: "points", points: -10 }] },
      preScoring: [
        {
          kind: "take",
          from: { chosen: true },
          attributes: ["name", "baseStrength", "suit", "penalty"],
        },
      ],
      choice: {
        kind: "cardInHand",
        from: [{ suit: "army" }, { suit: "land" }],
      },
    };
    // An Army with a bonus, which the duplicator mustn't take, and a penalty, which it must.
    const grunt: Card = {
      ...card("grunt", "army", 15, [{ kind: "points", points: 4 }]),
      penalty: {
        text: "",
        effects: [{ kind: "points", points: -2, per: { suit: "army" } }],
      },
    };
    const rules = { deckCards: [], preScoring: ["duplicator"] };

    it("takes the chosen card's base strength and penalty, but not its bonus", () => {
      const { cards, total } = scoreHand(
        [duplicator, grunt],
        { duplicator: { cardId: "grunt" } },
        rules,
      );

      // Duplicator (15 - 2 for the grunt) + grunt (15 + 4 - 2 for the duplicator, now an Army)
      expect(total).toBe(30);
      expect(cards[0]).toEqual({
        cardId: "duplicator",
        blanked: false,
        base: 15,
        bonus: 0,
        penalty: -2,
        total: 13,
        suit: "army",
        choice: { chosenId: "grunt", optionIds: ["grunt"] },
      });
    });

    it("keeps its own base strength and penalty while the choice is pending", () => {
      // Duplicator (0 - 10) + grunt (15 + 4)
      expect(calculateScore([duplicator, grunt], {}, rules)).toBe(9);
    });

    it("loses its own penalty when the chosen card has none", () => {
      // Duplicator 4 as a Land + Land 4
      expect(
        calculateScore(
          [duplicator, aLand],
          { duplicator: { cardId: "land-1" } },
          rules,
        ),
      ).toBe(8);
    });

    it("has the taken penalty cleared by a clear on the suit it took", () => {
      const clearsArmies = card("clearer", "land", 1, [
        { kind: "clearPenalty", targets: [{ suit: "army" }] },
      ]);

      // Duplicator 15 + grunt (15 + 4) + clearer 1, with both Army penalties cleared
      expect(
        calculateScore(
          [duplicator, grunt, clearsArmies],
          { duplicator: { cardId: "grunt" } },
          rules,
        ),
      ).toBe(35);
    });
  });

  describe("pre-scoring give effects", () => {
    // Before scoring, gives one other card in the hand a suit, both chosen by the player.
    const giver: Card = {
      ...card("giver", "artifact", 3),
      preScoring: [
        { kind: "give", to: { chosen: true }, suit: { chosenSuit: true } },
      ],
      choice: {
        kind: "cardInHand",
        from: [{ suit: "land" }, { suit: "army" }, { suit: "artifact" }],
        suits: ["land", "army", "flame"],
      },
    };
    const rules = { deckCards: [], preScoring: ["giver"] };
    // +5 for each Army.
    const perArmy = card("counter", "wizard", 1, [pointsPerArmy]);
    const toArmy = { giver: { cardId: "land-1", suit: "army" as const } };

    it("gives the chosen card the chosen suit, which counts for other cards", () => {
      // Giver 3 + Land 4 + (1 + 5 for the Land as an Army)
      expect(calculateScore([giver, aLand, perArmy], toArmy, rules)).toBe(13);
    });

    it("gives nothing while the card or the suit is pending", () => {
      // Giver 3 + Land 4 + 1
      expect(calculateScore([giver, aLand, perArmy], {}, rules)).toBe(8);
      expect(
        calculateScore(
          [giver, aLand, perArmy],
          { giver: { cardId: "land-1" } },
          rules,
        ),
      ).toBe(8);
    });

    it("gives nothing for a suit the choice doesn't include, or the card already has", () => {
      const hand = [giver, aLand, perArmy];
      const report = (suit: Card["suit"]) =>
        scoreHand(hand, { giver: { cardId: "land-1", suit } }, rules).cards[0]
          .choice;

      // Giver 3 + Land 4 + 1
      expect(
        calculateScore(
          hand,
          { giver: { cardId: "land-1", suit: "wizard" } },
          rules,
        ),
      ).toBe(8);
      expect(report("wizard")?.chosenId).toBeNull();
      expect(report("land")?.chosenId).toBeNull();
      expect(report("land")?.chosenSuit).toBeNull();
    });

    it("reports the suits each option may be given, leaving out its own, and never offers the giver", () => {
      const { cards } = scoreHand([giver, aLand, anArmy], toArmy, rules);

      expect(cards[0].choice).toEqual({
        chosenId: "land-1",
        chosenSuit: "army",
        optionIds: ["land-1", "army-1"],
        suitOptions: {
          "land-1": ["army", "flame"],
          "army-1": ["land", "flame"],
        },
      });
    });

    it("keeps the chosen card's name, base strength, bonus and penalty, and reports the suit it was scored as", () => {
      const penalisedLand: Card = {
        ...card("land-2", "land", 6, [{ kind: "points", points: 2 }]),
        penalty: { text: "", effects: [{ kind: "points", points: -1 }] },
      };
      const withNamed = card("namer", "wizard", 1, [
        { kind: "points", points: 10, when: { present: { cardId: "land-2" } } },
      ]);

      const { cards } = scoreHand(
        [giver, penalisedLand, withNamed],
        { giver: { cardId: "land-2", suit: "flame" } },
        rules,
      );

      expect(cards[1]).toEqual({
        cardId: "land-2",
        blanked: false,
        base: 6,
        bonus: 2,
        penalty: -1,
        total: 7,
        suit: "flame",
      });
      // 1 + 10, as the name still matches
      expect(cards[2].total).toBe(11);
      // The giver keeps its own suit
      expect(cards[0].suit).toBeUndefined();
    });

    it("changes what blanks the chosen card", () => {
      const blanksLands = card("blanker", "flood", 2, [
        { kind: "blank", targets: [{ suit: "land" }] },
      ]);
      const blanksFlames = card("blanker", "flood", 2, [
        { kind: "blank", targets: [{ suit: "flame" }] },
      ]);
      const toFlame = { giver: { cardId: "land-1", suit: "flame" as const } };

      expect(
        scoreHand([giver, aLand, blanksLands], toFlame, rules).cards[1].blanked,
      ).toBe(false);
      expect(
        scoreHand([giver, aLand, blanksFlames], toFlame, rules).cards[1]
          .blanked,
      ).toBe(true);
    });

    it("still gives the suit when the giver is blanked", () => {
      const blanksArtifacts = card("blanker", "flood", 2, [
        { kind: "blank", targets: [{ suit: "artifact" }] },
      ]);

      // Giver blanked + Land 4 + (1 + 5 for the Land as an Army) + 2
      expect(
        calculateScore([giver, aLand, perArmy, blanksArtifacts], toArmy, rules),
      ).toBe(12);
    });

    it("gives a suit to a card that an earlier pre-scoring card added, and reports it", () => {
      const adder: Card = {
        ...card("adder", "wizard", 0),
        preScoring: [{ kind: "addToHand", card: { chosen: true } }],
        choice: { kind: "cardInDiscardArea", from: [{ suit: "land" }] },
      };
      const addThenGive = {
        deckCards: [aLand],
        preScoring: ["adder", "giver"],
      };

      const { cards, total } = scoreHand(
        [adder, giver, perArmy],
        { adder: { cardId: "land-1" }, ...toArmy },
        addThenGive,
      );

      expect(cards[3]).toMatchObject({ cardId: "land-1", suit: "army" });
      // 0 + Giver 3 + (1 + 5 for the Land as an Army) + Land 4
      expect(total).toBe(13);
    });

    it("overrides a suit an earlier pre-scoring card took", () => {
      // Takes the suit of any Land in the game.
      const taker: Card = {
        ...card("taker", "wild", 0),
        preScoring: [
          { kind: "take", from: { chosen: true }, attributes: ["suit"] },
        ],
        choice: { kind: "cardInGame", from: [{ suit: "land" }] },
      };
      const takeThenGive = {
        deckCards: [aLand],
        preScoring: ["taker", "giver"],
      };
      const choices = {
        taker: { cardId: "land-1" },
        giver: { cardId: "taker", suit: "army" as const },
      };

      const { cards } = scoreHand(
        [taker, giver, perArmy],
        choices,
        takeThenGive,
      );

      // The taker, now a Land, may become an Army or a Flame, but not a Land
      expect(cards[1].choice?.suitOptions).toEqual({
        taker: ["army", "flame"],
      });
      expect(cards[0].suit).toBe("army");
      // 1 + 5 for the taker as an Army
      expect(cards[2].total).toBe(6);
    });

    it("gives nothing when the variant doesn't list the card", () => {
      // Giver 3 + Land 4 + 1
      expect(
        calculateScore([giver, aLand, perArmy], toArmy, {
          ...rules,
          preScoring: [],
        }),
      ).toBe(8);
    });
  });

  describe("self-blanked cards in scoring", () => {
    const blankedWithoutArmy: CardEffect = {
      kind: "blankSelf",
      when: { absent: { suit: "army" } },
    };
    const selfBlanker: Card = {
      ...card("self-blanker", "weapon", 35),
      bonus: { text: "", effects: [{ kind: "points", points: 5 }] },
      penalty: { text: "", effects: [blankedWithoutArmy] },
    };

    it("blanks the card when the condition holds, ignoring its bonus", () => {
      expect(calculateScore([selfBlanker])).toBe(0);
      expect(calculateScore([selfBlanker, aLand])).toBe(4);
    });

    it("doesn't count a self-blanked card toward per", () => {
      const subject = card("subject", "wizard", 1, [
        { kind: "points", points: 5, per: { suit: "weapon" } },
      ]);

      expect(calculateScore([selfBlanker, subject])).toBe(1);
    });

    it("doesn't apply when the penalty is cleared", () => {
      const clearsWeapons = card("clearer", "land", 1, [
        { kind: "clearPenalty", targets: [{ suit: "weapon" }] },
      ]);

      expect(calculateScore([selfBlanker, clearsWeapons])).toBe(41);
    });

    it("treats a self-blanked card as absent when points are added", () => {
      const withoutWeapon = card("subject", "wizard", 1, [
        { kind: "points", points: 5, when: { absent: { suit: "weapon" } } },
      ]);

      expect(calculateScore([selfBlanker, withoutWeapon])).toBe(6); // 1 + 5, self-blanker blanked
    });

    it("counts for other cards when a clear keeps it in play", () => {
      const clearsWeapons = card("clearer", "land", 1, [
        { kind: "clearPenalty", targets: [{ suit: "weapon" }] },
      ]);
      const perWeapon = card("subject", "wizard", 1, [
        { kind: "points", points: 5, per: { suit: "weapon" } },
      ]);

      expect(calculateScore([selfBlanker, clearsWeapons, perWeapon])).toBe(47); // (35 + 5) + 1 + (1 + 5)
    });
  });

  describe("clearPenaltySuitWord effects", () => {
    const withPenalty = (base: Card, effects: readonly CardEffect[]): Card => ({
      ...base,
      penalty: { text: "", effects },
    });
    const subject = (effects: readonly CardEffect[]) =>
      withPenalty(card("subject", "flame", 10), effects);
    const clearer = card("clearer", "wizard", 1, [
      { kind: "clearPenaltySuitWord", suit: "army" },
    ]);
    const minusThreePerArmy: CardEffect = {
      kind: "points",
      points: -3,
      per: { suit: "army" },
    };

    it("leaves the penalty in place without the clearer", () => {
      expect(calculateScore([subject([minusThreePerArmy]), anArmy])).toBe(17); // (10 - 3) + 10
    });

    it("removes a per effect naming the suit", () => {
      expect(
        calculateScore([subject([minusThreePerArmy]), anArmy, clearer]),
      ).toBe(21); // 10 + 10 + 1
    });

    it("works wherever the clearer sits in the hand", () => {
      expect(
        calculateScore([clearer, anArmy, subject([minusThreePerArmy])]),
      ).toBe(21); // 1 + 10 + 10
    });

    it("keeps a per effect naming another suit", () => {
      expect(
        calculateScore([
          subject([
            minusThreePerArmy,
            { kind: "points", points: -3, per: { suit: "land" } },
          ]),
          anArmy,
          aLand,
          clearer,
        ]),
      ).toBe(22); // (10 - 3) + 10 + 4 + 1
    });

    it("removes the suit from blank targets, keeping the others", () => {
      expect(
        calculateScore([
          subject([
            { kind: "blank", targets: [{ suit: "army" }, { suit: "land" }] },
          ]),
          anArmy,
          aLand,
          clearer,
        ]),
      ).toBe(21); // 10 + 10 + 1, Land blanked
    });

    it("removes a self-blank that applies without the suit", () => {
      const blankedWithoutArmy: CardEffect = {
        kind: "blankSelf",
        when: { absent: { suit: "army" } },
      };

      expect(calculateScore([subject([blankedWithoutArmy])])).toBe(0);
      expect(calculateScore([subject([blankedWithoutArmy]), clearer])).toBe(11); // 10 + 1
    });

    it("removes a self-blank that applies with the suit", () => {
      expect(
        calculateScore([
          subject([{ kind: "blankSelf", when: { present: { suit: "army" } } }]),
          anArmy,
          clearer,
        ]),
      ).toBe(21); // 10 + 10 + 1
    });

    it("removes the effect when an allOf condition names the suit", () => {
      expect(
        calculateScore([
          subject([
            {
              kind: "points",
              points: -5,
              when: {
                allOf: [
                  { absent: { suit: "army" } },
                  { present: { suit: "land" } },
                ],
              },
            },
          ]),
          aLand,
          clearer,
        ]),
      ).toBe(15); // 10 + 4 + 1
    });

    it("removes the effect when an anyOf condition names the suit", () => {
      expect(
        calculateScore([
          subject([
            {
              kind: "points",
              points: -5,
              when: {
                anyOf: [
                  { present: { suit: "army" } },
                  { present: { suit: "land" } },
                ],
              },
            },
          ]),
          aLand,
          clearer,
        ]),
      ).toBe(15); // 10 + 4 + 1
    });

    it("keeps a condition naming another suit", () => {
      expect(
        calculateScore([
          subject([
            {
              kind: "points",
              points: -5,
              when: { absent: { suit: "leader" } },
            },
          ]),
          clearer,
        ]),
      ).toBe(6); // (10 - 5) + 1
    });

    it("keeps a condition naming a specific card of that suit", () => {
      expect(
        calculateScore([
          subject([
            {
              kind: "points",
              points: -5,
              when: { present: { cardId: anArmy.id } },
            },
          ]),
          anArmy,
          clearer,
        ]),
      ).toBe(16); // (10 - 5) + 10 + 1
    });

    it("leaves bonuses alone", () => {
      expect(
        calculateScore([
          card("subject", "flame", 1, [pointsPerArmy]),
          anArmy,
          clearer,
        ]),
      ).toBe(17); // (1 + 5) + 10 + 1
    });

    it("still clears when the clearer is blanked, as clearing comes first", () => {
      const blanksWizards = card("blanker", "weapon", 1, [
        { kind: "blank", targets: [{ suit: "wizard" }] },
      ]);

      expect(
        calculateScore([
          subject([minusThreePerArmy]),
          anArmy,
          clearer,
          blanksWizards,
        ]),
      ).toBe(21); // 10 + 10 + 1, clearer blanked
    });

    it("protects a clearer of that suit from being blanked", () => {
      const armyClearer = card("clearer", "army", 1, [
        { kind: "clearPenaltySuitWord", suit: "army" },
      ]);

      expect(
        calculateScore([
          subject([{ kind: "blank", targets: [{ suit: "army" }] }]),
          armyClearer,
        ]),
      ).toBe(11); // 10 + 1
    });

    it("keeps a blank naming a specific card of that suit", () => {
      expect(
        calculateScore([
          subject([{ kind: "blank", targets: [{ cardId: anArmy.id }] }]),
          anArmy,
          clearer,
        ]),
      ).toBe(11); // 10 + 1, Army blanked
    });

    it("counts for other cards when it keeps a self-blanking card in play", () => {
      const perFlame = card("counter", "wizard", 1, [
        { kind: "points", points: 5, per: { suit: "flame" } },
      ]);

      expect(
        calculateScore([
          subject([{ kind: "blankSelf", when: { absent: { suit: "army" } } }]),
          clearer,
          perFlame,
        ]),
      ).toBe(17); // 10 + 1 + (1 + 5)
    });

    it("works alongside a clear of the whole penalty", () => {
      const clearsFlames = card("whole-clearer", "land", 1, [
        { kind: "clearPenalty", targets: [{ suit: "flame" }] },
      ]);

      expect(
        calculateScore([
          subject([minusThreePerArmy, { kind: "points", points: -2 }]),
          anArmy,
          clearer,
          clearsFlames,
        ]),
      ).toBe(22); // 10 + 10 + 1 + 1
    });

    it("only counts when it's in the bonus slot", () => {
      const penaltyClearer = withPenalty(card("clearer", "wizard", 1), [
        { kind: "clearPenaltySuitWord", suit: "army" },
      ]);

      expect(
        calculateScore([subject([minusThreePerArmy]), anArmy, penaltyClearer]),
      ).toBe(18); // (10 - 3) + 10 + 1
    });

    describe("limited to targets", () => {
      const clearsArmyOnFloods: CardEffect = {
        kind: "clearPenaltySuitWord",
        suit: "army",
        targets: [{ suit: "flood" }],
      };
      const limitedClearer = card("clearer", "wizard", 1, [clearsArmyOnFloods]);
      const floodSubject = withPenalty(card("flood-1", "flood", 10), [
        minusThreePerArmy,
      ]);

      it("clears the word on a card matching a target", () => {
        expect(calculateScore([floodSubject, anArmy, limitedClearer])).toBe(21); // 10 + 10 + 1
      });

      it("leaves the word on a card matching no target", () => {
        expect(
          calculateScore([
            subject([minusThreePerArmy]),
            anArmy,
            limitedClearer,
          ]),
        ).toBe(18); // (10 - 3) + 10 + 1
      });

      it("treats matching and non-matching cards separately in one hand", () => {
        expect(
          calculateScore([
            floodSubject,
            subject([minusThreePerArmy]),
            anArmy,
            limitedClearer,
          ]),
        ).toBe(28); // 10 + (10 - 3) + 10 + 1
      });

      it("doesn't clear the clearer's own penalty, even if it matches a target", () => {
        const matchesItself = withPenalty(
          card("clearer", "flood", 1, [clearsArmyOnFloods]),
          [minusThreePerArmy],
        );

        expect(calculateScore([matchesItself, anArmy])).toBe(8); // (1 - 3) + 10
      });

      it("still clears when the clearer blanks itself", () => {
        const selfBlankingClearer = withPenalty(limitedClearer, [
          { kind: "blankSelf", when: { absent: { suit: "weather" } } },
        ]);

        expect(
          calculateScore([floodSubject, anArmy, selfBlankingClearer]),
        ).toBe(20); // 10 + 10, clearer blanked
      });
    });
  });

  describe("allSuitsDifferent conditions", () => {
    const allDifferent: EffectCondition = { allSuitsDifferent: true };
    const subject = card("subject", "artifact", 2, [
      { kind: "points", points: 50, when: allDifferent },
    ]);

    it("applies when every card is a different suit", () => {
      expect(calculateScore([subject, anArmy, aLeader, aLand])).toBe(69); // (2 + 50) + 10 + 3 + 4
    });

    it("applies to a part-built hand, even with no other cards", () => {
      expect(calculateScore([subject])).toBe(52); // 2 + 50
    });

    it("doesn't apply when two other cards share a suit", () => {
      expect(calculateScore([subject, anArmy, anotherArmy])).toBe(32); // 2 + 10 + 20
    });

    it("doesn't apply when another card shares the owner's suit", () => {
      const anotherArtifact = card("artifact-2", "artifact", 1);

      expect(calculateScore([subject, anotherArtifact])).toBe(3); // 2 + 1
    });

    it("treats Wild as a suit like any other", () => {
      const aWild = card("wild-1", "wild", 1);
      const anotherWild = card("wild-2", "wild", 1);

      expect(calculateScore([subject, aWild])).toBe(53); // (2 + 50) + 1
      expect(calculateScore([subject, aWild, anotherWild])).toBe(4); // 2 + 1 + 1
    });

    it("ignores a card blanked by another card", () => {
      const blanksAnotherArmy = card("blanker", "land", 4, [
        { kind: "blank", targets: [{ cardId: "army-2" }] },
      ]);

      expect(
        calculateScore([subject, anArmy, anotherArmy, blanksAnotherArmy]),
      ).toBe(66); // (2 + 50) + 10 + 4
    });

    it("ignores a self-blanked card", () => {
      const selfBlankingArmy = card("army-3", "army", 20, [
        { kind: "blankSelf", when: { absent: { suit: "weapon" } } },
      ]);

      expect(calculateScore([subject, anArmy, selfBlankingArmy])).toBe(62); // (2 + 50) + 10
    });

    it("counts a card that a clear keeps in play", () => {
      const aWeapon = card("weapon-1", "weapon", 5);
      const selfBlankingWeapon: Card = {
        ...card("weapon-2", "weapon", 40),
        penalty: {
          text: "",
          effects: [
            { kind: "blankSelf", when: { absent: { suit: "wizard" } } },
          ],
        },
      };
      const clearsWeapons = card("clearer", "land", 1, [
        { kind: "clearPenalty", targets: [{ suit: "weapon" }] },
      ]);

      expect(calculateScore([subject, aWeapon, selfBlankingWeapon])).toBe(57); // (2 + 50) + 5
      expect(
        calculateScore([subject, aWeapon, selfBlankingWeapon, clearsWeapons]),
      ).toBe(48); // 2 + 5 + 40 + 1
    });

    it("gives nothing when the owner is blanked", () => {
      const blanksArtifacts = card("blanker", "land", 4, [
        { kind: "blank", targets: [{ suit: "artifact" }] },
      ]);

      expect(calculateScore([subject, blanksArtifacts])).toBe(4);
    });

    it("combines with other conditions", () => {
      const needsArmyToo = card("subject", "artifact", 2, [
        {
          kind: "points",
          points: 50,
          when: { allOf: [allDifferent, { present: { suit: "army" } }] },
        },
      ]);

      expect(calculateScore([needsArmyToo, anArmy])).toBe(62); // (2 + 50) + 10
      expect(calculateScore([needsArmyToo, aLand])).toBe(6); // 2 + 4
    });

    it("includes the owner's suit when deciding a self-blank", () => {
      const blanksIfAllDifferent = card("subject", "wizard", 10, [
        { kind: "blankSelf", when: allDifferent },
      ]);
      const aWizard = card("wizard-1", "wizard", 1);

      expect(calculateScore([blanksIfAllDifferent, anArmy])).toBe(10); // subject blanked, army 10
      expect(calculateScore([blanksIfAllDifferent, aWizard])).toBe(11); // 10 + 1
    });

    it("isn't removed by clearing a suit word, as it names no suit", () => {
      const subjectWithPenalty: Card = {
        ...card("subject", "wizard", 10),
        penalty: {
          text: "",
          effects: [{ kind: "points", points: -5, when: allDifferent }],
        },
      };
      const clearsArmyWord = card("clearer", "land", 1, [
        { kind: "clearPenaltySuitWord", suit: "army" },
      ]);

      expect(calculateScore([subjectWithPenalty, clearsArmyWord])).toBe(6); // (10 - 5) + 1
    });
  });

  describe("baseStrengthRun effects", () => {
    const subject = card("subject", "artifact", 5, [
      {
        kind: "baseStrengthRun",
        tiers: [
          { length: 3, points: 10 },
          { length: 4, points: 30 },
          { length: 5, points: 60 },
          { length: 6, points: 100 },
          { length: 7, points: 150 },
        ],
      },
    ]);
    const strengths = (...values: readonly number[]): readonly Card[] =>
      values.map((value, index) =>
        card(`card-${index}-${value}`, "army", value),
      );

    it("pays nothing without a run", () => {
      expect(calculateScore([subject])).toBe(5);
      expect(calculateScore([subject, ...strengths(1, 9)])).toBe(15); // 5 + 1 + 9
      expect(calculateScore([subject, ...strengths(6)])).toBe(11); // 5 + 6, a run of 2
    });

    it("pays only the tier the run reaches, as tiers don't add up", () => {
      expect(calculateScore([subject, ...strengths(4, 6)])).toBe(25); // 5 + 4 + 6 + 10
      expect(calculateScore([subject, ...strengths(4, 6, 7)])).toBe(52); // 5 + 4 + 6 + 7 + 30
      expect(calculateScore([subject, ...strengths(3, 4, 6, 7)])).toBe(85); // 5 + 3 + 4 + 6 + 7 + 60
      expect(calculateScore([subject, ...strengths(3, 4, 6, 7, 8)])).toBe(133); // 5 + 3 + 4 + 6 + 7 + 8 + 100
      expect(calculateScore([subject, ...strengths(2, 3, 4, 6, 7, 8)])).toBe(
        185,
      ); // 5 + 2 + 3 + 4 + 6 + 7 + 8 + 150
    });

    it("pays nothing extra for a run longer than the top tier", () => {
      expect(calculateScore([subject, ...strengths(1, 2, 3, 4, 6, 7, 8)])).toBe(
        186,
      ); // 5 + 1 + 2 + 3 + 4 + 6 + 7 + 8 + 150
    });

    it("pays for a run that doesn't include the owner", () => {
      expect(calculateScore([subject, ...strengths(7, 8, 9)])).toBe(39); // 5 + 7 + 8 + 9 + 10
    });

    it("ignores duplicate strengths", () => {
      expect(calculateScore([subject, ...strengths(4, 5, 6)])).toBe(30); // 5 + 4 + 5 + 6 + 10, a run of 3
      expect(calculateScore([subject, ...strengths(6, 6)])).toBe(17); // 5 + 6 + 6, a run of 2
    });

    it("pays only the longest run", () => {
      expect(calculateScore([subject, ...strengths(4, 6, 9, 10, 11)])).toBe(55); // 5 + 4 + 6 + 9 + 10 + 11 + 10, two runs of 3
      expect(calculateScore([subject, ...strengths(6, 7, 8, 1, 2, 3)])).toBe(
        62,
      ); // 5 + 6 + 7 + 8 + 1 + 2 + 3 + 30, runs of 4 and 3
    });

    it("doesn't count a card blanked by another card", () => {
      const [four, six] = strengths(4, 6);
      const blanksSix = card("blanker", "land", 20, [
        { kind: "blank", targets: [{ cardId: six.id }] },
      ]);

      expect(calculateScore([subject, four, six, blanksSix])).toBe(29); // 5 + 4 + 20
    });

    it("doesn't count a self-blanked card", () => {
      const [four] = strengths(4);
      const selfBlankingSix = card("self-blanker", "army", 6, [
        { kind: "blankSelf", when: { absent: { suit: "weapon" } } },
      ]);

      expect(calculateScore([subject, four, selfBlankingSix])).toBe(9); // 5 + 4
    });

    it("counts a card that a clear keeps in play", () => {
      const [four] = strengths(4);
      const selfBlankingSix: Card = {
        ...card("self-blanker", "wizard", 6),
        penalty: {
          text: "",
          effects: [
            { kind: "blankSelf", when: { absent: { suit: "weapon" } } },
          ],
        },
      };
      const clearsWizards = card("clearer", "land", 20, [
        { kind: "clearPenalty", targets: [{ suit: "wizard" }] },
      ]);

      expect(calculateScore([subject, four, selfBlankingSix])).toBe(9); // 5 + 4
      expect(
        calculateScore([subject, four, selfBlankingSix, clearsWizards]),
      ).toBe(45); // 5 + 4 + 6 + 20 + 10
    });

    it("gives nothing when the owner is blanked", () => {
      const blanksArtifacts = card("blanker", "land", 20, [
        { kind: "blank", targets: [{ suit: "artifact" }] },
      ]);

      expect(
        calculateScore([subject, ...strengths(4, 6), blanksArtifacts]),
      ).toBe(30); // 4 + 6 + 20
    });

    it("isn't affected by clearing a suit word", () => {
      const clearsArmyWord = card("clearer", "land", 20, [
        { kind: "clearPenaltySuitWord", suit: "army" },
      ]);

      expect(
        calculateScore([subject, ...strengths(4, 6), clearsArmyWord]),
      ).toBe(45); // 5 + 4 + 6 + 20 + 10
    });
  });

  describe("suit matchers with exceptions", () => {
    const armyExceptTwo = { suit: "army", except: ["army-2"] } as const;
    const anotherLand = card("land-2", "land", 6);
    const blanksLandsExceptFirst = card("blanker", "wizard", 1, [
      { kind: "blank", targets: [{ suit: "land", except: ["land-1"] }] },
    ]);

    it("doesn't blank the excepted card, but blanks the rest of the suit", () => {
      expect(calculateScore([blanksLandsExceptFirst, aLand, anotherLand])).toBe(
        5,
      ); // 1 + 4, land-2 blanked
    });

    it("still lets a different card blank the excepted card", () => {
      const blanksFirstLand = card("other-blanker", "weapon", 2, [
        { kind: "blank", targets: [{ cardId: "land-1" }] },
      ]);

      expect(
        calculateScore([blanksLandsExceptFirst, blanksFirstLand, aLand]),
      ).toBe(3); // 1 + 2, land-1 blanked
    });

    it("doesn't count the excepted card for per", () => {
      const subject = card("subject", "wizard", 1, [
        { kind: "points", points: 5, per: armyExceptTwo },
      ]);

      expect(calculateScore([subject, anArmy, anotherArmy])).toBe(36); // (1 + 5) + 10 + 20
    });

    it("doesn't count the excepted card as present", () => {
      const subject = card("subject", "wizard", 1, [
        { kind: "points", points: 5, when: { present: armyExceptTwo } },
      ]);

      expect(calculateScore([subject, anotherArmy])).toBe(21); // 1 + 20
      expect(calculateScore([subject, anArmy])).toBe(16); // (1 + 5) + 10
    });

    it("treats the excepted card as missing for absent", () => {
      const subject = card("subject", "wizard", 1, [
        { kind: "points", points: -5, when: { absent: armyExceptTwo } },
      ]);

      expect(calculateScore([subject, anotherArmy])).toBe(16); // (1 - 5) + 20
      expect(calculateScore([subject, anArmy])).toBe(11); // 1 + 10
    });

    it("doesn't clear the penalty on the excepted card", () => {
      const penalisedFlood = (id: string): Card => ({
        ...card(id, "flood", 5),
        penalty: { text: "", effects: [{ kind: "points", points: -2 }] },
      });
      const clearer = card("clearer", "land", 1, [
        {
          kind: "clearPenalty",
          targets: [{ suit: "flood", except: ["flood-1"] }],
        },
      ]);

      expect(
        calculateScore([
          clearer,
          penalisedFlood("flood-1"),
          penalisedFlood("flood-2"),
        ]),
      ).toBe(9); // 1 + (5 - 2) + 5
    });

    it("loses the whole target when its suit word is cleared, keeping other targets", () => {
      const subject: Card = {
        ...card("subject", "wizard", 1),
        penalty: {
          text: "",
          effects: [
            { kind: "blank", targets: [armyExceptTwo, { suit: "land" }] },
          ],
        },
      };
      const clearsArmyWord = card("clearer", "flame", 1, [
        { kind: "clearPenaltySuitWord", suit: "army" },
      ]);

      expect(calculateScore([subject, anArmy, aLand])).toBe(1); // army-1 and land-1 blanked
      expect(calculateScore([subject, anArmy, aLand, clearsArmyWord])).toBe(12); // 1 + 10 + 1, land-1 blanked
    });
  });

  describe("sum of the chosen card", () => {
    // Adds the base strength of any one Weapon or Land in the hand.
    const summer: Card = {
      ...card("summer", "flood", 1, [
        { kind: "sum", of: { chosen: true }, attribute: "baseStrength" },
      ]),
      choice: {
        kind: "cardInHand",
        from: [{ suit: "weapon" }, { suit: "land" }],
      },
    };
    const aWeapon = card("weapon-1", "weapon", 9);

    it("adds the chosen card's base strength", () => {
      expect(
        calculateScore([summer, aWeapon, aLand], {
          summer: { cardId: "weapon-1" },
        }),
      ).toBe(23); // (1 + 9) + 9 + 4
    });

    it("adds nothing while the choice is pending", () => {
      expect(calculateScore([summer, aWeapon])).toBe(10); // 1 + 9
    });

    it("adds nothing when the chosen card is blanked", () => {
      const blanksWeapons = card("blanker", "land", 2, [
        { kind: "blank", targets: [{ suit: "weapon" }] },
      ]);

      expect(
        calculateScore([summer, aWeapon, blanksWeapons], {
          summer: { cardId: "weapon-1" },
        }),
      ).toBe(3); // 1 + 2, with the Weapon blanked
    });

    it("adds only the card chosen, not one that took its name", () => {
      const namedAsWeapon: Card = {
        ...card("copy", "weapon", 5),
        namedAs: "weapon-1",
      };

      expect(
        calculateScore([summer, aWeapon, namedAsWeapon], {
          summer: { cardId: "weapon-1" },
        }),
      ).toBe(24); // (1 + 9) + 9 + 5
    });
  });

  describe("clearing the chosen card's penalty", () => {
    it("clears only the card chosen, not one that took its name", () => {
      const penalised = (id: string): Card => ({
        ...card(id, "flood", 10),
        penalty: { text: "", effects: [{ kind: "points", points: -5 }] },
      });
      const clearer: Card = {
        ...card("clearer", "flood", 1, [
          { kind: "clearPenalty", targets: [{ chosen: true }] },
        ]),
        choice: { kind: "cardInHand", from: [{ suit: "flood" }] },
      };
      const namesake: Card = { ...penalised("copy"), namedAs: "flood-1" };

      expect(
        calculateScore([clearer, penalised("flood-1"), namesake], {
          clearer: { cardId: "flood-1" },
        }),
      ).toBe(16); // 1 + 10 + (10 - 5)
    });
  });

  describe("sameSuitSet effects", () => {
    const collector = card("collector", "wizard", 7, [
      {
        kind: "sameSuitSet",
        tiers: [
          { count: 3, points: 10 },
          { count: 4, points: 40 },
          { count: 5, points: 100 },
        ],
      },
    ]);
    const wizard1 = card("wizard-1", "wizard", 1);
    const wizard2 = card("wizard-2", "wizard", 2);
    const wizard3 = card("wizard-3", "wizard", 3);
    const wizard4 = card("wizard-4", "wizard", 4);

    it("scores nothing below the lowest tier", () => {
      expect(calculateScore([collector, wizard1])).toBe(8); // 7 + 1
    });

    it("counts its owner among the cards of its suit", () => {
      expect(calculateScore([collector, wizard1, wizard2])).toBe(20); // (7 + 10) + 1 + 2
    });

    it("pays only the highest tier reached", () => {
      expect(
        calculateScore([collector, wizard1, wizard2, wizard3, wizard4]),
      ).toBe(117); // (7 + 100) + 1 + 2 + 3 + 4
    });

    it("pays each suit that reaches a tier", () => {
      const armies = [1, 2, 3, 4].map((n) => card(`army-${n}`, "army", n));

      expect(calculateScore([collector, wizard1, wizard2, ...armies])).toBe(70); // (7 + 10 for 3 Wizards + 40 for 4 Armies) + 1 + 2 + (1 + 2 + 3 + 4)
    });

    it("counts cards of the same name once", () => {
      const namedAsWizard1: Card = {
        ...card("copy", "wizard", 0),
        namedAs: "wizard-1",
      };

      expect(calculateScore([collector, wizard1, namedAsWizard1])).toBe(8); // 7 + 1 + 0
    });

    it("counts Wild as a suit", () => {
      const wilds = [1, 2, 3].map((n) => card(`wild-${n}`, "wild", 0));

      expect(calculateScore([collector, ...wilds])).toBe(17); // (7 + 10) + 0 + 0 + 0
    });

    it("doesn't count blanked cards", () => {
      const blanksWizard2 = card("blanker", "land", 1, [
        { kind: "blank", targets: [{ cardId: "wizard-2" }] },
      ]);

      expect(calculateScore([collector, wizard1, wizard2, blanksWizard2])).toBe(
        9,
      ); // 7 + 1 + 1, with wizard-2 blanked
    });
  });

  describe("sum effects", () => {
    const sumOfArmies: CardEffect = {
      kind: "sum",
      of: { suit: "army" },
      attribute: "baseStrength",
    };
    const subject = card("subject", "leader", 4, [sumOfArmies]);
    const selfBlankingArmy: Card = {
      ...card("army-3", "army", 20),
      penalty: {
        text: "",
        effects: [{ kind: "blankSelf", when: { absent: { suit: "weapon" } } }],
      },
    };

    it("adds the base strengths of the matching cards", () => {
      expect(calculateScore([subject, anArmy, anotherArmy])).toBe(64); // (4 + 30) + 10 + 20
    });

    it("adds nothing without a matching card", () => {
      expect(calculateScore([subject])).toBe(4);
      expect(calculateScore([subject, aLand])).toBe(8); // 4 + 4
    });

    it("doesn't count the owner", () => {
      const armySubject = card("subject", "army", 5, [sumOfArmies]);

      expect(calculateScore([armySubject, anArmy])).toBe(25); // (5 + 10) + 10
    });

    it("doesn't count a card blanked by another card", () => {
      const blanksAnotherArmy = card("blanker", "land", 1, [
        { kind: "blank", targets: [{ cardId: "army-2" }] },
      ]);

      expect(
        calculateScore([subject, anArmy, anotherArmy, blanksAnotherArmy]),
      ).toBe(25); // (4 + 10) + 10 + 1
    });

    it("doesn't count a self-blanked card", () => {
      expect(calculateScore([subject, anArmy, selfBlankingArmy])).toBe(24); // (4 + 10) + 10
    });

    it("counts a card that a clear keeps in play", () => {
      const clearsArmies = card("clearer", "land", 1, [
        { kind: "clearPenalty", targets: [{ suit: "army" }] },
      ]);

      expect(
        calculateScore([subject, anArmy, selfBlankingArmy, clearsArmies]),
      ).toBe(65); // (4 + 30) + 10 + 20 + 1
    });

    it("leaves a matching card's bonus and penalty out of the sum", () => {
      const armyWithRules: Card = {
        ...card("army-3", "army", 10),
        bonus: { text: "", effects: [{ kind: "points", points: 3 }] },
        penalty: { text: "", effects: [{ kind: "points", points: -8 }] },
      };

      expect(calculateScore([subject, armyWithRules])).toBe(19); // (4 + 10) + (10 + 3 - 8)
    });

    it("gives nothing when the owner is blanked", () => {
      const blanksLeaders = card("blanker", "land", 1, [
        { kind: "blank", targets: [{ suit: "leader" }] },
      ]);

      expect(calculateScore([subject, anArmy, blanksLeaders])).toBe(11); // 10 + 1
    });

    it("works with exceptions and named cards", () => {
      const exceptSecondArmy = card("subject", "leader", 4, [
        { ...sumOfArmies, of: { suit: "army", except: ["army-2"] } },
      ]);
      const onlySecondArmy = card("subject", "leader", 4, [
        { ...sumOfArmies, of: { cardId: "army-2" } },
      ]);

      expect(calculateScore([exceptSecondArmy, anArmy, anotherArmy])).toBe(44); // (4 + 10) + 10 + 20
      expect(calculateScore([onlySecondArmy, anArmy, anotherArmy])).toBe(54); // (4 + 20) + 10 + 20
    });

    it("is removed from a penalty when its suit word is cleared", () => {
      const withPenalty = (effect: CardEffect): Card => ({
        ...card("subject", "wizard", 1),
        penalty: { text: "", effects: [effect] },
      });
      const clearsArmyWord = card("clearer", "land", 1, [
        { kind: "clearPenaltySuitWord", suit: "army" },
      ]);

      expect(calculateScore([withPenalty(sumOfArmies), anArmy])).toBe(21); // (1 + 10) + 10
      expect(
        calculateScore([withPenalty(sumOfArmies), anArmy, clearsArmyWord]),
      ).toBe(12); // 1 + 10 + 1
      expect(
        calculateScore([
          withPenalty({ ...sumOfArmies, of: { cardId: "army-1" } }),
          anArmy,
          clearsArmyWord,
        ]),
      ).toBe(22); // (1 + 10) + 10 + 1, naming a card doesn't name the suit
    });
  });
});

describe("scoreHand", () => {
  const withBonusAndPenalty: Card = {
    ...card("subject", "wizard", 10),
    bonus: {
      text: "",
      effects: [{ kind: "points", points: 5, per: { suit: "army" } }],
    },
    penalty: { text: "", effects: [{ kind: "points", points: -3 }] },
  };

  it("scores no cards as 0", () => {
    expect(scoreHand([])).toEqual({
      cards: [],
      base: 0,
      bonus: 0,
      penalty: 0,
      total: 0,
    });
  });

  it("splits each card's score into base, bonus and penalty, keeping the given order", () => {
    expect(scoreHand([withBonusAndPenalty, anArmy, anotherArmy])).toEqual({
      cards: [
        {
          cardId: "subject",
          blanked: false,
          base: 10,
          bonus: 10,
          penalty: -3,
          total: 17,
        },
        {
          cardId: "army-1",
          blanked: false,
          base: 10,
          bonus: 0,
          penalty: 0,
          total: 10,
        },
        {
          cardId: "army-2",
          blanked: false,
          base: 20,
          bonus: 0,
          penalty: 0,
          total: 20,
        },
      ],
      base: 40,
      bonus: 10,
      penalty: -3,
      total: 47,
    });
  });

  it("lists a blanked card as scoring nothing", () => {
    const blanksArmies: Card = {
      ...card("blanker", "flood", 7),
      penalty: {
        text: "",
        effects: [{ kind: "blank", targets: [{ suit: "army" }] }],
      },
    };

    expect(scoreHand([anArmy, blanksArmies])).toEqual({
      cards: [
        {
          cardId: "army-1",
          blanked: true,
          base: 0,
          bonus: 0,
          penalty: 0,
          total: 0,
        },
        {
          cardId: "blanker",
          blanked: false,
          base: 7,
          bonus: 0,
          penalty: 0,
          total: 7,
        },
      ],
      base: 7,
      bonus: 0,
      penalty: 0,
      total: 7,
    });
  });

  it("counts a cleared penalty as 0", () => {
    const clearsWizards = card("clearer", "land", 1, [
      { kind: "clearPenalty", targets: [{ suit: "wizard" }] },
    ]);

    expect(scoreHand([withBonusAndPenalty, clearsWizards]).cards[0]).toEqual({
      cardId: "subject",
      blanked: false,
      base: 10,
      bonus: 0,
      penalty: 0,
      total: 10,
    });
  });
});
