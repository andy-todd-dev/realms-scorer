import Camera from "lucide-react-native/icons/camera";
import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import type { LucideProps } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import {
  addCardToHand,
  clearHand,
  removeCardFromHand,
} from "../state/hand-slice";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import { cardRevealed, choiceSheetOpened } from "../state/navigation-slice";
import {
  CardSection,
  CardTile as CardTileData,
  selectCardSections,
  selectCardsStatus,
  selectCardToReveal,
  selectHandProgress,
} from "../state/selectors";
import { ChoiceSheet } from "./ChoiceSheet";
import { Box } from "./gluestack/box";
import { Button, ButtonIcon, ButtonText } from "./gluestack/button";
import { Heading } from "./gluestack/heading";
import { HStack } from "./gluestack/hstack";
import { Icon } from "./gluestack/icon";
import { Pressable } from "./gluestack/pressable";
import { Text } from "./gluestack/text";
import { VStack } from "./gluestack/vstack";
import { Screen } from "./Screen";
import { ScoreBar } from "./ScoreBar";
import { SuitDot } from "./SuitDot";
import { SUITS } from "./theme";
import { useHideOnScroll } from "./useHideOnScroll";

// Gluestack's Icon doesn't type strokeWidth, so this heavier weight from the design is set here.
const HeavyCheck = (props: LucideProps) => <Check {...props} strokeWidth={3} />;

type HostView = React.ComponentRef<typeof View>;

// The score bar draws behind the bottom inset itself, so its background reaches the screen edge.
const EDGES_ABOVE_SCORE_BAR = ["top", "left", "right"] as const;

export function HomeScreen() {
  const { headerHeight, headerStyle, onHeaderLayout, onScroll } =
    useHideOnScroll();

  return (
    <Screen edges={EDGES_ABOVE_SCORE_BAR}>
      {/* Clips the header as it slides away, so it doesn't show over the status bar. */}
      <View className="flex-1 overflow-hidden">
        <Grid headerHeight={headerHeight} onScroll={onScroll} />
        {/* box-none so the grid can still be scrolled from where the header was. */}
        <View pointerEvents="box-none" className="absolute inset-x-0 top-0">
          <Animated.View style={headerStyle} onLayout={onHeaderLayout}>
            <Header />
          </Animated.View>
        </View>
      </View>
      <ScoreBar />
      <ChoiceSheet />
    </Screen>
  );
}

function Header() {
  const dispatch = useAppDispatch();
  const { isEmpty } = useAppSelector(selectHandProgress);

  return (
    <HStack className="items-center gap-2 bg-background px-4 pt-4 pb-2">
      <Heading size="xl" accessibilityRole="header" className="flex-1">
        Realms Scorer
      </Heading>
      <Button
        testID="clear-hand"
        variant="ghost"
        size="sm"
        isDisabled={isEmpty}
        onPress={() => dispatch(clearHand())}
      >
        <ButtonIcon as={RotateCcw} className="h-4 w-4 text-subtle-foreground" />
        <ButtonText className="text-subtle-foreground">Clear</ButtonText>
      </Button>
      <Button testID="scan-hand" size="sm" isDisabled className="px-4">
        <ButtonIcon as={Camera} className="h-4.5 w-4.5" />
        <ButtonText className="font-body-semibold">Scan</ButtonText>
      </Button>
    </HStack>
  );
}

function Grid({
  headerHeight,
  onScroll,
}: {
  headerHeight: number;
  onScroll: ReturnType<typeof useHideOnScroll>["onScroll"];
}) {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectCardsStatus);
  const sections = useAppSelector(selectCardSections);
  const cardToReveal = useAppSelector(selectCardToReveal);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const contentRef = useRef<HostView>(null);
  const tileRefs = useRef(new Map<string, HostView>());

  // Scrolls a requested card to just below where the header sits, so it shows whether or not the header does.
  useEffect(() => {
    if (cardToReveal === null) {
      return;
    }

    const tile = tileRefs.current.get(cardToReveal);
    const content = contentRef.current;

    if (tile && content) {
      tile.measureLayout(content, (_, y) =>
        scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true }),
      );
    }

    dispatch(cardRevealed());
  }, [cardToReveal, dispatch]);

  const registerTile = (cardId: string, view: HostView | null) => {
    if (view) {
      tileRefs.current.set(cardId, view);
    } else {
      tileRefs.current.delete(cardId);
    }
  };

  if (status === "failed") {
    return (
      <View style={{ paddingTop: headerHeight }}>
        <Text size="sm" className="p-5 text-muted-foreground">
          Could not load cards.
        </Text>
      </View>
    );
  }

  if (status !== "loaded") {
    return (
      <View style={{ paddingTop: headerHeight }}>
        <Text size="sm" className="p-5 text-muted-foreground">
          Loading cards...
        </Text>
      </View>
    );
  }

  return (
    <Animated.ScrollView
      ref={scrollRef}
      testID="card-grid"
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {/* Leaves room for the header, which sits over the grid so that hiding it needs no layout pass. */}
      <View style={{ height: headerHeight }} />
      <View ref={contentRef} className="gap-3 px-4 pt-1 pb-4">
        {sections.map((section) => (
          <Section
            key={section.suit}
            section={section}
            registerTile={registerTile}
          />
        ))}
      </View>
    </Animated.ScrollView>
  );
}

