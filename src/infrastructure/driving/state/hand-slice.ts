import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Hand } from "../../../domain/hand";

const initialState: Hand = {
  cardIds: [],
  choices: {},
};

// The hand, which the use cases that change it save whole.
const handSlice = createSlice({
  name: "hand",
  initialState,
  reducers: {
    // Returns the payload as the new state, as an Immer draft can't hold the hand's readonly arrays.
    handSaved: (_, action: PayloadAction<Hand>) => action.payload,
  },
});

export const { handSaved } = handSlice.actions;
export const handReducer = handSlice.reducer;
