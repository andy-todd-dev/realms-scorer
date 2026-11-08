import { AddCardToHandUseCase } from "../../../application/add-card-to-hand.usecase";
import { ChooseCardUseCase } from "../../../application/choose-card.usecase";
import { ClearHandUseCase } from "../../../application/clear-hand.usecase";
import { LoadVariantUseCase } from "../../../application/load-variant.usecase";
import { RemoveCardFromHandUseCase } from "../../../application/remove-card-from-hand.usecase";
import { ScoreHandUseCase } from "../../../application/score-hand.usecase";
import type { Card, CardId } from "../../../domain/card";
import type { DeckId } from "../../../domain/deck";
import type { Hand } from "../../../domain/hand";
import type { HandScore } from "../../../domain/score";
import type { Variant, VariantId } from "../../../domain/variant";
import {
  addCardToHand,
  chooseCard,
  clearHand,
  removeCardFromHand,
} from "./hand-slice";
import {
  cardRevealed,
  cardRevealRequested,
  choiceSheetClosed,
  choiceSheetOpened,
  screenOpened,
} from "./navigation-slice";
import { scoreHand } from "./score-slice";
import {
  selectBreakdown,
  selectCardSections,
  selectCardsStatus,
  selectCardToReveal,
  selectChoiceSheet,
  selectHand,
  selectHandCards,
  selectHandProgress,
  selectScore,
  selectScreen,
} from "./selectors";
import { createAppStore } from "./store";
import { BASE_VARIANT_ID, loadVariant } from "./variant-slice";

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

// A score with only a total, for tests that don't look at the breakdown.
const totalOnly = (total: number): HandScore => ({
  cards: [],
  base: total,
  bonus: 0,
  penalty: 0,
  total,
});

