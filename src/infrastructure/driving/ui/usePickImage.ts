import * as ImagePicker from "expo-image-picker";
import { useCallback } from "react";
import { scanSheetClosed } from "./navigation";
import { useNavigation } from "./NavigationProvider";
import { useScan } from "./ScanProvider";

export type PhotoSource = "camera" | "library";

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 1,
};

/*
  Takes a photo, or lets the player pick a saved one, then scans it. Picking a photo is the player's input, like a tap,
  so it happens here rather than behind a port. Cancelling leaves everything as it was.
*/
export function usePickImage() {
  const { scanPhoto, fail } = useScan();
  const { navigate } = useNavigation();

  return useCallback(
    async (source: PhotoSource) => {
      navigate(scanSheetClosed());

      try {
        if (source === "camera") {
          const { granted } = await ImagePicker.requestCameraPermissionsAsync();

          if (!granted) {
            fail("cameraDenied");
            return;
          }
        }

        const result =
          source === "camera"
            ? await ImagePicker.launchCameraAsync(OPTIONS)
            : await ImagePicker.launchImageLibraryAsync(OPTIONS);
        const photo = result.canceled ? undefined : result.assets[0];

        if (photo) {
          await scanPhoto(photo.uri);
        }
      } catch {
        fail("unreadable");
      }
    },
    [fail, navigate, scanPhoto],
  );
}
