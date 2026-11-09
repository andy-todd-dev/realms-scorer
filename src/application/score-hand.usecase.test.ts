import { Card, CardId } from "../domain/card";
import { Hand } from "../domain/hand";
import { Variant } from "../domain/variant";
import { CardCatalog } from "./score-hand.ports";
import { ScoreHandUseCase } from "./score-hand.usecase";

const king: Card = {
  id: "king",
  name: "King",
  suit: "leader",
  baseStrength: 8,
};
const queen: Card = {
  id: "queen",
  name: "Queen",
  suit: "leader",
  baseStrength: 6,
};
// Clears the penalty of the card the player chose.
const chooser: Card = {
  id: "chooser",
  name: "Chooser",
  suit: "flood",
  baseStrength: 1,
  bonus: {
    text: "",
    effects: [{ kind: "clearPenalty", targets: [{ chosen: true }] }],
  },
  choice: { kind: "cardInHand", from: [{ suit: "leader" }] },
};
const penalisedLeader: Card = {
  id: "penalised",
  name: "Penalised",
  suit: "leader",
  baseStrength: 10,
  penalty: { text: "", effects: [{ kind: "points", points: -4 }] },
};

const handOf = (...cardIds: CardId[]): Hand => ({ cardIds, choices: {} });

const variant: Variant = {
  id: "variant",
  name: "Variant",
  deckId: "deck",
  handSize: 7,
  preScoring: ["necromancer"],
};

// Before scoring, takes a Leader from the discard area into the hand.
const necromancer: Card = {
  id: "necromancer",
  name: "Necromancer",
  suit: "wizard",
  baseStrength: 3,
  preScoring: [{ kind: "addToHand", card: { chosen: true } }],
  choice: { kind: "cardInDiscardArea", from: [{ suit: "leader" }] },
};

// Serves the given cards as the variant's deck, and none for any other deck.
const catalogOf = (cards: readonly Card[]): CardCatalog => ({
  getAll: async (deckId) => (deckId === "deck" ? [...cards] : []),
  getByIds: async (deckId, cardIds) =>
    deckId === "deck"
      ? cardIds.flatMap((id) => cards.filter((card) => card.id === id))
      : [],
});

const createUseCase = (cardCatalog: CardCatalog) =>
  new ScoreHandUseCase({
    cardCatalog,
    variantCatalog: {
      getById: async (variantId) => {
        if (variantId !== variant.id) {
          throw new Error(`Unknown variant: ${variantId}`);
        }
        return variant;
      },
    },
  });

describe("ScoreHandUseCase", () => {
  it("scores the cards the catalog serves from the variant's deck", async () => {
    const catalog = catalogOf([king, queen]);
    const getByIds = jest.spyOn(catalog, "getByIds");

    await expect(
      createUseCase(catalog).execute("variant", handOf("king", "queen")),
    ).resolves.toMatchObject({
      cards: [
        { cardId: "king", total: 8 },
        { cardId: "queen", total: 6 },
      ],
      total: 14,
    });
    expect(getByIds).toHaveBeenCalledWith("deck", ["king", "queen"]);
  });

  it("applies the choices made in the hand", async () => {
    // 1 + 10, with the penalty cleared
    await expect(
      createUseCase(catalogOf([chooser, penalisedLeader])).execute("variant", {
        cardIds: ["chooser", "penalised"],
        choices: { chooser: { cardId: "penalised" } },
      }),
    ).resolves.toMatchObject({ total: 11 });
  });

  it("fires the variant's pre-scoring effects, with the deck as the discard area", async () => {
    // 3 + King 8
    await expect(
      createUseCase(catalogOf([necromancer, king, queen])).execute("variant", {
        cardIds: ["necromancer"],
        choices: { necromancer: { cardId: "king" } },
      }),
    ).resolves.toMatchObject({
      cards: [
        { cardId: "necromancer", total: 3 },
        { cardId: "king", total: 8, addedBy: "necromancer" },
      ],
      total: 11,
    });
  });

  it("scores no cards as 0", async () => {
    await expect(
      createUseCase(catalogOf([])).execute("variant", handOf()),
    ).resolves.toMatchObject({ cards: [], total: 0 });
  });

  it("fails for an unknown variant", async () => {
    await expect(
      createUseCase(catalogOf([king])).execute("unknown", handOf("king")),
    ).rejects.toThrow("Unknown variant: unknown");
  });

  it("fails when the catalog can't serve the cards", async () => {
    const useCase = createUseCase({
      ...catalogOf([]),
      getByIds: () => Promise.reject(new Error("unknown card")),
    });

    await expect(useCase.execute("variant", handOf("unknown"))).rejects.toThrow(
      "unknown card",
    );
  });
});
