import { combineReducers, configureStore } from "@reduxjs/toolkit";
import type { VariantId } from "../../../domain/variant";
import { appInfoReducer } from "./app-info-slice";
import { handReducer } from "./hand-slice";
import { loadedVariantReducer } from "./loaded-variant-slice";
import { scoreReducer } from "./score-slice";

function createReducer(variantId: VariantId) {
  return combineReducers({
    appInfo: appInfoReducer,
    hand: handReducer,
    loadedVariant: loadedVariantReducer,
    score: scoreReducer,
    // The variant the player is playing, which the app starts with. Nothing changes it until there is a way to pick another.
    variant: (state: VariantId = variantId) => state,
  });
}

// Only holds state: the use cases save to it through the adapters in redux-stores.ts.
export function createAppStore(variantId: VariantId) {
  return configureStore({ reducer: createReducer(variantId) });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<ReturnType<typeof createReducer>>;
export type AppDispatch = AppStore["dispatch"];
