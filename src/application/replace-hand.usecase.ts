import { CardId } from "../domain/card";
import { addCardToHand, emptyHand } from "../domain/hand";
import { withValidChoices } from "./hand-rules";
import { ReplaceHandPorts } from "./replace-hand.ports";

export interface ReplaceHand {
  execute(cardIds: readonly CardId[]): Promise<void>;
}

export class ReplaceHandUseCase implements ReplaceHand {
  private readonly ports: ReplaceHandPorts;

  constructor({
    hands,
    variant,
    handLock,
    rescore,
    cardCatalog,
    variantCatalog,
  }: ReplaceHandPorts) {
    this.ports = {
      hands,
      variant,
      handLock,
      rescore,
      cardCatalog,
      variantCatalog,
    };
  }

  /*
    Makes these cards the hand, as from a scan, and rescores it. The new hand has no choices, so any card that needs one
    is pending until the player makes it. Rejects more cards than the variant's hand size, or a card that isn't in its
    deck, leaving the hand as it was.
  */
  async execute(cardIds: readonly CardId[]): Promise<void> {
    const { hands, variant, handLock, rescore, variantCatalog } = this.ports;

    await handLock.runExclusive(async () => {
      const variantId = variant.get();
      const { handSize } = await variantCatalog.getById(variantId);
      const hand = cardIds.reduce(
        (current, cardId) => addCardToHand(current, cardId, handSize),
        emptyHand(),
      );

      hands.save(await withValidChoices(this.ports, variantId, hand));
    });
    await rescore.execute();
  }
}
