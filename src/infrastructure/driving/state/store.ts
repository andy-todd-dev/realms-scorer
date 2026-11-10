import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { UseCases } from "../../../application/use-cases";
import { appInfoReducer } from "./app-info-slice";
import { cardsReducer } from "./cards-slice";
import { handReducer } from "./hand-slice";
import { navigationReducer } from "./navigation-slice";
import { scanReducer } from "./scan-slice";
import { scoreReducer } from "./score-slice";
import { variantReducer } from "./variant-slice";

const reducer = combineReducers({
  appInfo: appInfoReducer,
  cards: cardsReducer,
  hand: handReducer,
  navigation: navigationReducer,
  scan: scanReducer,
  score: scoreReducer,
  variant: variantReducer,
});

export function createAppStore(useCases: UseCases) {
  return configureStore({
    reducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: { extraArgument: useCases } }),
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<typeof reducer>;
export type AppDispatch = AppStore["dispatch"];
