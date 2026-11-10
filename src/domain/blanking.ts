import { Card, CardId } from "./card";
import { effectsOf, matches, othersIn } from "./card-matching";
import {
  anyTrue,
  ConditionFacts,
  conditionFacts,
  conditionHolds,
  conditionMatchers,
  conditionTruth,
  Truth,
} from "./conditions";

/*
  Rulebook: "A blanked card should be considered to have no name, no suit, no base strength, no bonuses, and no
  penalties, so it should have no effect on other cards at all."

  Rulebook Q&A: "Finally, apply all penalties, beginning with cards not blanked by any other cards."

  Rulebook Q&A example: "You have a Blizzard (blanks Floods), a Great Flood (blanks Flames and Lands), a Wildfire
  (blanks Lands), and Cavern (clears penalties on Weather). [...] If you did not have the Cavern, then the Flood would
  be blanked and the Blizzard and Wildfire would both be active." So a blanked card blanks nothing.

  Rulebook Q&A: "What happens if the Doppelgänger copies the Basilisk? If there is no card that clears their
  penalties, both cards will be blanked." So cards that blank each other are all blanked.
*/

// Returns the other specified cards whose blank effects target the specified card.
function blankersOf(card: Card, cards: readonly Card[]): readonly Card[] {
  return othersIn(cards, card).filter((other) =>
    effectsOf(other).some(
      (effect) =>
        effect.kind === "blank" &&
        effect.targets.some((target) => matches(card, target)),
    ),
  );
}

// Checks if any of the other specified cards blanks the specified card.
function isBlanked(card: Card, cards: readonly Card[]): boolean {
  return blankersOf(card, cards).length > 0;
}

// Checks if the specified card blanks itself, based on the other cards that are settled in play and those that may yet be.
function blanksItself(
  card: Card,
  settled: readonly Card[],
  unsettled: readonly Card[],
): Truth {
  return anyTrue(
    effectsOf(card).flatMap((effect) =>
      effect.kind === "blankSelf"
        ? [
            conditionTruth(
              effect.when,
              card,
              othersIn(settled, card),
              othersIn(unsettled, card),
            ),
          ]
        : [],
    ),
  );
}

// Checks if another card blanks the specified card: true if a settled card does, false if no card that may still be in play does.
function blankedByOthers(
  card: Card,
  settled: readonly Card[],
  unsettled: readonly Card[],
): Truth {
  if (isBlanked(card, settled)) {
    return true;
  }

  return isBlanked(card, unsettled) ? undefined : false;
}

// Checks if the specified card is blanked, by another card or by itself, based on the other cards that are settled in play and those that may yet be.
function blanking(
  card: Card,
  settled: readonly Card[],
  unsettled: readonly Card[],
): Truth {
  return anyTrue([
    blankedByOthers(card, settled, unsettled),
    blanksItself(card, settled, unsettled),
  ]);
}

// The outcome of settling a hand: the cards settled in play, and those never settled, which are blanked.
type Settled = {
  readonly inPlay: readonly Card[];
  readonly neverSettled: readonly Card[];
};

// Settles cards in rounds. Each round settles every card whose blanking no longer depends on unsettled cards: those not blanked join the settled cards, and blanked ones drop out, which may settle others in the next round. Cards never settled depend on each other, as in a loop of blanks, and are left out, so blanked.
function settleInPlay(
  settled: readonly Card[],
  unsettled: readonly Card[],
): Settled {
  const inPlay = unsettled.filter(
    (card) => blanking(card, settled, unsettled) === false,
  );
  const stillUnsettled = unsettled.filter(
    (card) => blanking(card, settled, unsettled) === undefined,
  );

  return stillUnsettled.length === unsettled.length
    ? { inPlay: settled, neverSettled: unsettled }
    : settleInPlay([...settled, ...inPlay], stillUnsettled);
}

// Removes blanked cards, keeping the rest in their original order. A blanked card neither blanks other cards nor counts toward their self-blanks. Cards that are never settled are blanked, as the rulebook does for two cards that blank each other.
export function withoutBlankedCards(cards: readonly Card[]): readonly Card[] {
  const { inPlay } = settleInPlay([], cards);

  return cards.filter((card) => inPlay.includes(card));
}

// Why a card was blanked, for explaining it. A card can be blanked for more than one reason.
export type BlankReason = {
  // The cards in play whose blank effects target it.
  readonly byCardIds: readonly CardId[];
  // Each of its own blank conditions that holds against the cards in play.
  readonly self: readonly ConditionFacts[];
  // Only when neither of those applies, as the card never settled: the other cards never settled that could blank it, or that its own blank conditions name.
  readonly loopCardIds: readonly CardId[];
};

// Each of the card's own blank conditions that holds against the cards in play, with what made it hold.
function selfBlankFacts(
  card: Card,
  inPlay: readonly Card[],
): readonly ConditionFacts[] {
  const others = othersIn(inPlay, card);

  return effectsOf(card).flatMap((effect) =>
    effect.kind === "blankSelf" && conditionHolds(effect.when, card, others)
      ? [conditionFacts(effect.when, card, others)]
      : [],
  );
}

// The other never-settled cards that the card's fate depends on: those whose blanks target it, and those its own blank conditions name.
function loopCardIdsFor(
  card: Card,
  neverSettled: readonly Card[],
): readonly CardId[] {
  const named = effectsOf(card).flatMap((effect) =>
    effect.kind === "blankSelf" ? conditionMatchers(effect.when) : [],
  );
  const blankers = blankersOf(card, neverSettled);

  return othersIn(neverSettled, card)
    .filter(
      (other) =>
        blankers.includes(other) ||
        named.some((matcher) => matches(other, matcher)),
    )
    .map(({ id }) => id);
}

// Why each blanked card was blanked, from the same settling as withoutBlankedCards. Cards in play have no entry.
export function blankReasons(
  cards: readonly Card[],
): Readonly<Record<CardId, BlankReason>> {
  const { inPlay, neverSettled } = settleInPlay([], cards);

  return Object.fromEntries(
    cards
      .filter((card) => !inPlay.includes(card))
      .map((card) => {
        const byCardIds = blankersOf(card, inPlay).map(({ id }) => id);
        const self = selfBlankFacts(card, inPlay);
        const settled = byCardIds.length > 0 || self.length > 0;

        return [
          card.id,
          {
            byCardIds,
            self,
            loopCardIds: settled ? [] : loopCardIdsFor(card, neverSettled),
          },
        ];
      }),
  );
}
