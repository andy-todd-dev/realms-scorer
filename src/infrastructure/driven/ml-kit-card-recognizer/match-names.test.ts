import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { CARDS } from "../in-memory-card-catalog";
import { matchNames, RecognisedBlock } from "./match-names";

// ML Kit's output for real photos of cards, with the cards each photo shows. See the plan for how they were captured.
type Fixture = {
  readonly photo: string;
  readonly cards: readonly string[];
  readonly blocks: readonly RecognisedBlock[];
};

const FIXTURES_DIR = join(__dirname, "__fixtures__");

const fixtures: Fixture[] = readdirSync(FIXTURES_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(join(FIXTURES_DIR, file), "utf8")));

const deck = CARDS.map(({ id, name }) => ({ id, name }));

// One block per line of text, as ML Kit gives a title.
const titles = (...texts: string[]): RecognisedBlock[] =>
  texts.map((text) => ({ lines: [{ text }] }));

describe("matchNames on real photos", () => {
  it.each(fixtures.map((fixture) => [fixture.photo, fixture] as const))(
    "finds the cards in %s and nothing else",
    (_, { blocks, cards }) => {
      const matches = matchNames(blocks, deck, 7);

      expect(matches.map((match) => match.candidates[0]).sort()).toEqual(
        [...cards].sort(),
      );
    },
  );

  it("is sure of the cards in a whole hand", () => {
    const hand = fixtures.find((fixture) => fixture.photo === "hand2.jpg")!;

    const unsure = matchNames(hand.blocks, deck, 7).filter(
      (match) => !match.confident,
    );

    expect(unsure).toEqual([]);
  });
});

describe("matchNames", () => {
  it("matches a title with misread letters", () => {
    expect(matchNames(titles("Warborse"), deck, 7)).toEqual([
      { candidates: ["warhorse", "warlord"], confident: true },
    ]);
  });

  it("matches a title with the base strength joined on", () => {
    const matches = matchNames(
      titles("3Elven Longbow", "25) Warlock Lord", "17 Light Cavalry"),
      deck,
      7,
    );

    expect(matches.map((match) => match.candidates[0])).toEqual([
      "elven-longbow",
      "warlock-lord",
      "light-cavalry",
    ]);
  });

  it("ignores lines that start with a sign, as they're rules text", () => {
    expect(matchNames(titles("+30 Rainstorm", "-Smoke"), deck, 7)).toEqual([]);
  });

  it("ignores a line ending in a full stop, unless it starts with the base strength", () => {
    const matches = matchNames(
      titles("Great Flood.", "25 Warlock Lord."),
      deck,
      7,
    );

    expect(matches.map((match) => match.candidates[0])).toEqual([
      "warlock-lord",
    ]);
  });

  it("ignores a card name in a block of several lines, as it's rules text", () => {
    const rules = {
      lines: [{ text: "+40 with Rainstorm and" }, { text: "Great Flood" }],
    };

    expect(matchNames([rules], deck, 7)).toEqual([]);
  });

  it("ignores a card name inside a longer line", () => {
    expect(
      matchNames(titles("with both Leader and Shield of Keth"), deck, 7),
    ).toEqual([]);
  });

  it("tells apart cards with similar names", () => {
    const matches = matchNames(
      titles("4 Air Elemental", "Fire Elemental"),
      deck,
      7,
    );

    expect(
      matches.map(({ candidates, confident }) => [candidates[0], confident]),
    ).toEqual([
      ["air-elemental", true],
      ["fire-elemental", true],
    ]);
  });

  it("is unsure of a line that is close to more than one name, and offers each", () => {
    const [match] = matchNames(titles("Elemental"), deck, 7);

    expect(match.confident).toBe(false);
    expect(match.candidates).toHaveLength(3);
  });

  it("reads a card only once when two lines match it", () => {
    const matches = matchNames(titles("Warborse", "Warhorse"), deck, 7);

    expect(matches).toEqual([
      expect.objectContaining({ candidates: ["warhorse", "warlord"] }),
    ]);
  });

  it("keeps the best matches when it finds more cards than the hand holds", () => {
    const matches = matchNames(titles("Warborse", "Dragon", "Smoke"), deck, 2);

    expect(matches.map((match) => match.candidates[0])).toEqual([
      "dragon",
      "smoke",
    ]);
  });

  it("finds nothing in text with no card names", () => {
    expect(matchNames(titles("BONUS:", "Rulebook", "27"), deck, 7)).toEqual([]);
  });
});
