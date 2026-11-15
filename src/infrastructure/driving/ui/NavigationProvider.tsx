import constate from "constate";
import { useEffect, useReducer } from "react";
import type { CardId } from "../../../domain/card";
import {
  handChanged,
  initialNavigation,
  navigationReducer,
} from "./navigation";

// The UI-only navigation state, and `navigate` to change it.
export const [NavigationProvider, useNavigation] = constate(
  function useNavigationState() {
    const [navigation, navigate] = useReducer(
      navigationReducer,
      initialNavigation,
    );

    return { navigation, navigate };
  },
);

// Tells navigation each time the hand's cards change, so a screen that no longer applies can close.
export function useNavigationFollowsHand(cardIds: readonly CardId[]) {
  const { navigate } = useNavigation();

  useEffect(() => {
    navigate(handChanged(cardIds));
  }, [cardIds, navigate]);
}
