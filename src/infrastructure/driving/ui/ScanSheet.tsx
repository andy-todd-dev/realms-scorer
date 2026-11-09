import Camera from "lucide-react-native/icons/camera";
import Images from "lucide-react-native/icons/images";
import X from "lucide-react-native/icons/x";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import { scanSheetClosed } from "../state/navigation-slice";
import { selectScanSheetOpen } from "../state/selectors";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "./gluestack/actionsheet";
import { Button, ButtonIcon } from "./gluestack/button";
import { Heading } from "./gluestack/heading";
import { HStack } from "./gluestack/hstack";
import { Icon } from "./gluestack/icon";
import { Pressable } from "./gluestack/pressable";
import { Text } from "./gluestack/text";
import { VStack } from "./gluestack/vstack";
import { usePickImage } from "./usePickImage";

// Space below the options, on top of the bottom inset.
const BOTTOM_PADDING = 28;

// Asks whether to take a photo of the hand or use a saved one.
export function ScanSheet() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectScanSheetOpen);
  const pickImage = usePickImage();
  const { bottom } = useSafeAreaInsets();
  const close = () => dispatch(scanSheetClosed());

  return (
    <Actionsheet isOpen={isOpen} onClose={close}>
      <ActionsheetBackdrop />
      <ActionsheetContent
        testID="scan-sheet"
        className="items-stretch rounded-t-3xl border-t-0 bg-popover px-0 pt-2"
        style={{ paddingBottom: bottom + BOTTOM_PADDING }}
      >
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator className="h-1 w-9 bg-border-strong" />
        </ActionsheetDragIndicatorWrapper>
        <HStack className="items-center gap-1 pt-2 pr-2 pl-4">
          <Heading size="lg" accessibilityRole="header" className="flex-1">
            Scan your hand
          </Heading>
          <Button
            testID="close-scan-sheet"
            accessibilityLabel="Close"
            variant="ghost"
            size="icon"
            onPress={close}
          >
            <ButtonIcon as={X} className="h-5 w-5 text-subtle-foreground" />
          </Button>
        </HStack>
        <Text size="sm" className="mr-5 mb-3 ml-4 text-muted-foreground">
          Lay the cards flat with their names showing, and take one photo of
          them all.
        </Text>
        <VStack className="gap-1 px-4">
          <SourceOption
            testID="scan-take-photo"
            icon={Camera}
            label="Take photo"
            onPress={() => pickImage("camera")}
          />
          <SourceOption
            testID="scan-choose-photo"
            icon={Images}
            label="Choose from Photos"
            onPress={() => pickImage("library")}
          />
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}

function SourceOption({
  testID,
  icon,
  label,
  onPress,
}: {
  testID: string;
  icon: typeof Camera;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-12 flex-row items-center gap-3 rounded-xl border-[1.5px] border-border bg-muted px-3"
    >
      <Icon as={icon} className="h-5 w-5 text-primary" />
      <Text className="flex-1 font-body-medium">{label}</Text>
    </Pressable>
  );
}
