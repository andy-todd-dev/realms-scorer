import { createSelector } from "@reduxjs/toolkit";
import type { CardId, Suit } from "../../../domain/card";
import type { RootState } from "./store";

// Display only: the target for a hand, not a limit. The Necromancer allows an 8th card.
const HAND_SIZE = 7;

const selectCards = (state: RootState) => state.cards.items;

export const selectCardsStatus = (state: RootState) => state.cards.status;
export const selectHand = (state: RootState) => state.hand;
export const selectHandCardIds = (state: RootState) => state.hand.cardIds;
const selectChoices = (state: RootState) => state.hand.choices;
const selectHandScore = (state: RootState) => state.score.value;
export const selectScore = (state: RootState) =>
  state.score.value?.total ?? null;
export const selectScreen = (state: RootState) => state.navigation.screen;
export const selectCardToReveal = (state: RootState) =>
  state.navigation.cardToReveal;
const selectChoiceSheetFor = (state: RootState) =>
  state.navigation.choiceSheetFor;

const choicesNeededText = (count: number) =>
  count === 1 ? "1 choice needed" : `${count} choices needed`;

// The strip under a selected tile for a card that needs a choice: pending until the player chooses, then the chosen card's name.
function tileChoice(
  name: string,
  chosenName: string | null,
): { pending: boolean; text: string; accessibilityLabel: string } {
  return chosenName === null
    ? {
        pending: true,
        text: "Choose…",
        accessibilityLabel: `Choose a card for ${name}`,
      }
    : {
        pending: false,
        text: chosenName,
        accessibilityLabel: `${name}: ${chosenName}. Change`,
      };
}

export const selectCardSections = createSelector(
  [selectCards, selectHandCardIds, selectChoices],
  (cards, handCardIds, choices) => {
    const nameOf = (cardId: CardId | undefined) =>
      cards.find((card) => card.id === cardId)?.name ?? null;

    return [...new Set(cards.map((card) => card.suit))]
      .sort((a, b) => a.localeCompare(b))
      .map((suit) => ({
        suit,
        cards: cards
          .filter((card) => card.suit === suit)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(({ id, name, choice }) => {
            const selected = handCardIds.includes(id);

            return {
              id,
              name,
              selected,
              choice:
                selected && choice !== null
                  ? tileChoice(name, nameOf(choices[id]))
                  : null,
            };
          }),
      }));
  },
);

export type CardSection = ReturnType<typeof selectCardSections>[number];
export type CardTile = CardSection["cards"][number];

// Cards in the hand still waiting for a choice, in grid order.
const selectPendingChoiceCardIds = createSelector(
  [selectCardSections],
  (sections) =>
    sections
      .flatMap((section) => section.cards)
      .filter((card) => card.choice?.pending)
      .map((card) => card.id),
);

export const selectHandProgress = createSelector(
  [selectHandCardIds, selectPendingChoiceCardIds],
  ({ length: count }, pendingChoiceCardIds) => {
    const pendingChoiceCount = pendingChoiceCardIds.length;
    const isComplete = count >= HAND_SIZE;
    const countText = isComplete
      ? `${count} cards`
      : `${count} of ${HAND_SIZE} cards`;

    const choicesText =
      pendingChoiceCount > 0 ? choicesNeededText(pendingChoiceCount) : null;

    return {
      isEmpty: count === 0,
      isComplete,
      // The first card to scroll to when the player asks where a choice is needed.
      firstPendingChoiceCardId: pendingChoiceCardIds[0] ?? null,
      // Set while any choice is pending, which takes over the count line.
      choicesText,
      // One entry per slot, true when filled. A hand over the target gets extra slots.
      pips: Array.from(
        { length: Math.max(HAND_SIZE, count) },
        (_, index) => index < count,
      ),
      countLabel:
        count === 0
          ? "Tap cards or scan"
          : choicesText
            ? `${choicesText} ›`
            : isComplete
              ? `${countText} ✓`
              : countText,
      reviewLabel:
        choicesText ?? (isComplete ? `${countText} · complete` : countText),
      pipsAccessibilityLabel: choicesText
        ? `${choicesText}. Go to the card`
        : `${countText}. Show breakdown`,
    };
  },
);

