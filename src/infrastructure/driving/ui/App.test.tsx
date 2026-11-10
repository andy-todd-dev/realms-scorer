import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { AddCardToHandUseCase } from "../../../application/add-card-to-hand.usecase";
import { ChooseCardUseCase } from "../../../application/choose-card.usecase";
import { ClearHandUseCase } from "../../../application/clear-hand.usecase";
import type { AppInfoView } from "../../../application/load-app-info.usecase";
import { LoadVariantUseCase } from "../../../application/load-variant.usecase";
import type { ScanResult } from "../../../application/recognise-hand.usecase";
import { RemoveCardFromHandUseCase } from "../../../application/remove-card-from-hand.usecase";
import { ReplaceHandUseCase } from "../../../application/replace-hand.usecase";
import { ScoreHandUseCase } from "../../../application/score-hand.usecase";
import type { Card, CardId, Suit } from "../../../domain/card";
import type { DeckId } from "../../../domain/deck";
import type { Hand } from "../../../domain/hand";
import type { CardScore, HandScore } from "../../../domain/score";
import type { Variant, VariantId } from "../../../domain/variant";
import { createAppStore } from "../state/store";
import { BASE_VARIANT_ID } from "../state/variant-slice";
import { App } from "./App";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

// Their native modules don't exist under Jest. Reanimated's mock needs Worklets, so mock that too.
jest.mock("react-native-worklets", () =>
  jest.requireActual("react-native-worklets/lib/module/mock"),
);
jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated/mock"),
  // Missing from Reanimated's mock.
  useReducedMotion: () => false,
}));

// The camera and photo library are native. Each scanning test sets what they return.
const mockImagePicker = {
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
};
// The app imports the module before this file defines the fakes, so each is looked up when called.
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: () =>
    mockImagePicker.requestCameraPermissionsAsync(),
  launchCameraAsync: () => mockImagePicker.launchCameraAsync(),
  launchImageLibraryAsync: () => mockImagePicker.launchImageLibraryAsync(),
}));

// The first render loads all of React Native, which takes over 5s without a Jest cache.
jest.setTimeout(30000);

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
const cards = [king, queen, knights];

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
  choice: { kind: "cardInHand", from: [{ suit: "flood" }, { suit: "flame" }] },
};
const swamp: Card = {
  id: "swamp",
  name: "Swamp",
  suit: "flood",
  baseStrength: 18,
};
const withIsland = [...cards, island, swamp];

const handOf = (...cardIds: CardId[]): Hand => ({ cardIds, choices: {} });

const eightCards: Card[] = Array.from({ length: 8 }, (_, index) => ({
  id: `card-${index}`,
  name: `Card ${index}`,
  suit: "beast",
  baseStrength: 1,
}));

// Builds a score from card scores, adding up the totals.
const handScoreOf = (cardScores: readonly CardScore[]): HandScore => {
  const sum = (key: "base" | "bonus" | "penalty" | "total") =>
    cardScores.reduce((total, cardScore) => total + cardScore[key], 0);

  return {
    cards: cardScores,
    base: sum("base"),
    bonus: sum("bonus"),
    penalty: sum("penalty"),
    total: sum("total"),
  };
};

// A score with only a total, for tests that only look at the total.
const totalOnly = (total: number) => ({
  ...handScoreOf([]),
  base: total,
  total,
});

// Adds up base strengths. For the Island, it also reports its options as the rules would: the other Floods in the hand.
const sumStrengths = async ({ cardIds, choices }: Hand) => {
  const handCards = [...withIsland, ...eightCards].filter((card) =>
    cardIds.includes(card.id),
  );

  return handScoreOf(
    handCards.map(({ id, baseStrength, choice }) => ({
      cardId: id,
      blanked: false,
      base: baseStrength,
      bonus: 0,
      penalty: 0,
      total: baseStrength,
      lines: [],
      ...(choice && {
        choice: {
          chosenId: choices[id]?.cardId ?? null,
          optionIds: handCards
            .filter((other) => other.id !== id && other.suit === "flood")
            .map((other) => other.id),
        },
      }),
    })),
  );
};

