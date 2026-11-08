import type { ChoiceSheet, ChoiceTarget } from "../state/selectors";
import { SUITS } from "./theme";

type ChoiceFrom = ChoiceSheet["from"];

// "A", "A or B", "A, B or C". The design lists suits without a comma before "or".
function joinWith(parts: readonly string[], conjunction: string): string {
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

// What a choice may take, in words: "Flood or Flame", "Land other than Mountain", "Swamp".
export function describeTargets(targets: readonly ChoiceTarget[]): string {
  return joinWith(targets.map(describeTarget), "or");
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
