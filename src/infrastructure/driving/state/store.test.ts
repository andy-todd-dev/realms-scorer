import { LoadVariantUseCase } from "../../../application/load-variant.usecase";
import type { Card, CardId } from "../../../domain/card";
import type { DeckId } from "../../../domain/deck";
import type { CardScore, HandScore } from "../../../domain/score";
import type { Variant, VariantId } from "../../../domain/variant";
import { handSaved } from "./hand-slice";
import { scoreSaved } from "./score-slice";
import { selectBreakdown, selectChoiceSheet } from "./selectors";
import { reduxStores } from "./redux-stores";
import { createAppStore } from "./store";

/*
  Only the selector details too fine to drive through the UI: breakdown ordering at the edges, and choice options
  against a score that hasn't caught up with the hand. Everything the player sees is tested in
  ui/__tests__/.
*/

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
const knights: Card = {
  id: "knights",
  name: "Knights",
  suit: "army",
  baseStrength: 20,
};

// Saves a hand of these cards, with no choices made.
const handOf = (...cardIds: CardId[]) => handSaved({ cardIds, choices: {} });

// A score with only a total, for tests that don't look at the breakdown.
const totalOnly = (total: number): HandScore => ({
  cards: [],
  base: total,
  bonus: 0,
  penalty: 0,
  total,
});

// The variant the store starts with, which the fake catalogs serve.
const TEST_VARIANT_ID = "base";

// Fakes for the catalogs, serving the given cards as the deck of a variant with the store's default ID.
function catalogsFor(loadCardsExecute: () => Promise<Card[]>) {
  const variant: Variant = {
    id: TEST_VARIANT_ID,
    name: "Test variant",
    deckId: "deck",
    handSize: 7,
    preScoring: [],
  };

  return {
    cardCatalog: {
      getAll: loadCardsExecute,
      getByIds: async (_: DeckId, cardIds: readonly CardId[]) =>
        (await loadCardsExecute()).filter((card) => cardIds.includes(card.id)),
    },
    variantCatalog: {
      getById: async (variantId: VariantId) => {
        if (variantId !== variant.id) {
          throw new Error(`Unknown variant: ${variantId}`);
        }
        return variant;
      },
    },
  };
}

// A store with the variant loaded from these cards, through the real use case, so card views and choice descriptions are built as in the app.
async function createStore(loadCardsExecute: () => Promise<Card[]>) {
  const store = createAppStore(TEST_VARIANT_ID);

  await new LoadVariantUseCase({
    ...reduxStores(store),
    ...catalogsFor(loadCardsExecute),
    // These tests save the score themselves.
    rescore: { execute: async () => {} },
  }).execute();

  return store;
}

// The choice sheet's options for a card, across its groups.
const sheetOptions = (
  store: Awaited<ReturnType<typeof createStore>>,
  chooserId: CardId,
) =>
  selectChoiceSheet(store.getState(), chooserId, null)?.groups.flatMap(
    ({ options }) => options,
  );

const createLoadedStore = () => createStore(async () => [king, queen, knights]);

