import { View } from "react-native";
import type { Suit } from "../../../domain/card";
import { SUITS } from "./theme";

export function SuitDot({
  suit,
  size = "md",
}: {
  suit: Suit;
  // Small for the dot inside a card chip.
  size?: "sm" | "md";
}) {
  return (
    <View
      // The ring keeps the dark suit colours, especially Army's black, visible on the dark theme.
      className={`${size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5"} rounded-full border border-suit-dot-ring ${SUITS[suit].colorClass}`}
    />
  );
}
