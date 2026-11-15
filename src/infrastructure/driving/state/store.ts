import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { UseCases } from "../../../application/use-cases";
import type { VariantId } from "../../../domain/variant";
import { appInfoReducer } from "./app-info-slice";
import { handReducer } from "./hand-slice";
import { loadedVariantReducer } from "./loaded-variant-slice";
import { scanReducer } from "./scan-slice";
import { scoreReducer } from "./score-slice";

function createReducer(variantId: VariantId) {
  return combineReducers({
    appInfo: appInfoReducer,
    hand: handReducer,
    loadedVariant: loadedVariantReducer,
    scan: scanReducer,
    score: scoreReducer,
    // The variant the player is playing, which the app starts with. Nothing changes it until there is a way to pick another.
    variant: (state: VariantId = variantId) => state,
  });
}

export function createAppStore(useCases: UseCases, variantId: VariantId) {
  return configureStore({
    reducer: createReducer(variantId),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: { extraArgument: useCases } }),
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<ReturnType<typeof createReducer>>;
export type AppDispatch = AppStore["dispatch"];
