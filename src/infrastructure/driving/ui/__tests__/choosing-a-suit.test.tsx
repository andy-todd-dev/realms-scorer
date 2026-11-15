import { screen, waitFor } from "@testing-library/react-native";
import type { Card } from "../../../../domain/card";
import { cards } from "../testing/fixtures";
import { renderApp, expectScore } from "../testing/render-app";

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
      // Out of grid order, which the sheet puts them in.
      suits: ["wild", "leader", "army"],
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

  it("offers the picked card's suits in grid order, leaving out its own", async () => {
    const { press, tapCard } = await renderWithBook();

    await tapCard("book");
    await tapCard("king");
    await expectScore("11");
    await press("choice-strip-book");
    await press("choice-option-king");
    await screen.findByTestId("choice-suit-army");

    expect(
      screen
        .getAllByTestId(/^choice-suit-/)
        .map((option) => option.props.testID as string),
    ).toEqual(["choice-suit-army", "choice-suit-wild"]);
  });

  it("ticks the current suit when the same card is picked again", async () => {
    const { press, tapCard } = await renderWithBook();

    await tapCard("book");
    await tapCard("king");
    await expectScore("11");
    await press("choice-strip-book");
    await press("choice-option-king");
    await press("choice-suit-wild");
    await waitFor(() =>
      expect(screen.queryByTestId("choice-sheet-title")).toBeNull(),
    );
    await press("choice-strip-book");
    await press("choice-option-king");

    expect(await screen.findByTestId("choice-suit-wild")).toBeSelected();
    expect(screen.getByTestId("choice-suit-army")).not.toBeSelected();
  });

  it("starts again from the cards when the sheet is reopened", async () => {
    const { press, tapCard } = await renderWithBook();

    await tapCard("book");
    await tapCard("king");
    await expectScore("11");
    await press("choice-strip-book");
    await press("choice-option-king");
    await screen.findByTestId("choice-suit-army");
    await press("close-choice-sheet");
    await waitFor(() =>
      expect(screen.queryByTestId("choice-sheet-title")).toBeNull(),
    );

    await press("choice-strip-book");

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
