import { Box } from "./gluestack/box";
import { Text } from "./gluestack/text";

// The outlined label after a breakdown row's name, for a card that is blanked or still needs a choice.
export function RowBadge({
  testID,
  kind,
}: {
  testID?: string;
  kind: "blanked" | "choiceNeeded";
}) {
  return kind === "blanked" ? (
    <Box className="rounded-full border border-border-strong px-2">
      <Text
        testID={testID}
        size="xs"
        className="font-body-semibold tracking-widest text-subtle-foreground uppercase"
      >
        Blanked
      </Text>
    </Box>
  ) : (
    <Box className="rounded-full border border-warning px-2">
      <Text
        testID={testID}
        size="xs"
        className="font-body-semibold tracking-widest text-warning-foreground uppercase"
      >
        Choice needed
      </Text>
    </Box>
  );
}
