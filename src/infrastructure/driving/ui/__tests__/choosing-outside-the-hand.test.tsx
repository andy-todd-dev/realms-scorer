import { screen, waitFor, within } from "@testing-library/react-native";
import type { Card } from "../../../../domain/card";
import { cards } from "../testing/fixtures";
import { renderApp, expectScore, expectCount } from "../testing/render-app";

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

  it("asks again once the chosen card is added to the hand, counting it once", async () => {
    const { press, tapCard } = await renderWithNecromancer();

    await tapCard("necromancer");
    await expectScore("3");
    await press("choice-strip-necromancer");
    await press("choice-option-knights");
    await expectScore("23");
    await tapCard("knights");

    expect(screen.getByTestId("choice-strip-necromancer")).toHaveTextContent(
      "Choose…",
    );
    await expectCount("1 choice needed ›");
    // 3 + Knights 20
    await expectScore("23");
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

  const renderWithShapeshifter = () =>
    renderApp({
      loadCards: async () => [...cards, shapeshifter, dragon],
      scoreByTheRules: true,
      preScoring: ["shapeshifter"],
    });

  it("offers matching cards in the hand and out of it, under their suits", async () => {
    const { press, tapCard } = await renderWithShapeshifter();

    await tapCard("shapeshifter");
    await tapCard("king");
    await expectScore("8");
    await press("choice-strip-shapeshifter");

    const sheet = within(await screen.findByTestId("choice-sheet"));
    expect(
      sheet
        .getAllByRole("header")
        .map((heading) => heading.props.children)
        // After the sheet's own title
        .slice(1),
    ).toEqual(["Beast", "Leader"]);
    expect(screen.getByTestId("choice-option-dragon")).toBeOnTheScreen();
    expect(screen.getByTestId("choice-option-king")).toBeOnTheScreen();
    expect(screen.getByTestId("choice-option-queen")).toBeOnTheScreen();
    expect(screen.queryByTestId("choice-option-knights")).toBeNull();
  });

  it("shows the suit it took on the breakdown, with no row to go to for a card not in the hand", async () => {
    const { press, showBreakdown, tapCard } = await renderWithShapeshifter();

    await tapCard("shapeshifter");
    await expectScore("0");
    await press("choice-strip-shapeshifter");
    await press("choice-option-dragon");
    await waitFor(() =>
      expect(screen.getByTestId("choice-strip-shapeshifter")).toHaveTextContent(
        "Dragon",
      ),
    );
    await showBreakdown();

    await waitFor(() =>
      expect(
        screen.getByTestId("breakdown-card-shapeshifter"),
      ).toHaveTextContent(/Beast/),
    );
    expect(screen.getByTestId("chosen-card-shapeshifter")).toHaveProp(
      "accessibilityLabel",
      expect.stringMatching(/chose Dragon$/),
    );
  });
});
