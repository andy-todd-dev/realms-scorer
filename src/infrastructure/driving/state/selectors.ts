import { createSelector } from "@reduxjs/toolkit";
import type { CardId, Suit } from "../../../domain/card";
import type { BlankReason } from "../../../domain/blanking";
import type { ConditionFacts } from "../../../domain/conditions";
import type { ScoreLine, ScoreReason } from "../../../domain/score";
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
// The line at the end of the home grid, "Version 0.3.0 (42)", or null until the version is known.
export const selectVersionLabel = createSelector(
  [
    (state: RootState) => state.appInfo.version,
    (state: RootState) => state.appInfo.buildNumber,
  ],
  (version, buildNumber) =>
    version === null
      ? null
      : buildNumber === null
        ? `Version ${version}`
        : `Version ${version} (${buildNumber})`,
);

const choicesNeededText = (count: number) =>
  count === 1 ? "1 choice needed" : `${count} choices needed`;

/*
  The strip under a selected tile for a card that needs a choice: pending until the player chooses, then the chosen
  card's name, and the suit chosen for it for a choice that includes one, which the UI puts into words.
*/
function tileChoice(
  name: string,
  chosenName: string | null,
  chosenSuit: Suit | null,
): {
  pending: boolean;
  text: string;
  chosenSuit: Suit | null;
  accessibilityLabel: string;
} {
  return chosenName === null
    ? {
        pending: true,
        text: "Choose…",
        chosenSuit: null,
        accessibilityLabel: `Choose a card for ${name}`,
      }
    : {
        pending: false,
        text: chosenName,
        chosenSuit,
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
                  ? tileChoice(
                      name,
                      nameOf(choices[id]?.cardId),
                      choices[id]?.suit ?? null,
                    )
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
      // The breakdown footer's warning: a pending choice first, then an incomplete hand. A complete hand needs none.
      breakdownWarning:
        choicesText ?? (isComplete || count === 0 ? null : countText),
      pipsAccessibilityLabel: choicesText
        ? `${choicesText}. Go to the card`
        : `${countText}. Show breakdown`,
    };
  },
);