// Fakes for the catalogs, serving the given cards as the deck of a variant with the store's default ID.
function catalogsFor(
  loadCardsExecute: () => Promise<Card[]>,
  preScoring: readonly CardId[],
  handSize: number,
) {
  const variant: Variant = {
    id: BASE_VARIANT_ID,
    name: "Test variant",
    deckId: "deck",
    handSize,
    preScoring,
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

function createStore(
  loadCardsExecute: () => Promise<Card[]>,
  {
    scoreHandExecute = async () => 0,
    scoreByTheRules = false,
    preScoring = [],
    handSize = 7,
  }: {
    scoreHandExecute?: (hand: Hand) => Promise<number | HandScore>;
    // Scores with the real use case, so the options and any added cards come from the rules.
    scoreByTheRules?: boolean;
    preScoring?: readonly CardId[];
    handSize?: number;
  } = {},
) {
  const catalogs = catalogsFor(loadCardsExecute, preScoring, handSize);

  return createAppStore({
    addCardToHand: new AddCardToHandUseCase(catalogs),
    // Checks choices against the same cards that loading serves.
    chooseCard: new ChooseCardUseCase(catalogs),
    clearHand: new ClearHandUseCase(),
    // The real use case, so card views and choice descriptions are built as in the app.
    loadVariant: new LoadVariantUseCase(catalogs),
    removeCardFromHand: new RemoveCardFromHandUseCase(catalogs),
    scoreHand: scoreByTheRules
      ? new ScoreHandUseCase(catalogs)
      : {
          execute: async (_, hand) => {
            const score = await scoreHandExecute(hand);
            return typeof score === "number" ? totalOnly(score) : score;
          },
        },
  });
}

const handCardIds = (store: ReturnType<typeof createStore>) =>
  selectHandCards(store.getState()).map(({ id }) => id);

// The choice sheet's options, across its groups.
const sheetOptions = (store: ReturnType<typeof createStore>) =>
  selectChoiceSheet(store.getState())?.groups.flatMap(({ options }) => options);

async function createLoadedStore() {
  const store = createStore(async () => [king, queen, knights]);
  await store.dispatch(loadVariant());
  return store;
}

describe("loading cards", () => {
  it("offers the loaded cards as unselected tiles", async () => {
    const store = await createLoadedStore();

    expect(selectCardsStatus(store.getState())).toBe("loaded");
    expect(selectCardSections(store.getState())).toEqual([
      {
        suit: "army",
        cards: [
          {
            id: "knights",
            name: "Knights",
            selected: false,
            disabled: false,
            choice: null,
          },
        ],
      },
      {
        suit: "leader",
        cards: [
          {
            id: "king",
            name: "King",
            selected: false,
            disabled: false,
            choice: null,
          },
          {
            id: "queen",
            name: "Queen",
            selected: false,
            disabled: false,
            choice: null,
          },
        ],
      },
    ]);
  });

  it("sets the failed status when loading fails", async () => {
    const store = createStore(() => Promise.reject(new Error("no cards")));

    await store.dispatch(loadVariant());

    expect(selectCardsStatus(store.getState())).toBe("failed");
  });
});

describe("loading the variant", () => {
  it("keeps the variant's name and hand size", async () => {
    const store = await createLoadedStore();

    expect(store.getState().variant).toEqual({
      id: BASE_VARIANT_ID,
      name: "Test variant",
      handSize: 7,
    });
  });

  it("counts towards no target before the variant has loaded", () => {
    const store = createStore(() => new Promise(() => {}));

    expect(selectHandProgress(store.getState())).toMatchObject({
      isComplete: false,
      pips: [],
      reviewLabel: "0 cards",
    });
  });

  it("takes the hand size from the variant, for the pips and for when the hand is full", async () => {
    const store = createStore(async () => [king, queen, knights], {
      handSize: 2,
    });
    await store.dispatch(loadVariant());
    await store.dispatch(addCardToHand("king"));
    await store.dispatch(addCardToHand("queen"));
    await store.dispatch(addCardToHand("knights"));

    expect(handCardIds(store)).toEqual(["king", "queen"]);
    expect(selectHandProgress(store.getState())).toMatchObject({
      isComplete: true,
      pips: [true, true],
      countLabel: "2 cards ✓",
    });
    expect(
      selectCardSections(store.getState())
        .flatMap(({ cards }) => cards)
        .find(({ id }) => id === "knights")?.disabled,
    ).toBe(true);
  });
});

describe("adding a card to the hand", () => {
  it("adds the card and marks its tile as selected", async () => {
    const store = await createLoadedStore();

    await store.dispatch(addCardToHand("king"));

    expect(handCardIds(store)).toEqual(["king"]);
    expect(selectCardSections(store.getState())[1].cards).toEqual([
      {
        id: "king",
        name: "King",
        selected: true,
        disabled: false,
        choice: null,
      },
      {
        id: "queen",
        name: "Queen",
        selected: false,
        disabled: false,
        choice: null,
      },
    ]);
  });

  it("keeps cards in the order they were added and ignores duplicates", async () => {
    const store = await createLoadedStore();

    await store.dispatch(addCardToHand("queen"));
    await store.dispatch(addCardToHand("king"));
    await store.dispatch(addCardToHand("queen"));

    expect(handCardIds(store)).toEqual(["queen", "king"]);
  });
});

describe("removing a card from the hand", () => {
  it("removes the card, unselects its tile and keeps the order of the rest", async () => {
    const store = await createLoadedStore();
    await store.dispatch(addCardToHand("queen"));
    await store.dispatch(addCardToHand("king"));
    await store.dispatch(addCardToHand("knights"));

    await store.dispatch(removeCardFromHand("king"));

    expect(handCardIds(store)).toEqual(["queen", "knights"]);
    expect(selectCardSections(store.getState())[1].cards).toEqual([
      {
        id: "king",
        name: "King",
        selected: false,
        disabled: false,
        choice: null,
      },
      {
        id: "queen",
        name: "Queen",
        selected: true,
        disabled: false,
        choice: null,
      },
    ]);
  });

  it("returns to the home screen when the last card is removed from the breakdown", async () => {
    const store = await createLoadedStore();
    await store.dispatch(addCardToHand("king"));
    store.dispatch(screenOpened("breakdown"));

    await store.dispatch(removeCardFromHand("king"));

    expect(handCardIds(store)).toEqual([]);
    expect(selectScreen(store.getState())).toBe("home");
  });

  it("stays on the breakdown while cards remain", async () => {
    const store = await createLoadedStore();
    await store.dispatch(addCardToHand("king"));
    await store.dispatch(addCardToHand("queen"));
    store.dispatch(screenOpened("breakdown"));

    await store.dispatch(removeCardFromHand("king"));

    expect(selectScreen(store.getState())).toBe("breakdown");
  });
});

describe("clearing the hand", () => {
  it("empties the hand and unselects every tile", async () => {
    const store = await createLoadedStore();
    await store.dispatch(addCardToHand("king"));
    await store.dispatch(addCardToHand("knights"));

    await store.dispatch(clearHand());

    expect(handCardIds(store)).toEqual([]);
    expect(
      selectCardSections(store.getState())
        .flatMap((section) => section.cards)
        .some((card) => card.selected),
    ).toBe(false);
  });
});

describe("scoring the hand", () => {
  it("has no score until one is requested", () => {
    const store = createStore(async () => []);

    expect(selectScore(store.getState())).toBeNull();
  });

  it("requests the score using the cards in the hand and the choices made", async () => {
    const scoreHandExecute = jest.fn(async (_: Hand) => 14);
    const store = createStore(async () => [king, queen], { scoreHandExecute });

    await store.dispatch(addCardToHand("queen"));
    await store.dispatch(addCardToHand("king"));
    await store.dispatch(scoreHand());

    expect(scoreHandExecute).toHaveBeenCalledWith({
      cardIds: ["queen", "king"],
      choices: {},
    });
    expect(selectScore(store.getState())).toBe(14);
  });

  it("keeps the current score while a new one is pending", async () => {
    const responses: ((score: number) => void)[] = [];
    const store = createStore(async () => [], {
      scoreHandExecute: () => new Promise((resolve) => responses.push(resolve)),
    });

    const first = store.dispatch(scoreHand());
    responses[0](8);
    await first;
    const second = store.dispatch(scoreHand());

    expect(selectScore(store.getState())).toBe(8);

    responses[1](14);
    await second;

    expect(selectScore(store.getState())).toBe(14);
  });

  it("ignores a response that arrives after a newer one", async () => {
    const responses: ((score: number) => void)[] = [];
    const store = createStore(async () => [], {
      scoreHandExecute: () => new Promise((resolve) => responses.push(resolve)),
    });

    const first = store.dispatch(scoreHand());
    const second = store.dispatch(scoreHand());
    responses[1](14);
    await second;
    responses[0](8);
    await first;

    expect(selectScore(store.getState())).toBe(14);
  });

  it("clears the score when scoring fails", async () => {
    const scoreHandExecute = jest
      .fn<Promise<number>, [Hand]>()
      .mockResolvedValueOnce(8)
      .mockRejectedValueOnce(new Error("no score"));
    const store = createStore(async () => [], { scoreHandExecute });

    await store.dispatch(scoreHand());

    expect(selectScore(store.getState())).toBe(8);

    await store.dispatch(scoreHand());

    expect(selectScore(store.getState())).toBeNull();
  });
});

describe("breaking down the score", () => {
  const scored = (
    cardId: CardId,
    base: number,
    bonus = 0,
    penalty = 0,
    blanked = false,
  ) => ({
    cardId,
    blanked,
    base,
    bonus,
    penalty,
    total: base + bonus + penalty,
  });

  async function createScoredStore(handScore: HandScore) {
    const store = createStore(async () => [king, queen, knights], {
      scoreHandExecute: async () => handScore,
    });
    await store.dispatch(loadVariant());
    await store.dispatch(addCardToHand("queen"));
    await store.dispatch(addCardToHand("king"));
    await store.dispatch(addCardToHand("knights"));
    await store.dispatch(scoreHand());
    return store;
  }

  it("shows the totals and each card's figures, highest-scoring first", async () => {
    const store = await createScoredStore({
      cards: [
        scored("queen", 6, 10, -3),
        scored("king", 8),
        scored("knights", 0, 0, 0, true),
      ],
      base: 14,
      bonus: 10,
      penalty: -3,
      total: 21,
    });

    expect(selectBreakdown(store.getState())).toEqual({
      stats: { base: "14", bonus: "+10", penalty: "\u22123" },
      rows: [
        {
          id: "queen",
          name: "Queen",
          suit: "leader",
          chosenName: null,
          choicePending: false,
          addedByName: null,
          blanked: false,
          points: 13,
          figures: { total: "13", base: "6", bonus: "+10", penalty: "\u22123" },
        },
        {
          id: "king",
          name: "King",
          suit: "leader",
          chosenName: null,
          choicePending: false,
          addedByName: null,
          blanked: false,
          points: 8,
          figures: { total: "8", base: "8", bonus: null, penalty: null },
        },
        {
          id: "knights",
          name: "Knights",
          suit: "army",
          chosenName: null,
          choicePending: false,
          addedByName: null,
          blanked: true,
          points: 0,
          figures: { total: "0", base: "0", bonus: null, penalty: null },
        },
      ],
      sum: "14 + 10 \u2212 3",
      blanked: "Knights",
    });
  });

  it("says none are blanked and shows no penalties as 0", async () => {
    const store = await createScoredStore({
      cards: [scored("queen", 6), scored("king", 8), scored("knights", 20)],
      base: 34,
      bonus: 0,
      penalty: 0,
      total: 34,
    });

    const { stats, sum, blanked } = selectBreakdown(store.getState());

    expect(stats).toEqual({ base: "34", bonus: "0", penalty: "0" });
    expect(sum).toBe("34 + 0 \u2212 0");
    expect(blanked).toBe("none");
  });

  it("lists cards without figures, in hand order, before there is a score", async () => {
    const store = await createLoadedStore();
    await store.dispatch(addCardToHand("queen"));
    await store.dispatch(addCardToHand("king"));

    const { stats, rows, sum } = selectBreakdown(store.getState());

    expect(stats).toBeNull();
    expect(sum).toBeNull();
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

describe("navigation", () => {
  it("starts on the home screen and moves between screens", async () => {
    const store = await createLoadedStore();

    expect(selectScreen(store.getState())).toBe("home");

    store.dispatch(screenOpened("breakdown"));

    expect(selectScreen(store.getState())).toBe("breakdown");

    store.dispatch(screenOpened("home"));

    expect(selectScreen(store.getState())).toBe("home");
  });
});

describe("tracking progress towards a full hand", () => {
  const deck: Card[] = Array.from({ length: 8 }, (_, index) => ({
    id: `card-${index}`,
    name: `Card ${index}`,
    suit: "beast",
    baseStrength: 1,
  }));

  async function createStoreWithHandOf(size: number) {
    const store = createStore(async () => deck);
    await store.dispatch(loadVariant());
    for (const card of deck.slice(0, size)) {
      await store.dispatch(addCardToHand(card.id));
    }
    return store;
  }

  it("prompts for cards when the hand is empty", async () => {
    const store = await createStoreWithHandOf(0);

    expect(selectHandProgress(store.getState())).toEqual({
      isEmpty: true,
      isComplete: false,
      firstPendingChoiceCardId: null,
      choicesText: null,
      pips: [false, false, false, false, false, false, false],
      countLabel: "Tap cards or scan",
      reviewLabel: "0 of 7 cards",
      pipsAccessibilityLabel: "0 of 7 cards. Show breakdown",
    });
  });

  it("counts towards 7 for a partial hand", async () => {
    const store = await createStoreWithHandOf(5);

    expect(selectHandProgress(store.getState())).toEqual({
      isEmpty: false,
      isComplete: false,
      firstPendingChoiceCardId: null,
      choicesText: null,
      pips: [true, true, true, true, true, false, false],
      countLabel: "5 of 7 cards",
      reviewLabel: "5 of 7 cards",
      pipsAccessibilityLabel: "5 of 7 cards. Show breakdown",
    });
  });

  it("is complete at 7 cards", async () => {
    const store = await createStoreWithHandOf(7);

    expect(selectHandProgress(store.getState())).toEqual({
      isEmpty: false,
      isComplete: true,
      firstPendingChoiceCardId: null,
      choicesText: null,
      pips: [true, true, true, true, true, true, true],
      countLabel: "7 cards ✓",
      reviewLabel: "7 cards · complete",
      pipsAccessibilityLabel: "7 cards. Show breakdown",
    });
  });

  it("rejects an 8th card, keeping the hand at 7", async () => {
    const store = await createStoreWithHandOf(8);

    expect(selectHand(store.getState()).cardIds).toHaveLength(7);
    expect(selectHandProgress(store.getState())).toMatchObject({
      isComplete: true,
      pips: [true, true, true, true, true, true, true],
      countLabel: "7 cards ✓",
    });
  });

  it("disables the unselected tiles of a full hand, but not the selected ones", async () => {
    const store = await createStoreWithHandOf(7);
    const tiles = selectCardSections(store.getState()).flatMap(
      ({ cards }) => cards,
    );

    expect(
      tiles.map(({ id, selected, disabled }) => [id, selected, disabled]),
    ).toEqual([
      ...deck.slice(0, 7).map(({ id }) => [id, true, false]),
      ["card-7", false, true],
    ]);
  });

  it("enables the tiles again when a card is removed from a full hand", async () => {
    const store = await createStoreWithHandOf(7);
    await store.dispatch(removeCardFromHand("card-0"));

    expect(
      selectCardSections(store.getState())
        .flatMap(({ cards }) => cards)
        .some(({ disabled }) => disabled),
    ).toBe(false);
  });
});

describe("ordering the card sections", () => {
  it("lists suits alphabetically, not in the catalogue's order", async () => {
    const mirage: Card = {
      id: "mirage",
      name: "Mirage",
      suit: "wild",
      baseStrength: 0,
    };
    const collector: Card = {
      id: "collector",
      name: "Collector",
      suit: "wizard",
      baseStrength: 7,
    };
    const store = createStore(async () => [collector, mirage, king, knights]);
    await store.dispatch(loadVariant());

    expect(
      selectCardSections(store.getState()).map(({ suit }) => suit),
    ).toEqual(["army", "leader", "wild", "wizard"]);
  });

  it("lists cards alphabetically within a suit, not in the catalogue's order", async () => {
    const store = createStore(async () => [queen, king]);
    await store.dispatch(loadVariant());

    expect(
      selectCardSections(store.getState())[0].cards.map(({ name }) => name),
    ).toEqual(["King", "Queen"]);
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
        choice: { chosenId: null, optionIds },
      },
    ],
  });

  async function createStoreWithHand(
    cardIds: readonly CardId[],
    scoreHandExecute?: (hand: Hand) => Promise<number | HandScore>,
  ) {
    const store = createStore(async () => [island, swamp, candle, knights], {
      scoreHandExecute,
    });
    await store.dispatch(loadVariant());
    for (const cardId of cardIds) {
      await store.dispatch(addCardToHand(cardId));
    }
    return store;
  }

  const tileFor = (store: ReturnType<typeof createStore>, cardId: CardId) =>
    selectCardSections(store.getState())
      .flatMap((section) => section.cards)
      .find((card) => card.id === cardId);

  it("needs no choice for an unselected card", async () => {
    const store = await createStoreWithHand([]);

    expect(tileFor(store, "island")?.choice).toBeNull();
  });

  it("shows a pending choice once the card is selected", async () => {
    const store = await createStoreWithHand(["island", "swamp"]);

    expect(tileFor(store, "island")?.choice).toEqual({
      pending: true,
      text: "Choose…",
      accessibilityLabel: "Choose a card for Island",
    });
    expect(selectHandProgress(store.getState())).toMatchObject({
      firstPendingChoiceCardId: "island",
      choicesText: "1 choice needed",
      countLabel: "1 choice needed ›",
      reviewLabel: "1 choice needed",
      pipsAccessibilityLabel: "1 choice needed. Go to the card",
    });
  });

  it("records a valid choice and shows the chosen card", async () => {
    const store = await createStoreWithHand(["island", "swamp"]);

    await store.dispatch(
      chooseCard({ chooserId: "island", targetId: "swamp" }),
    );

    expect(selectHand(store.getState()).choices).toEqual({ island: "swamp" });
    expect(tileFor(store, "island")?.choice).toEqual({
      pending: false,
      text: "Swamp",
      accessibilityLabel: "Island: Swamp. Change",
    });
    expect(selectHandProgress(store.getState())).toMatchObject({
      firstPendingChoiceCardId: null,
      choicesText: null,
      countLabel: "2 of 7 cards",
    });
  });

  it("leaves the choice pending when the choice is rejected", async () => {
    const store = await createStoreWithHand(["island", "knights"]);

    await store.dispatch(
      chooseCard({ chooserId: "island", targetId: "knights" }),
    );

    expect(selectHand(store.getState()).choices).toEqual({});
    expect(tileFor(store, "island")?.choice?.pending).toBe(true);
  });

  it("goes back to pending when the chosen card is removed", async () => {
    const store = await createStoreWithHand(["island", "swamp", "candle"]);
    await store.dispatch(
      chooseCard({ chooserId: "island", targetId: "swamp" }),
    );

    await store.dispatch(removeCardFromHand("swamp"));

    expect(selectHand(store.getState()).choices).toEqual({});
    expect(tileFor(store, "island")?.choice?.pending).toBe(true);
  });

  it("forgets the choice when the choosing card is removed", async () => {
    const store = await createStoreWithHand(["island", "swamp"]);
    await store.dispatch(
      chooseCard({ chooserId: "island", targetId: "swamp" }),
    );

    await store.dispatch(removeCardFromHand("island"));
    await store.dispatch(addCardToHand("island"));

    expect(tileFor(store, "island")?.choice?.pending).toBe(true);
  });

  it("removes the choices with the hand", async () => {
    const store = await createStoreWithHand(["island", "swamp"]);
    await store.dispatch(
      chooseCard({ chooserId: "island", targetId: "swamp" }),
    );

    await store.dispatch(clearHand());

    expect(selectHand(store.getState())).toEqual({ cardIds: [], choices: {} });
  });

  it("counts every pending choice", async () => {
    const otherChooser: Card = { ...island, id: "mirage", name: "Mirage" };
    const store = createStore(async () => [island, otherChooser, swamp]);
    await store.dispatch(loadVariant());
    await store.dispatch(addCardToHand("mirage"));
    await store.dispatch(addCardToHand("island"));

    expect(selectHandProgress(store.getState())).toMatchObject({
      // In grid order, not the order they were added.
      firstPendingChoiceCardId: "island",
      countLabel: "2 choices needed ›",
    });
  });

  it("shows the made choice and the pending ones on the breakdown", async () => {
    const otherChooser: Card = { ...island, id: "mirage", name: "Mirage" };
    const store = createStore(async () => [island, otherChooser, swamp]);
    await store.dispatch(loadVariant());
    for (const cardId of ["island", "mirage", "swamp"]) {
      await store.dispatch(addCardToHand(cardId));
    }
    await store.dispatch(
      chooseCard({ chooserId: "island", targetId: "swamp" }),
    );

    expect(
      selectBreakdown(store.getState()).rows.map(
        ({ id, chosenName, choicePending }) => [id, chosenName, choicePending],
      ),
    ).toEqual([
      ["island", "Swamp", false],
      ["mirage", null, true],
      ["swamp", null, false],
    ]);
  });

  describe("the choice sheet", () => {
    it("is closed until opened", async () => {
      const store = await createStoreWithHand(["island"]);

      expect(selectChoiceSheet(store.getState())).toBeNull();
    });

    it("lists the options the score reports, with none current", async () => {
      const store = await createStoreWithHand(
        ["island", "swamp", "candle"],
        async () => scoreWithOptions(["swamp", "candle"]),
      );
      await store.dispatch(scoreHand());

      store.dispatch(choiceSheetOpened("island"));

      expect(selectChoiceSheet(store.getState())).toEqual({
        chooserId: "island",
        title: "Island",
        from: "hand",
        targets: [
          { suit: "flood", exceptNames: [] },
          { suit: "flame", exceptNames: [] },
        ],
        // One group with no suit, in the order the score gives
        groups: [
          {
            suit: null,
            options: [
              { id: "swamp", name: "Swamp", suit: "flood", current: false },
              { id: "candle", name: "Candle", suit: "flame", current: false },
            ],
          },
        ],
      });
    });

    it("names the cards that the choice's targets mention", async () => {
      const picky: Card = {
        ...island,
        id: "picky",
        name: "Picky",
        choice: {
          kind: "cardInHand",
          from: [{ suit: "flood", except: ["swamp"] }, { cardId: "candle" }],
        },
      };
      const store = createStore(async () => [picky, swamp, candle]);
      await store.dispatch(loadVariant());
      await store.dispatch(addCardToHand("picky"));

      store.dispatch(choiceSheetOpened("picky"));

      expect(selectChoiceSheet(store.getState())?.targets).toEqual([
        { suit: "flood", exceptNames: ["Swamp"] },
        { cardName: "Candle" },
      ]);
    });

    it("has no options before the score covers the card", async () => {
      const store = await createStoreWithHand(["island", "swamp"]);

      store.dispatch(choiceSheetOpened("island"));

      expect(sheetOptions(store)).toEqual([]);
    });

    it("leaves out options no longer in the hand", async () => {
      const store = await createStoreWithHand(
        ["island", "swamp", "candle"],
        async () => scoreWithOptions(["swamp", "candle"]),
      );
      await store.dispatch(scoreHand());
      await store.dispatch(removeCardFromHand("candle"));

      store.dispatch(choiceSheetOpened("island"));

      expect(sheetOptions(store)?.map(({ id }) => id)).toEqual(["swamp"]);
    });

    it("closes once a choice is made, and marks it current when reopened", async () => {
      const store = await createStoreWithHand(
        ["island", "swamp", "candle"],
        async () => scoreWithOptions(["swamp", "candle"]),
      );
      await store.dispatch(scoreHand());
      store.dispatch(choiceSheetOpened("island"));

      await store.dispatch(
        chooseCard({ chooserId: "island", targetId: "candle" }),
      );

      expect(selectChoiceSheet(store.getState())).toBeNull();

      store.dispatch(choiceSheetOpened("island"));

      expect(
        sheetOptions(store)?.map(({ id, current }) => [id, current]),
      ).toEqual([
        ["swamp", false],
        ["candle", true],
      ]);
    });

    it("stays open when a choice is rejected", async () => {
      const store = await createStoreWithHand(["island", "knights"]);
      store.dispatch(choiceSheetOpened("island"));

      await store.dispatch(
        chooseCard({ chooserId: "island", targetId: "knights" }),
      );

      expect(selectChoiceSheet(store.getState())?.chooserId).toBe("island");
    });

    it("closes when asked, when its card is removed, and when the hand is cleared", async () => {
      const store = await createStoreWithHand(["island", "swamp"]);

      store.dispatch(choiceSheetOpened("island"));
      store.dispatch(choiceSheetClosed());

      expect(selectChoiceSheet(store.getState())).toBeNull();

      store.dispatch(choiceSheetOpened("island"));
      await store.dispatch(removeCardFromHand("swamp"));

      expect(selectChoiceSheet(store.getState())).not.toBeNull();

      await store.dispatch(removeCardFromHand("island"));

      expect(selectChoiceSheet(store.getState())).toBeNull();

      await store.dispatch(addCardToHand("island"));
      store.dispatch(choiceSheetOpened("island"));
      await store.dispatch(clearHand());

      expect(selectChoiceSheet(store.getState())).toBeNull();
    });
  });
});

describe("revealing a card on the grid", () => {
  it("returns to the grid with the card to scroll to, until it has been revealed", async () => {
    const store = await createLoadedStore();
    store.dispatch(screenOpened("breakdown"));

    store.dispatch(cardRevealRequested("king"));

    expect(selectScreen(store.getState())).toBe("home");
    expect(selectCardToReveal(store.getState())).toBe("king");

    store.dispatch(cardRevealed());

    expect(selectCardToReveal(store.getState())).toBeNull();
  });
});

describe("choosing a card from the discard area", () => {
  // May take one Army or Beast from the discard area.
  const necromancer: Card = {
    id: "necromancer",
    name: "Necromancer",
    suit: "wizard",
    baseStrength: 3,
    preScoring: [{ kind: "addToHand", card: { chosen: true } }],
    choice: {
      kind: "cardInDiscardArea",
      from: [{ suit: "army" }, { suit: "beast" }],
    },
  };
  const dragon: Card = {
    id: "dragon",
    name: "Dragon",
    suit: "beast",
    baseStrength: 30,
  };
  const basilisk: Card = {
    id: "basilisk",
    name: "Basilisk",
    suit: "beast",
    baseStrength: 35,
  };
  const gameCards = [necromancer, king, knights, dragon, basilisk];

  async function createStoreWithHand(cardIds: readonly CardId[]) {
    const store = createStore(async () => gameCards, {
      scoreByTheRules: true,
      preScoring: ["necromancer"],
    });
    await store.dispatch(loadVariant());
    for (const cardId of cardIds) {
      await store.dispatch(addCardToHand(cardId));
    }
    await store.dispatch(scoreHand());
    return store;
  }

  const tileFor = (store: ReturnType<typeof createStore>, cardId: CardId) =>
    selectCardSections(store.getState())
      .flatMap((section) => section.cards)
      .find((card) => card.id === cardId);

  it("offers matching cards not in the hand, grouped by suit and sorted by name", async () => {
    const store = await createStoreWithHand(["necromancer", "king", "knights"]);

    store.dispatch(choiceSheetOpened("necromancer"));

    expect(selectChoiceSheet(store.getState())).toMatchObject({
      from: "discardArea",
      groups: [
        { suit: "beast", options: [{ id: "basilisk" }, { id: "dragon" }] },
      ],
    });
  });

  it("adds the chosen card to the score, and lists it on the breakdown as not removable", async () => {
    const store = await createStoreWithHand(["necromancer", "king"]);

    await store.dispatch(
      chooseCard({ chooserId: "necromancer", targetId: "dragon" }),
    );
    await store.dispatch(scoreHand());

    // 3 + King 8 + Dragon 30
    expect(selectScore(store.getState())).toBe(41);
    expect(tileFor(store, "necromancer")?.choice).toMatchObject({
      pending: false,
      text: "Dragon",
    });
    expect(
      selectBreakdown(store.getState()).rows.map(
        ({ id, chosenName, addedByName }) => [id, chosenName, addedByName],
      ),
    ).toEqual([
      ["dragon", null, "Necromancer"],
      ["king", null, null],
      ["necromancer", "Dragon", null],
    ]);
  });

  it("doesn't count the chosen card towards the hand limit", async () => {
    const store = await createStoreWithHand(["necromancer"]);
    await store.dispatch(
      chooseCard({ chooserId: "necromancer", targetId: "dragon" }),
    );

    expect(selectHandProgress(store.getState()).pips.filter(Boolean)).toEqual([
      true,
    ]);
  });

  it("shows the choice as pending once its card is added to the hand", async () => {
    const store = await createStoreWithHand(["necromancer"]);
    await store.dispatch(
      chooseCard({ chooserId: "necromancer", targetId: "dragon" }),
    );

    await store.dispatch(addCardToHand("dragon"));
    await store.dispatch(scoreHand());

    expect(tileFor(store, "necromancer")?.choice?.pending).toBe(true);
    // 3 + Dragon 30, counted once
    expect(selectScore(store.getState())).toBe(33);
  });
});

describe("choosing a card from the game", () => {
  // Before scoring, takes the name and suit of any one Leader or Beast in the game.
  const shapeshifter: Card = {
    id: "shapeshifter",
    name: "Shapeshifter",
    suit: "wild",
    baseStrength: 0,
    preScoring: [
      { kind: "take", from: { chosen: true }, attributes: ["name", "suit"] },
    ],
    choice: {
      kind: "cardInGame",
      from: [{ suit: "leader" }, { suit: "beast" }],
    },
  };
  const dragon: Card = {
    id: "dragon",
    name: "Dragon",
    suit: "beast",
    baseStrength: 30,
  };
  const gameCards = [shapeshifter, king, queen, knights, dragon];

  async function createStoreWithHand(cardIds: readonly CardId[]) {
    const store = createStore(async () => gameCards, {
      scoreByTheRules: true,
      preScoring: ["shapeshifter"],
    });
    await store.dispatch(loadVariant());
    for (const cardId of cardIds) {
      await store.dispatch(addCardToHand(cardId));
    }
    await store.dispatch(scoreHand());
    return store;
  }

  it("offers matching cards in the hand and out of it, grouped by suit", async () => {
    const store = await createStoreWithHand(["shapeshifter", "king"]);

    store.dispatch(choiceSheetOpened("shapeshifter"));

    expect(selectChoiceSheet(store.getState())).toMatchObject({
      from: "game",
      groups: [
        { suit: "beast", options: [{ id: "dragon" }] },
        { suit: "leader", options: [{ id: "king" }, { id: "queen" }] },
      ],
    });
  });

  it("shows the suit it took on the breakdown", async () => {
    const store = await createStoreWithHand(["shapeshifter"]);

    await store.dispatch(
      chooseCard({ chooserId: "shapeshifter", targetId: "dragon" }),
    );
    await store.dispatch(scoreHand());

    expect(selectBreakdown(store.getState()).rows).toMatchObject([
      { id: "shapeshifter", suit: "beast", chosenName: "Dragon" },
    ]);
  });
});
