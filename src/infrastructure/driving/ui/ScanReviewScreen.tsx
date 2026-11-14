import Check from "lucide-react-native/icons/check";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import Info from "lucide-react-native/icons/info";
import type { LucideProps } from "lucide-react-native";
import { useEffect } from "react";
import { BackHandler, ScrollView, View } from "react-native";
import type { CardId } from "../../../domain/card";
import { replaceHand } from "../state/hand-slice";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import { scanSheetOpened } from "./navigation";
import { useNavigation } from "./NavigationProvider";
import { scanCandidatePicked, scanDismissed } from "../state/scan-slice";
import {
  ScanReview,
  ScanUnsureMatch,
  selectScanReview,
} from "../state/selectors";
import { Button, ButtonIcon, ButtonText } from "./gluestack/button";
import { Divider } from "./gluestack/divider";
import { Heading } from "./gluestack/heading";
import { HStack } from "./gluestack/hstack";
import { Icon } from "./gluestack/icon";
import { Pressable } from "./gluestack/pressable";
import { Text } from "./gluestack/text";
import { VStack } from "./gluestack/vstack";
import { Screen } from "./Screen";
import { SUITS } from "./theme";

// Gluestack's Icon doesn't type strokeWidth, so this heavier weight from the design is set here.
const HeavyCheck = (props: LucideProps) => (
  <Check {...props} strokeWidth={2.5} />
);

/*
  Lists the cards a scan found, for the player to check before they replace the hand. Cards the scan wasn't sure of
  offer their likeliest matches, best first and preselected.
*/
export function ScanReviewScreen() {
  const dispatch = useAppDispatch();
  const { navigate } = useNavigation();
  const review = useAppSelector(selectScanReview);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        dispatch(scanDismissed());
        return true;
      },
    );

    return () => subscription.remove();
  }, [dispatch]);

  if (review === null) {
    return null;
  }

  const addToHand = (cardIds: readonly CardId[]) =>
    dispatch(cardIds.length > 0 ? replaceHand(cardIds) : scanDismissed());

  return (
    <Screen>
      <View testID="scan-review" className="flex-1">
        <HStack className="items-center gap-1 px-3 pt-4 pb-1">
          <Button
            testID="scan-retake"
            accessibilityLabel="Retake photo"
            variant="ghost"
            size="icon"
            onPress={() => {
              dispatch(scanDismissed());
              navigate(scanSheetOpened());
            }}
          >
            <ButtonIcon as={ChevronLeft} className="h-5.5 w-5.5" />
          </Button>
          <Heading size="xl" accessibilityRole="header" className="flex-1">
            Check your cards
          </Heading>
        </HStack>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-3.5 px-4 pt-2 pb-4"
        >
          <VStack className="gap-1 px-1">
            <Text
              testID="scan-summary"
              size="sm"
              className="text-subtle-foreground"
            >
              {review.summary}
            </Text>
            {review.countWarning && (
              <Text
                testID="scan-count-warning"
                size="sm"
                className="font-body-semibold text-warning-foreground"
              >
                {review.countWarning}
              </Text>
            )}
          </VStack>

          {review.unsure.map((match) => (
            <UnsurePanel
              key={match.matchIndex}
              match={match}
              onPick={(cardId) =>
                dispatch(
                  scanCandidatePicked({ matchIndex: match.matchIndex, cardId }),
                )
              }
              onNoneOfThese={() =>
                addToHand(
                  review.picks.filter(
                    (_, matchIndex) => matchIndex !== match.matchIndex,
                  ),
                )
              }
            />
          ))}

          {review.matched.length > 0 && <MatchedList review={review} />}
        </ScrollView>

        <Divider />
        <VStack className="gap-2 px-4 pt-3 pb-4">
          {review.replaceWarning && (
            <Text
              testID="scan-replace-warning"
              size="sm"
              className="text-center text-muted-foreground"
            >
              {review.replaceWarning}
            </Text>
          )}
          {review.confirmFailed && (
            <Text
              testID="scan-confirm-failed"
              size="sm"
              className="text-center font-body-semibold text-destructive"
            >
              Couldn&apos;t add the cards. Try again.
            </Text>
          )}
          <Button
            testID="scan-confirm"
            size="lg"
            isDisabled={review.confirming}
            onPress={() => addToHand(review.picks)}
          >
            <ButtonText>
              {review.confirming ? "Adding…" : "Looks right: add to hand"}
            </ButtonText>
          </Button>
        </VStack>
      </View>
    </Screen>
  );
}

function UnsurePanel({
  match: { matchIndex, options },
  onPick,
  onNoneOfThese,
}: {
  match: ScanUnsureMatch;
  onPick: (cardId: CardId) => void;
  onNoneOfThese: () => void;
}) {
  return (
    <VStack
      testID={`scan-unsure-${matchIndex}`}
      className="gap-2 rounded-2xl border border-warning bg-warning-muted p-3.5"
    >
      <HStack className="items-center gap-2">
        <Icon as={Info} className="h-4 w-4 text-warning-foreground" />
        <Text size="sm" className="font-body-semibold text-warning-foreground">
          Not sure about this card
        </Text>
      </HStack>
      <Text size="sm">Which card is it?</Text>
      <VStack accessibilityRole="radiogroup" className="gap-1.5">
        {options.map(({ id, name, suit, selected }) => (
          <Pressable
            key={id}
            testID={`scan-option-${matchIndex}-${id}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onPick(id)}
            className={
              selected
                ? "min-h-12 flex-row items-center gap-2.5 rounded-xl border border-primary bg-accent px-3"
                : "min-h-12 flex-row items-center gap-2.5 rounded-xl border border-border-strong px-3"
            }
          >
            <View
              className={
                selected
                  ? "h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-primary"
                  : "h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-border-strong"
              }
            >
              {selected && <View className="h-2 w-2 rounded-full bg-primary" />}
            </View>
            <Text className="flex-1 font-body-medium">{name}</Text>
            <Text size="xs" className="text-muted-foreground">
              {SUITS[suit].label}
            </Text>
          </Pressable>
        ))}
      </VStack>
      <Pressable
        testID={`scan-none-${matchIndex}`}
        accessibilityRole="button"
        onPress={onNoneOfThese}
        className="min-h-11 justify-center self-start px-1"
      >
        <Text size="sm" className="font-body-semibold text-primary">
          None of these: pick from all cards
        </Text>
      </Pressable>
    </VStack>
  );
}

function MatchedList({ review: { matched } }: { review: ScanReview }) {
  return (
    <VStack className="gap-2">
      <Heading size="md" accessibilityRole="header" className="px-1">
        Matched
      </Heading>
      <VStack className="gap-1">
        {matched.map(({ id, name, suit }) => (
          <HStack
            key={id}
            testID={`scan-matched-${id}`}
            className="min-h-11 items-center gap-3 rounded-xl bg-muted px-3"
          >
            <Icon as={HeavyCheck} className="h-4.5 w-4.5 text-success" />
            <Text className="flex-1">{name}</Text>
            <Text size="xs" className="text-muted-foreground">
              {SUITS[suit].label}
            </Text>
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}
