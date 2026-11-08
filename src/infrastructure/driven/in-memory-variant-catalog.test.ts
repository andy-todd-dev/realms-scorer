import type { Variant } from "../../domain/variant";
import { DECKS } from "./in-memory-card-catalog";
import { InMemoryVariantCatalog, VARIANTS } from "./in-memory-variant-catalog";

const variant = (id: string): Variant => ({
  id,
  name: `Variant ${id}`,
  deckId: "base",
  handSize: 7,
  preScoring: [],
});

describe("variant data", () => {
  it("gives every variant a unique ID", () => {
    const ids = VARIANTS.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses a known deck for every variant", () => {
    const deckIds = DECKS.map(({ id }) => id);

    VARIANTS.forEach(({ deckId }) => expect(deckIds).toContain(deckId));
  });
});

describe("InMemoryVariantCatalog", () => {
  const catalog = new InMemoryVariantCatalog([variant("one"), variant("two")]);

  it("returns the variant with the given ID", async () => {
    await expect(catalog.getById("two")).resolves.toEqual(variant("two"));
  });

  it("rejects an unknown ID", async () => {
    await expect(catalog.getById("unknown")).rejects.toThrow(
      "Unknown variant: unknown",
    );
  });
});
