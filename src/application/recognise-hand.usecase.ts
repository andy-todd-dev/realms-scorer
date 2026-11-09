import { VariantId } from "../domain/variant";
import { CardMatch, RecogniseHandPorts } from "./recognise-hand.ports";

// The cards found in a photo of a hand, for the player to check, and how many the hand holds.
export type ScanResult = {
  readonly matches: readonly CardMatch[];
  readonly handSize: number;
};

export interface RecogniseHand {
  execute(variantId: VariantId, imageUri: string): Promise<ScanResult>;
}

export class RecogniseHandUseCase implements RecogniseHand {
  private readonly ports: RecogniseHandPorts;

  constructor({
    cardCatalog,
    cardRecognizer,
    variantCatalog,
  }: RecogniseHandPorts) {
    this.ports = { cardCatalog, cardRecognizer, variantCatalog };
  }

  // Looks for the variant's cards in the photo. A photo shows only the cards the player holds, so it never finds more than the hand size.
  async execute(variantId: VariantId, imageUri: string): Promise<ScanResult> {
    const { deckId, handSize } =
      await this.ports.variantCatalog.getById(variantId);
    const cards = await this.ports.cardCatalog.getAll(deckId);
    const matches = await this.ports.cardRecognizer.recognise(
      imageUri,
      cards.map(({ id, name }) => ({ id, name })),
      handSize,
    );

    return { matches: matches.slice(0, handSize), handSize };
  }
}
