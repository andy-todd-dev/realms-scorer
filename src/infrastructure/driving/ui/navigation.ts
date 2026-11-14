import type { CardId } from "../../../domain/card";

/*
  UI-only state: which screen shows, which sheets are open and the card to scroll to. None of it would matter if the UI
  were replaced, so it stays in React state rather than behind the application's ports.
*/

export type Screen = "home" | "breakdown";

export type NavigationState = {
  readonly screen: Screen;
  // The card whose choice sheet is open, if any.
  readonly choiceSheetFor: CardId | null;
  // For a choice that includes a suit, the card picked on the sheet, whose suit the player is now choosing.
  readonly choiceSheetPickedCard: CardId | null;
  // A card the grid should scroll to, until it has.
  readonly cardToReveal: CardId | null;
  // Whether the sheet for choosing between the camera and a saved photo is open.
  readonly scanSheetOpen: boolean;
};

export const initialNavigation: NavigationState = {
  screen: "home",
  choiceSheetFor: null,
  choiceSheetPickedCard: null,
  cardToReveal: null,
  scanSheetOpen: false,
};

export type NavigationAction =
  | { readonly type: "screenOpened"; readonly screen: Screen }
  | { readonly type: "choiceSheetOpened"; readonly cardId: CardId }
  | { readonly type: "choiceSheetClosed" }
  | { readonly type: "choiceSheetCardPicked"; readonly cardId: CardId }
  | { readonly type: "choiceSheetCardUnpicked" }
  | { readonly type: "cardRevealRequested"; readonly cardId: CardId }
  | { readonly type: "cardRevealed" }
  | { readonly type: "scanSheetOpened" }
  | { readonly type: "scanSheetClosed" }
  | { readonly type: "handChanged"; readonly cardIds: readonly CardId[] };

export const screenOpened = (screen: Screen): NavigationAction => ({
  type: "screenOpened",
  screen,
});
export const choiceSheetOpened = (cardId: CardId): NavigationAction => ({
  type: "choiceSheetOpened",
  cardId,
});
export const choiceSheetClosed = (): NavigationAction => ({
  type: "choiceSheetClosed",
});
// The player picked a card on the sheet, and now chooses its suit.
export const choiceSheetCardPicked = (cardId: CardId): NavigationAction => ({
  type: "choiceSheetCardPicked",
  cardId,
});
// Back from choosing a suit to choosing a card.
export const choiceSheetCardUnpicked = (): NavigationAction => ({
  type: "choiceSheetCardUnpicked",
});
// The card is on the grid, so this returns to it from any screen.
export const cardRevealRequested = (cardId: CardId): NavigationAction => ({
  type: "cardRevealRequested",
  cardId,
});
export const cardRevealed = (): NavigationAction => ({ type: "cardRevealed" });
export const scanSheetOpened = (): NavigationAction => ({
  type: "scanSheetOpened",
});
export const scanSheetClosed = (): NavigationAction => ({
  type: "scanSheetClosed",
});
// The hand's cards changed to these, however that came about.
export const handChanged = (cardIds: readonly CardId[]): NavigationAction => ({
  type: "handChanged",
  cardIds,
});

export function navigationReducer(
  state: NavigationState,
  action: NavigationAction,
): NavigationState {
  switch (action.type) {
    case "screenOpened":
      return { ...state, screen: action.screen };
    case "choiceSheetOpened":
      return {
        ...state,
        choiceSheetFor: action.cardId,
        choiceSheetPickedCard: null,
      };
    case "choiceSheetClosed":
      return { ...state, choiceSheetFor: null, choiceSheetPickedCard: null };
    case "choiceSheetCardPicked":
      return { ...state, choiceSheetPickedCard: action.cardId };
    case "choiceSheetCardUnpicked":
      return { ...state, choiceSheetPickedCard: null };
    case "cardRevealRequested":
      return { ...state, screen: "home", cardToReveal: action.cardId };
    case "cardRevealed":
      return { ...state, cardToReveal: null };
    case "scanSheetOpened":
      return { ...state, scanSheetOpen: true };
    case "scanSheetClosed":
      return { ...state, scanSheetOpen: false };
    // The breakdown can't show an empty hand, so emptying it from there returns to the cards.
    case "handChanged":
      return action.cardIds.length === 0 && state.screen === "breakdown"
        ? { ...state, screen: "home" }
        : state;
  }
}
