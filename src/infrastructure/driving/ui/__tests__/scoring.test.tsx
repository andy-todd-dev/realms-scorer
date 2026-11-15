import { act, screen, waitFor } from "@testing-library/react-native";
import { handOf, sumStrengths } from "../testing/fixtures";
import { renderApp, expectScore } from "../testing/render-app";

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
    const requests = scoreHand.mock.calls.length;

    await showBreakdown();
    await backToCards();

    await expectScore("8");
    expect(scoreHand).toHaveBeenCalledTimes(requests);
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
