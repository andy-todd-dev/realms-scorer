import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { CardId } from "../../../domain/card";
import { chooseCard, clearHand, removeCardFromHand } from "./hand-slice";

export type Screen = "home" | "breakdown";

type NavigationState = {
  screen: Screen;
  // The card whose choice sheet is open, if any.
  choiceSheetFor: CardId | null;
  // A card the grid should scroll to, until it has.
  cardToReveal: CardId | null;
};

const initialState: NavigationState = {
  screen: "home",
  choiceSheetFor: null,
  cardToReveal: null,
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
    },
    choiceSheetClosed(state) {
      state.choiceSheetFor = null;
    },
    // The card is on the grid, so this returns to it from any screen.
    cardRevealRequested(state, action: PayloadAction<CardId>) {
      state.screen = "home";
      state.cardToReveal = action.payload;
    },
    cardRevealed(state) {
      state.cardToReveal = null;
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
        }
      })
      .addCase(chooseCard.fulfilled, (state) => {
        state.choiceSheetFor = null;
      })
      .addCase(clearHand.fulfilled, (state) => {
        state.choiceSheetFor = null;
        state.cardToReveal = null;
      });
  },
});

export const {
  screenOpened,
  choiceSheetOpened,
  choiceSheetClosed,
  cardRevealRequested,
  cardRevealed,
} = navigationSlice.actions;
export const navigationReducer = navigationSlice.reducer;
