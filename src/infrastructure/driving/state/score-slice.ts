import { createSlice } from "@reduxjs/toolkit";
import type { HandScore } from "../../../domain/score";
import { createAppAsyncThunk } from "./create-app-async-thunk";

type ScoreState = {
  value: HandScore | null;
  latestRequestId: string | null;
};

const initialState: ScoreState = {
  value: null,
  latestRequestId: null,
};

export const scoreHand = createAppAsyncThunk(
  "score/scoreHand",
  (_: void, { extra, getState }) => extra.scoreHand.execute(getState().hand),
);

const scoreSlice = createSlice({
  name: "score",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(scoreHand.pending, (state, action) => {
        state.latestRequestId = action.meta.requestId;
      })
      // Returns a new state, as an Immer draft can't hold the score's readonly arrays.
      .addCase(scoreHand.fulfilled, (state, action) =>
        action.meta.requestId === state.latestRequestId
          ? { ...state, value: action.payload }
          : state,
      )
      .addCase(scoreHand.rejected, (state, action) => {
        if (action.meta.requestId === state.latestRequestId) {
          state.value = null;
        }
      });
  },
});

export const scoreReducer = scoreSlice.reducer;
