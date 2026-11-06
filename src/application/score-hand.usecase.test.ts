import { Card, CardId } from "../domain/card";
import { Hand } from "../domain/hand";
import { ScoreHandUseCase } from "./score-hand.usecase";

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
// Clears the penalty of the card the player chose.
const chooser: Card = {
  id: "chooser",
  name: "Chooser",
  suit: "flood",
  baseStrength: 1,
  bonus: {
    text: "",
    effects: [{ kind: "clearPenalty", targets: [{ chosen: true }] }],
  },
  choice: { kind: "cardInHand", from: [{ suit: "leader" }] },
};
const penalisedLeader: Card = {
  id: "penalised",
  name: "Penalised",
  suit: "leader",
  baseStrength: 10,
  penalty: { text: "", effects: [{ kind: "points", points: -4 }] },
};

const handOf = (...cardIds: CardId[]): Hand => ({ cardIds, choices: {} });

describe("ScoreHandUseCase", () => {
  it("scores the cards the catalog serves for the given IDs", async () => {
    const getByIds = jest.fn(async (_: readonly CardId[]) => [king, queen]);
    const useCase = new ScoreHandUseCase({ cardCatalog: { getByIds } });

    await expect(
      useCase.execute(handOf("king", "queen")),
    ).resolves.toMatchObject({
      cards: [
        { cardId: "king", total: 8 },
        { cardId: "queen", total: 6 },
      ],
      total: 14,
    });
    expect(getByIds).toHaveBeenCalledWith(["king", "queen"]);
  });

  it("applies the choices made in the hand", async () => {
    const useCase = new ScoreHandUseCase({
      cardCatalog: { getByIds: async () => [chooser, penalisedLeader] },
    });

    // 1 + 10, with the penalty cleared
    await expect(
      useCase.execute({
        cardIds: ["chooser", "penalised"],
        choices: { chooser: "penalised" },
      }),
    ).resolves.toMatchObject({ total: 11 });
  });

  it("scores no cards as 0", async () => {
    const useCase = new ScoreHandUseCase({
      cardCatalog: { getByIds: async () => [] },
    });

    await expect(useCase.execute(handOf())).resolves.toMatchObject({
      cards: [],
      total: 0,
    });
  });

  it("fails when the catalog can't serve the cards", async () => {
    const useCase = new ScoreHandUseCase({
      cardCatalog: {
        getByIds: () => Promise.reject(new Error("unknown card")),
      },
    });

    await expect(useCase.execute(handOf("unknown"))).rejects.toThrow(
      "unknown card",
    );
  });
});
