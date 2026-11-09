import { recognizeText } from "@infinitered/react-native-mlkit-text-recognition";
import { CardMatch, matchNames, NamedCard } from "./match-names";

// Reads the text in a photo with Google ML Kit, on the device, and matches card titles in it to the given cards.
export class MlKitCardRecognizer {
  async recognise(
    imageUri: string,
    cards: readonly NamedCard[],
    maxCards: number,
  ): Promise<CardMatch[]> {
    const { blocks } = await recognizeText(imageUri);

    return matchNames(blocks, cards, maxCards);
  }
}
