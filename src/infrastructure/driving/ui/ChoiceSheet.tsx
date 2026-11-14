import Check from "lucide-react-native/icons/check";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import type { CardId, Suit } from "../../../domain/card";
import X from "lucide-react-native/icons/x";
import type { LucideProps } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { chooseCard } from "../state/hand-slice";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import {
  choiceSheetCardPicked,
  choiceSheetCardUnpicked,
  choiceSheetClosed,
} from "./navigation";
import { useNavigation } from "./NavigationProvider";
import {
  ChoiceOption,
  ChoiceOptionGroup,
  ChoiceSheet as ChoiceSheetData,
  ChoiceSuitStep,
  selectChoiceSheet,
} from "../state/selectors";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from "./gluestack/actionsheet";
import {
  choiceInstruction,
  noChoiceText,
  suitInstruction,
  suitStepTitle,
} from "./choice-wording";
import { Box } from "./gluestack/box";
import { Button, ButtonIcon } from "./gluestack/button";
import { Heading } from "./gluestack/heading";
import { HStack } from "./gluestack/hstack";
import { Icon } from "./gluestack/icon";
import { Pressable } from "./gluestack/pressable";
import { Text } from "./gluestack/text";
import { VStack } from "./gluestack/vstack";
import { SuitDot } from "./SuitDot";
import { SUITS } from "./theme";

// Gluestack's Icon doesn't type strokeWidth, so this heavier weight from the design is set here.
const HeavyCheck = (props: LucideProps) => <Check {...props} strokeWidth={3} />;

// Space below the list, on top of the bottom inset.
const BOTTOM_PADDING = 28;

/*
  Lists the cards that the card the sheet was opened for may choose. Nothing is preselected; the current choice, if any,
  has a tick. For a choice that includes a suit, picking a card then lists the suits it may be given.
*/
export function ChoiceSheet() {
  const {
    navigation: { choiceSheetFor, choiceSheetPickedCard },
    navigate,
  } = useNavigation();
  const sheet = useAppSelector((state) =>
    selectChoiceSheet(state, choiceSheetFor, choiceSheetPickedCard),
  );
  const { bottom } = useSafeAreaInsets();
  const close = () => navigate(choiceSheetClosed());

  return (
    <Actionsheet isOpen={sheet !== null} onClose={close}>
      <ActionsheetBackdrop />
      <ActionsheetContent
        testID="choice-sheet"
        className="items-stretch rounded-t-3xl border-t-0 bg-popover px-0 pt-2"
        style={{ paddingBottom: bottom + BOTTOM_PADDING }}
      >
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator className="h-1 w-9 bg-border-strong" />
        </ActionsheetDragIndicatorWrapper>
        {sheet && <SheetBody sheet={sheet} onClose={close} />}
      </ActionsheetContent>
    </Actionsheet>
  );
}

