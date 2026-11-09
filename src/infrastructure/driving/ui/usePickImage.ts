import * as ImagePicker from "expo-image-picker";
import { useCallback } from "react";
import { useAppDispatch } from "../state/hooks";
import { scanSheetClosed } from "../state/navigation-slice";
import { scanFailed, scanHand } from "../state/scan-slice";

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
  const dispatch = useAppDispatch();

  return useCallback(
    async (source: PhotoSource) => {
      dispatch(scanSheetClosed());

      try {
        if (source === "camera") {
          const { granted } = await ImagePicker.requestCameraPermissionsAsync();

          if (!granted) {
            dispatch(scanFailed("cameraDenied"));
            return;
          }
        }

        const result =
          source === "camera"
            ? await ImagePicker.launchCameraAsync(OPTIONS)
            : await ImagePicker.launchImageLibraryAsync(OPTIONS);
        const photo = result.canceled ? undefined : result.assets[0];

        if (photo) {
          dispatch(scanHand(photo.uri));
        }
      } catch {
        dispatch(scanFailed("unreadable"));
      }
    },
    [dispatch],
  );
}
