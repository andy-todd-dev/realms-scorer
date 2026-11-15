import type { Hand } from "../../../domain/hand";
import type { HandScore } from "../../../domain/score";
import type { VariantId } from "../../../domain/variant";
import { handSaved } from "./hand-slice";
import { scoreSaved } from "./score-slice";
import type { AppStore } from "./store";

/*
  The store's state as the application's use cases reach it, satisfying their ports structurally. Here until Redux
  becomes a driven adapter, while some changes still go through thunks.
*/
export function reduxStores(store: AppStore) {
  return {
    hands: {
      get: (): Hand => store.getState().hand,
      save: (hand: Hand) => {
        store.dispatch(handSaved(hand));
      },
    },
    scores: {
      save: (score: HandScore | null) => {
        store.dispatch(scoreSaved(score));
      },
    },
    variant: { get: (): VariantId => store.getState().variant.id },
  };
}
