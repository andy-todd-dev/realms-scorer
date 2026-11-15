import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { HandScore } from "../../../domain/score";

// The latest score of the hand, which the Rescore use case saves, or null before the first and when scoring failed.
type ScoreState = HandScore | null;

const scoreSlice = createSlice({
  name: "score",
  initialState: null as ScoreState,
  reducers: {
    // Returns the payload as the new state, as an Immer draft can't hold the score's readonly arrays.
    scoreSaved: (_, action: PayloadAction<ScoreState>) => action.payload,
  },
});

export const { scoreSaved } = scoreSlice.actions;
export const scoreReducer = scoreSlice.reducer;
