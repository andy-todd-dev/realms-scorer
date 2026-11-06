import Check from "lucide-react-native/icons/check";
import X from "lucide-react-native/icons/x";
import type { LucideProps } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { chooseCard } from "../state/hand-slice";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import { choiceSheetClosed } from "../state/navigation-slice";
import {
  ChoiceOption,
  ChoiceSheet as ChoiceSheetData,
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
import { choiceInstruction, noChoiceText } from "./choice-wording";
import { Box } from "./gluestack/box";
import { Button, ButtonIcon } from "./gluestack/button";
import { Heading } from "./gluestack/heading";
import { HStack } from "./gluestack/hstack";
import { Icon } from "./gluestack/icon";
import { Pressable } from "./gluestack/pressable";
import { Text } from "./gluestack/text";
import { SuitDot } from "./SuitDot";
import { SUITS } from "./theme";

// Gluestack's Icon doesn't type strokeWidth, so this heavier weight from the design is set here.
const HeavyCheck = (props: LucideProps) => <Check {...props} strokeWidth={3} />;

// Space below the list, on top of the bottom inset.
const BOTTOM_PADDING = 28;

// Lists the cards that the card the sheet was opened for may choose. Nothing is preselected; the current choice, if any, has a tick.
export function ChoiceSheet() {
  const dispatch = useAppDispatch();
  const sheet = useAppSelector(selectChoiceSheet);
  const { bottom } = useSafeAreaInsets();
  const close = () => dispatch(choiceSheetClosed());

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
  sheet: { chooserId, title, targets, options },
  onClose,
}: {
  sheet: ChoiceSheetData;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();

  return (
    <>
      <HStack className="items-center gap-1 pt-2 pr-2 pl-4">
        <Heading
          testID="choice-sheet-title"
          size="lg"
          accessibilityRole="header"
          className="flex-1"
        >
          {title}
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
        {choiceInstruction(targets)}
      </Text>
      {options.length === 0 ? (
        <Box className="mx-4 rounded-xl border border-dashed border-input p-4">
          <Text size="sm" className="text-muted-foreground">
            {noChoiceText(targets)}
          </Text>
        </Box>
      ) : (
        <ActionsheetScrollView contentContainerClassName="gap-1 px-4">
          {options.map((option) => (
            <OptionRow
              key={option.id}
              option={option}
              onPress={() =>
                dispatch(chooseCard({ chooserId, targetId: option.id }))
              }
            />
          ))}
        </ActionsheetScrollView>
      )}
    </>
  );
}

function OptionRow({
  option: { id, name, suit, current },
  onPress,
}: {
  option: ChoiceOption;
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
      <Text size="xs" className="text-muted-foreground">
        {SUITS[suit].label}
      </Text>
      {current && <Icon as={HeavyCheck} className="h-4 w-4 text-primary" />}
    </Pressable>
  );
}
