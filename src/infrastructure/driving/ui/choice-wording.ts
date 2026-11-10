import type { Suit } from "../../../domain/card";
import type { ChoiceSheet, ChoiceTarget } from "../state/selectors";
import { SUITS } from "./theme";

type ChoiceFrom = ChoiceSheet["from"];

// "A", "A or B", "A, B or C". The design lists suits without a comma before "or".
export function joinWith(
  parts: readonly string[],
  conjunction: string,
): string {
  return parts.length <= 1
    ? parts.join("")
    : `${parts.slice(0, -1).join(", ")} ${conjunction} ${parts.slice(-1).join("")}`;
}

function describeTarget(target: ChoiceTarget): string {
  if ("cardName" in target) {
    return target.cardName;
  }

  const suit = SUITS[target.suit].label;

  return target.exceptNames.length > 0
    ? `${suit} other than ${joinWith(target.exceptNames, "and")}`
    : suit;
}

// Checks if the targets take every suit, with no cards left out, so that any card will do.
function isAnyCard(targets: readonly ChoiceTarget[]): boolean {
  const suits = new Set(
    targets.flatMap((target) =>
      "suit" in target && target.exceptNames.length === 0 ? [target.suit] : [],
    ),
  );

  return Object.keys(SUITS).every((suit) => suits.has(suit as Suit));
}

// What a choice may take, in words: "Flood or Flame", "Land other than Mountain", "Swamp", or "card" when any card will do.
export function describeTargets(targets: readonly ChoiceTarget[]): string {
  return isAnyCard(targets)
    ? "card"
    : joinWith(targets.map(describeTarget), "or");
}

export function choiceInstruction(
  targets: readonly ChoiceTarget[],
  from: ChoiceFrom,
): string {
  const where = {
    hand: "in your hand",
    discardArea: "from the discard area",
    game: "in the game",
  }[from];

  return `Choose one ${describeTargets(targets)} ${where}.`;
}

export function noChoiceText(
  targets: readonly ChoiceTarget[],
  from: ChoiceFrom,
): string {
  const described = describeTargets(targets);

  return {
    hand: `No ${described} in your hand yet. Add one, then come back.`,
    discardArea: `Every ${described} is in your hand, so there's none to take from the discard area.`,
    game: `There's no ${described} in the game to choose.`,
  }[from];
}

// A chosen card, with the suit chosen for it for a choice that includes one: "Swamp", or "Swamp → Flame".
export function chosenText(cardName: string, suit: Suit | null): string {
  return suit === null ? cardName : `${cardName} → ${SUITS[suit].label}`;
}

// The sheet's title while choosing the suit a picked card becomes.
export function suitStepTitle(cardName: string): string {
  return `${cardName} becomes…`;
}

export function suitInstruction(cardName: string): string {
  return `Choose a new suit for ${cardName}.`;
}
