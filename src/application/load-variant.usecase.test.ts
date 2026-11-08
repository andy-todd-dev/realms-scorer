import { Card } from "../domain/card";
import { Variant } from "../domain/variant";
import { LoadVariantUseCase } from "./load-variant.usecase";

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

const variant: Variant = {
  id: "variant",
  name: "Variant",
  deckId: "deck",
  handSize: 5,
  preScoring: ["chooser"],
};

// Serves the given cards as the variant's deck, and none for any other deck.
const createUseCase = (cards: readonly Card[]) =>
  new LoadVariantUseCase({
    cardCatalog: {
      getAll: async (deckId) => (deckId === "deck" ? [...cards] : []),
    },
    variantCatalog: {
      getById: async (variantId) => {
        if (variantId !== variant.id) {
          throw new Error(`Unknown variant: ${variantId}`);
        }
        return variant;
      },
    },
  });

// The card views of a loaded variant.
const cardViewsOf = async (cards: readonly Card[]) =>
  (await createUseCase(cards).execute("variant")).cards;

describe("LoadVariantUseCase", () => {
  it("serves the variant's name and hand size with its deck's cards", async () => {
    await expect(
      createUseCase([plainCard]).execute("variant"),
    ).resolves.toEqual({
      id: "variant",
      name: "Variant",
      handSize: 5,
      cards: [{ id: "plain", name: "Plain", suit: "land", choice: null }],
    });
  });

  it("fails for an unknown variant", async () => {
    await expect(createUseCase([]).execute("unknown")).rejects.toThrow(
      "Unknown variant: unknown",
    );
  });

  it("serves only what the UI shows of the deck's cards", async () => {
    const preScoringCard: Card = {
      ...cardWithChoice,
      id: "pre-scoring",
      preScoring: [{ kind: "addToHand", card: { chosen: true } }],
    };

    await expect(
      cardViewsOf([
        plainCard,
        cardWithAbilities,
        cardWithChoice,
        preScoringCard,
      ]),
    ).resolves.toStrictEqual([
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
      {
        id: "pre-scoring",
        name: "Chooser",
        suit: "flood",
        choice: { from: "hand", targets: [{ suit: "flood", except: [] }] },
      },
    ]);
  });

  it("says when a choice is from the discard area", async () => {
    const chooser: Card = {
      ...cardWithChoice,
      choice: { kind: "cardInDiscardArea", from: [{ suit: "army" }] },
    };
    const [view] = await cardViewsOf([chooser]);

    expect(view.choice).toEqual({
      from: "discardArea",
      targets: [{ suit: "army", except: [] }],
    });
  });

  it("says when a choice is from anywhere in the game", async () => {
    const chooser: Card = {
      ...cardWithChoice,
      choice: { kind: "cardInGame", from: [{ suit: "beast" }] },
    };
    const [view] = await cardViewsOf([chooser]);

    expect(view.choice).toEqual({
      from: "game",
      targets: [{ suit: "beast", except: [] }],
    });
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
    const [view] = await cardViewsOf([chooser]);

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
    const useCase = new LoadVariantUseCase({
      cardCatalog: { getAll: () => Promise.reject(new Error("no cards")) },
      variantCatalog: { getById: async () => variant },
    });

    await expect(useCase.execute("variant")).rejects.toThrow("no cards");
  });
});
