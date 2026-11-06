import { useEffect } from "react";
import { StatusBar, View } from "react-native";
import { loadCards } from "../state/cards-slice";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import { scoreHand } from "../state/score-slice";
import { selectHand, selectScreen } from "../state/selectors";
import { BreakdownScreen } from "./BreakdownScreen";
import { HomeScreen } from "./HomeScreen";

export function Screens() {
  const dispatch = useAppDispatch();
  const screen = useAppSelector(selectScreen);
  const hand = useAppSelector(selectHand);

  useEffect(() => {
    dispatch(loadCards());
  }, [dispatch]);

  // Lives above the screens so it follows the hand, not which screen is showing.
  useEffect(() => {
    dispatch(scoreHand());
  }, [dispatch, hand]);

  return (
    <>
      <StatusBar barStyle="light-content" />
      {/* Home stays mounted behind the breakdown, to keep its scroll position and header state. */}
      <View className={screen === "home" ? "flex-1" : "hidden"}>
        <HomeScreen />
      </View>
      {screen === "breakdown" && <BreakdownScreen />}
    </>
  );
}
