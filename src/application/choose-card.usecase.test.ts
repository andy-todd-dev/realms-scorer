import { Card, CardId } from "../domain/card";
import { Hand } from "../domain/hand";
import { Variant } from "../domain/variant";
import { CardCatalog } from "./choose-card.ports";
import { ChooseCardUseCase } from "./choose-card.usecase";
import { handState } from "./testing/hand-state";

// May choose another Flood or Army.
const chooser: Card = {
  id: "chooser",
  name: "Chooser",
  suit: "flood",
  baseStrength: 1,
  bonus: {
    text: "",
    effects: [{ kind: "clearPenalty", targets: [{ chosen: true }] }],
  },
  choice: { kind: "cardInHand", from: [{ suit: "flood" }, { suit: "army" }] },
};
const flood: Card = {
  id: "flood",
  name: "Flood",
  suit: "flood",
  baseStrength: 5,
};
const army: Card = { id: "army", name: "Army", suit: "army", baseStrength: 5 };
const leader: Card = {
  id: "leader",
  name: "Leader",
  suit: "leader",
  baseStrength: 4,
};

// Before scoring, adds an Army from the discard area to the hand.
const adder: Card = {
  id: "adder",
  name: "Adder",
  suit: "wizard",
  baseStrength: 3,
  preScoring: [{ kind: "addToHand", card: { chosen: true } }],
  choice: { kind: "cardInDiscardArea", from: [{ suit: "army" }] },
};
// Before scoring, gives another Flood or Army in the hand an Army or Flame suit.
const giver: Card = {
  id: "giver",
  name: "Giver",
  suit: "artifact",
  baseStrength: 3,
  preScoring: [
    { kind: "give", to: { chosen: true }, suit: { chosenSuit: true } },
  ],
  choice: {
    kind: "cardInHand",
    from: [{ suit: "flood" }, { suit: "army" }],
    suits: ["army", "flame"],
  },
};
const deck = [chooser, flood, army, adder, giver];

const variant: Variant = {
  id: "variant",
  name: "Variant",
  deckId: "deck",
  handSize: 7,
  preScoring: ["adder"],
};

// Serves the deck as the variant's, and the leader from another deck.
const cardCatalog: CardCatalog = {
  getAll: async (deckId) => (deckId === "deck" ? deck : [leader]),
  getByIds: async (deckId, cardIds) =>
    (deckId === "deck" ? deck : [leader]).filter((card) =>
      cardIds.includes(card.id),
    ),
};

function setUp(
  hand: Hand,
  {
    cards = cardCatalog,
    variantId = variant.id,
  }: { cards?: CardCatalog; variantId?: string } = {},
) {
  const state = handState({ cardCatalog: cards, variant, hand, variantId });

  return { ...state, useCase: new ChooseCardUseCase(state.ports) };
}

const handOf = (...cardIds: CardId[]): Hand => ({ cardIds, choices: {} });
const hand = handOf("chooser", "flood", "army");

