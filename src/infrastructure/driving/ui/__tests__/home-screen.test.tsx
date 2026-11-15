import { screen, waitFor, within } from "@testing-library/react-native";
import type { Card } from "../../../../domain/card";
import {
  king,
  queen,
  knights,
  handOf,
  eightCards,
  sumStrengths,
} from "../testing/fixtures";
import { renderApp, expectScore } from "../testing/render-app";

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
    // The hand size comes with the variant, so there's no target to count towards yet.
    expect(screen.getByTestId("hand-pips")).toHaveProp(
      "accessibilityLabel",
      "0 cards. Show breakdown",
    );
  });

  it("takes the hand size from the variant", async () => {
    const { tapCard } = await renderApp({ handSize: 2 });

    await tapCard("king");
    await tapCard("queen");

    expect(screen.getByTestId("hand-count")).toHaveTextContent("2 cards ✓");
    expect(screen.getByTestId("card-tile-knights")).toBeDisabled();
  });

  it("lists suits, and cards within each suit, alphabetically rather than in the catalogue's order", async () => {
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
    await renderApp({
      loadCards: async () => [collector, mirage, queen, king, knights],
    });

    const grid = within(await screen.findByTestId("card-grid"));
    expect(
      grid.getAllByRole("header").map((heading) => heading.props.children),
    ).toEqual(["Army", "Leader", "Wild", "Wizard"]);
    expect(
      grid
        .getAllByTestId(/^card-tile-/)
        .map((tile) => tile.props.testID as string),
    ).toEqual([
      "card-tile-knights",
      "card-tile-king",
      "card-tile-queen",
      "card-tile-mirage",
      "card-tile-collector",
    ]);
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

  it("shows the version alone when there is no build number", async () => {
    await renderApp({
      loadAppInfo: async () => ({ version: "0.3.0", buildNumber: null }),
    });

    expect(await screen.findByTestId("app-version")).toHaveTextContent(
      /^Version 0\.3\.0$/,
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
