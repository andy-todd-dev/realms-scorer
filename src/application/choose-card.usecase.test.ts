import { Card, CardId } from "../domain/card";
import { Hand } from "../domain/hand";
import { Variant } from "../domain/variant";
import { ChooseCardUseCase } from "./choose-card.usecase";
import { CardCatalog } from "./choose-card.ports";

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

const createUseCase = ({ cards = cardCatalog }: { cards?: CardCatalog } = {}) =>
  new ChooseCardUseCase({
    cardCatalog: cards,
    variantCatalog: {
      getById: async (variantId) => {
        if (variantId !== variant.id) {
          throw new Error(`Unknown variant: ${variantId}`);
        }
        return variant;
      },
    },
  });

const handOf = (...cardIds: CardId[]): Hand => ({ cardIds, choices: {} });
const hand = handOf("chooser", "flood", "army");

describe("ChooseCardUseCase", () => {
  it("records a choice of a matching card in the hand", async () => {
    await expect(
      createUseCase().execute("variant", hand, "chooser", "flood"),
    ).resolves.toEqual({ ...hand, choices: { chooser: { cardId: "flood" } } });
  });

  it("rejects a card that doesn't match the choice", async () => {
    await expect(
      createUseCase().execute(
        "variant",
        handOf("chooser", "adder"),
        "chooser",
        "adder",
      ),
    ).rejects.toThrow("chooser can't choose adder");
  });

  it("rejects a card that isn't in the hand", async () => {
    await expect(
      createUseCase().execute("variant", handOf("chooser"), "chooser", "flood"),
    ).rejects.toThrow();
  });

  it("rejects a choice for a card that doesn't make one", async () => {
    await expect(
      createUseCase().execute("variant", hand, "army", "flood"),
    ).rejects.toThrow();
  });

  it("records a choice from the discard area of a matching card not in the hand", async () => {
    const adderHand = handOf("adder");

    await expect(
      createUseCase().execute("variant", adderHand, "adder", "army"),
    ).resolves.toEqual({
      ...adderHand,
      choices: { adder: { cardId: "army" } },
    });
  });

  it("rejects a choice from the discard area of a card in the hand", async () => {
    await expect(
      createUseCase().execute(
        "variant",
        handOf("adder", "army"),
        "adder",
        "army",
      ),
    ).rejects.toThrow("adder can't choose army");
  });

  it("takes the discard area from the variant's deck only", async () => {
    // A Leader would match if the choice allowed it, but it's in another deck either way.
    await expect(
      createUseCase().execute("variant", handOf("adder"), "adder", "leader"),
    ).rejects.toThrow();
  });

  it("checks a choice against the hand after pre-scoring, as scoring does", async () => {
    const withAddedArmy: Hand = {
      cardIds: ["adder", "chooser"],
      choices: { adder: { cardId: "army" } },
    };

    await expect(
      createUseCase().execute("variant", withAddedArmy, "chooser", "army"),
    ).resolves.toEqual({
      ...withAddedArmy,
      choices: { adder: { cardId: "army" }, chooser: { cardId: "army" } },
    });
  });

  it("drops choices that depended on the chooser's earlier choice", async () => {
    // The chooser chose the Army the adder brought in, so changing the adder's choice leaves it invalid.
    const secondArmy: Card = { ...army, id: "army-2", name: "Army 2" };
    const useCase = createUseCase({
      cards: {
        getAll: async () => [...deck, secondArmy],
        getByIds: async (_, cardIds) =>
          [...deck, secondArmy].filter((card) => cardIds.includes(card.id)),
      },
    });
    const withAddedArmy: Hand = {
      cardIds: ["adder", "chooser"],
      choices: { adder: { cardId: "army" }, chooser: { cardId: "army" } },
    };

    await expect(
      useCase.execute("variant", withAddedArmy, "adder", "army-2"),
    ).resolves.toEqual({
      cardIds: ["adder", "chooser"],
      choices: { adder: { cardId: "army-2" } },
    });
  });

  describe("a choice that includes a suit", () => {
    const giverHand = handOf("giver", "flood");

    it("records the card and the suit", async () => {
      await expect(
        createUseCase().execute("variant", giverHand, "giver", "flood", "army"),
      ).resolves.toEqual({
        ...giverHand,
        choices: { giver: { cardId: "flood", suit: "army" } },
      });
    });

    it("rejects a card without a suit", async () => {
      await expect(
        createUseCase().execute("variant", giverHand, "giver", "flood"),
      ).rejects.toThrow("giver can't choose flood");
    });

    it("rejects a suit the choice doesn't include", async () => {
      await expect(
        createUseCase().execute(
          "variant",
          giverHand,
          "giver",
          "flood",
          "beast",
        ),
      ).rejects.toThrow("giver can't choose flood as beast");
    });

    it("rejects a suit for a choice that doesn't include one", async () => {
      await expect(
        createUseCase().execute("variant", hand, "chooser", "flood", "army"),
      ).rejects.toThrow("chooser can't choose flood as army");
    });
  });

  it("fails for an unknown variant", async () => {
    await expect(
      createUseCase().execute("unknown", hand, "chooser", "flood"),
    ).rejects.toThrow("Unknown variant: unknown");
  });

  it("fails when the catalog can't serve the cards", async () => {
    const useCase = createUseCase({
      cards: {
        ...cardCatalog,
        getByIds: () => Promise.reject(new Error("no cards")),
      },
    });

    await expect(
      useCase.execute("variant", hand, "chooser", "flood"),
    ).rejects.toThrow("no cards");
  });
});
