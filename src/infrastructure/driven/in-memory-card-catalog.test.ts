import { CARDS, DECKS, InMemoryCardCatalog } from "./in-memory-card-catalog";

const king = {
  id: "king",
  name: "King",
  suit: "leader",
  baseStrength: 8,
} as const;
const queen = {
  id: "queen",
  name: "Queen",
  suit: "leader",
  baseStrength: 6,
} as const;
const unicorn = {
  id: "unicorn",
  name: "Unicorn",
  suit: "beast",
  baseStrength: 9,
} as const;

describe("deck data", () => {
  it("gives every deck a unique ID", () => {
    const ids = DECKS.map((deck) => deck.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts every card in a known deck", () => {
    const deckIds = DECKS.map((deck) => deck.id);

    CARDS.forEach((card) => expect(deckIds).toContain(card.deckId));
  });
});

describe("InMemoryCardCatalog", () => {
  const catalog = new InMemoryCardCatalog([
    { ...king, deckId: "base" },
    { ...unicorn, deckId: "expansion" },
    { ...queen, deckId: "base" },
  ]);

  it("returns only the given deck's cards, without their deck ID", async () => {
    await expect(catalog.getAll("base")).resolves.toEqual([king, queen]);
    await expect(catalog.getAll("expansion")).resolves.toEqual([unicorn]);
  });

  it("returns no cards for an unknown deck", async () => {
    await expect(catalog.getAll("unknown")).resolves.toEqual([]);
  });

  it("returns cards by ID in the order requested", async () => {
    await expect(catalog.getByIds("base", ["queen", "king"])).resolves.toEqual([
      queen,
      king,
    ]);
  });

  it("rejects when any requested card ID is unknown", async () => {
    await expect(catalog.getByIds("base", ["king", "unknown"])).rejects.toThrow(
      "Unknown card: unknown",
    );
  });

  it("rejects a card from another deck", async () => {
    await expect(catalog.getByIds("base", ["unicorn"])).rejects.toThrow(
      "Unknown card: unicorn",
    );
  });
});
