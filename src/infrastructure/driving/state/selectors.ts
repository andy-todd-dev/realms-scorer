import { createSelector } from "@reduxjs/toolkit";
import type { CardId, Suit } from "../../../domain/card";
import type { RootState } from "./store";

const selectCards = (state: RootState) => state.cards.items;

export const selectCardsStatus = (state: RootState) => state.cards.status;
// The most cards the player can select, from the variant, or null until it has loaded. A card the Necromancer takes from the discard area doesn't count towards it.
const selectHandSize = (state: RootState) => state.variant.handSize;
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
  [selectCards, selectHandCardIds, selectChoices, selectHandSize],
  (cards, handCardIds, choices, handSize) => {
    const nameOf = (cardId: CardId | undefined) =>
      cards.find((card) => card.id === cardId)?.name ?? null;
    const isHandFull = handSize !== null && handCardIds.length >= handSize;

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
              // A full hand takes no more cards, but its cards can still be removed.
              disabled: isHandFull && !selected,
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
  [selectHandCardIds, selectPendingChoiceCardIds, selectHandSize],
  ({ length: count }, pendingChoiceCardIds, handSize) => {
    const pendingChoiceCount = pendingChoiceCardIds.length;
    // Until the variant loads there is no target to count towards.
    const isComplete = handSize !== null && count >= handSize;
    const countText =
      isComplete || handSize === null
        ? `${count} cards`
        : `${count} of ${handSize} cards`;

    const choicesText =
      pendingChoiceCount > 0 ? choicesNeededText(pendingChoiceCount) : null;

    return {
      isEmpty: count === 0,
      isComplete,
      // The first card to scroll to when the player asks where a choice is needed.
      firstPendingChoiceCardId: pendingChoiceCardIds[0] ?? null,
      // Set while any choice is pending, which takes over the count line.
      choicesText,
      // One entry per slot, true when filled.
      pips: Array.from({ length: handSize ?? 0 }, (_, index) => index < count),
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
    const { from } = chooser.choice;
    // Cards in the hand as the latest score has it: those in it, then any that pre-scoring added.
    const inScoredHand = (cardId: CardId) =>
      hand.cardIds.includes(cardId) ||
      (handScore?.cards.some(
        (scored) => scored.cardId === cardId && scored.addedBy !== undefined,
      ) ??
        false);
    // Options from the latest score, still in the right place for the choice, in case the hand changed since. Any card in the game stays an option.
    const stillAnOption = (cardId: CardId) =>
      from === "game" || inScoredHand(cardId) === (from === "hand");
    const options = optionIds.filter(stillAnOption).flatMap((optionId) =>
      cards
        .filter((card) => card.id === optionId)
        .map(({ id, name, suit }) => ({
          id,
          name,
          suit,
          current: hand.choices[chooser.id] === id,
        })),
    );

    // Options from the hand are one group, with no suit, in hand order. Options from the discard area can be many, so they are grouped by suit and sorted as the grid is.
    const groups: { suit: Suit | null; options: typeof options }[] =
      from === "hand"
        ? options.length > 0
          ? [{ suit: null, options }]
          : []
        : [...new Set(options.map((option) => option.suit))]
            .sort((a, b) => a.localeCompare(b))
            .map((suit) => ({
              suit,
              options: options
                .filter((option) => option.suit === suit)
                .sort((a, b) => a.name.localeCompare(b.name)),
            }));

    return {
      chooserId: chooser.id,
      title: chooser.name,
      from,
      // What may be chosen, with card names for the UI to describe.
      targets: chooser.choice.targets.map((target): ChoiceTarget =>
        "suit" in target
          ? { suit: target.suit, exceptNames: target.except.map(nameOf) }
          : { cardName: nameOf(target.cardId) },
      ),
      groups,
    };
  },
);

export type ChoiceSheet = NonNullable<ReturnType<typeof selectChoiceSheet>>;
export type ChoiceOptionGroup = ChoiceSheet["groups"][number];
export type ChoiceOption = ChoiceOptionGroup["options"][number];
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
    const nameOf = (cardId: CardId | null) =>
      allCards.find((card) => card.id === cardId)?.name ?? null;

    // Cards a choice took from the discard area, which the latest score lists after the hand.
    const addedCards = (handScore?.cards ?? []).flatMap(
      ({ cardId, addedBy }) =>
        addedBy === undefined
          ? []
          : allCards
              .filter((card) => card.id === cardId)
              .map((card) => ({ ...card, addedBy })),
    );

    const rows = [
      ...cards.map((card) => ({ ...card, addedBy: null })),
      ...addedCards,
    ]
      .map(({ id, name, suit, choice, addedBy }) => {
        const cardScore = handScore?.cards.find(
          (scored) => scored.cardId === id,
        );

        const choosesCard = choice !== null && addedBy === null;
        const chosenName = choosesCard ? nameOf(choices[id] ?? null) : null;

        return {
          id,
          name,
          // The suit it was scored as, which differs from its own when it took another card's.
          suit: cardScore?.suit ?? suit,
          // The chosen card's name, for a card with a choice that has been made.
          chosenName,
          choicePending: choosesCard && chosenName === null,
          // For a card taken from the discard area, the name of the card that took it. It isn't in the hand, so it can't be removed from it.
          addedByName: addedBy === null ? null : nameOf(addedBy),
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
