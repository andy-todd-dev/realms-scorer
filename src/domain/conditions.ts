import { Card, CardId, CardMatcher, EffectCondition, Suit } from "./card";
import { CardTarget, matches, namesSuit, targetOf } from "./card-matching";

// Whether a condition holds while some cards are unsettled: true or false when it holds or fails however they turn out, and undefined until then.
export type Truth = boolean | undefined;

export function not(truth: Truth): Truth {
  return truth === undefined ? undefined : !truth;
}

export function allTrue(truths: readonly Truth[]): Truth {
  if (truths.includes(false)) {
    return false;
  }

  return truths.includes(undefined) ? undefined : true;
}

export function anyTrue(truths: readonly Truth[]): Truth {
  return not(allTrue(truths.map(not)));
}

// Checks if a card matching the matcher is in play: true if a settled card matches, false if no card that may still be in play matches.
function presence(
  matcher: CardMatcher,
  settled: readonly Card[],
  unsettled: readonly Card[],
): Truth {
  if (settled.some((other) => matches(other, matcher))) {
    return true;
  }

  return unsettled.some((other) => matches(other, matcher)) ? undefined : false;
}

// Checks if the specified card and the other cards are all of different suits.
function allSuitsDiffer(card: Card, others: readonly Card[]): boolean {
  const suits = [card, ...others].map(({ suit }) => suit);

  return new Set(suits).size === suits.length;
}

// Checks if the specified effect condition holds for the card that owns the effect, based on the other cards that are settled in play and those that may yet be. A condition can require the presence or absence of a specific card or suit, that all or any of several conditions hold, or that the owner and the other cards are all of different suits.
export function conditionTruth(
  condition: EffectCondition,
  card: Card,
  settled: readonly Card[],
  unsettled: readonly Card[],
): Truth {
  if ("allOf" in condition) {
    return allTrue(
      condition.allOf.map((part) =>
        conditionTruth(part, card, settled, unsettled),
      ),
    );
  }

  if ("anyOf" in condition) {
    return anyTrue(
      condition.anyOf.map((part) =>
        conditionTruth(part, card, settled, unsettled),
      ),
    );
  }

  if ("allSuitsDifferent" in condition) {
    if (!allSuitsDiffer(card, settled)) {
      return false;
    }

    return allSuitsDiffer(card, [...settled, ...unsettled]) ? true : undefined;
  }

  return "present" in condition
    ? presence(condition.present, settled, unsettled)
    : not(presence(condition.absent, settled, unsettled));
}

// Checks if a condition, or any part of it, names the specified suit. Walks the same kinds of condition as conditionTruth, so a new kind needs handling in both.
export function conditionNamesSuit(
  condition: EffectCondition,
  suit: Suit,
): boolean {
  if ("allOf" in condition) {
    return condition.allOf.some((part) => conditionNamesSuit(part, suit));
  }

  if ("anyOf" in condition) {
    return condition.anyOf.some((part) => conditionNamesSuit(part, suit));
  }

  if ("allSuitsDifferent" in condition) {
    return false;
  }

  return namesSuit(
    "present" in condition ? condition.present : condition.absent,
    suit,
  );
}

// Returns every matcher a condition, or any part of it, names. Walks the same kinds of condition as conditionTruth, so a new kind needs handling in both.
export function conditionMatchers(
  condition: EffectCondition,
): readonly CardMatcher[] {
  if ("allOf" in condition) {
    return condition.allOf.flatMap(conditionMatchers);
  }

  if ("anyOf" in condition) {
    return condition.anyOf.flatMap(conditionMatchers);
  }

  if ("allSuitsDifferent" in condition) {
    return [];
  }

  return ["present" in condition ? condition.present : condition.absent];
}

// Checks if the specified effect condition holds for the card that owns the effect, once every other card is settled.
export function conditionHolds(
  condition: EffectCondition,
  card: Card,
  others: readonly Card[],
): boolean {
  return conditionTruth(condition, card, others, []) === true;
}

// What made a condition hold, for explaining the points it gave: the other cards it needed, the cards or suits it needed to be missing, and whether it needed every suit to differ.
export type ConditionFacts = {
  readonly withCardIds: readonly CardId[];
  readonly without: readonly CardTarget[];
  readonly allSuitsDifferent: boolean;
};

const NO_FACTS: ConditionFacts = {
  withCardIds: [],
  without: [],
  allSuitsDifferent: false,
};

function combinedFacts(parts: readonly ConditionFacts[]): ConditionFacts {
  return {
    withCardIds: [...new Set(parts.flatMap((part) => part.withCardIds))],
    without: parts.flatMap((part) => part.without),
    allSuitsDifferent: parts.some((part) => part.allSuitsDifferent),
  };
}

// Reports what made a condition hold once every other card is settled, for a condition that holds. Of the parts of an anyOf, only those that hold are reported. Walks the same kinds of condition as conditionTruth, so a new kind needs handling in both.
export function conditionFacts(
  condition: EffectCondition,
  card: Card,
  others: readonly Card[],
): ConditionFacts {
  if ("allOf" in condition) {
    return combinedFacts(
      condition.allOf.map((part) => conditionFacts(part, card, others)),
    );
  }

  if ("anyOf" in condition) {
    return combinedFacts(
      condition.anyOf
        .filter((part) => conditionHolds(part, card, others))
        .map((part) => conditionFacts(part, card, others)),
    );
  }

  if ("allSuitsDifferent" in condition) {
    return { ...NO_FACTS, allSuitsDifferent: true };
  }

  return "present" in condition
    ? {
        ...NO_FACTS,
        withCardIds: others
          .filter((other) => matches(other, condition.present))
          .map(({ id }) => id),
      }
    : {
        ...NO_FACTS,
        without: [targetOf(condition.absent)].flatMap((target) =>
          target ? [target] : [],
        ),
      };
}
