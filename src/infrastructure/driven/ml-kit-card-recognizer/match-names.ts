import { distance } from "fastest-levenshtein";
import type { CardId } from "../../../domain/card";

// The parts of ML Kit's result that matching uses: its text blocks, each with its lines.
export type RecognisedBlock = {
  readonly lines: readonly { readonly text: string }[];
};

export type NamedCard = { readonly id: CardId; readonly name: string };

// The card a title line was read as, or the cards it most likely is when it isn't clear, best first.
export type CardMatch = {
  readonly candidates: CardId[];
  readonly confident: boolean;
};

// Starting values, set from the fixtures in __fixtures__. Change them when a fixture fails, not by eye.
const MIN_SCORE = 0.6;
const CONFIDENT_SCORE = 0.75;
const CONFIDENT_LEAD = 0.1;
const MAX_CANDIDATES = 3;

const SIGN = /^[+\-−–]/;
// A card's base strength, which ML Kit often joins onto its name: "3Elven Longbow", "25) Warlock Lord".
const LEADING_NUMBER = /^\d{1,2}\)?\s*/;
const FULL_STOP = /\.\s*$/;

type TitleLine = { readonly text: string; readonly hasNumber: boolean };

type ScoredLine = TitleLine & {
  // Every card, best match first.
  readonly ranked: readonly { readonly id: CardId; readonly score: number }[];
};

/*
  Finds the cards whose titles are in the text, ignoring card names in rules text and anything else in the photo.
  A title is always the only line in its block, while rules text comes in blocks of several lines. Lines that start
  with a sign, or end with a full stop without a leading base strength, are rules text too. Each remaining line is
  compared, whole, with every card's name, so a name inside a sentence never matches.
*/
export function matchNames(
  blocks: readonly RecognisedBlock[],
  cards: readonly NamedCard[],
  maxCards: number,
): CardMatch[] {
  const names = cards.map((card) => ({
    id: card.id,
    name: normalise(card.name),
  }));

  const scored: ScoredLine[] = blocks
    .flatMap(titleLine)
    .map((line) => ({
      ...line,
      ranked: names
        .map(({ id, name }) => ({ id, score: similarity(line.text, name) }))
        .sort((a, b) => b.score - a.score),
    }))
    .filter(
      (line) => line.ranked.length > 0 && line.ranked[0].score >= MIN_SCORE,
    )
    // Best first, preferring a line with a leading base strength, which is more likely a title.
    .sort(
      (a, b) =>
        b.ranked[0].score - a.ranked[0].score ||
        Number(b.hasNumber) - Number(a.hasNumber),
    );

  // A card is read from one line only: when two lines match it best, the better match keeps it and the other is dropped.
  const claimed = new Set<CardId>();
  const kept = scored
    .filter((line) => {
      const best = line.ranked[0].id;

      if (claimed.has(best)) {
        return false;
      }

      claimed.add(best);

      return true;
    })
    .slice(0, maxCards);

  const keptCards = new Set(kept.map((line) => line.ranked[0].id));

  return kept.map(({ ranked }) => {
    const [best, runnerUp] = ranked;
    const alternatives = ranked
      .slice(1)
      .filter(({ id, score }) => score >= MIN_SCORE && !keptCards.has(id))
      .slice(0, MAX_CANDIDATES - 1);

    return {
      candidates: [best.id, ...alternatives.map(({ id }) => id)],
      confident:
        best.score >= CONFIDENT_SCORE &&
        best.score - (runnerUp?.score ?? 0) >= CONFIDENT_LEAD,
    };
  });
}

// The block's line, cleaned up for matching, if it could be a card's title.
function titleLine(block: RecognisedBlock): TitleLine[] {
  if (block.lines.length !== 1) {
    return [];
  }

  const raw = block.lines[0].text.trim();

  if (SIGN.test(raw)) {
    return [];
  }

  const hasNumber = LEADING_NUMBER.test(raw);

  if (FULL_STOP.test(raw) && !hasNumber) {
    return [];
  }

  const text = normalise(raw.replace(LEADING_NUMBER, ""));

  return text === "" ? [] : [{ text, hasNumber }];
}

function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// 1 for the same text, falling towards 0 as more letters differ.
function similarity(a: string, b: string): number {
  return 1 - distance(a, b) / Math.max(a.length, b.length, 1);
}
