import { act, screen, waitFor } from "@testing-library/react-native";
import type { Card } from "../../../../domain/card";
import { island, withIsland, handOf, sumStrengths } from "../testing/fixtures";
import { renderApp, expectScore, expectCount } from "../testing/render-app";

describe("choosing a card", () => {
  const renderWithIsland = (
    options: Omit<Parameters<typeof renderApp>[0], "loadCards"> = {},
  ) => renderApp({ ...options, loadCards: async () => withIsland });

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

  it("forgets the choices when the hand is cleared", async () => {
    const scoreHand = jest.fn(sumStrengths);
    const { press, tapCard } = await renderWithIsland({ scoreHand });

    await tapCard("island");
    await tapCard("swamp");
    await expectScore("32");
    await press("choice-strip-island");
    await press("choice-option-swamp");
    await expectCount("2 of 7 cards");
    await press("clear-hand");
    await tapCard("island");
    await tapCard("swamp");

    expect(screen.getByTestId("choice-strip-island")).toHaveTextContent(
      "Choose…",
    );
    await waitFor(() =>
      expect(scoreHand).toHaveBeenLastCalledWith(handOf("island", "swamp")),
    );
  });

  describe("with two cards that need a choice", () => {
    // Makes the same choice as the Island, and comes after it in the grid.
    const mirage: Card = { ...island, id: "mirage", name: "Mirage" };
    const renderWithTwoChoosers = () =>
      renderApp({ loadCards: async () => [...withIsland, mirage] });

    it("counts every pending choice", async () => {
      const { tapCard } = await renderWithTwoChoosers();

      await tapCard("mirage");
      await tapCard("island");

      await expectCount("2 choices needed ›");
    });

    it("shows the made choice and the pending one on the breakdown", async () => {
      const { press, showBreakdown, tapCard } = await renderWithTwoChoosers();

      await tapCard("island");
      await tapCard("mirage");
      await tapCard("swamp");
      // The fake scores only the cards it knows, which leaves out the Mirage.
      await expectScore("32");
      await press("choice-strip-island");
      await press("choice-option-swamp");
      await expectCount("1 choice needed ›");
      await showBreakdown();

      expect(screen.getByTestId("chosen-card-island")).toHaveTextContent(
        "Swamp",
      );
      expect(screen.queryByTestId("choice-needed-island")).toBeNull();
      expect(screen.queryByTestId("chosen-card-mirage")).toBeNull();
      expect(screen.getByTestId("choice-needed-mirage")).toBeOnTheScreen();
      expect(screen.getByTestId("breakdown-warning")).toHaveTextContent(
        "1 choice needed",
      );
    });
  });

  it("names the cards the choice's targets mention", async () => {
    const picky: Card = {
      ...island,
      id: "picky",
      name: "Picky",
      choice: {
        kind: "cardInHand",
        from: [{ suit: "flood", except: ["swamp"] }, { cardId: "king" }],
      },
    };
    const { press, tapCard } = await renderApp({
      loadCards: async () => [...withIsland, picky],
    });

    await tapCard("picky");
    await press("choice-strip-picky");

    expect(
      await screen.findByTestId("choice-sheet-instruction"),
    ).toHaveTextContent(
      "Choose one Flood other than Swamp or King in your hand.",
    );
  });
});
