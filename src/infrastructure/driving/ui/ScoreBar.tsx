import ChevronRight from "lucide-react-native/icons/chevron-right";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import { cardRevealRequested, screenOpened } from "../state/navigation-slice";
import { selectHandProgress, selectScore } from "../state/selectors";
import { Box } from "./gluestack/box";
import { Button, ButtonIcon, ButtonText } from "./gluestack/button";
import { Divider } from "./gluestack/divider";
import { HStack } from "./gluestack/hstack";
import { Pressable } from "./gluestack/pressable";
import { Text } from "./gluestack/text";
import { VStack } from "./gluestack/vstack";
import { NO_VALUE } from "./theme";

// Matches the bar's top padding, on top of the inset.
const BOTTOM_PADDING = 10;

export function ScoreBar() {
  const dispatch = useAppDispatch();
  const score = useAppSelector(selectScore);
  const {
    isEmpty,
    isComplete,
    pips,
    countLabel,
    pipsAccessibilityLabel,
    choicesText,
    firstPendingChoiceCardId,
  } = useAppSelector(selectHandProgress);
  const { bottom } = useSafeAreaInsets();
  const showBreakdown = () => dispatch(screenOpened("breakdown"));
  // While a choice is pending, the pips lead to the card that needs it rather than to the breakdown.
  const onPipsPress = () =>
    dispatch(
      firstPendingChoiceCardId === null
        ? screenOpened("breakdown")
        : cardRevealRequested(firstPendingChoiceCardId),
    );

  return (
    <>
      <Divider />
      <HStack
        className="items-center gap-3 bg-muted px-4 pt-2.5"
        style={{ paddingBottom: bottom + BOTTOM_PADDING }}
      >
        <VStack className="min-w-14">
          <Text
            size="xs"
            className="font-body-semibold tracking-widest text-muted-foreground uppercase"
          >
            Score
          </Text>
          <Text
            testID="hand-score"
            className="font-heading text-3xl text-primary"
          >
            {score ?? NO_VALUE}
          </Text>
        </VStack>
        <Pressable
          testID="hand-pips"
          accessibilityRole="button"
          accessibilityLabel={pipsAccessibilityLabel}
          disabled={isEmpty}
          onPress={onPipsPress}
          className="min-h-11 flex-1 justify-center gap-1.5 data-[disabled=true]:opacity-100"
        >
          <HStack className="gap-1">
            {/* border-dashed sets a CSS variable, and react-native-css needs a new component when
                that changes, so these keys and the button's make the swap explicit. */}
            {pips.map((filled, index) => (
              <Box
                key={`${index}-${filled}`}
                className={
                  filled
                    ? "h-3 w-3 rounded-full border border-primary bg-primary"
                    : "h-3 w-3 rounded-full border-[1.5px] border-dashed border-border-strong"
                }
              />
            ))}
          </HStack>
          <Text
            testID="hand-count"
            size="xs"
            className={
              choicesText
                ? "font-body-semibold text-warning-foreground"
                : isComplete
                  ? "text-primary"
                  : "text-muted-foreground"
            }
          >
            {countLabel}
          </Text>
        </Pressable>
        {isEmpty ? (
          <Button
            key="empty"
            testID="show-breakdown"
            variant="outline"
            isDisabled
            className="min-h-12 border-dashed data-[disabled=true]:opacity-100"
          >
            <ButtonText className="text-sm text-muted-foreground">
              Show breakdown
            </ButtonText>
          </Button>
        ) : (
          <Button
            key="ready"
            testID="show-breakdown"
            onPress={showBreakdown}
            className="min-h-12 gap-1 pr-3 pl-4"
          >
            <ButtonText className="text-sm">Show breakdown</ButtonText>
            <ButtonIcon as={ChevronRight} className="h-4 w-4" />
          </Button>
        )}
      </HStack>
    </>
  );
}
