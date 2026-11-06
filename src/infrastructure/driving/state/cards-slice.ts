import { createSlice } from "@reduxjs/toolkit";
import type { CardView } from "../../../application/load-cards.usecase";
import { createAppAsyncThunk } from "./create-app-async-thunk";

type CardsState = {
  items: CardView[];
  status: "idle" | "loading" | "loaded" | "failed";
};

const initialState: CardsState = {
  items: [],
  status: "idle",
};

export const loadCards = createAppAsyncThunk(
  "cards/load",
  (_: void, { extra }) => extra.loadCards.execute(),
);

const cardsSlice = createSlice({
  name: "cards",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadCards.pending, (state) => {
        state.status = "loading";
      })
      // Returns a new state, as an Immer draft can't hold the card views' readonly arrays.
      .addCase(loadCards.fulfilled, (state, action) => ({
        ...state,
        items: action.payload,
        status: "loaded" as const,
      }))
      .addCase(loadCards.rejected, (state) => {
        state.status = "failed";
      });
  },
});

export const cardsReducer = cardsSlice.reducer;
