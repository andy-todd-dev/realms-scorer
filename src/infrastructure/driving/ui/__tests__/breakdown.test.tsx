import { screen, waitFor } from "@testing-library/react-native";
import { eightCards, handScoreOf } from "../testing/fixtures";
import { renderApp, expectScore } from "../testing/render-app";

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