describe("breaking down the score", () => {
  const scored = (
    cardId: CardId,
    base: number,
    bonus = 0,
    penalty = 0,
    blanked = false,
  ): CardScore => ({
    cardId,
    blanked,
    base,
    bonus,
    penalty,
    total: base + bonus + penalty,
    // A blanked card is blanked by the Queen.
    ...(blanked && {
      blankReason: { byCardIds: ["queen"], self: [], loopCardIds: [] },
    }),
    // A bonus for each Army, counting the Knights, and a penalty for being with the King.
    lines: [
      ...(bonus === 0
        ? []
        : [
            {
              ability: "bonus" as const,
              points: bonus,
              reason: {
                kind: "each" as const,
                each: bonus,
                suit: "army" as const,
                cardIds: ["knights"],
                withCardIds: [],
              },
            },
          ]),
      ...(penalty === 0
        ? []
        : [
            {
              ability: "penalty" as const,
              points: penalty,
              reason: {
                kind: "condition" as const,
                withCardIds: ["king"],
                without: [],
                allSuitsDifferent: false,
              },
            },
          ]),
    ],
  });

  async function createScoredStore(handScore: HandScore) {
    const store = await createLoadedStore();
    store.dispatch(handOf("queen", "king", "knights"));
    store.dispatch(scoreSaved(handScore));
    return store;
  }

  it("lists a blanked card after one with a negative score", async () => {
    const store = await createScoredStore({
      cards: [
        scored("queen", 6),
        scored("king", 0, 0, 0, true),
        scored("knights", 2, 0, -5),
      ],
      base: 8,
      bonus: 0,
      penalty: -5,
      total: 3,
    });

    expect(selectBreakdown(store.getState()).rows.map(({ id }) => id)).toEqual([
      "queen",
      "knights",
      "king",
    ]);
  });

  it("lists cards without figures, in hand order, before there is a score", async () => {
    const store = await createLoadedStore();
    store.dispatch(handOf("queen", "king"));

    const { rows } = selectBreakdown(store.getState());

    expect(rows.map(({ id, figures }) => [id, figures])).toEqual([
      ["queen", undefined],
      ["king", undefined],
    ]);
  });

  it("lists a card the latest score doesn't cover last, without figures", async () => {
    const store = await createScoredStore({
      cards: [scored("queen", 6), scored("king", 8)],
      base: 14,
      bonus: 0,
      penalty: 0,
      total: 14,
    });

    expect(
      selectBreakdown(store.getState()).rows.map(({ id, figures }) => [
        id,
        figures?.total,
      ]),
    ).toEqual([
      ["king", "8"],
      ["queen", "6"],
      ["knights", undefined],
    ]);
  });
});

describe("choosing a card", () => {
  // Clears the penalty on a Flood or Flame of the player's choice.
  const island: Card = {
    id: "island",
    name: "Island",
    suit: "flood",
    baseStrength: 14,
    bonus: {
      text: "",
      effects: [{ kind: "clearPenalty", targets: [{ chosen: true }] }],
    },
    choice: {
      kind: "cardInHand",
      from: [{ suit: "flood" }, { suit: "flame" }],
    },
  };
  const swamp: Card = {
    id: "swamp",
    name: "Swamp",
    suit: "flood",
    baseStrength: 18,
  };
  const candle: Card = {
    id: "candle",
    name: "Candle",
    suit: "flame",
    baseStrength: 2,
  };

  // A score reporting the island's options, as the rules would decide them.
  const scoreWithOptions = (optionIds: readonly CardId[]): HandScore => ({
    ...totalOnly(0),
    cards: [
      {
        cardId: "island",
        blanked: false,
        base: 14,
        bonus: 0,
        penalty: 0,
        total: 14,
        lines: [],
        choice: { chosenId: null, optionIds },
      },
    ],
  });

  async function createStoreWithHand(cardIds: readonly CardId[]) {
    const store = await createStore(async () => [
      island,
      swamp,
      candle,
      knights,
    ]);
    store.dispatch(handOf(...cardIds));
    return store;
  }

  describe("the choice sheet", () => {
    it("has no options before the score covers the card", async () => {
      const store = await createStoreWithHand(["island", "swamp"]);

      expect(sheetOptions(store, "island")).toEqual([]);
    });

    it("leaves out options no longer in the hand", async () => {
      const store = await createStoreWithHand(["island", "swamp", "candle"]);
      store.dispatch(scoreSaved(scoreWithOptions(["swamp", "candle"])));
      // Candle leaves the hand after the score that offered it.
      store.dispatch(handOf("island", "swamp"));

      expect(sheetOptions(store, "island")?.map(({ id }) => id)).toEqual([
        "swamp",
      ]);
    });
  });
});
