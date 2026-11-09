import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { CardId } from "../../../domain/card";
import {
  chooseCard,
  clearHand,
  removeCardFromHand,
  replaceHand,
} from "./hand-slice";
import { scanFailed, scanHand } from "./scan-slice";

export type Screen = "home" | "breakdown";

type NavigationState = {
  screen: Screen;
  // The card whose choice sheet is open, if any.
  choiceSheetFor: CardId | null;
  // For a choice that includes a suit, the card picked on the sheet, whose suit the player is now choosing.
  choiceSheetPickedCard: CardId | null;
  // A card the grid should scroll to, until it has.
  cardToReveal: CardId | null;
  // Whether the sheet for choosing between the camera and a saved photo is open.
  scanSheetOpen: boolean;
};

const initialState: NavigationState = {
  screen: "home",
  choiceSheetFor: null,
  choiceSheetPickedCard: null,
  cardToReveal: null,
  scanSheetOpen: false,
};

const navigationSlice = createSlice({
  name: "navigation",
  initialState,
  reducers: {
    screenOpened(state, action: PayloadAction<Screen>) {
      state.screen = action.payload;
    },
    choiceSheetOpened(state, action: PayloadAction<CardId>) {
      state.choiceSheetFor = action.payload;
      state.choiceSheetPickedCard = null;
    },
    choiceSheetClosed(state) {
      state.choiceSheetFor = null;
      state.choiceSheetPickedCard = null;
    },
    // The player picked a card on the sheet, and now chooses its suit.
    choiceSheetCardPicked(state, action: PayloadAction<CardId>) {
      state.choiceSheetPickedCard = action.payload;
    },
    // Back from choosing a suit to choosing a card.
    choiceSheetCardUnpicked(state) {
      state.choiceSheetPickedCard = null;
    },
    // The card is on the grid, so this returns to it from any screen.
    cardRevealRequested(state, action: PayloadAction<CardId>) {
      state.screen = "home";
      state.cardToReveal = action.payload;
    },
    cardRevealed(state) {
      state.cardToReveal = null;
    },
    scanSheetOpened(state) {
      state.scanSheetOpen = true;
    },
    scanSheetClosed(state) {
      state.scanSheetOpen = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // The breakdown can't be opened with an empty hand, so removing the last card leaves it.
      .addCase(removeCardFromHand.fulfilled, (state, action) => {
        if (action.payload.cardIds.length === 0) {
          state.screen = "home";
        }

        if (state.choiceSheetFor === action.meta.arg) {
          state.choiceSheetFor = null;
          state.choiceSheetPickedCard = null;
        }
      })
      .addCase(chooseCard.fulfilled, (state) => {
        state.choiceSheetFor = null;
        state.choiceSheetPickedCard = null;
      })
      .addCase(clearHand.fulfilled, (state) => {
        state.choiceSheetFor = null;
        state.choiceSheetPickedCard = null;
        state.cardToReveal = null;
      })
      // A scanned hand replaces the old one, so a sheet open for one of its cards no longer applies.
      .addCase(replaceHand.fulfilled, (state) => {
        state.choiceSheetFor = null;
        state.choiceSheetPickedCard = null;
      })
      .addCase(scanHand.pending, (state) => {
        state.scanSheetOpen = false;
      })
      .addCase(scanFailed, (state) => {
        state.scanSheetOpen = false;
      });
  },
});

export const {
  screenOpened,
  choiceSheetOpened,
  choiceSheetClosed,
  choiceSheetCardPicked,
  choiceSheetCardUnpicked,
  cardRevealRequested,
  cardRevealed,
  scanSheetOpened,
  scanSheetClosed,
} = navigationSlice.actions;
export const navigationReducer = navigationSlice.reducer;
