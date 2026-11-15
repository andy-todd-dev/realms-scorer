import { Card } from "../domain/card";
import { Variant, VariantId } from "../domain/variant";
import { CardCatalog } from "./load-variant.ports";
import { LoadedVariant, LoadVariantUseCase } from "./load-variant.usecase";
import { InMemoryStore } from "./testing/in-memory-store";

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
const deckOf = (cards: readonly Card[]): CardCatalog => ({
  getAll: async (deckId) => (deckId === "deck" ? [...cards] : []),
});

// Loads the current variant, holding what it saves in memory.
async function load(
  cardCatalog: CardCatalog,
  variantId: VariantId = "variant",
) {
  const loadedVariant = new InMemoryStore<LoadedVariant>({
    status: "idle",
    view: null,
  });
  const rescore = { execute: jest.fn(async () => {}) };

  await new LoadVariantUseCase({
    variant: new InMemoryStore(variantId),
    loadedVariant,
    rescore,
    cardCatalog,
    variantCatalog: {
      getById: async (id) => {
        if (id !== variant.id) {
          throw new Error(`Unknown variant: ${id}`);
        }
        return variant;
      },
    },
  }).execute();

  return { loadedVariant: loadedVariant.get(), rescore };
}

// The card views of a loaded variant.
const cardViewsOf = async (cards: readonly Card[]) =>
  (await load(deckOf(cards))).loadedVariant.view?.cards ?? [];

describe("LoadVariantUseCase", () => {
  it("saves the current variant's name and hand size with its deck's cards, and rescores", async () => {
    const { loadedVariant, rescore } = await load(deckOf([plainCard]));

    expect(loadedVariant).toEqual({
      status: "loaded",
      view: {
        id: "variant",
        name: "Variant",
        handSize: 5,
        cards: [{ id: "plain", name: "Plain", suit: "land", choice: null }],
      },
    });
    expect(rescore.execute).toHaveBeenCalledTimes(1);
  });

  it("saves the variant as loading until it has loaded", async () => {
    const statuses: string[] = [];
    const loadedVariant = new InMemoryStore<LoadedVariant>({
      status: "idle",
      view: null,
    });
    loadedVariant.subscribe(() => statuses.push(loadedVariant.get().status));

    await new LoadVariantUseCase({
      variant: new InMemoryStore("variant"),
      loadedVariant,
      rescore: { execute: async () => {} },
      cardCatalog: deckOf([plainCard]),
      variantCatalog: { getById: async () => variant },
    }).execute();

    expect(statuses).toEqual(["loading", "loaded"]);
  });

  it("saves an unknown variant as failed", async () => {
    const { loadedVariant } = await load(deckOf([]), "unknown");

    expect(loadedVariant).toEqual({ status: "failed", view: null });
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

  it("saves the variant as failed when the catalog can't serve the cards", async () => {
    const { loadedVariant } = await load({
      getAll: () => Promise.reject(new Error("no cards")),
    });

    expect(loadedVariant).toEqual({ status: "failed", view: null });
  });
});
