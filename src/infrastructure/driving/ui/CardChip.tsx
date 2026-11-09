import type { Suit } from "../../../domain/card";
import { HStack } from "./gluestack/hstack";
import { Pressable } from "./gluestack/pressable";
import { Text } from "./gluestack/text";
import { SuitDot } from "./SuitDot";

// Takes the visible pill, about 26pt tall, to a 44pt touch target.
const HIT_SLOP = { top: 9, bottom: 9, left: 4, right: 4 };

/*
  A card shown as a small pill, as cards look elsewhere in the app. "chose" is the card a row's own choice picked, in
  gold; "target" is a card that acted on the row, in grey. Given onPress, it goes to that card's row.
*/
export function CardChip({
  testID,
  name,
  suit,
  variant,
  accessibilityLabel,
  onPress,
}: {
  testID?: string;
  name: string;
  suit: Suit;
  variant: "chose" | "target";
  accessibilityLabel: string;
  onPress?: () => void;
}) {
  const className =
    variant === "chose"
      ? "flex-row items-center gap-1.5 rounded-full border-[1.5px] border-primary bg-chip py-0.5 pr-2.5 pl-2"
      : "flex-row items-center gap-1.5 rounded-full border-[1.5px] border-border-strong bg-chip py-0.5 pr-2.5 pl-2";
  const content = (
    <>
      <SuitDot suit={suit} size="sm" />
      <Text size="sm" className="font-body-semibold text-foreground">
        {name}
      </Text>
    </>
  );

  return onPress ? (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      hitSlop={HIT_SLOP}
      onPress={onPress}
      className={className}
    >
      {content}
    </Pressable>
  ) : (
    <HStack
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel}
      className={className}
    >
      {content}
    </HStack>
  );
}
