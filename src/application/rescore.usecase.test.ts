import { Card, CardId } from "../domain/card";
import { Hand } from "../domain/hand";
import { HandScore } from "../domain/score";
import { Variant, VariantId } from "../domain/variant";
import { CardCatalog } from "./rescore.ports";
import { RescoreUseCase } from "./rescore.usecase";
import { InMemoryStore } from "./testing/in-memory-store";

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

// Holds the hand, the variant and the score in memory, and scores with the given cards.
function setUp(
  cardCatalog: CardCatalog,
  hand: Hand,
  variantId: VariantId = "variant",
) {
  const hands = new InMemoryStore(hand);
  const scores = new InMemoryStore<HandScore | null>(null);
  const useCase = new RescoreUseCase({
    hands,
    scores,
    variant: new InMemoryStore(variantId),
    cardCatalog,
    variantCatalog: {
      getById: async (id) => {
        if (id !== variant.id) {
          throw new Error(`Unknown variant: ${id}`);
        }
        return variant;
      },
    },
  });

  return { hands, scores, useCase };
}

// Scores the hand and returns the score saved.
async function rescore(cardCatalog: CardCatalog, hand: Hand) {
  const { scores, useCase } = setUp(cardCatalog, hand);
  await useCase.execute();
  return scores.get();
}

describe("RescoreUseCase", () => {
  it("saves the score of the cards the catalog serves from the variant's deck", async () => {
    const catalog = catalogOf([king, queen]);
    const getByIds = jest.spyOn(catalog, "getByIds");

    await expect(
      rescore(catalog, handOf("king", "queen")),
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
      rescore(catalogOf([chooser, penalisedLeader]), {
        cardIds: ["chooser", "penalised"],
        choices: { chooser: { cardId: "penalised" } },
      }),
    ).resolves.toMatchObject({ total: 11 });
  });

  it("fires the variant's pre-scoring effects, with the deck as the discard area", async () => {
    // 3 + King 8
    await expect(
      rescore(catalogOf([necromancer, king, queen]), {
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
    await expect(rescore(catalogOf([]), handOf())).resolves.toMatchObject({
      cards: [],
      total: 0,
    });
  });

  it("saves no score for an unknown variant", async () => {
    const { scores, useCase } = setUp(
      catalogOf([king]),
      handOf("king"),
      "unknown",
    );
    scores.save({ cards: [], base: 8, bonus: 0, penalty: 0, total: 8 });

    await useCase.execute();

    expect(scores.get()).toBeNull();
  });

  it("saves no score when the catalog can't serve the cards", async () => {
    await expect(
      rescore(
        {
          ...catalogOf([]),
          getByIds: () => Promise.reject(new Error("unknown card")),
        },
        handOf("unknown"),
      ),
    ).resolves.toBeNull();
  });

  it("drops the score of a hand that changed while it was scored, keeping the newer one", async () => {
    const catalog = catalogOf([king, queen]);
    let finishFirst!: () => void;
    const firstServed = new Promise<void>((resolve) => (finishFirst = resolve));
    let calls = 0;
    const slowFirst: CardCatalog = {
      ...catalog,
      getByIds: async (deckId, cardIds) => {
        if (calls++ === 0) {
          await firstServed;
        }
        return catalog.getByIds(deckId, cardIds);
      },
    };
    const { hands, scores, useCase } = setUp(slowFirst, handOf("king"));

    const first = useCase.execute();
    hands.save(handOf("king", "queen"));
    await useCase.execute();
    finishFirst();
    await first;

    expect(scores.get()).toMatchObject({ total: 14 });
  });
});
