import { CardId } from "../domain/card";
import { addCardToHand } from "../domain/hand";
import { AddCardToHandPorts } from "./add-card-to-hand.ports";
import { withValidChoices } from "./hand-rules";

export interface AddCardToHand {
  execute(cardId: CardId): Promise<void>;
}

export class AddCardToHandUseCase implements AddCardToHand {
  private readonly ports: AddCardToHandPorts;

  constructor({
    hands,
    variant,
    handLock,
    rescore,
    cardCatalog,
    variantCatalog,
  }: AddCardToHandPorts) {
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
    Adds the card to the hand and rescores it. Rejects a card the variant's hand size has no room for, or that isn't in
    its deck, leaving the hand as it was. Drops choices the card leaves invalid, such as a choice of it from the discard
    area.
  */
  async execute(cardId: CardId): Promise<void> {
    const { hands, variant, handLock, rescore, variantCatalog } = this.ports;

    await handLock.runExclusive(async () => {
      const variantId = variant.get();
      const { handSize } = await variantCatalog.getById(variantId);

      hands.save(
        await withValidChoices(
          this.ports,
          variantId,
          addCardToHand(hands.get(), cardId, handSize),
        ),
      );
    });
    await rescore.execute();
  }
}
