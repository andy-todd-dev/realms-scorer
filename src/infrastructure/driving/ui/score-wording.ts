import type {
  BlankReasonView,
  BreakdownLine,
  ConditionView,
  ScoreReasonView,
  ScoreTargetView,
} from "../state/selectors";
import { joinWith } from "./choice-wording";
import { SUITS } from "./theme";

const MINUS = "−";

const signed = (points: number) =>
  points < 0 ? `${MINUS}${-points}` : `+${points}`;

// A suit or card, as counted: "Army" or "Armies" by count, or the card's name.
function targetText(target: ScoreTargetView, count: number): string {
  if ("cardName" in target) {
    return target.cardName;
  }

  const { label, plural } = SUITS[target.suit];

  return count === 1 ? label : plural;
}

// The cards involved, in brackets, left out when they only repeat the card counted: "+12 × 1 Elven Archers".
function namesText(
  names: readonly string[],
  counts: ScoreTargetView | null = null,
): string {
  const repeatsCard =
    counts !== null &&
    "cardName" in counts &&
    names.every((name) => name === counts.cardName);

  return names.length === 0 || repeatsCard ? "" : ` (${names.join(", ")})`;
}

const withText = (names: readonly string[]) =>
  names.length === 0 ? "" : `with ${joinWith(names, "and")}`;

// "With Swamp", "With no Wizard", "Every card a different suit", or several of them.
function conditionText(
  reason: Extract<ScoreReasonView, { kind: "condition" }>,
): string | null {
  const parts = [
    withText(reason.withNames),
    reason.without.length === 0
      ? ""
      : `with no ${joinWith(
          reason.without.map((target) => targetText(target, 1)),
          "or",
        )}`,
    reason.allSuitsDifferent ? "every card a different suit" : "",
  ].filter((part) => part !== "");

  if (parts.length === 0) {
    return null;
  }

  const text = parts.join(", ");

  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Why a bonus or penalty scored, naming the cards involved, so a player can check it against the cards: "+10 × 2 Lands (Bell Tower, Mountain)".
export function describeScoreLine({ ability, reason }: BreakdownLine): string {
  const fallback = ability === "bonus" ? "Bonus" : "Penalty";

  switch (reason.kind) {
    case "each": {
      const count = reason.names.length;
      const counted =
        reason.counts === null
          ? count === 1
            ? "card"
            : "cards"
          : targetText(reason.counts, count);
      const condition = withText(reason.withNames);

      return `${signed(reason.each)} × ${count} ${counted}${namesText(reason.names, reason.counts)}${condition === "" ? "" : ` ${condition}`}`;
    }
    case "condition":
      return conditionText(reason) ?? fallback;
    case "flat":
      return fallback;
    case "sum":
      return reason.counts === null
        ? `Base strength of ${joinWith(reason.names, "and")}`
        : `Base strength of ${targetText(reason.counts, 2)}${namesText(reason.names, reason.counts)}`;
    case "run":
      return `${reason.length}-card run${namesText(reason.names)}`;
    case "set": {
      const count = reason.names.length;

      return `${count} different ${targetText({ suit: reason.suit }, count)}${namesText(reason.names)}`;
    }
  }
}

// What a card would need to be in the hand, in words: "at least one Flame card", "Swamp".
function neededText(target: ScoreTargetView): string {
  return "cardName" in target
    ? target.cardName
    : `at least one ${SUITS[target.suit].label} card`;
}

// One of a card's own blank conditions that held, in words.
function selfBlankText(condition: ConditionView): readonly string[] {
  return [
    condition.without.length === 0
      ? ""
      : `needs ${joinWith(condition.without.map(neededText), "or")} in your hand`,
    condition.withNames.length === 0
      ? ""
      : `can't be with ${joinWith(condition.withNames, "and")}`,
    condition.allSuitsDifferent ? "can't have every card a different suit" : "",
  ].filter((part) => part !== "");
}

// Why a card was blanked, as a sentence: "Blanked by Great Flood.", "Blanked: needs at least one Flame card in your hand."
export function describeBlankReason(reason: BlankReasonView): string {
  const selfParts = reason.self.flatMap(selfBlankText);
  const loopParts =
    reason.loopNames.length === 0
      ? []
      : [
          `caught in a loop of blanks with ${joinWith(reason.loopNames, "and")}`,
        ];
  const parts = [...selfParts, ...loopParts];

  if (reason.byNames.length > 0) {
    const by = `Blanked by ${joinWith(reason.byNames, "and")}`;

    return parts.length === 0
      ? `${by}.`
      : `${by}, and ${joinWith(parts, "and")}.`;
  }

  return parts.length === 0
    ? "Blanked."
    : `Blanked: ${joinWith(parts, "and")}.`;
}
