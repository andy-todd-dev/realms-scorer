import { CardMatch, RecogniseHandPorts } from "./recognise-hand.ports";

// The cards found in a photo of a hand, for the player to check, and how many the hand holds.
export type ScanResult = {
  readonly matches: readonly CardMatch[];
  readonly handSize: number;
};

export interface RecogniseHand {
  execute(imageUri: string): Promise<ScanResult>;
}

/*
  Finds the cards in a photo of the hand. Unlike the other use cases it returns what it found rather than saving it,
  as the result is only for the player to check, and is kept by the UI until they do.
*/
export class RecogniseHandUseCase implements RecogniseHand {
  private readonly ports: RecogniseHandPorts;

  constructor({
    variant,
    cardCatalog,
    cardRecognizer,
    variantCatalog,
  }: RecogniseHandPorts) {
    this.ports = { variant, cardCatalog, cardRecognizer, variantCatalog };
  }

  // Looks for the current variant's cards in the photo. A photo shows only the cards the player holds, so it never finds more than the hand size.
  async execute(imageUri: string): Promise<ScanResult> {
    const { variant, cardCatalog, cardRecognizer, variantCatalog } = this.ports;
    const { deckId, handSize } = await variantCatalog.getById(variant.get());
    const cards = await cardCatalog.getAll(deckId);
    const matches = await cardRecognizer.recognise(
      imageUri,
      cards.map(({ id, name }) => ({ id, name })),
      handSize,
    );

    return { matches: matches.slice(0, handSize), handSize };
  }
}
