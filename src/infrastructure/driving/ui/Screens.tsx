import { useEffect } from "react";
import { StatusBar, View } from "react-native";
import { loadAppInfo } from "../state/app-info-slice";
import { loadVariant } from "../state/variant-slice";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import { scoreHand } from "../state/score-slice";
import { selectHand, selectScanReview } from "../state/selectors";
import { BreakdownScreen } from "./BreakdownScreen";
import { HomeScreen } from "./HomeScreen";
import { useNavigation, useNavigationFollowsHand } from "./NavigationProvider";
import { ScanProgress } from "./ScanProgress";
import { ScanReviewScreen } from "./ScanReviewScreen";

export function Screens() {
  const dispatch = useAppDispatch();
  const { screen } = useNavigation().navigation;
  const hand = useAppSelector(selectHand);
  // A scan being checked shows over whichever screen it started from, and leaves it as it was.
  const reviewingScan = useAppSelector(selectScanReview) !== null;

  useEffect(() => {
    dispatch(loadVariant());
    dispatch(loadAppInfo());
  }, [dispatch]);

  // Lives above the screens so it follows the hand, not which screen is showing.
  useEffect(() => {
    dispatch(scoreHand());
  }, [dispatch, hand]);

  useNavigationFollowsHand(hand.cardIds);

  return (
    <>
      <StatusBar barStyle="light-content" />
      {/* Home stays mounted behind the breakdown, to keep its scroll position and header state. */}
      <View
        className={screen === "home" && !reviewingScan ? "flex-1" : "hidden"}
      >
        <HomeScreen />
      </View>
      {screen === "breakdown" && !reviewingScan && <BreakdownScreen />}
      {reviewingScan && <ScanReviewScreen />}
      <ScanProgress />
    </>
  );
}
