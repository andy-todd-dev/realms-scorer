import { createSlice } from "@reduxjs/toolkit";
import type { VariantId } from "../../../domain/variant";
import { createAppAsyncThunk } from "./create-app-async-thunk";

// The variant the app plays. Always the base game until there is a way to pick another.
export const BASE_VARIANT_ID: VariantId = "base";

type VariantState = {
  readonly id: VariantId;
  // Known once the variant has loaded.
  readonly name: string | null;
  readonly handSize: number | null;
};

const initialState: VariantState = {
  id: BASE_VARIANT_ID,
  name: null,
  handSize: null,
};

// Loads the variant along with its deck's cards, which the cards slice keeps.
export const loadVariant = createAppAsyncThunk(
  "variant/load",
  (_: void, { extra, getState }) =>
    extra.loadVariant.execute(getState().variant.id),
);

const variantSlice = createSlice({
  name: "variant",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(loadVariant.fulfilled, (state, action) => {
      state.name = action.payload.name;
      state.handSize = action.payload.handSize;
    });
  },
});

export const variantReducer = variantSlice.reducer;
