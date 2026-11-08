import { createSlice } from "@reduxjs/toolkit";
import type { CardView } from "../../../application/load-variant.usecase";
import { loadVariant } from "./variant-slice";

type CardsState = {
  items: readonly CardView[];
  status: "idle" | "loading" | "loaded" | "failed";
};

const initialState: CardsState = {
  items: [],
  status: "idle",
};

// The cards of the variant's deck, which arrive with the variant.
const cardsSlice = createSlice({
  name: "cards",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadVariant.pending, (state) => {
        state.status = "loading";
      })
      // Returns a new state, as an Immer draft can't hold the card views' readonly arrays.
      .addCase(loadVariant.fulfilled, (state, action) => ({
        ...state,
        items: action.payload.cards,
        status: "loaded" as const,
      }))
      .addCase(loadVariant.rejected, (state) => {
        state.status = "failed";
      });
  },
});

export const cardsReducer = cardsSlice.reducer;