/*
  The choice sheet for the card it was opened for. Its options come from the latest score, as the rules decide them, and
  are limited to cards still in the hand. For a choice that includes a suit, picking a card leads to a second step,
  choosing its suit from those the score allows. Which card the sheet is for, and the card picked on it, are UI state,
  so they're passed in.
*/
export const selectChoiceSheet = createSelector(
  [
    (_: RootState, chooserId: CardId | null) => chooserId,
    (_: RootState, _chooserId: CardId | null, pickedCardId: CardId | null) =>
      pickedCardId,
    selectCards,
    selectHand,
    selectHandScore,
  ],
  (chooserId, pickedCardId, cards, hand, handScore) => {
    const chooser = cards.find((card) => card.id === chooserId);

    if (!chooser?.choice) {
      return null;
    }

    const nameOf = (cardId: CardId) =>
      cards.find((card) => card.id === cardId)?.name ?? cardId;

    const report = handScore?.cards.find(
      (scored) => scored.cardId === chooser.id,
    )?.choice;
    const optionIds = report?.optionIds ?? [];
    const suitOptions = report?.suitOptions;
    const currentChoice = hand.choices[chooser.id];
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
          current: currentChoice?.cardId === id,
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

    // The card picked for a choice that includes a suit, while it is still an option, with the suits it may be given in grid order.
    const picked = options.find(({ id }) => id === pickedCardId);
    const suitStep =
      picked && suitOptions?.[picked.id]
        ? {
            cardId: picked.id,
            cardName: picked.name,
            options: [...suitOptions[picked.id]]
              .sort((a, b) => a.localeCompare(b))
              .map((suit) => ({
                suit,
                current:
                  currentChoice?.cardId === picked.id &&
                  currentChoice.suit === suit,
              })),
          }
        : null;

    return {
      chooserId: chooser.id,
      title: chooser.name,
      from,
      // Set when the player chooses a suit too, so picking a card leads to choosing its suit.
      choosesSuit: suitOptions !== undefined,
      // Set once a card is picked, for choosing its suit.
      suitStep,
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
export type ChoiceSuitStep = NonNullable<ChoiceSheet["suitStep"]>;
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

// A suit, or a card by name, that a score line counted or needed.
export type ScoreTargetView =
  { readonly suit: Suit } | { readonly cardName: string };

// What made a condition hold, with card names: the cards it needed, what it needed missing, and whether every suit had to differ.
export type ConditionView = {
  readonly withNames: readonly string[];
  readonly without: readonly ScoreTargetView[];
  readonly allSuitsDifferent: boolean;
};

// Why a card was blanked, with card names for the UI to put into words.
export type BlankReasonView = {
  readonly byNames: readonly string[];
  readonly self: readonly ConditionView[];
  readonly loopNames: readonly string[];
};

const targetView = (
  target: { suit?: Suit; cardId?: CardId },
  nameOf: (cardId: CardId) => string,
): ScoreTargetView | null =>
  target.suit !== undefined
    ? { suit: target.suit }
    : target.cardId !== undefined
      ? { cardName: nameOf(target.cardId) }
      : null;

function conditionView(
  facts: ConditionFacts,
  nameOf: (cardId: CardId) => string,
): ConditionView {
  return {
    withNames: facts.withCardIds.map(nameOf),
    without: facts.without.flatMap((target) => {
      const view = targetView(target, nameOf);

      return view ? [view] : [];
    }),
    allSuitsDifferent: facts.allSuitsDifferent,
  };
}

function toBlankReasonView(
  reason: BlankReason,
  nameOf: (cardId: CardId) => string,
): BlankReasonView {
  return {
    byNames: reason.byCardIds.map(nameOf),
    self: reason.self.map((facts) => conditionView(facts, nameOf)),
    loopNames: reason.loopCardIds.map(nameOf),
  };
}

// Why a bonus or penalty scored, with card names for the UI to put into words.
export type ScoreReasonView =
  | {
      readonly kind: "each";
      readonly each: number;
      // What it counts, or null for a chosen card that can't be named.
      readonly counts: ScoreTargetView | null;
      readonly names: readonly string[];
      readonly withNames: readonly string[];
    }
  | ({
      readonly kind: "condition";
    } & ConditionView)
  | { readonly kind: "flat" }
  | {
      readonly kind: "sum";
      readonly counts: ScoreTargetView | null;
      readonly names: readonly string[];
    }
  | {
      readonly kind: "run";
      readonly length: number;
      readonly names: readonly string[];
    }
  | {
      readonly kind: "set";
      readonly suit: Suit;
      readonly names: readonly string[];
    };

export type BreakdownLine = {
  readonly ability: ScoreLine["ability"];
  readonly value: string;
  readonly reason: ScoreReasonView;
};

function toReasonView(
  reason: ScoreReason,
  nameOf: (cardId: CardId) => string,
): ScoreReasonView {
  switch (reason.kind) {
    case "each":
      return {
        kind: "each",
        each: reason.each,
        counts: targetView(reason, nameOf),
        names: reason.cardIds.map(nameOf),
        withNames: reason.withCardIds.map(nameOf),
      };
    case "condition":
      return { kind: "condition", ...conditionView(reason, nameOf) };
    case "flat":
      return { kind: "flat" };
    case "sum":
      return {
        kind: "sum",
        counts: targetView(reason, nameOf),
        names: reason.cardIds.map(nameOf),
      };
    case "run":
      return {
        kind: "run",
        length: reason.length,
        names: reason.cardIds.map(nameOf),
      };
    case "set":
      return {
        kind: "set",
        suit: reason.suit,
        names: reason.cardIds.map(nameOf),
      };
  }
}

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
        const chosenCard = choosesCard
          ? allCards.find((card) => card.id === choices[id]?.cardId)
          : undefined;
        const chosenScore = handScore?.cards.find(
          (scored) => scored.cardId === chosenCard?.id,
        );

        return {
          id,
          name,
          // The suit it was scored as, which differs from its own when it took another card's.
          suit: cardScore?.suit ?? suit,
          // The chosen card, for a card with a choice that has been made, with its suit as scored when it is in the hand. Only a card in the hand has a row of its own.
          chosen: chosenCard
            ? {
                id: chosenCard.id,
                name: chosenCard.name,
                suit: chosenScore?.suit ?? chosenCard.suit,
                // In the hand, or added to it by the latest score.
                inHand:
                  cards.some((card) => card.id === chosenCard.id) ||
                  chosenScore !== undefined,
              }
            : null,
          // The suit chosen for that card, for a choice that includes one.
          chosenSuit: chosenCard ? (choices[id]?.suit ?? null) : null,
          choicePending: choosesCard && !chosenCard,
          // For a card taken from the discard area, the name of the card that took it. It isn't in the hand, so it can't be removed from it.
          addedByName: addedBy === null ? null : nameOf(addedBy),
          blanked: cardScore?.blanked ?? false,
          // Why it was blanked, for a blanked card.
          blankReason: cardScore?.blankReason
            ? toBlankReasonView(
                cardScore.blankReason,
                (cardId) => nameOf(cardId) ?? cardId,
              )
            : null,
          points: cardScore?.total ?? null,
          figures: cardScore && {
            total: String(cardScore.total),
            base: String(cardScore.base),
            // One line for each bonus and penalty that scored, bonuses first.
            lines: cardScore.lines.map(
              ({ ability, points, reason }): BreakdownLine => ({
                ability,
                value: signed(points),
                reason: toReasonView(
                  reason,
                  (cardId) => nameOf(cardId) ?? cardId,
                ),
              }),
            ),
          },
        };
      })
      // Blanked cards go last. Stable, so ties keep hand order. Unscored cards rank as -Infinity, and two of them give NaN, which || 0 treats as a tie.
      .sort(
        (a, b) =>
          Number(a.blanked) - Number(b.blanked) ||
          (b.points ?? -Infinity) - (a.points ?? -Infinity) ||
          0,
      );

    return { rows };
  },
);

