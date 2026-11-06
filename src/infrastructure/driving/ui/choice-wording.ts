import type { ChoiceTarget } from "../state/selectors";
import { SUITS } from "./theme";

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

export function choiceInstruction(targets: readonly ChoiceTarget[]): string {
  return `Choose one ${describeTargets(targets)} in your hand.`;
}

export function noChoiceText(targets: readonly ChoiceTarget[]): string {
  return `No ${describeTargets(targets)} in your hand yet. Add one, then come back.`;
}
