import {
  createContext,
  Dispatch,
  ReactNode,
  useContext,
  useEffect,
  useReducer,
} from "react";
import type { CardId } from "../../../domain/card";
import {
  handChanged,
  initialNavigation,
  NavigationAction,
  navigationReducer,
  NavigationState,
} from "./navigation";

type NavigationContextValue = {
  readonly navigation: NavigationState;
  readonly navigate: Dispatch<NavigationAction>;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [navigation, navigate] = useReducer(
    navigationReducer,
    initialNavigation,
  );

  return (
    <NavigationContext.Provider value={{ navigation, navigate }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  const value = useContext(NavigationContext);

  if (value === null) {
    throw new Error("useNavigation needs a NavigationProvider");
  }

  return value;
}

// Tells navigation each time the hand's cards change, so a screen that no longer applies can close.
export function useNavigationFollowsHand(cardIds: readonly CardId[]) {
  const { navigate } = useNavigation();

  useEffect(() => {
    navigate(handChanged(cardIds));
  }, [cardIds, navigate]);
}
