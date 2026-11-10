import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import X from "lucide-react-native/icons/x";
import { useEffect, useRef } from "react";
import { BackHandler, ScrollView } from "react-native";
import { removeCardFromHand } from "../state/hand-slice";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import { cardRevealRequested, screenOpened } from "../state/navigation-slice";
import {
  BreakdownRow,
  selectBreakdown,
  selectHandProgress,
  selectScore,
} from "../state/selectors";
import { Box } from "./gluestack/box";
import { Button, ButtonIcon } from "./gluestack/button";
import { Divider } from "./gluestack/divider";
import { Heading } from "./gluestack/heading";
import { HStack } from "./gluestack/hstack";
import { Icon } from "./gluestack/icon";
import { Pressable } from "./gluestack/pressable";
import { Text } from "./gluestack/text";
import { VStack } from "./gluestack/vstack";
import { CardChip } from "./CardChip";
import { RowBadge } from "./RowBadge";
import { describeBlankReason, describeScoreLine } from "./score-wording";
import { Screen } from "./Screen";
import { StripedFill } from "./StripedFill";
import { SuitDot } from "./SuitDot";
import { NO_VALUE, SUITS } from "./theme";

// NativeWind has no class for this on native, so it has to be a style.
const TABULAR_NUMBERS = { fontVariant: ["tabular-nums" as const] };

// One line under a card's name, such as its base strength or a bonus and its reason. Struck through for a figure that doesn't count.
function FigureLine({
  label,
  value,
  valueClassName,
  struck = false,
}: {
  label: string;
  value: string;
  valueClassName: string;
  struck?: boolean;
}) {
  return (
    <HStack className="justify-between gap-3 pr-13.5 pl-5">
      <Text
        size="sm"
        // Long reasons wrap rather than push the value off the row.
        className={
          struck
            ? "flex-1 text-muted-foreground line-through"
            : "flex-1 text-subtle-foreground"
        }
      >
        {label}
      </Text>
      <Text
        size="sm"
        className={
          struck ? "text-muted-foreground line-through" : valueClassName
        }
        style={TABULAR_NUMBERS}
      >
        {value}
      </Text>
    </HStack>
  );
}

function CardFigures({ row }: { row: BreakdownRow }) {
  const { blanked, blankReason, figures } = row;

  if (!figures) {
    return null;
  }

  // A blanked card's text doesn't apply, so only its base strength is shown, struck through, with why it was blanked.
  return (
    <>
      <FigureLine
        label="Base strength"
        value={figures.base}
        valueClassName="text-subtle-foreground"
        struck={blanked}
      />
      {blanked && blankReason && (
        <Text
          testID={`blank-reason-${row.id}`}
          size="sm"
          className="pr-13.5 pl-5 text-foreground"
        >
          {describeBlankReason(blankReason)}
        </Text>
      )}
      {!blanked &&
        figures.lines.map((line, index) => (
          <FigureLine
            key={index}
            label={describeScoreLine(line)}
            value={line.value}
            valueClassName={
              line.ability === "bonus" ? "text-success" : "text-destructive"
            }
          />
        ))}
    </>
  );
}

// The row's own choice, first under its name: "Chose [Swamp]", or "Chose [Bell Tower] → Wizard" with a suit.
function ChoseLine({
  row,
  onGoToCard,
}: {
  row: BreakdownRow;
  onGoToCard: (cardId: string) => void;
}) {
  const { chosen, chosenSuit } = row;

  if (!chosen) {
    return null;
  }

  return (
    <HStack className="flex-wrap items-center gap-1.5 pr-13.5 pl-5">
      <Text size="sm" className="text-subtle-foreground">
        Chose
      </Text>
      <CardChip
        testID={`chosen-card-${row.id}`}
        name={chosen.name}
        suit={chosen.suit}
        variant="chose"
        accessibilityLabel={
          chosen.inHand
            ? `${row.name} chose ${chosen.name}. Go to ${chosen.name}`
            : `${row.name} chose ${chosen.name}`
        }
        onPress={chosen.inHand ? () => onGoToCard(chosen.id) : undefined}
      />
      {chosenSuit && (
        <Text size="sm" className="text-subtle-foreground">
          → {SUITS[chosenSuit].label}
        </Text>
      )}
    </HStack>
  );
}

function rowClassName({ blanked, choicePending }: BreakdownRow): string {
  if (blanked) {
    return "gap-1.5 overflow-hidden rounded-2xl border-[1.5px] border-dashed border-border-strong pt-1 pr-1 pb-3 pl-3.5";
  }

  return choicePending
    ? "gap-1.5 rounded-2xl border-[1.5px] border-warning bg-warning-muted pt-1 pr-1 pb-3 pl-3.5"
    : "gap-1.5 rounded-2xl border-[1.5px] border-transparent bg-muted pt-1 pr-1 pb-3 pl-3.5";
}

