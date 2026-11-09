import { styled } from "nativewind";
import { useEffect } from "react";
import { ActivityIndicator, BackHandler, View } from "react-native";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import { scanSheetOpened } from "../state/navigation-slice";
import { scanDismissed } from "../state/scan-slice";
import { selectScanProgress } from "../state/selectors";
import { Button, ButtonText } from "./gluestack/button";
import { Heading } from "./gluestack/heading";
import { Text } from "./gluestack/text";
import { VStack } from "./gluestack/vstack";

// ActivityIndicator takes its colour as a prop, so NativeWind is told to pass the text colour class through as one.
const Spinner = styled(ActivityIndicator, {
  className: { target: false, nativeStyleMapping: { color: true } },
});

// Covers the home screen while a photo is read, and explains when reading it failed.
export function ScanProgress() {
  const dispatch = useAppDispatch();
  const progress = useAppSelector(selectScanProgress);
  const failed = progress !== null && !progress.reading;

  // Back leaves a failed scan for the cards. While reading, it does nothing, as the result is on its way.
  useEffect(() => {
    if (progress === null) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (failed) {
          dispatch(scanDismissed());
        }
        return true;
      },
    );

    return () => subscription.remove();
  }, [dispatch, progress, failed]);

  if (progress === null) {
    return null;
  }

  return (
    <View
      testID="scan-progress"
      className="absolute inset-0 items-center justify-center bg-camera px-8"
    >
      {progress.reading ? (
        <VStack className="items-center gap-4">
          <Spinner size="large" className="text-primary" />
          <Text testID="scan-reading" className="text-subtle-foreground">
            Reading your cards…
          </Text>
        </VStack>
      ) : (
        <VStack className="w-full items-stretch gap-3">
          <Heading
            testID="scan-failure-title"
            size="xl"
            accessibilityRole="header"
            className="text-center"
          >
            {progress.title}
          </Heading>
          <Text className="mb-3 text-center text-subtle-foreground">
            {progress.detail}
          </Text>
          <Button
            testID="scan-try-again"
            size="lg"
            onPress={() => {
              dispatch(scanDismissed());
              dispatch(scanSheetOpened());
            }}
          >
            <ButtonText>Try again</ButtonText>
          </Button>
          <Button
            testID="scan-pick-by-hand"
            variant="ghost"
            size="lg"
            onPress={() => dispatch(scanDismissed())}
          >
            <ButtonText>Pick cards by hand</ButtonText>
          </Button>
        </VStack>
      )}
    </View>
  );
}
