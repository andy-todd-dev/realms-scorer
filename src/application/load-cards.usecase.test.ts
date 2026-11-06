import { Card } from "../domain/card";
import { LoadCardsUseCase } from "./load-cards.usecase";

const plainCard: Card = {
  id: "plain",
  name: "Plain",
  suit: "land",
  baseStrength: 1,
};

const cardWithAbilities: Card = {
  id: "abilities",
  name: "Abilities",
  suit: "wizard",
  baseStrength: 2,
  bonus: {
    text: "Bonus text",
    effects: [{ kind: "points", points: 3 }],
  },
  penalty: {
    text: "Penalty text",
    effects: [{ kind: "blank", targets: [{ suit: "land" }] }],
  },
};
const cardWithChoice: Card = {
  id: "chooser",
  name: "Chooser",
  suit: "flood",
  baseStrength: 3,
  bonus: {
    text: "Bonus text",
    effects: [{ kind: "clearPenalty", targets: [{ chosen: true }] }],
  },
  choice: { kind: "cardInHand", from: [{ suit: "flood" }] },
};

describe("LoadCardsUseCase", () => {
  it("serves only what the UI shows of the catalog's cards", async () => {
    const useCase = new LoadCardsUseCase({
      cardCatalog: {
        getAll: async () => [plainCard, cardWithAbilities, cardWithChoice],
      },
    });

    await expect(useCase.execute()).resolves.toStrictEqual([
      { id: "plain", name: "Plain", suit: "land", choice: null },
      {
        id: "abilities",
        name: "Abilities",
        suit: "wizard",
        choice: null,
      },
      {
        id: "chooser",
        name: "Chooser",
        suit: "flood",
        choice: { from: "hand", targets: [{ suit: "flood", except: [] }] },
      },
    ]);
  });

  it("describes what a choice can take: suits, with the cards they leave out, and specific cards", async () => {
    const chooser: Card = {
      ...cardWithChoice,
      choice: {
        kind: "cardInHand",
        from: [
          { suit: "land", except: ["mountain"] },
          { cardId: "swamp" },
          { suit: "flame" },
          // Has no meaning as a target of a choice, so it isn't described.
          { chosen: true },
        ],
      },
    };
    const useCase = new LoadCardsUseCase({
      cardCatalog: { getAll: async () => [chooser] },
    });

    const [view] = await useCase.execute();

    expect(view.choice).toEqual({
      from: "hand",
      targets: [
        { suit: "land", except: ["mountain"] },
        { cardId: "swamp" },
        { suit: "flame", except: [] },
      ],
    });
  });

  it("fails when the catalog can't serve the cards", async () => {
    const useCase = new LoadCardsUseCase({
      cardCatalog: { getAll: () => Promise.reject(new Error("no cards")) },
    });

    await expect(useCase.execute()).rejects.toThrow("no cards");
  });
});
