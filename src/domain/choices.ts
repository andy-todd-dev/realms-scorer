import { Card, CardAbility, CardEffect, CardId, CardMatcher } from "./card";
import { matches, othersIn } from "./card-matching";

// The choices made for cards in a hand: each choosing card's ID, mapped to the ID of the card it chose.
export type Choices = Readonly<Record<CardId, CardId>>;

// Returns the cards in the hand that the specified card may choose: the other cards that match its choice.
export function choiceOptions(
  chooser: Card,
  cards: readonly Card[],
): readonly Card[] {
  const { choice } = chooser;

  if (!choice) {
    return [];
  }

  return othersIn(cards, chooser).filter((other) =>
    choice.from.some((matcher) => matches(other, matcher)),
  );
}

// Checks if the specified card may choose the target, given the cards in the hand.
export function isValidChoice(
  chooser: Card,
  targetId: CardId,
  cards: readonly Card[],
): boolean {
  return choiceOptions(chooser, cards).some(({ id }) => id === targetId);
}

// Returns the card the specified card chose, or null while its choice is pending. A choice that no longer fits the hand counts as pending: it is never replaced with another.
export function chosenCardId(
  chooser: Card,
  cards: readonly Card[],
  choices: Choices,
): CardId | null {
  const targetId = choices[chooser.id];

  return targetId !== undefined && isValidChoice(chooser, targetId, cards)
    ? targetId
    : null;
}

// Replaces a matcher for the chosen card with the chosen card's ID. While the choice is pending, it is dropped, so it targets nothing.
function resolveMatchers(
  matchers: readonly CardMatcher[],
  chosenId: CardId | null,
): readonly CardMatcher[] {
  return matchers.flatMap((matcher): readonly CardMatcher[] => {
    if (!("chosen" in matcher)) {
      return [matcher];
    }

    return chosenId === null ? [] : [{ cardId: chosenId }];
  });
}

// Resolves the chosen card in an effect's targets. Only targets can name the chosen card so far; add other places here as cards need them.
function resolveEffect(
  effect: CardEffect,
  chosenId: CardId | null,
): CardEffect {
  if (effect.kind === "blank" || effect.kind === "clearPenalty") {
    return { ...effect, targets: resolveMatchers(effect.targets, chosenId) };
  }

  if (effect.kind === "clearPenaltySuitWord" && effect.targets) {
    return { ...effect, targets: resolveMatchers(effect.targets, chosenId) };
  }

  return effect;
}

function resolveAbility(
  ability: CardAbility | undefined,
  chosenId: CardId | null,
): CardAbility | undefined {
  return (
    ability && {
      ...ability,
      effects: ability.effects.map((effect) => resolveEffect(effect, chosenId)),
    }
  );
}

// Applies the players' choices: each effect that targets the chosen card targets the card chosen, or nothing while the choice is pending. Choices are checked against the full hand, before any clearing or blanking.
export function withChoicesResolved(
  cards: readonly Card[],
  choices: Choices,
): readonly Card[] {
  return cards.map((card) => {
    if (!card.choice) {
      return card;
    }

    const chosenId = chosenCardId(card, cards, choices);
    const { bonus, penalty, ...rest } = card;
    const resolvedBonus = resolveAbility(bonus, chosenId);
    const resolvedPenalty = resolveAbility(penalty, chosenId);

    return {
      ...rest,
      ...(resolvedBonus && { bonus: resolvedBonus }),
      ...(resolvedPenalty && { penalty: resolvedPenalty }),
    };
  });
}
