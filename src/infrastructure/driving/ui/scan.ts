import type { ScanResult } from "../../../application/recognise-hand.usecase";

/*
  How far scanning a hand has got: reading a photo, waiting for the player to check what it found, or failed. UI-only
  state, like navigation: the application only recognises the cards and replaces the hand.
*/

// Why a scan didn't get to the check screen.
export type ScanFailure = "unreadable" | "noCards" | "cameraDenied";

export type Scan =
  | { readonly status: "idle" }
  | { readonly status: "recognising" }
  | { readonly status: "review"; readonly result: ScanResult }
  | { readonly status: "failed"; readonly failure: ScanFailure };

export const NO_SCAN: Scan = { status: "idle" };

const SCAN_FAILURES = {
  unreadable: {
    title: "Couldn't read the photo",
    detail: "Try again, or pick your cards by hand.",
  },
  noCards: {
    title: "Couldn't find any cards",
    detail:
      "Lay the cards flat with their names showing, and take the photo from above.",
  },
  cameraDenied: {
    title: "The camera isn't allowed",
    detail:
      "Allow Realms Scorer to use the camera in your phone's settings, or choose a saved photo.",
  },
} as const;

// What to show over the home screen while a photo is read, or when reading it failed. Null otherwise.
export function scanProgress(scan: Scan) {
  return scan.status === "recognising"
    ? { reading: true as const }
    : scan.status === "failed"
      ? { reading: false as const, ...SCAN_FAILURES[scan.failure] }
      : null;
}
