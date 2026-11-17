import constate from "constate";
import { useCallback, useRef, useState } from "react";
import { NO_SCAN, Scan, ScanFailure } from "./scan";
import { useUseCases } from "./UseCasesProvider";

/*
  The scan in progress, and what moves it on. A photo's result only counts while its scan is the latest: one that
  finishes after the player has left, or started another, is dropped.
*/
export const [ScanProvider, useScan] = constate(function useScanState() {
  const { recogniseHand } = useUseCases();
  const [scan, setScan] = useState<Scan>(NO_SCAN);
  // Counts each change of scan, so a photo can tell whether its scan is still the latest.
  const latest = useRef(0);

  const scanPhoto = useCallback(
    async (imageUri: string) => {
      const request = ++latest.current;
      setScan({ status: "recognising" });

      const next = await recogniseHand.execute(imageUri).then(
        (result): Scan =>
          result.matches.length === 0
            ? { status: "failed", failure: "noCards" }
            : { status: "review", result },
        (): Scan => ({ status: "failed", failure: "unreadable" }),
      );

      if (latest.current === request) {
        setScan(next);
      }
    },
    [recogniseHand],
  );

  // There's no photo to scan: the player refused the camera, or the photo couldn't be taken or opened.
  const fail = useCallback((failure: ScanFailure) => {
    latest.current++;
    setScan({ status: "failed", failure });
  }, []);

  // Back to the cards, whatever the scan had got to, without changing the hand.
  const dismiss = useCallback(() => {
    latest.current++;
    setScan(NO_SCAN);
  }, []);

  return { scan, scanPhoto, fail, dismiss };
});