// Fakes for the catalogs, serving the given cards as the deck of a variant with the store's default ID.
function catalogsFor(
  loadCards: () => Promise<Card[]>,
  preScoring: readonly CardId[],
) {
  const variant: Variant = {
    id: BASE_VARIANT_ID,
    name: "Test variant",
    deckId: "deck",
    handSize: 7,
    preScoring,
  };

  return {
    cardCatalog: {
      getAll: loadCards,
      getByIds: async (_: DeckId, cardIds: readonly CardId[]) =>
        (await loadCards()).filter((card) => cardIds.includes(card.id)),
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

async function renderApp({
  scoreHand = sumStrengths,
  scoreByTheRules = false,
  preScoring = [],
  loadCards = async () => cards,
  chooseCard,
  recogniseHand = () => Promise.reject(new Error("No scan expected")),
  replaceHand,
  loadAppInfo = async () => ({ version: null, buildNumber: null }),
}: {
  scoreHand?: (hand: Hand) => Promise<number | HandScore>;
  // Scores with the real use case, so the options and any added cards come from the rules.
  scoreByTheRules?: boolean;
  preScoring?: readonly CardId[];
  loadCards?: () => Promise<Card[]>;
  chooseCard?: (
    hand: Hand,
    chooserId: CardId,
    targetId: CardId,
    suit?: Suit,
  ) => Promise<Hand>;
  recogniseHand?: (imageUri: string) => Promise<ScanResult>;
  replaceHand?: (cardIds: readonly CardId[]) => Promise<Hand>;
  loadAppInfo?: () => Promise<AppInfoView>;
} = {}) {
  const catalogs = catalogsFor(loadCards, preScoring);
  const store = createAppStore({
    addCardToHand: new AddCardToHandUseCase(catalogs),
    // Checks choices against the same cards that loading serves, unless faked.
    chooseCard: chooseCard
      ? {
          execute: (_, hand, chooserId, targetId, suit) =>
            chooseCard(hand, chooserId, targetId, suit),
        }
      : new ChooseCardUseCase(catalogs),
    clearHand: new ClearHandUseCase(),
    loadAppInfo: { execute: loadAppInfo },
    // The real use case, so card views and choice descriptions are built as in the app.
    loadVariant: new LoadVariantUseCase(catalogs),
    recogniseHand: { execute: (_, imageUri) => recogniseHand(imageUri) },
    removeCardFromHand: new RemoveCardFromHandUseCase(catalogs),
    // Builds the hand from the same cards that loading serves, unless faked.
    replaceHand: replaceHand
      ? { execute: (_, cardIds) => replaceHand(cardIds) }
      : new ReplaceHandUseCase(catalogs),
    scoreHand: scoreByTheRules
      ? new ScoreHandUseCase(catalogs)
      : {
          execute: async (_, hand) => {
            const score = await scoreHand(hand);
            return typeof score === "number" ? totalOnly(score) : score;
          },
        },
  });
  const user = userEvent.setup();

  await render(<App store={store} />);
  await screen.findByTestId("hand-score");

  const press = (testID: string) => user.press(screen.getByTestId(testID));

  return {
    press,
    showBreakdown: () => press("show-breakdown"),
    backToCards: () => press("back-to-cards"),
    tapCard: (cardId: CardId) => press(`card-tile-${cardId}`),
  };
}

const expectScore = (score: string) =>
  waitFor(() =>
    expect(screen.getByTestId("hand-score")).toHaveTextContent(score),
  );

describe("scoring", () => {
  it("requests a score for the empty hand on start", async () => {
    const scoreHand = jest.fn(sumStrengths);

    await renderApp({ scoreHand });

    await expectScore("0");
    expect(scoreHand).toHaveBeenCalledWith(handOf());
  });

  it("updates the score each time a card is tapped", async () => {
    const scoreHand = jest.fn(sumStrengths);
    const { tapCard } = await renderApp({ scoreHand });

    await tapCard("king");
    await waitFor(() =>
      expect(scoreHand).toHaveBeenLastCalledWith(handOf("king")),
    );
    await expectScore("8");
    await tapCard("queen");
    await waitFor(() =>
      expect(scoreHand).toHaveBeenLastCalledWith(handOf("king", "queen")),
    );

    await expectScore("14");
  });

  it("doesn't request a score when only the screen changes", async () => {
    const scoreHand = jest.fn(sumStrengths);
    const { showBreakdown, backToCards, tapCard } = await renderApp({
      scoreHand,
    });

    await tapCard("king");
    await expectScore("8");
    expect(scoreHand).toHaveBeenCalledTimes(2);

    await showBreakdown();
    await backToCards();

    await expectScore("8");
    expect(scoreHand).toHaveBeenCalledTimes(2);
  });

  it("keeps the current score while a new one is in flight", async () => {
    const responses: ((score: number) => void)[] = [];
    const { tapCard } = await renderApp({
      scoreHand: () => new Promise((resolve) => responses.push(resolve)),
    });

    await act(async () => responses[0](0));
    await expectScore("0");
    await tapCard("king");

    expect(screen.getByTestId("hand-score")).toHaveTextContent("0");

    await act(async () => responses[1](8));

    await expectScore("8");
  });

  it("shows a placeholder when scoring fails", async () => {
    await renderApp({
      scoreHand: () => Promise.reject(new Error("no score")),
    });

    await expectScore("–");
  });
});

describe("the home screen", () => {
  it("opens on the card grid with an empty hand", async () => {
    await renderApp();

    expect(await screen.findByTestId("card-tile-king")).toBeOnTheScreen();
    expect(screen.getByTestId("hand-count")).toHaveTextContent(
      "Tap cards or scan",
    );
    expect(screen.queryByTestId("breakdown-total")).toBeNull();
  });

  it("clears the hand, and rescores", async () => {
    const scoreHand = jest.fn(sumStrengths);
    const { press, tapCard } = await renderApp({ scoreHand });

    expect(screen.getByTestId("clear-hand")).toBeDisabled();

    await tapCard("king");
    await tapCard("queen");
    await expectScore("14");

    expect(screen.getByTestId("clear-hand")).toBeEnabled();

    await press("clear-hand");

    expect(screen.getByTestId("card-tile-king")).not.toBeChecked();
    expect(screen.getByTestId("card-tile-queen")).not.toBeChecked();
    expect(screen.getByTestId("hand-count")).toHaveTextContent(
      "Tap cards or scan",
    );
    expect(screen.getByTestId("show-breakdown")).toBeDisabled();
    expect(screen.getByTestId("clear-hand")).toBeDisabled();
    await waitFor(() => expect(scoreHand).toHaveBeenLastCalledWith(handOf()));
    await expectScore("0");
  });

  it("unselects a card when its tile is tapped again, and rescores", async () => {
    const scoreHand = jest.fn(sumStrengths);
    const { tapCard } = await renderApp({ scoreHand });

    await tapCard("king");
    await tapCard("queen");
    await expectScore("14");

    expect(screen.getByTestId("card-tile-king")).toBeEnabled();

    await tapCard("king");

    expect(screen.getByTestId("card-tile-king")).not.toBeChecked();
    expect(screen.getByTestId("card-tile-queen")).toBeChecked();
    expect(screen.getByTestId("hand-count")).toHaveTextContent("1 of 7 cards");
    await waitFor(() =>
      expect(scoreHand).toHaveBeenLastCalledWith(handOf("queen")),
    );
    await expectScore("6");
  });

  it("can't open the breakdown with an empty hand", async () => {
    await renderApp();

    expect(screen.getByTestId("show-breakdown")).toBeDisabled();
    expect(screen.getByTestId("hand-pips")).toBeDisabled();
  });

  it("groups the cards under their suits, leaving out suits with no cards", async () => {
    await renderApp();

    expect(await screen.findByText("Army")).toBeOnTheScreen();
    expect(screen.getByText("Leader")).toBeOnTheScreen();
    expect(screen.queryByText("Flood")).toBeNull();
    expect(screen.getByTestId("card-tile-knights")).toBeOnTheScreen();
  });

  it("marks a tapped card as selected and counts it", async () => {
    const { tapCard } = await renderApp();

    expect(await screen.findByTestId("card-tile-king")).not.toBeChecked();

    await tapCard("king");

    expect(screen.getByTestId("card-tile-king")).toBeChecked();
    expect(screen.getByTestId("hand-count")).toHaveTextContent("1 of 7 cards");
    expect(screen.getByTestId("hand-pips")).toHaveProp(
      "accessibilityLabel",
      "1 of 7 cards. Show breakdown",
    );
  });

  it("confirms a full hand at 7 cards, and disables the cards not in it", async () => {
    const { tapCard } = await renderApp({
      loadCards: async () => eightCards,
    });

    for (const index of [0, 1, 2, 3, 4, 5, 6]) {
      await tapCard(`card-${index}`);
    }

    expect(screen.getByTestId("hand-count")).toHaveTextContent("7 cards ✓");
    expect(screen.getByTestId("card-tile-card-7")).toBeDisabled();
    expect(screen.getByTestId("card-tile-card-0")).toBeEnabled();

    await tapCard("card-7");

    expect(screen.getByTestId("hand-count")).toHaveTextContent("7 cards ✓");
    expect(screen.getByTestId("card-tile-card-7")).not.toBeChecked();

    await tapCard("card-0");

    expect(screen.getByTestId("hand-count")).toHaveTextContent("6 of 7 cards");
    expect(screen.getByTestId("card-tile-card-7")).toBeEnabled();
  });

  it("explains when the cards failed to load", async () => {
    await renderApp({
      loadCards: () => Promise.reject(new Error("no cards")),
    });

    expect(await screen.findByText("Could not load cards.")).toBeOnTheScreen();
  });

  it("shows a loading message until the cards arrive", async () => {
    await renderApp({
      loadCards: () => new Promise(() => {}),
    });

    expect(screen.getByText("Loading cards...")).toBeOnTheScreen();
  });
});

describe("the app version", () => {
  it("shows the version and build number at the end of the grid", async () => {
    await renderApp({
      loadAppInfo: async () => ({ version: "0.3.0", buildNumber: "42" }),
    });

    expect(await screen.findByTestId("app-version")).toHaveTextContent(
      "Version 0.3.0 (42)",
    );
  });

  it("shows nothing when the version is unknown", async () => {
    await renderApp();

    expect(screen.queryByTestId("app-version")).toBeNull();
  });

  it("shows nothing and keeps working when the version can't be read", async () => {
    const { tapCard } = await renderApp({
      loadAppInfo: () => Promise.reject(new Error("Unavailable")),
    });

    await tapCard("king");

    await expectScore("8");
    expect(screen.queryByTestId("app-version")).toBeNull();
  });
});

describe("the breakdown screen", () => {
  it("opens from the button, listing the hand highest-scoring first", async () => {
    const { showBreakdown, tapCard } = await renderApp();

    await tapCard("queen");
    await tapCard("king");
    await expectScore("14");
    await showBreakdown();

    expect(screen.getByTestId("breakdown-title")).toHaveTextContent(
      "Score breakdown",
    );
    expect(screen.getByTestId("breakdown-total")).toHaveTextContent("14");
    expect(screen.getByTestId("breakdown-warning")).toHaveTextContent(
      "2 of 7 cards",
    );
    expect(
      screen.getAllByTestId(/^breakdown-card-/).map((row) => row.props.testID),
    ).toEqual(["breakdown-card-king", "breakdown-card-queen"]);
    expect(screen.queryByTestId("breakdown-card-knights")).toBeNull();
  });

  it("opens from a button labelled Breakdown", async () => {
    const { tapCard } = await renderApp();

    await tapCard("king");

    expect(screen.getByTestId("show-breakdown")).toHaveTextContent("Breakdown");
    expect(screen.getByTestId("show-breakdown")).toHaveProp(
      "accessibilityLabel",
      "Show score breakdown",
    );
  });

  it("opens from the pips too", async () => {
    const { press, tapCard } = await renderApp();

    await tapCard("king");
    await press("hand-pips");

    expect(screen.getByTestId("breakdown-card-king")).toBeOnTheScreen();
  });

  it("returns to the cards with the hand intact", async () => {
    const { showBreakdown, backToCards, tapCard } = await renderApp();

    await tapCard("king");
    await showBreakdown();
    await backToCards();

    expect(screen.queryByTestId("breakdown-total")).toBeNull();
    expect(screen.getByTestId("card-tile-king")).toBeChecked();
  });

  it("shows no warning for a full hand", async () => {
    const { showBreakdown, tapCard } = await renderApp({
      loadCards: async () => eightCards,
    });

    for (const index of [0, 1, 2, 3, 4, 5, 6]) {
      await tapCard(`card-${index}`);
    }
    await showBreakdown();

    expect(screen.getByTestId("breakdown-total")).toBeOnTheScreen();
    expect(screen.queryByTestId("breakdown-warning")).toBeNull();
  });

  it("removes a card in place, and rescores", async () => {
    const { press, showBreakdown, tapCard } = await renderApp();

    await tapCard("king");
    await tapCard("queen");
    await expectScore("14");
    await showBreakdown();

    expect(screen.getByLabelText("Remove King from hand")).toBeOnTheScreen();

    await press("remove-card-king");

    expect(screen.queryByTestId("breakdown-card-king")).toBeNull();
    expect(screen.getByTestId("breakdown-card-queen")).toBeOnTheScreen();
    expect(screen.getByTestId("breakdown-warning")).toHaveTextContent(
      "1 of 7 cards",
    );
    await waitFor(() =>
      expect(screen.getByTestId("breakdown-total")).toHaveTextContent("6"),
    );
  });

  it("returns to the grid when the last card is removed", async () => {
    const { press, showBreakdown, tapCard } = await renderApp();

    await tapCard("king");
    await showBreakdown();
    await press("remove-card-king");

    expect(screen.queryByTestId("breakdown-total")).toBeNull();
    expect(screen.getByTestId("card-tile-king")).not.toBeChecked();
    expect(screen.getByTestId("hand-count")).toHaveTextContent(
      "Tap cards or scan",
    );
    await expectScore("0");
  });

  it("shows each card's base, then each bonus and penalty with its reason, with blanked cards last and why", async () => {
    const { showBreakdown, tapCard } = await renderApp({
      scoreHand: async () =>
        handScoreOf([
          {
            cardId: "king",
            blanked: false,
            base: 8,
            bonus: 10,
            penalty: -3,
            total: 15,
            lines: [
              {
                ability: "bonus",
                points: 10,
                reason: {
                  kind: "each",
                  each: 10,
                  suit: "army",
                  cardIds: ["knights"],
                  withCardIds: [],
                },
              },
              {
                ability: "penalty",
                points: -3,
                reason: {
                  kind: "condition",
                  withCardIds: [],
                  without: [{ suit: "wizard" }],
                  allSuitsDifferent: false,
                },
              },
            ],
          },
          {
            cardId: "queen",
            blanked: false,
            base: 6,
            bonus: 0,
            penalty: 0,
            total: 6,
            lines: [],
          },
          {
            cardId: "knights",
            blanked: true,
            base: 0,
            bonus: 0,
            penalty: 0,
            total: 0,
            lines: [],
            blankReason: { byCardIds: ["king"], self: [], loopCardIds: [] },
          },
        ]),
    });

    await tapCard("knights");
    await tapCard("queen");
    await tapCard("king");
    await showBreakdown();

    await waitFor(() =>
      expect(screen.getByTestId("breakdown-total")).toHaveTextContent("21"),
    );

    expect(
      screen.getAllByTestId(/^breakdown-card-/).map((row) => row.props.testID),
    ).toEqual([
      "breakdown-card-king",
      "breakdown-card-queen",
      "breakdown-card-knights",
    ]);
    expect(screen.getByTestId("card-total-king")).toHaveTextContent("15");
    expect(screen.getByTestId("breakdown-card-king")).toHaveTextContent(
      /Base strength8\+10 × 1 Army \(Knights\)\+10With no Wizard\u22123/,
    );
    expect(screen.getByTestId("breakdown-card-queen")).toHaveTextContent(
      /^Queen.*Base strength6$/,
    );
    expect(screen.getByTestId("card-total-knights")).toHaveTextContent("0");
    expect(screen.getByTestId("row-badge-knights")).toHaveTextContent(
      "Blanked",
    );
    expect(screen.queryByTestId("row-badge-king")).toBeNull();
    expect(screen.getByTestId("blank-reason-knights")).toHaveTextContent(
      "Blanked by King.",
    );
    expect(screen.queryByTestId("blank-reason-king")).toBeNull();
  });

  it("shows a placeholder total when scoring fails", async () => {
    const { showBreakdown, tapCard } = await renderApp({
      scoreHand: () => Promise.reject(new Error("no score")),
    });

    await tapCard("king");
    await showBreakdown();

    expect(screen.getByTestId("breakdown-total")).toHaveTextContent("–");
    expect(screen.getByTestId("card-total-king")).toHaveTextContent("–");
    expect(screen.getByTestId("breakdown-card-king")).toBeOnTheScreen();
  });
});

describe("choosing a card", () => {
  const renderWithIsland = (
    options: Omit<Parameters<typeof renderApp>[0], "loadCards"> = {},
  ) => renderApp({ ...options, loadCards: async () => withIsland });

  const expectCount = (text: string) =>
    waitFor(() =>
      expect(screen.getByTestId("hand-count")).toHaveTextContent(text),
    );

  it("shows a pending strip under a selected card that needs a choice, and flags it on the bar", async () => {
    const { tapCard } = await renderWithIsland();

    await tapCard("king");

    expect(screen.queryByTestId("choice-strip-king")).toBeNull();
    expect(screen.queryByTestId("choice-strip-island")).toBeNull();

    await tapCard("island");

    expect(screen.getByTestId("choice-strip-island")).toHaveTextContent(
      "Choose…",
    );
    expect(screen.getByTestId("choice-strip-island")).toHaveProp(
      "accessibilityLabel",
      "Choose a card for Island",
    );
    await expectCount("1 choice needed ›");
    expect(screen.getByTestId("hand-pips")).toHaveProp(
      "accessibilityLabel",
      "1 choice needed. Go to the card",
    );
  });

  it("leads the pips to the card that needs a choice, not the breakdown", async () => {
    const { press, tapCard } = await renderWithIsland();

    await tapCard("island");
    await press("hand-pips");

    expect(screen.queryByTestId("breakdown-total")).toBeNull();
    expect(screen.getByTestId("card-grid")).toBeOnTheScreen();
  });

  it("still opens the breakdown from the button", async () => {
    const { showBreakdown, tapCard } = await renderWithIsland();

    await tapCard("island");
    await showBreakdown();

    expect(screen.getByTestId("breakdown-total")).toBeOnTheScreen();
  });

  it("lists only the cards in the hand that may be chosen, with none current", async () => {
    const { press, tapCard } = await renderWithIsland();

    await tapCard("island");
    await tapCard("swamp");
    await tapCard("king");
    await expectScore("40");
    await press("choice-strip-island");

    expect(await screen.findByTestId("choice-sheet-title")).toHaveTextContent(
      "Island",
    );
    expect(screen.getByTestId("choice-sheet-instruction")).toHaveTextContent(
      "Choose one Flood or Flame in your hand.",
    );
    expect(screen.getByTestId("choice-option-swamp")).not.toBeSelected();
    expect(screen.queryByTestId("choice-option-king")).toBeNull();
    expect(screen.queryByTestId("choice-option-island")).toBeNull();
  });

  it("says when there is nothing to choose", async () => {
    const { press, tapCard } = await renderWithIsland();

    await tapCard("island");
    await expectScore("14");
    await press("choice-strip-island");

    expect(
      await screen.findByText(
        "No Flood or Flame in your hand yet. Add one, then come back.",
      ),
    ).toBeOnTheScreen();
  });

  it("closes without choosing", async () => {
    const { press, tapCard } = await renderWithIsland();

    await tapCard("island");
    await press("choice-strip-island");
    await screen.findByTestId("choice-sheet-title");
    await press("close-choice-sheet");

    await waitFor(() =>
      expect(screen.queryByTestId("choice-sheet-title")).toBeNull(),
    );
    expect(screen.getByTestId("choice-strip-island")).toHaveTextContent(
      "Choose…",
    );
  });

  it("makes the choice, closing the sheet, showing the choice and rescoring with it", async () => {
    const scoreHand = jest.fn(sumStrengths);
    const { press, showBreakdown, tapCard } = await renderWithIsland({
      scoreHand,
    });

    await tapCard("island");
    await tapCard("swamp");
    await expectScore("32");
    await press("choice-strip-island");
    await press("choice-option-swamp");

    await waitFor(() =>
      expect(screen.queryByTestId("choice-sheet-title")).toBeNull(),
    );
    expect(screen.getByTestId("choice-strip-island")).toHaveTextContent(
      "Swamp",
    );
    expect(screen.getByTestId("choice-strip-island")).toHaveProp(
      "accessibilityLabel",
      "Island: Swamp. Change",
    );
    await expectCount("2 of 7 cards");
    await waitFor(() =>
      expect(scoreHand).toHaveBeenLastCalledWith({
        cardIds: ["island", "swamp"],
        choices: { island: { cardId: "swamp" } },
      }),
    );

    await press("choice-strip-island");

    expect(await screen.findByTestId("choice-option-swamp")).toBeSelected();

    await press("close-choice-sheet");
    await showBreakdown();

    expect(screen.getByTestId("breakdown-card-island")).toHaveTextContent(
      /Chose.*Swamp.*Base strength/,
    );
    // Swamp is in the hand, so its chip leads to its row.
    expect(screen.getByTestId("chosen-card-island")).toHaveProp(
      "accessibilityLabel",
      "Island chose Swamp. Go to Swamp",
    );
    expect(screen.queryByTestId("choice-needed-island")).toBeNull();
  });

  it("stays pending while the choice is in flight, and when it fails", async () => {
    const responses: { reject: (error: Error) => void }[] = [];
    const { press, tapCard } = await renderWithIsland({
      chooseCard: () => new Promise((_, reject) => responses.push({ reject })),
    });

    await tapCard("island");
    await tapCard("swamp");
    await expectScore("32");
    await press("choice-strip-island");
    await press("choice-option-swamp");

    expect(screen.getByTestId("choice-strip-island")).toHaveTextContent(
      "Choose…",
    );

    await act(async () => responses[0].reject(new Error("no choice")));

    expect(screen.getByTestId("choice-strip-island")).toHaveTextContent(
      "Choose…",
    );
    expect(screen.getByTestId("choice-sheet-title")).toBeOnTheScreen();
    await expectCount("1 choice needed ›");
  });

  it("goes back to pending when the chosen card is removed", async () => {
    const { press, tapCard } = await renderWithIsland();

    await tapCard("island");
    await tapCard("swamp");
    await expectScore("32");
    await press("choice-strip-island");
    await press("choice-option-swamp");
    await waitFor(() =>
      expect(screen.getByTestId("choice-strip-island")).toHaveTextContent(
        "Swamp",
      ),
    );

    await tapCard("swamp");

    expect(screen.getByTestId("choice-strip-island")).toHaveTextContent(
      "Choose…",
    );
    await expectCount("1 choice needed ›");
  });

  it("flags a pending choice on the breakdown, and returns to the grid from it", async () => {
    const { press, showBreakdown, tapCard } = await renderWithIsland();

    await tapCard("island");
    await showBreakdown();

    expect(screen.getByTestId("breakdown-warning")).toHaveTextContent(
      "1 choice needed",
    );
    expect(screen.getByTestId("row-badge-island")).toHaveTextContent(
      "Choice needed",
    );
    expect(screen.getByTestId("choice-needed-island")).toHaveTextContent(
      "Choose on the cards screen",
    );

    await press("choice-needed-island");

    expect(screen.queryByTestId("breakdown-total")).toBeNull();
    expect(screen.getByTestId("choice-strip-island")).toBeOnTheScreen();
  });
});

describe("choosing a card from the discard area", () => {
  // May take one Army or Leader from the discard area.
  const necromancer: Card = {
    id: "necromancer",
    name: "Necromancer",
    suit: "wizard",
    baseStrength: 3,
    preScoring: [{ kind: "addToHand", card: { chosen: true } }],
    choice: {
      kind: "cardInDiscardArea",
      from: [{ suit: "army" }, { suit: "leader" }],
    },
  };
  const withNecromancer = [...cards, necromancer];

  const renderWithNecromancer = () =>
    renderApp({
      loadCards: async () => withNecromancer,
      scoreByTheRules: true,
      preScoring: ["necromancer"],
    });

  it("lists matching cards not in the hand under their suits", async () => {
    const { press, tapCard } = await renderWithNecromancer();

    await tapCard("necromancer");
    await tapCard("king");
    await expectScore("11");
    await press("choice-strip-necromancer");

    expect(
      await screen.findByTestId("choice-sheet-instruction"),
    ).toHaveTextContent("Choose one Army or Leader from the discard area.");
    const sheet = within(screen.getByTestId("choice-sheet"));
    expect(
      sheet
        .getAllByRole("header")
        .map((heading) => heading.props.children)
        // After the sheet's own title
        .slice(1),
    ).toEqual(["Army", "Leader"]);
    expect(screen.getByTestId("choice-option-knights")).toBeOnTheScreen();
    expect(screen.getByTestId("choice-option-queen")).toBeOnTheScreen();
    expect(screen.queryByTestId("choice-option-king")).toBeNull();
  });

  it("scores the chosen card and lists it on the breakdown, without a remove button", async () => {
    const { press, showBreakdown, tapCard } = await renderWithNecromancer();

    await tapCard("necromancer");
    await expectScore("3");
    await press("choice-strip-necromancer");
    await press("choice-option-knights");

    // 3 + Knights 20
    await expectScore("23");
    expect(screen.getByTestId("choice-strip-necromancer")).toHaveTextContent(
      "Knights",
    );
    expect(screen.getByTestId("hand-count")).toHaveTextContent("1 of 7 cards");

    await showBreakdown();

    expect(screen.getByTestId("breakdown-card-knights")).toHaveTextContent(
      /added by Necromancer/,
    );
    expect(screen.getByTestId("card-total-knights")).toHaveTextContent("20");
    expect(screen.queryByTestId("remove-card-knights")).toBeNull();
    expect(screen.getByTestId("chosen-card-necromancer")).toHaveTextContent(
      "Knights",
    );
  });
});

describe("choosing a card and a suit", () => {
  // Before scoring, gives one other card in the hand a new suit: Army, Leader or Wild.
  const book: Card = {
    id: "book",
    name: "Book",
    suit: "artifact",
    baseStrength: 3,
    preScoring: [
      { kind: "give", to: { chosen: true }, suit: { chosenSuit: true } },
    ],
    choice: {
      kind: "cardInHand",
      from: [{ suit: "leader" }, { suit: "army" }],
      suits: ["army", "leader", "wild"],
    },
  };
  // +5 for each Army.
  const captain: Card = {
    id: "captain",
    name: "Captain",
    suit: "wizard",
    baseStrength: 1,
    bonus: {
      text: "",
      effects: [{ kind: "points", points: 5, per: { suit: "army" } }],
    },
  };

  const renderWithBook = () =>
    renderApp({
      loadCards: async () => [...cards, book, captain],
      scoreByTheRules: true,
      preScoring: ["book"],
    });

  it("asks for a suit once a card is picked, and goes back to the cards", async () => {
    const { press, tapCard } = await renderWithBook();

    await tapCard("book");
    await tapCard("king");
    await expectScore("11");
    await press("choice-strip-book");
    await press("choice-option-king");

    expect(
      await screen.findByTestId("choice-sheet-instruction"),
    ).toHaveTextContent("Choose a new suit for King.");
    expect(screen.getByTestId("choice-sheet-title")).toHaveTextContent(
      "King becomes…",
    );
    expect(screen.getByTestId("choice-suit-army")).toBeOnTheScreen();
    expect(screen.getByTestId("choice-suit-wild")).toBeOnTheScreen();
    expect(screen.queryByTestId("choice-suit-leader")).toBeNull();
    expect(screen.getByTestId("choice-strip-book")).toHaveTextContent(
      "Choose…",
    );

    await press("choice-sheet-back");

    expect(await screen.findByTestId("choice-option-king")).toBeOnTheScreen();
    expect(screen.queryByTestId("choice-suit-army")).toBeNull();
  });

  it("gives the card the suit, showing it on the strip and the breakdown, and rescoring", async () => {
    const { press, showBreakdown, tapCard } = await renderWithBook();

    await tapCard("book");
    await tapCard("king");
    await tapCard("captain");
    // 3 + 8 + 1
    await expectScore("12");
    await press("choice-strip-book");
    await press("choice-option-king");
    await press("choice-suit-army");

    await waitFor(() =>
      expect(screen.queryByTestId("choice-sheet-title")).toBeNull(),
    );
    // 3 + 8 + (1 + 5 for the King as an Army)
    await expectScore("17");
    expect(screen.getByTestId("choice-strip-book")).toHaveTextContent(
      "King → Army",
    );
    expect(screen.getByTestId("choice-strip-book")).toHaveProp(
      "accessibilityLabel",
      "Book: King → Army. Change",
    );

    await showBreakdown();

    expect(screen.getByTestId("chosen-card-book")).toHaveTextContent("King");
    expect(screen.getByTestId("breakdown-card-book")).toHaveTextContent(
      /Chose.*King.*→ Army/,
    );
    expect(screen.getByTestId("breakdown-card-king")).toHaveTextContent(/Army/);
  });
});

describe("scanning a hand", () => {
  const sure = (cardId: CardId) => ({ candidates: [cardId], confident: true });
  const scanOf = (...matches: ScanResult["matches"]): ScanResult => ({
    matches,
    handSize: 7,
  });
  const photo = (uri: string) => ({ canceled: false, assets: [{ uri }] });

  beforeEach(() => {
    Object.values(mockImagePicker).forEach((mock) => mock.mockReset());
    mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: true,
    });
    mockImagePicker.launchCameraAsync.mockResolvedValue(
      photo("file:///camera.jpg"),
    );
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue(
      photo("file:///saved.jpg"),
    );
  });

  // Opens the sheet from the Scan button and picks a saved photo.
  const scanSavedPhoto = async (press: (testID: string) => Promise<void>) => {
    await press("scan-hand");
    await screen.findByTestId("scan-choose-photo");
    await press("scan-choose-photo");
  };

  it("offers to take a photo or choose a saved one", async () => {
    const { press } = await renderApp();

    await press("scan-hand");

    expect(await screen.findByTestId("scan-take-photo")).toBeOnTheScreen();
    expect(screen.getByTestId("scan-choose-photo")).toBeOnTheScreen();
  });

  it("reads a saved photo, showing progress, then lists the cards found", async () => {
    let respond: (result: ScanResult) => void = () => {};
    const recogniseHand = jest.fn(
      () => new Promise<ScanResult>((resolve) => (respond = resolve)),
    );
    const { press } = await renderApp({ recogniseHand });

    await scanSavedPhoto(press);

    expect(await screen.findByTestId("scan-reading")).toBeOnTheScreen();
    expect(recogniseHand).toHaveBeenCalledWith("file:///saved.jpg");

    await act(async () => respond(scanOf(sure("king"), sure("queen"))));

    expect(await screen.findByTestId("scan-review")).toBeOnTheScreen();
    expect(screen.queryByTestId("scan-progress")).toBeNull();
    expect(screen.getByTestId("scan-matched-king")).toHaveTextContent(
      "KingLeader",
    );
    expect(screen.getByTestId("scan-matched-queen")).toBeOnTheScreen();
    expect(screen.getByTestId("scan-summary")).toHaveTextContent(
      "We found 2 of 7 cards. Check them, then add them to your hand.",
    );
    expect(screen.getByTestId("scan-count-warning")).toHaveTextContent(
      "Add the missing 5 cards on the cards screen.",
    );
    expect(screen.queryByTestId("scan-replace-warning")).toBeNull();
  });

  it("takes a photo with the camera", async () => {
    const recogniseHand = jest.fn(async () => scanOf(sure("king")));
    const { press } = await renderApp({ recogniseHand });

    await press("scan-hand");
    await press(
      (await screen.findByTestId("scan-take-photo")).props.testID as string,
    );

    expect(await screen.findByTestId("scan-review")).toBeOnTheScreen();
    expect(recogniseHand).toHaveBeenCalledWith("file:///camera.jpg");
  });

  it("changes nothing when the photo is cancelled", async () => {
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: true,
      assets: null,
    });
    const recogniseHand = jest.fn(async () => scanOf(sure("king")));
    const { press } = await renderApp({ recogniseHand });

    await scanSavedPhoto(press);

    await waitFor(() =>
      expect(screen.queryByTestId("scan-take-photo")).toBeNull(),
    );
    expect(recogniseHand).not.toHaveBeenCalled();
    expect(screen.queryByTestId("scan-progress")).toBeNull();
  });

  it("replaces the hand with the cards found, leaving choices pending, and rescores", async () => {
    const scoreHand = jest.fn(sumStrengths);
    const { press, tapCard } = await renderApp({
      scoreHand,
      loadCards: async () => withIsland,
      recogniseHand: async () => scanOf(sure("island"), sure("swamp")),
    });

    await tapCard("king");
    await scanSavedPhoto(press);

    expect(await screen.findByTestId("scan-replace-warning")).toHaveTextContent(
      "This replaces the 1 card in your hand.",
    );

    await press("scan-confirm");

    expect(await screen.findByTestId("card-grid")).toBeOnTheScreen();
    expect(screen.queryByTestId("scan-review")).toBeNull();
    expect(screen.getByTestId("card-tile-island")).toBeChecked();
    expect(screen.getByTestId("card-tile-swamp")).toBeChecked();
    expect(screen.getByTestId("card-tile-king")).not.toBeChecked();
    expect(screen.getByTestId("choice-strip-island")).toHaveTextContent(
      "Choose…",
    );
    await waitFor(() =>
      expect(scoreHand).toHaveBeenLastCalledWith(handOf("island", "swamp")),
    );
    await expectScore("32");
  });

  it("offers the likeliest cards for one it isn't sure of, best first, and adds the one picked", async () => {
    const { press } = await renderApp({
      recogniseHand: async () =>
        scanOf(sure("knights"), {
          candidates: ["queen", "king"],
          confident: false,
        }),
    });

    await scanSavedPhoto(press);

    expect(await screen.findByTestId("scan-summary")).toHaveTextContent(
      /Confirm the one we weren't sure about/,
    );
    expect(screen.getByTestId("scan-option-1-queen")).toBeChecked();
    expect(screen.getByTestId("scan-option-1-king")).not.toBeChecked();

    await press("scan-option-1-king");

    expect(screen.getByTestId("scan-option-1-king")).toBeChecked();
    expect(screen.getByTestId("scan-option-1-queen")).not.toBeChecked();

    await press("scan-confirm");

    expect(await screen.findByTestId("card-grid")).toBeOnTheScreen();
    expect(screen.getByTestId("card-tile-king")).toBeChecked();
    expect(screen.getByTestId("card-tile-queen")).not.toBeChecked();
    expect(screen.getByTestId("card-tile-knights")).toBeChecked();
  });

  it("leaves out a card that is none of those offered, for picking by hand", async () => {
    const { press } = await renderApp({
      recogniseHand: async () =>
        scanOf(sure("knights"), {
          candidates: ["queen", "king"],
          confident: false,
        }),
    });

    await scanSavedPhoto(press);
    await press(
      (await screen.findByTestId("scan-none-1")).props.testID as string,
    );

    expect(await screen.findByTestId("card-grid")).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.getByTestId("card-tile-knights")).toBeChecked(),
    );
    expect(screen.getByTestId("card-tile-queen")).not.toBeChecked();
    expect(screen.getByTestId("card-tile-king")).not.toBeChecked();
  });

  it("keeps the check screen while the cards are added, and says when adding them fails", async () => {
    let fail: (error: Error) => void = () => {};
    const { press } = await renderApp({
      recogniseHand: async () => scanOf(sure("king")),
      replaceHand: () => new Promise((_, reject) => (fail = reject)),
    });

    await scanSavedPhoto(press);
    await press(
      (await screen.findByTestId("scan-confirm")).props.testID as string,
    );

    expect(screen.getByTestId("scan-confirm")).toBeDisabled();
    expect(screen.getByTestId("scan-confirm")).toHaveTextContent("Adding…");

    await act(async () => fail(new Error("no hand")));

    expect(await screen.findByTestId("scan-confirm-failed")).toBeOnTheScreen();
    expect(screen.getByTestId("scan-confirm")).toBeEnabled();
    expect(screen.getByTestId("scan-review")).toBeOnTheScreen();
  });

  it("goes back to retake the photo, leaving the hand as it was", async () => {
    const { press, tapCard } = await renderApp({
      recogniseHand: async () => scanOf(sure("queen")),
    });

    await tapCard("king");
    await scanSavedPhoto(press);
    await press(
      (await screen.findByTestId("scan-retake")).props.testID as string,
    );

    expect(await screen.findByTestId("scan-take-photo")).toBeOnTheScreen();
    expect(screen.queryByTestId("scan-review")).toBeNull();
    expect(screen.getByTestId("card-tile-king")).toBeChecked();
    expect(screen.getByTestId("card-tile-queen")).not.toBeChecked();
  });

  it("explains when the photo can't be read, and offers to try again", async () => {
    const { press } = await renderApp({
      recogniseHand: () => Promise.reject(new Error("unreadable")),
    });

    await scanSavedPhoto(press);

    expect(await screen.findByTestId("scan-failure-title")).toHaveTextContent(
      "Couldn't read the photo",
    );

    await press("scan-try-again");

    expect(await screen.findByTestId("scan-take-photo")).toBeOnTheScreen();
    expect(screen.queryByTestId("scan-progress")).toBeNull();
  });

  it("explains when no cards are found, and goes back to the cards", async () => {
    const { press } = await renderApp({
      recogniseHand: async () => scanOf(),
    });

    await scanSavedPhoto(press);

    expect(await screen.findByTestId("scan-failure-title")).toHaveTextContent(
      "Couldn't find any cards",
    );

    await press("scan-pick-by-hand");

    expect(screen.queryByTestId("scan-progress")).toBeNull();
    expect(screen.getByTestId("card-grid")).toBeOnTheScreen();
  });

  it("explains when the camera isn't allowed", async () => {
    mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: false,
    });
    const { press } = await renderApp();

    await press("scan-hand");
    await press(
      (await screen.findByTestId("scan-take-photo")).props.testID as string,
    );

    expect(await screen.findByTestId("scan-failure-title")).toHaveTextContent(
      "The camera isn't allowed",
    );
    expect(mockImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });
});
