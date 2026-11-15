import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { LoadedVariant } from "../../../application/load-variant.usecase";

const initialState: LoadedVariant = { status: "idle", view: null };

// How far loading the current variant has got, with its name, hand size and cards once loaded.
const loadedVariantSlice = createSlice({
  name: "loadedVariant",
  initialState: initialState as LoadedVariant,
  reducers: {
    // Returns the payload as the new state, as an Immer draft can't hold the card views' readonly arrays.
    loadedVariantSaved: (_, action: PayloadAction<LoadedVariant>) =>
      action.payload,
  },
});

export const { loadedVariantSaved } = loadedVariantSlice.actions;
export const loadedVariantReducer = loadedVariantSlice.reducer;