// The choice sheet for the card it was opened for. Its options come from the latest score, as the rules decide them, and are limited to cards still in the hand.
export const selectChoiceSheet = createSelector(
  [selectChoiceSheetFor, selectCards, selectHand, selectHandScore],
  (chooserId, cards, hand, handScore) => {
    const chooser = cards.find((card) => card.id === chooserId);

    if (!chooser?.choice) {
      return null;
    }

    const nameOf = (cardId: CardId) =>
      cards.find((card) => card.id === cardId)?.name ?? cardId;

    const optionIds =
      handScore?.cards.find((scored) => scored.cardId === chooser.id)?.choice
        ?.optionIds ?? [];

    return {
      chooserId: chooser.id,
      title: chooser.name,
      // What may be chosen, with card names for the UI to describe.
      targets: chooser.choice.targets.map((target): ChoiceTarget =>
        "suit" in target
          ? { suit: target.suit, exceptNames: target.except.map(nameOf) }
          : { cardName: nameOf(target.cardId) },
      ),
      options: optionIds
        .filter((optionId) => hand.cardIds.includes(optionId))
        .flatMap((optionId) =>
          cards
            .filter((card) => card.id === optionId)
            .map(({ id, name, suit }) => ({
              id,
              name,
              suit,
              current: hand.choices[chooser.id] === id,
            })),
        ),
    };
  },
);

export type ChoiceSheet = NonNullable<ReturnType<typeof selectChoiceSheet>>;
export type ChoiceOption = ChoiceSheet["options"][number];
// What a choice may take, for the UI to put into words: a suit, other than some cards, or a card.
export type ChoiceTarget =
  | { readonly suit: Suit; readonly exceptNames: readonly string[] }
  | { readonly cardName: string };

export const selectHandCards = createSelector(
  [selectCards, selectHandCardIds],
  (cards, handCardIds) =>
    handCardIds.flatMap((cardId) => cards.filter((card) => card.id === cardId)),
);

const MINUS = "\u2212";

const signed = (points: number) =>
  points > 0 ? `+${points}` : points < 0 ? `${MINUS}${-points}` : "0";

// Bonus or penalty points for a card row, left out when there are none.
const signedIfAny = (points: number) => (points === 0 ? null : signed(points));

// The hand score split up for display. Cards are listed highest-scoring first; a card not yet scored, while a new score is in flight, comes last with no figures.
export const selectBreakdown = createSelector(
  [selectCards, selectHandCards, selectChoices, selectHandScore],
  (allCards, cards, choices, handScore) => {
    const rows = cards
      .map(({ id, name, suit, choice }) => {
        const cardScore = handScore?.cards.find(
          (scored) => scored.cardId === id,
        );

        const choosesCard = choice !== null;
        const chosenName = choosesCard
          ? (allCards.find((card) => card.id === choices[id])?.name ?? null)
          : null;

        return {
          id,
          name,
          suit,
          // The chosen card's name, for a card with a choice that has been made.
          chosenName,
          choicePending: choosesCard && chosenName === null,
          blanked: cardScore?.blanked ?? false,
          points: cardScore?.total ?? null,
          figures: cardScore && {
            total: String(cardScore.total),
            base: String(cardScore.base),
            bonus: signedIfAny(cardScore.bonus),
            penalty: signedIfAny(cardScore.penalty),
          },
        };
      })
      // Stable, so ties keep hand order. Unscored cards rank as -Infinity, and two of them give NaN, which || 0 treats as a tie.
      .sort((a, b) => (b.points ?? -Infinity) - (a.points ?? -Infinity) || 0);

    const blankedNames = rows
      .filter(({ blanked }) => blanked)
      .map(({ name }) => name);

    return {
      stats: handScore && {
        base: String(handScore.base),
        bonus: signed(handScore.bonus),
        penalty: signed(handScore.penalty),
      },
      rows,
      sum:
        handScore &&
        `${handScore.base} + ${handScore.bonus} ${MINUS} ${-handScore.penalty}`,
      blanked: blankedNames.length > 0 ? blankedNames.join(", ") : "none",
    };
  },
);

export type BreakdownRow = ReturnType<typeof selectBreakdown>["rows"][number];
