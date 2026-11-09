import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { ScanResult } from "../../../application/recognise-hand.usecase";
import type { CardId } from "../../../domain/card";
import { createAppAsyncThunk } from "./create-app-async-thunk";
import { replaceHand } from "./hand-slice";

// Why a scan didn't get to the check screen.
export type ScanFailure = "unreadable" | "noCards" | "cameraDenied";

type ScanState = {
  status: "idle" | "recognising" | "review" | "failed";
  failure: ScanFailure | null;
  // The latest scan's result, kept while the player checks it.
  result: ScanResult | null;
  // For each match, the card the player has settled on: the best candidate until they pick another.
  picks: CardId[];
  // Set while the checked cards are being added to the hand, and when that fails.
  confirming: boolean;
  confirmFailed: boolean;
  latestRequestId: string | null;
};

const initialState: ScanState = {
  status: "idle",
  failure: null,
  result: null,
  picks: [],
  confirming: false,
  confirmFailed: false,
  latestRequestId: null,
};

export const scanHand = createAppAsyncThunk(
  "scan/scanHand",
  (imageUri: string, { extra, getState }) =>
    extra.recogniseHand.execute(getState().variant.id, imageUri),
);

const scanSlice = createSlice({
  name: "scan",
  initialState,
  reducers: {
    // The player picked one of an unsure match's candidates.
    scanCandidatePicked(
      state,
      action: PayloadAction<{ matchIndex: number; cardId: CardId }>,
    ) {
      state.picks[action.payload.matchIndex] = action.payload.cardId;
    },
    // There's no photo to scan: the player refused the camera, or the photo couldn't be taken or opened.
    scanFailed(state, action: PayloadAction<ScanFailure>) {
      state.status = "failed";
      state.failure = action.payload;
    },
    // Back to the cards without changing the hand.
    scanDismissed() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(scanHand.pending, (_, action) => ({
        ...initialState,
        status: "recognising" as const,
        latestRequestId: action.meta.requestId,
      }))
      // Returns a new state, as an Immer draft can't hold the result's readonly arrays.
      .addCase(scanHand.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          return state;
        }

        const { matches } = action.payload;

        return matches.length === 0
          ? { ...state, status: "failed" as const, failure: "noCards" as const }
          : {
              ...state,
              status: "review" as const,
              result: action.payload,
              picks: matches.map((match) => match.candidates[0]),
            };
      })
      .addCase(scanHand.rejected, (state, action) => {
        if (action.meta.requestId === state.latestRequestId) {
          state.status = "failed";
          state.failure = "unreadable";
        }
      })
      .addCase(replaceHand.pending, (state) => {
        state.confirming = true;
        state.confirmFailed = false;
      })
      .addCase(replaceHand.fulfilled, () => initialState)
      .addCase(replaceHand.rejected, (state) => {
        state.confirming = false;
        state.confirmFailed = true;
      });
  },
});

export const { scanCandidatePicked, scanFailed, scanDismissed } =
  scanSlice.actions;
export const scanReducer = scanSlice.reducer;