function SheetBody({
  sheet: { chooserId, title, from, targets, groups, choosesSuit, suitStep },
  onClose,
}: {
  sheet: ChoiceSheetData;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const { navigate } = useNavigation();
  // Closes the sheet once the choice is made. A rejected choice leaves it open, still pending.
  const choose = async (targetId: CardId, suit?: Suit) => {
    try {
      await dispatch(chooseCard({ chooserId, targetId, suit })).unwrap();
      navigate(choiceSheetClosed());
    } catch {}
  };

  return (
    <>
      <HStack
        className={
          suitStep
            ? "items-center gap-1 pt-2 pr-2 pl-1"
            : "items-center gap-1 pt-2 pr-2 pl-4"
        }
      >
        {suitStep && (
          <Button
            testID="choice-sheet-back"
            accessibilityLabel="Back to cards"
            variant="ghost"
            size="icon"
            onPress={() => navigate(choiceSheetCardUnpicked())}
          >
            <ButtonIcon as={ChevronLeft} className="h-5 w-5 text-foreground" />
          </Button>
        )}
        <Heading
          testID="choice-sheet-title"
          size="lg"
          accessibilityRole="header"
          className="flex-1"
        >
          {suitStep ? suitStepTitle(suitStep.cardName) : title}
        </Heading>
        <Button
          testID="close-choice-sheet"
          accessibilityLabel="Close"
          variant="ghost"
          size="icon"
          onPress={onClose}
        >
          <ButtonIcon as={X} className="h-5 w-5 text-subtle-foreground" />
        </Button>
      </HStack>
      <Text
        testID="choice-sheet-instruction"
        size="sm"
        className="mr-5 mb-3 ml-4 text-muted-foreground"
      >
        {suitStep
          ? suitInstruction(suitStep.cardName)
          : choiceInstruction(targets, from)}
      </Text>
      {suitStep ? (
        <ActionsheetScrollView contentContainerClassName="gap-1 px-4">
          <SuitOptions
            step={suitStep}
            onChoose={(suit) => choose(suitStep.cardId, suit)}
          />
        </ActionsheetScrollView>
      ) : groups.length === 0 ? (
        <Box className="mx-4 rounded-xl border border-dashed border-input p-4">
          <Text size="sm" className="text-muted-foreground">
            {noChoiceText(targets, from)}
          </Text>
        </Box>
      ) : (
        <ActionsheetScrollView contentContainerClassName="gap-3.5 px-4">
          {groups.map((group) => (
            <OptionGroup
              key={group.suit ?? "hand"}
              group={group}
              onChoose={(targetId) =>
                choosesSuit
                  ? navigate(choiceSheetCardPicked(targetId))
                  : choose(targetId)
              }
            />
          ))}
        </ActionsheetScrollView>
      )}
    </>
  );
}

// A suit's options, under the suit's heading, or the options from the hand, which need no heading.
function OptionGroup({
  group: { suit, options },
  onChoose,
}: {
  group: ChoiceOptionGroup;
  onChoose: (targetId: string) => void;
}) {
  return (
    <VStack className="gap-1">
      {suit && (
        <HStack className="items-center gap-2 pb-0.5">
          <SuitDot suit={suit} />
          <Text
            accessibilityRole="header"
            size="xs"
            className="font-body-semibold tracking-widest text-subtle-foreground uppercase"
          >
            {SUITS[suit].label}
          </Text>
        </HStack>
      )}
      {options.map((option) => (
        <OptionRow
          key={option.id}
          option={option}
          showSuit={suit === null}
          onPress={() => onChoose(option.id)}
        />
      ))}
    </VStack>
  );
}

function OptionRow({
  option: { id, name, suit, current },
  showSuit,
  onPress,
}: {
  option: ChoiceOption;
  // Options under a suit heading leave the suit out, as the heading already says it.
  showSuit: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={`choice-option-${id}`}
      accessibilityRole="button"
      accessibilityState={{ selected: current }}
      onPress={onPress}
      className={
        current
          ? "min-h-12 flex-row items-center gap-2.5 rounded-xl border-[1.5px] border-primary bg-accent px-3"
          : "min-h-12 flex-row items-center gap-2.5 rounded-xl border-[1.5px] border-border bg-muted px-3"
      }
    >
      <SuitDot suit={suit} />
      <Text className="flex-1 font-body-medium">{name}</Text>
      {showSuit && (
        <Text size="xs" className="text-muted-foreground">
          {SUITS[suit].label}
        </Text>
      )}
      {current && <Icon as={HeavyCheck} className="h-4 w-4 text-primary" />}
    </Pressable>
  );
}

// The suits the picked card may be given, with a tick on the current choice, if any.
function SuitOptions({
  step: { options },
  onChoose,
}: {
  step: ChoiceSuitStep;
  onChoose: (suit: Suit) => void;
}) {
  return (
    <>
      {options.map(({ suit, current }) => (
        <Pressable
          key={suit}
          testID={`choice-suit-${suit}`}
          accessibilityRole="button"
          accessibilityState={{ selected: current }}
          onPress={() => onChoose(suit)}
          className={
            current
              ? "min-h-12 flex-row items-center gap-2.5 rounded-xl border-[1.5px] border-primary bg-accent px-3"
              : "min-h-12 flex-row items-center gap-2.5 rounded-xl border-[1.5px] border-border bg-muted px-3"
          }
        >
          <SuitDot suit={suit} />
          <Text className="flex-1 font-body-medium">{SUITS[suit].label}</Text>
          {current && <Icon as={HeavyCheck} className="h-4 w-4 text-primary" />}
        </Pressable>
      ))}
    </>
  );
}
