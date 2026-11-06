import ChevronLeft from "lucide-react-native/icons/chevron-left";
import X from "lucide-react-native/icons/x";
import { useEffect } from "react";
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
import { Card } from "./gluestack/card";
import { Divider } from "./gluestack/divider";
import { Heading } from "./gluestack/heading";
import { HStack } from "./gluestack/hstack";
import { Pressable } from "./gluestack/pressable";
import { Text } from "./gluestack/text";
import { VStack } from "./gluestack/vstack";
import { Screen } from "./Screen";
import { SuitDot } from "./SuitDot";
import { NO_VALUE, SUITS } from "./theme";

// NativeWind has no class for this on native, so it has to be a style.
const TABULAR_NUMBERS = { fontVariant: ["tabular-nums" as const] };

// One line under a card's name, such as its base strength or bonus points.
function FigureLine({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName: string;
}) {
  return (
    <HStack className="justify-between gap-3 pr-13.5 pl-5">
      <Text size="sm" className="text-subtle-foreground">
        {label}
      </Text>
      <Text size="sm" className={valueClassName} style={TABULAR_NUMBERS}>
        {value}
      </Text>
    </HStack>
  );
}

function CardFigures({ row }: { row: BreakdownRow }) {
  const { blanked, figures } = row;

  if (blanked) {
    return (
      <Text size="sm" className="pr-13.5 pl-5 text-muted-foreground">
        Blanked: scores 0
      </Text>
    );
  }

  if (!figures) {
    return null;
  }

  return (
    <>
      <FigureLine
        label="Base strength"
        value={figures.base}
        valueClassName="text-subtle-foreground"
      />
      {figures.bonus && (
        <FigureLine
          label="Bonuses"
          value={figures.bonus}
          valueClassName="text-success"
        />
      )}
      {figures.penalty && (
        <FigureLine
          label="Penalties"
          value={figures.penalty}
          valueClassName="text-destructive"
        />
      )}
    </>
  );
}

export function BreakdownScreen() {
  const dispatch = useAppDispatch();
  const { stats, rows, sum, blanked } = useAppSelector(selectBreakdown);
  const { isComplete, reviewLabel, choicesText } =
    useAppSelector(selectHandProgress);
  const score = useAppSelector(selectScore) ?? NO_VALUE;
  const tiles = [
    {
      testID: "breakdown-base",
      label: "Base",
      value: stats?.base ?? NO_VALUE,
      className: "text-foreground",
    },
    {
      testID: "breakdown-bonus",
      label: "Bonuses",
      value: stats?.bonus ?? NO_VALUE,
      className: "text-success",
    },
    {
      testID: "breakdown-penalty",
      label: "Penalties",
      value: stats?.penalty ?? NO_VALUE,
      className:
        stats && stats.penalty !== "0" ? "text-destructive" : "text-foreground",
    },
  ];

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
      <HStack className="items-center gap-1 px-3 pt-4">
        <Button
          testID="back-to-cards"
          accessibilityLabel="Back to cards"
          variant="ghost"
          size="icon"
          onPress={() => dispatch(screenOpened("home"))}
        >
          <ButtonIcon as={ChevronLeft} className="h-5.5 w-5.5" />
        </Button>
        <VStack className="flex-1">
          <Heading
            testID="breakdown-title"
            size="xl"
            accessibilityRole="header"
          >
            Your hand: {score}
          </Heading>
          <Text
            testID="breakdown-count"
            size="sm"
            className={
              choicesText
                ? "font-body-semibold text-warning-foreground"
                : isComplete
                  ? "text-primary"
                  : "text-muted-foreground"
            }
          >
            {reviewLabel}
          </Text>
        </VStack>
      </HStack>

      {/* Padding rather than gap, so that three tiles fill the row exactly. */}
      <HStack className="mx-3 mt-3">
        {tiles.map(({ testID, label, value, className }) => (
          <Box key={label} className="w-1/3 p-1">
            <Card className="gap-0.5 rounded-xl border-0 px-3 py-2.5">
              <Text size="xs" className="text-muted-foreground">
                {label}
              </Text>
              <Text
                testID={testID}
                className={`font-body-semibold text-xl ${className}`}
                style={TABULAR_NUMBERS}
              >
                {value}
              </Text>
            </Card>
          </Box>
        ))}
      </HStack>

      <ScrollView
        className="mt-2.5 flex-1"
        contentContainerClassName="gap-2 px-4 pb-3"
      >
        {rows.map((row) => (
          <VStack
            key={row.id}
            testID={`breakdown-card-${row.id}`}
            className={
              row.choicePending
                ? "gap-1.5 rounded-2xl border-[1.5px] border-warning bg-muted pt-1 pr-1 pb-3 pl-3.5"
                : "gap-1.5 rounded-2xl bg-muted pt-1 pr-1 pb-3 pl-3.5"
            }
          >
            <HStack className="items-center gap-2.5">
              <SuitDot suit={row.suit} />
              <Text className="flex-1 font-body-semibold">
                {row.name}
                {row.chosenName && (
                  <Text
                    testID={`chosen-card-${row.id}`}
                    className="font-body-semibold text-accent-foreground"
                  >
                    {` → ${row.chosenName}`}
                  </Text>
                )}{" "}
                <Text size="xs" className="text-muted-foreground">
                  {SUITS[row.suit].label}
                </Text>
              </Text>
              <Text
                testID={`card-total-${row.id}`}
                size="lg"
                className="font-body-bold text-primary"
                style={TABULAR_NUMBERS}
              >
                {row.figures?.total ?? NO_VALUE}
              </Text>
              <Button
                testID={`remove-card-${row.id}`}
                accessibilityLabel={`Remove ${row.name} from hand`}
                variant="ghost"
                size="icon"
                onPress={() => dispatch(removeCardFromHand(row.id))}
              >
                <ButtonIcon as={X} className="h-4.5 w-4.5 text-icon" />
              </Button>
            </HStack>
            {row.choicePending && (
              <Pressable
                testID={`choice-needed-${row.id}`}
                accessibilityRole="button"
                onPress={() => dispatch(cardRevealRequested(row.id))}
                className="min-h-11 justify-center pr-13.5 pl-5"
              >
                <Text
                  size="sm"
                  className="font-body-semibold text-warning-foreground"
                >
                  Choice needed: choose on the cards screen ›
                </Text>
              </Pressable>
            )}
            <CardFigures row={row} />
          </VStack>
        ))}
      </ScrollView>

      <Divider />
      <VStack className="gap-1 px-5 pt-3.5 pb-4">
        <HStack className="items-baseline justify-between">
          <Text
            testID="breakdown-sum"
            className="text-subtle-foreground"
            style={TABULAR_NUMBERS}
          >
            {sum ?? NO_VALUE}
          </Text>
          <Text
            testID="breakdown-total"
            className="font-heading text-4xl text-primary"
          >
            {score}
          </Text>
        </HStack>
        <Text
          testID="breakdown-blanked"
          size="xs"
          className="text-muted-foreground"
        >
          Blanked cards: {blanked}
        </Text>
      </VStack>
    </Screen>
  );
}
