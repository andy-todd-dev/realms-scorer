import { act, screen, waitFor } from "@testing-library/react-native";
import type { ScanResult } from "../../../../application/recognise-hand.usecase";
import type { CardId } from "../../../../domain/card";
import { withIsland, handOf, sumStrengths } from "../testing/fixtures";
import { renderApp, expectScore } from "../testing/render-app";

// The camera and photo library are native. Each scanning test sets what they return.
const mockImagePicker = {
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
};
// The app imports the module before this file defines the fakes, so each is looked up when called.
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: () =>
    mockImagePicker.requestCameraPermissionsAsync(),
  launchCameraAsync: () => mockImagePicker.launchCameraAsync(),
  launchImageLibraryAsync: () => mockImagePicker.launchImageLibraryAsync(),
}));

describe("scanning a hand", () => {
  const sure = (cardId: CardId) => ({ candidates: [cardId], confident: true });
  const scanOf = (...matches: ScanResult["matches"]): ScanResult => ({
    matches,
    handSize: 7,
  });
  const photo = (uri: string) => ({ canceled: false, assets: [{ uri }] });

  beforeEach(() => {
    Object.values(mockImagePicker).forEach((mock) => mock.mockReset());
    mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: true,
    });
    mockImagePicker.launchCameraAsync.mockResolvedValue(
      photo("file:///camera.jpg"),
    );
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue(
      photo("file:///saved.jpg"),
    );
  });

  // Opens the sheet from the Scan button and picks a saved photo.
  const scanSavedPhoto = async (press: (testID: string) => Promise<void>) => {
    await press("scan-hand");
    await screen.findByTestId("scan-choose-photo");
    await press("scan-choose-photo");
  };

  it("offers to take a photo or choose a saved one", async () => {
    const { press } = await renderApp();

    await press("scan-hand");

    expect(await screen.findByTestId("scan-take-photo")).toBeOnTheScreen();
    expect(screen.getByTestId("scan-choose-photo")).toBeOnTheScreen();
  });

  it("reads a saved photo, showing progress, then lists the cards found", async () => {
    let respond: (result: ScanResult) => void = () => {};
    const recogniseHand = jest.fn(
      () => new Promise<ScanResult>((resolve) => (respond = resolve)),
    );
    const { press } = await renderApp({ recogniseHand });

    await scanSavedPhoto(press);

    expect(await screen.findByTestId("scan-reading")).toBeOnTheScreen();
    expect(recogniseHand).toHaveBeenCalledWith("file:///saved.jpg");

    await act(async () => respond(scanOf(sure("king"), sure("queen"))));

    expect(await screen.findByTestId("scan-review")).toBeOnTheScreen();
    expect(screen.queryByTestId("scan-progress")).toBeNull();
    expect(screen.getByTestId("scan-matched-king")).toHaveTextContent(
      "KingLeader",
    );
    expect(screen.getByTestId("scan-matched-queen")).toBeOnTheScreen();
    expect(screen.getByTestId("scan-summary")).toHaveTextContent(
      "We found 2 of 7 cards. Check them, then add them to your hand.",
    );
    expect(screen.getByTestId("scan-count-warning")).toHaveTextContent(
      "Add the missing 5 cards on the cards screen.",
    );
    expect(screen.queryByTestId("scan-replace-warning")).toBeNull();
  });

  it("takes a photo with the camera", async () => {
    const recogniseHand = jest.fn(async () => scanOf(sure("king")));
    const { press } = await renderApp({ recogniseHand });

    await press("scan-hand");
    await press(
      (await screen.findByTestId("scan-take-photo")).props.testID as string,
    );

    expect(await screen.findByTestId("scan-review")).toBeOnTheScreen();
    expect(recogniseHand).toHaveBeenCalledWith("file:///camera.jpg");
  });

  it("changes nothing when the photo is cancelled", async () => {
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: true,
      assets: null,
    });
    const recogniseHand = jest.fn(async () => scanOf(sure("king")));
    const { press } = await renderApp({ recogniseHand });

    await scanSavedPhoto(press);

    await waitFor(() =>
      expect(screen.queryByTestId("scan-take-photo")).toBeNull(),
    );
    expect(recogniseHand).not.toHaveBeenCalled();
    expect(screen.queryByTestId("scan-progress")).toBeNull();
  });

  it("replaces the hand with the cards found, leaving choices pending, and rescores", async () => {
    const scoreHand = jest.fn(sumStrengths);
    const { press, tapCard } = await renderApp({
      scoreHand,
      loadCards: async () => withIsland,
      recogniseHand: async () => scanOf(sure("island"), sure("swamp")),
    });

    await tapCard("king");
    await scanSavedPhoto(press);

    expect(await screen.findByTestId("scan-replace-warning")).toHaveTextContent(
      "This replaces the 1 card in your hand.",
    );

    await press("scan-confirm");

    expect(await screen.findByTestId("card-grid")).toBeOnTheScreen();
    expect(screen.queryByTestId("scan-review")).toBeNull();
    expect(screen.getByTestId("card-tile-island")).toBeChecked();
    expect(screen.getByTestId("card-tile-swamp")).toBeChecked();
    expect(screen.getByTestId("card-tile-king")).not.toBeChecked();
    expect(screen.getByTestId("choice-strip-island")).toHaveTextContent(
      "Choose…",
    );
    await waitFor(() =>
      expect(scoreHand).toHaveBeenLastCalledWith(handOf("island", "swamp")),
    );
    await expectScore("32");
  });

  it("offers the likeliest cards for one it isn't sure of, best first, and adds the one picked", async () => {
    const { press } = await renderApp({
      recogniseHand: async () =>
        scanOf(sure("knights"), {
          candidates: ["queen", "king"],
          confident: false,
        }),
    });

    await scanSavedPhoto(press);

    expect(await screen.findByTestId("scan-summary")).toHaveTextContent(
      /Confirm the one we weren't sure about/,
    );
    expect(screen.getByTestId("scan-option-1-queen")).toBeChecked();
    expect(screen.getByTestId("scan-option-1-king")).not.toBeChecked();

    await press("scan-option-1-king");

    expect(screen.getByTestId("scan-option-1-king")).toBeChecked();
    expect(screen.getByTestId("scan-option-1-queen")).not.toBeChecked();

    await press("scan-confirm");

    expect(await screen.findByTestId("card-grid")).toBeOnTheScreen();
    expect(screen.getByTestId("card-tile-king")).toBeChecked();
    expect(screen.getByTestId("card-tile-queen")).not.toBeChecked();
    expect(screen.getByTestId("card-tile-knights")).toBeChecked();
  });

  it("leaves out a card that is none of those offered, for picking by hand", async () => {
    const { press } = await renderApp({
      recogniseHand: async () =>
        scanOf(sure("knights"), {
          candidates: ["queen", "king"],
          confident: false,
        }),
    });

    await scanSavedPhoto(press);
    await press(
      (await screen.findByTestId("scan-none-1")).props.testID as string,
    );

    expect(await screen.findByTestId("card-grid")).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.getByTestId("card-tile-knights")).toBeChecked(),
    );
    expect(screen.getByTestId("card-tile-queen")).not.toBeChecked();
    expect(screen.getByTestId("card-tile-king")).not.toBeChecked();
  });

  it("keeps the check screen while the cards are added, and says when adding them fails", async () => {
    let fail: (error: Error) => void = () => {};
    const { press } = await renderApp({
      recogniseHand: async () => scanOf(sure("king")),
      replaceHand: () => new Promise((_, reject) => (fail = reject)),
    });

    await scanSavedPhoto(press);
    await press(
      (await screen.findByTestId("scan-confirm")).props.testID as string,
    );

    expect(screen.getByTestId("scan-confirm")).toBeDisabled();
    expect(screen.getByTestId("scan-confirm")).toHaveTextContent("Adding…");

    await act(async () => fail(new Error("no hand")));

    expect(await screen.findByTestId("scan-confirm-failed")).toBeOnTheScreen();
    expect(screen.getByTestId("scan-confirm")).toBeEnabled();
    expect(screen.getByTestId("scan-review")).toBeOnTheScreen();
  });

  it("goes back to retake the photo, leaving the hand as it was", async () => {
    const { press, tapCard } = await renderApp({
      recogniseHand: async () => scanOf(sure("queen")),
    });

    await tapCard("king");
    await scanSavedPhoto(press);
    await press(
      (await screen.findByTestId("scan-retake")).props.testID as string,
    );

    expect(await screen.findByTestId("scan-take-photo")).toBeOnTheScreen();
    expect(screen.queryByTestId("scan-review")).toBeNull();
    expect(screen.getByTestId("card-tile-king")).toBeChecked();
    expect(screen.getByTestId("card-tile-queen")).not.toBeChecked();
  });

  it("explains when the photo can't be read, and offers to try again", async () => {
    const { press } = await renderApp({
      recogniseHand: () => Promise.reject(new Error("unreadable")),
    });

    await scanSavedPhoto(press);

    expect(await screen.findByTestId("scan-failure-title")).toHaveTextContent(
      "Couldn't read the photo",
    );

    await press("scan-try-again");

    expect(await screen.findByTestId("scan-take-photo")).toBeOnTheScreen();
    expect(screen.queryByTestId("scan-progress")).toBeNull();
  });

  it("explains when no cards are found, and goes back to the cards", async () => {
    const { press } = await renderApp({
      recogniseHand: async () => scanOf(),
    });

    await scanSavedPhoto(press);

    expect(await screen.findByTestId("scan-failure-title")).toHaveTextContent(
      "Couldn't find any cards",
    );

    await press("scan-pick-by-hand");

    expect(screen.queryByTestId("scan-progress")).toBeNull();
    expect(screen.getByTestId("card-grid")).toBeOnTheScreen();
  });

  it("explains when the camera isn't allowed", async () => {
    mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: false,
    });
    const { press } = await renderApp();

    await press("scan-hand");
    await press(
      (await screen.findByTestId("scan-take-photo")).props.testID as string,
    );

    expect(await screen.findByTestId("scan-failure-title")).toHaveTextContent(
      "The camera isn't allowed",
    );
    expect(mockImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });
});