export type BreakdownRow = ReturnType<typeof selectBreakdown>["rows"][number];

const selectScan = (state: RootState) => state.scan;

const cardsText = (count: number) =>
  count === 1 ? "1 card" : `${count} cards`;

const SCAN_FAILURES = {
  unreadable: {
    title: "Couldn't read the photo",
    detail: "Try again, or pick your cards by hand.",
  },
  noCards: {
    title: "Couldn't find any cards",
    detail:
      "Lay the cards flat with their names showing, and take the photo from above.",
  },
  cameraDenied: {
    title: "The camera isn't allowed",
    detail:
      "Allow Realms Scorer to use the camera in your phone's settings, or choose a saved photo.",
  },
} as const;

// What to show over the home screen while a photo is read, or when reading it failed. Null otherwise.
export const selectScanProgress = createSelector([selectScan], (scan) =>
  scan.status === "recognising"
    ? { reading: true as const }
    : scan.status === "failed" && scan.failure !== null
      ? { reading: false as const, ...SCAN_FAILURES[scan.failure] }
      : null,
);

/*
  The check screen for a scan, or null when there's nothing to check. Cards the scan was sure of are listed as matched;
  each unsure one offers its candidates, with the player's pick selected, which starts as the best.
*/
export const selectScanReview = createSelector(
  [selectScan, selectCards, selectHandCardIds],
  (scan, cards, handCardIds) => {
    const { status, result, picks, confirming, confirmFailed } = scan;

    if (status !== "review" || result === null) {
      return null;
    }

    const cardView = (cardId: CardId) => {
      const card = cards.find((candidate) => candidate.id === cardId);

      return card && { id: card.id, name: card.name, suit: card.suit };
    };
    const isDefined = <T>(value: T | undefined): value is T =>
      value !== undefined;

    const { matches, handSize } = result;
    const found = matches.length;
    const unsure = matches.flatMap((match, matchIndex) =>
      match.confident
        ? []
        : [
            {
              matchIndex,
              options: match.candidates
                .map(cardView)
                .filter(isDefined)
                .map((option) => ({
                  ...option,
                  selected: picks[matchIndex] === option.id,
                })),
            },
          ],
    );
    const unsureText =
      unsure.length === 0
        ? "Check them, then add them to your hand."
        : unsure.length === 1
          ? "Confirm the one we weren't sure about, then add them to your hand."
          : `Confirm the ${unsure.length} we weren't sure about, then add them to your hand.`;
    const missing = handSize - found;

    return {
      summary: `We found ${found < handSize ? `${found} of ${handSize}` : found} cards. ${unsureText}`,
      // A scan can find fewer cards than the hand holds, never more.
      countWarning:
        missing > 0
          ? `Add the missing ${missing === 1 ? "card" : `${missing} cards`} on the cards screen.`
          : null,
      replaceWarning:
        handCardIds.length > 0
          ? `This replaces the ${cardsText(handCardIds.length)} in your hand.`
          : null,
      unsure,
      matched: matches
        .filter((match) => match.confident)
        .map((match) => cardView(match.candidates[0]))
        .filter(isDefined),
      // The card settled on for each match, in match order, for adding to the hand.
      picks,
      confirming,
      confirmFailed,
    };
  },
);

export type ScanReview = NonNullable<ReturnType<typeof selectScanReview>>;
export type ScanUnsureMatch = ScanReview["unsure"][number];