export function BreakdownScreen() {
  const dispatch = useAppDispatch();
  const { rows } = useAppSelector(selectBreakdown);
  const { breakdownWarning } = useAppSelector(selectHandProgress);
  const score = useAppSelector(selectScore) ?? NO_VALUE;
  const scrollRef = useRef<ScrollView>(null);
  // Where each card's row starts in the list, so a card chip can scroll to it.
  const rowOffsets = useRef(new Map<string, number>());

  const goToCard = (cardId: string) => {
    const y = rowOffsets.current.get(cardId);

    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y, animated: true });
    }
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        dispatch(screenOpened("home"));
        return true;
      },
    );

    return () => subscription.remove();
  }, [dispatch]);

  return (
    <Screen>
      <HStack className="items-center gap-1 px-3 pt-4 pb-1">
        <Button
          testID="back-to-cards"
          accessibilityLabel="Back to cards"
          variant="ghost"
          size="icon"
          onPress={() => dispatch(screenOpened("home"))}
        >
          <ButtonIcon as={ChevronLeft} className="h-5.5 w-5.5" />
        </Button>
        <Heading
          testID="breakdown-title"
          size="xl"
          accessibilityRole="header"
          className="flex-1"
        >
          Score breakdown
        </Heading>
      </HStack>

      <ScrollView
        ref={scrollRef}
        className="mt-2 flex-1"
        contentContainerClassName="gap-2 px-4 pb-3"
      >
        {rows.map((row) => (
          <VStack
            // border-dashed sets a CSS variable, and react-native-css needs a new component when that changes.
            key={`${row.id}-${row.blanked}`}
            testID={`breakdown-card-${row.id}`}
            onLayout={(event) =>
              rowOffsets.current.set(row.id, event.nativeEvent.layout.y)
            }
            className={rowClassName(row)}
          >
            {row.blanked && <StripedFill />}
            <HStack className="items-center gap-2.5">
              <SuitDot suit={row.suit} />
              <HStack className="flex-1 flex-wrap items-center gap-x-1.5">
                <Text
                  className={
                    row.blanked
                      ? "font-body-semibold text-subtle-foreground"
                      : "font-body-semibold text-foreground"
                  }
                >
                  {row.name}
                </Text>
                <Text size="xs" className="text-muted-foreground">
                  {SUITS[row.suit].label}
                  {row.addedByName && ` · added by ${row.addedByName}`}
                </Text>
                {row.blanked && (
                  <RowBadge testID={`row-badge-${row.id}`} kind="blanked" />
                )}
                {row.choicePending && (
                  <RowBadge
                    testID={`row-badge-${row.id}`}
                    kind="choiceNeeded"
                  />
                )}
              </HStack>
              <Text
                testID={`card-total-${row.id}`}
                size="lg"
                className={
                  row.blanked || row.choicePending
                    ? "font-body-bold text-muted-foreground"
                    : "font-body-bold text-primary"
                }
                style={TABULAR_NUMBERS}
              >
                {row.figures?.total ?? NO_VALUE}
              </Text>
              {row.addedByName === null ? (
                <Button
                  testID={`remove-card-${row.id}`}
                  accessibilityLabel={`Remove ${row.name} from hand`}
                  variant="ghost"
                  size="icon"
                  onPress={() => dispatch(removeCardFromHand(row.id))}
                >
                  <ButtonIcon as={X} className="h-4.5 w-4.5 text-icon" />
                </Button>
              ) : (
                // Keeps the total lined up with the rows that have a remove button. The card is changed through its chooser's choice.
                <Box className="h-11 w-11" />
              )}
            </HStack>
            <ChoseLine row={row} onGoToCard={goToCard} />
            <CardFigures row={row} />
            {row.choicePending && (
              <Pressable
                testID={`choice-needed-${row.id}`}
                accessibilityRole="button"
                onPress={() => dispatch(cardRevealRequested(row.id))}
                className="ml-5 min-h-11 flex-row items-center gap-1 self-start"
              >
                <Text
                  size="sm"
                  className="font-body-semibold text-warning-foreground"
                >
                  Choose on the cards screen
                </Text>
                <Icon
                  as={ChevronRight}
                  className="h-4 w-4 text-warning-foreground"
                />
              </Pressable>
            )}
          </VStack>
        ))}
      </ScrollView>

      <Divider />
      <VStack className="gap-0.5 px-5 pt-3 pb-4">
        {breakdownWarning && (
          <Text
            testID="breakdown-warning"
            size="sm"
            className="font-body-semibold text-warning-foreground"
          >
            {breakdownWarning}
          </Text>
        )}
        <HStack className="items-baseline justify-between">
          <Text
            size="xs"
            className="font-body-semibold tracking-widest text-muted-foreground uppercase"
          >
            Total
          </Text>
          <Text
            testID="breakdown-total"
            className="font-heading text-4xl text-primary"
          >
            {score}
          </Text>
        </HStack>
      </VStack>
    </Screen>
  );
}