describe("ChooseCardUseCase", () => {
  it("records a choice of a matching card in the hand, and rescores", async () => {
    const { hands, scores, useCase } = setUp(hand);

    await useCase.execute("chooser", "flood");

    expect(hands.get()).toEqual({
      ...hand,
      choices: { chooser: { cardId: "flood" } },
    });
    expect(scores.get()).toMatchObject({ total: 11 });
  });

  it("rejects a card that doesn't match the choice, leaving the hand and score as they were", async () => {
    const adderHand = handOf("chooser", "adder");
    const { hands, scores, useCase } = setUp(adderHand);

    await expect(useCase.execute("chooser", "adder")).rejects.toThrow(
      "chooser can't choose adder",
    );
    expect(hands.get()).toBe(adderHand);
    expect(scores.get()).toBeNull();
  });

  it("rejects a card that isn't in the hand", async () => {
    await expect(
      setUp(handOf("chooser")).useCase.execute("chooser", "flood"),
    ).rejects.toThrow();
  });

  it("rejects a choice for a card that doesn't make one", async () => {
    await expect(
      setUp(hand).useCase.execute("army", "flood"),
    ).rejects.toThrow();
  });

  it("records a choice from the discard area of a matching card not in the hand", async () => {
    const { hands, useCase } = setUp(handOf("adder"));

    await useCase.execute("adder", "army");

    expect(hands.get()).toEqual({
      ...handOf("adder"),
      choices: { adder: { cardId: "army" } },
    });
  });

  it("rejects a choice from the discard area of a card in the hand", async () => {
    await expect(
      setUp(handOf("adder", "army")).useCase.execute("adder", "army"),
    ).rejects.toThrow("adder can't choose army");
  });

  it("takes the discard area from the variant's deck only", async () => {
    // A Leader would match if the choice allowed it, but it's in another deck either way.
    await expect(
      setUp(handOf("adder")).useCase.execute("adder", "leader"),
    ).rejects.toThrow();
  });

  it("checks a choice against the hand after pre-scoring, as scoring does", async () => {
    const withAddedArmy: Hand = {
      cardIds: ["adder", "chooser"],
      choices: { adder: { cardId: "army" } },
    };
    const { hands, useCase } = setUp(withAddedArmy);

    await useCase.execute("chooser", "army");

    expect(hands.get()).toEqual({
      ...withAddedArmy,
      choices: { adder: { cardId: "army" }, chooser: { cardId: "army" } },
    });
  });

  it("drops choices that depended on the chooser's earlier choice", async () => {
    // The chooser chose the Army the adder brought in, so changing the adder's choice leaves it invalid.
    const secondArmy: Card = { ...army, id: "army-2", name: "Army 2" };
    const { hands, useCase } = setUp(
      {
        cardIds: ["adder", "chooser"],
        choices: { adder: { cardId: "army" }, chooser: { cardId: "army" } },
      },
      {
        cards: {
          getAll: async () => [...deck, secondArmy],
          getByIds: async (_, cardIds) =>
            [...deck, secondArmy].filter((card) => cardIds.includes(card.id)),
        },
      },
    );

    await useCase.execute("adder", "army-2");

    expect(hands.get()).toEqual({
      cardIds: ["adder", "chooser"],
      choices: { adder: { cardId: "army-2" } },
    });
  });

  describe("a choice that includes a suit", () => {
    const giverHand = handOf("giver", "flood");

    it("records the card and the suit", async () => {
      const { hands, useCase } = setUp(giverHand);

      await useCase.execute("giver", "flood", "army");

      expect(hands.get()).toEqual({
        ...giverHand,
        choices: { giver: { cardId: "flood", suit: "army" } },
      });
    });

    it("rejects a card without a suit", async () => {
      await expect(
        setUp(giverHand).useCase.execute("giver", "flood"),
      ).rejects.toThrow("giver can't choose flood");
    });

    it("rejects a suit the choice doesn't include", async () => {
      await expect(
        setUp(giverHand).useCase.execute("giver", "flood", "beast"),
      ).rejects.toThrow("giver can't choose flood as beast");
    });

    it("rejects a suit for a choice that doesn't include one", async () => {
      await expect(
        setUp(hand).useCase.execute("chooser", "flood", "army"),
      ).rejects.toThrow("chooser can't choose flood as army");
    });
  });

  it("fails for an unknown variant", async () => {
    await expect(
      setUp(hand, { variantId: "unknown" }).useCase.execute("chooser", "flood"),
    ).rejects.toThrow("Unknown variant: unknown");
  });

  it("fails when the catalog can't serve the cards", async () => {
    const { useCase } = setUp(hand, {
      cards: {
        ...cardCatalog,
        getByIds: () => Promise.reject(new Error("no cards")),
      },
    });

    await expect(useCase.execute("chooser", "flood")).rejects.toThrow(
      "no cards",
    );
  });
});
