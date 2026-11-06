import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { AddCardToHandUseCase } from "../../../application/add-card-to-hand.usecase";
import { ChooseCardUseCase } from "../../../application/choose-card.usecase";
import { ClearHandUseCase } from "../../../application/clear-hand.usecase";
import { LoadCardsUseCase } from "../../../application/load-cards.usecase";
import { RemoveCardFromHandUseCase } from "../../../application/remove-card-from-hand.usecase";
import type { Card, CardId } from "../../../domain/card";
import type { Hand } from "../../../domain/hand";
import type { CardScore, HandScore } from "../../../domain/score";
import { createAppStore } from "../state/store";
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
      ...(choice && {
        choice: {
          chosenId: choices[id] ?? null,
          optionIds: handCards
            .filter((other) => other.id !== id && other.suit === "flood")
            .map((other) => other.id),
        },
      }),
    })),
  );
};

async function renderApp({
  scoreHand = sumStrengths,
  loadCards = async () => cards,
  chooseCard,
}: {
  scoreHand?: (hand: Hand) => Promise<number | HandScore>;
  loadCards?: () => Promise<Card[]>;
  chooseCard?: (
    hand: Hand,
    chooserId: CardId,
    targetId: CardId,
  ) => Promise<Hand>;
} = {}) {
  const store = createAppStore({
    addCardToHand: new AddCardToHandUseCase(),
    // Checks choices against the same cards that loading serves, unless faked.
    chooseCard: chooseCard
      ? { execute: chooseCard }
      : new ChooseCardUseCase({
          cardCatalog: {
            getByIds: async (cardIds) =>
              (await loadCards()).filter((card) => cardIds.includes(card.id)),
          },
        }),
    clearHand: new ClearHandUseCase(),
    // The real use case, so card views and choice descriptions are built as in the app.
    loadCards: new LoadCardsUseCase({ cardCatalog: { getAll: loadCards } }),
    removeCardFromHand: new RemoveCardFromHandUseCase(),
    scoreHand: {
      execute: async (hand) => {
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

  it("disables the features that aren't implemented yet", async () => {
    const { tapCard } = await renderApp();

    await tapCard("king");

    expect(screen.getByTestId("scan-hand")).toBeDisabled();
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

  it("confirms a full hand at 7 cards, and still allows an 8th", async () => {
    const { tapCard } = await renderApp({
      loadCards: async () => eightCards,
    });

    for (const index of [0, 1, 2, 3, 4, 5, 6]) {
      await tapCard(`card-${index}`);
    }

    expect(screen.getByTestId("hand-count")).toHaveTextContent("7 cards ✓");
    expect(screen.getByTestId("card-tile-card-7")).toBeEnabled();

    await tapCard("card-7");

    expect(screen.getByTestId("hand-count")).toHaveTextContent("8 cards ✓");
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

describe("the breakdown screen", () => {
  it("opens from the button, listing the hand highest-scoring first", async () => {
    const { showBreakdown, tapCard } = await renderApp();

    await tapCard("queen");
    await tapCard("king");
    await expectScore("14");
    await showBreakdown();

    expect(screen.getByTestId("breakdown-title")).toHaveTextContent(
      "Your hand: 14",
    );
    expect(screen.getByTestId("breakdown-total")).toHaveTextContent("14");
    expect(screen.getByTestId("breakdown-count")).toHaveTextContent(
      "2 of 7 cards",
    );
    expect(
      screen.getAllByTestId(/^breakdown-card-/).map((row) => row.props.testID),
    ).toEqual(["breakdown-card-king", "breakdown-card-queen"]);
    expect(screen.queryByTestId("breakdown-card-knights")).toBeNull();
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

  it("marks a full hand as complete, and an 8th card with no 8 of 7", async () => {
    const { showBreakdown, backToCards, tapCard } = await renderApp({
      loadCards: async () => eightCards,
    });

    for (const index of [0, 1, 2, 3, 4, 5, 6]) {
      await tapCard(`card-${index}`);
    }
    await showBreakdown();

    expect(screen.getByTestId("breakdown-count")).toHaveTextContent(
      "7 cards · complete",
    );

    await backToCards();
    await tapCard("card-7");
    await showBreakdown();

    expect(screen.getByTestId("breakdown-count")).toHaveTextContent(
      "8 cards · complete",
    );
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
    expect(screen.getByTestId("breakdown-count")).toHaveTextContent(
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

  it("shows the base, bonuses and penalties of the hand and of each card", async () => {
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
          },
          {
            cardId: "queen",
            blanked: false,
            base: 6,
            bonus: 0,
            penalty: 0,
            total: 6,
          },
          {
            cardId: "knights",
            blanked: true,
            base: 0,
            bonus: 0,
            penalty: 0,
            total: 0,
          },
        ]),
    });

    await tapCard("knights");
    await tapCard("queen");
    await tapCard("king");
    await showBreakdown();

    await waitFor(() =>
      expect(screen.getByTestId("breakdown-base")).toHaveTextContent("14"),
    );
    expect(screen.getByTestId("breakdown-bonus")).toHaveTextContent("+10");
    expect(screen.getByTestId("breakdown-penalty")).toHaveTextContent(
      "\u22123",
    );
    expect(screen.getByTestId("breakdown-sum")).toHaveTextContent(
      "14 + 10 \u2212 3",
    );
    expect(screen.getByTestId("breakdown-total")).toHaveTextContent("21");
    expect(screen.getByTestId("breakdown-blanked")).toHaveTextContent(
      "Blanked cards: Knights",
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
      /Base strength8.*Bonuses\+10.*Penalties\u22123/,
    );
    expect(screen.getByTestId("breakdown-card-queen")).not.toHaveTextContent(
      /Bonuses|Penalties/,
    );
    expect(screen.getByTestId("card-total-knights")).toHaveTextContent("0");
    expect(screen.getByTestId("breakdown-card-knights")).toHaveTextContent(
      /Blanked: scores 0/,
    );
  });

  it("shows a placeholder total when scoring fails", async () => {
    const { showBreakdown, tapCard } = await renderApp({
      scoreHand: () => Promise.reject(new Error("no score")),
    });

    await tapCard("king");
    await showBreakdown();

    expect(screen.getByTestId("breakdown-total")).toHaveTextContent("–");
    expect(screen.getByTestId("breakdown-base")).toHaveTextContent("–");
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
        choices: { island: "swamp" },
      }),
    );

    await press("choice-strip-island");

    expect(await screen.findByTestId("choice-option-swamp")).toBeSelected();

    await press("close-choice-sheet");
    await showBreakdown();

    expect(screen.getByTestId("chosen-card-island")).toHaveTextContent(
      "→ Swamp",
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

    expect(screen.getByTestId("breakdown-count")).toHaveTextContent(
      "1 choice needed",
    );
    expect(screen.getByTestId("choice-needed-island")).toHaveTextContent(
      "Choice needed: choose on the cards screen ›",
    );

    await press("choice-needed-island");

    expect(screen.queryByTestId("breakdown-total")).toBeNull();
    expect(screen.getByTestId("choice-strip-island")).toBeOnTheScreen();
  });
});