function Section({
  section: { suit, cards },
  registerTile,
}: {
  section: CardSection;
  registerTile: (cardId: string, view: HostView | null) => void;
}) {
  return (
    <VStack className="gap-1.5">
      <HStack className="items-center gap-2">
        <SuitDot suit={suit} />
        <Text
          accessibilityRole="header"
          size="xs"
          className="font-body-semibold tracking-widest text-subtle-foreground uppercase"
        >
          {SUITS[suit].label}
        </Text>
      </HStack>
      {/* Padding rather than gap, so that three tiles fill each row exactly, and a short row keeps its widths. */}
      <Box className="-m-[3px] flex-row flex-wrap">
        {cards.map((card) => (
          <View
            key={card.id}
            ref={(view) => registerTile(card.id, view)}
            className="w-1/3 p-[3px]"
          >
            <CardTile card={card} />
          </View>
        ))}
      </Box>
    </VStack>
  );
}

function CardTile({ card }: { card: CardTileData }) {
  const dispatch = useAppDispatch();
  const { id, name, selected, choice } = card;

  return (
    <VStack>
      <Pressable
        testID={`card-tile-${id}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        onPress={() =>
          dispatch(selected ? removeCardFromHand(id) : addCardToHand(id))
        }
        className={
          choice
            ? "min-h-12 justify-center rounded-t-lg border-[1.5px] border-primary bg-accent px-2 py-1.5"
            : selected
              ? "min-h-12 justify-center rounded-lg border-[1.5px] border-primary bg-accent px-2 py-1.5"
              : "min-h-12 justify-center rounded-lg border-[1.5px] border-border bg-muted px-2 py-1.5"
        }
      >
        <Text size="sm" className="pr-3.5 font-body-medium leading-tight">
          {name}
        </Text>
        {selected && (
          <Box className="absolute top-1.5 right-1.5">
            <Icon as={HeavyCheck} className="h-3.5 w-3.5 text-primary" />
          </Box>
        )}
      </Pressable>
      {choice && (
        <ChoiceStrip
          cardId={id}
          choice={choice}
          onPress={() => dispatch(choiceSheetOpened(id))}
        />
      )}
    </VStack>
  );
}

// A separate button under a selected tile, for a card that needs a choice: orange while pending, gold once made.
function ChoiceStrip({
  cardId,
  choice: { pending, text, accessibilityLabel },
  onPress,
}: {
  cardId: string;
  choice: NonNullable<CardTileData["choice"]>;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={`choice-strip-${cardId}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={
        pending
          ? "min-h-11 flex-row items-center gap-1 rounded-b-lg border-[1.5px] border-t-0 border-warning bg-warning-muted py-1 pr-1.5 pl-2"
          : "min-h-11 flex-row items-center gap-1 rounded-b-lg border-[1.5px] border-t-0 border-primary bg-accent py-1 pr-1.5 pl-2"
      }
    >
      <Text
        size="xs"
        className={
          pending
            ? "flex-1 font-body-semibold leading-tight text-warning-foreground"
            : "flex-1 font-body-semibold leading-tight text-accent-foreground"
        }
      >
        {text}
      </Text>
      <Icon
        as={ChevronRight}
        className={
          pending
            ? "h-3.5 w-3.5 text-warning-foreground"
            : "h-3.5 w-3.5 text-accent-foreground"
        }
      />
    </Pressable>
  );
}
