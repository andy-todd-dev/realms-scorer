import { Card, CardId } from "../domain/card";
import { Hand } from "../domain/hand";
import { ChooseCardUseCase } from "./choose-card.usecase";

// May choose another Flood.
const chooser: Card = {
  id: "chooser",
  name: "Chooser",
  suit: "flood",
  baseStrength: 1,
  bonus: {
    text: "",
    effects: [{ kind: "clearPenalty", targets: [{ chosen: true }] }],
  },
  choice: { kind: "cardInHand", from: [{ suit: "flood" }] },
};
const flood: Card = {
  id: "flood",
  name: "Flood",
  suit: "flood",
  baseStrength: 5,
};
const army: Card = { id: "army", name: "Army", suit: "army", baseStrength: 5 };
const cards = [chooser, flood, army];

const getByIds = async (cardIds: readonly CardId[]) =>
  cards.filter((card) => cardIds.includes(card.id));

const hand: Hand = { cardIds: ["chooser", "flood", "army"], choices: {} };

describe("ChooseCardUseCase", () => {
  it("records a choice of a matching card in the hand", async () => {
    const useCase = new ChooseCardUseCase({ cardCatalog: { getByIds } });

    await expect(useCase.execute(hand, "chooser", "flood")).resolves.toEqual({
      ...hand,
      choices: { chooser: "flood" },
    });
  });

  it("rejects a card that doesn't match the choice", async () => {
    const useCase = new ChooseCardUseCase({ cardCatalog: { getByIds } });

    await expect(useCase.execute(hand, "chooser", "army")).rejects.toThrow(
      "chooser can't choose army",
    );
  });

  it("rejects a card that isn't in the hand", async () => {
    const useCase = new ChooseCardUseCase({ cardCatalog: { getByIds } });

    await expect(
      useCase.execute(
        { cardIds: ["chooser"], choices: {} },
        "chooser",
        "flood",
      ),
    ).rejects.toThrow();
  });

  it("rejects a choice for a card that doesn't make one", async () => {
    const useCase = new ChooseCardUseCase({ cardCatalog: { getByIds } });

    await expect(useCase.execute(hand, "army", "flood")).rejects.toThrow();
  });

  it("fails when the catalog can't serve the cards", async () => {
    const useCase = new ChooseCardUseCase({
      cardCatalog: { getByIds: () => Promise.reject(new Error("no cards")) },
    });

    await expect(useCase.execute(hand, "chooser", "flood")).rejects.toThrow(
      "no cards",
    );
  });
});
