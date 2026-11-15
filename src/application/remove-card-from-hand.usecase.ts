import { CardId } from "../domain/card";
import { removeCardFromHand } from "../domain/hand";
import { withValidChoices } from "./hand-rules";
import { RemoveCardFromHandPorts } from "./remove-card-from-hand.ports";

export interface RemoveCardFromHand {
  execute(cardId: CardId): Promise<void>;
}

export class RemoveCardFromHandUseCase implements RemoveCardFromHand {
  private readonly ports: RemoveCardFromHandPorts;

  constructor({
    hands,
    variant,
    handLock,
    rescore,
    cardCatalog,
    variantCatalog,
  }: RemoveCardFromHandPorts) {
    this.ports = {
      hands,
      variant,
      handLock,
      rescore,
      cardCatalog,
      variantCatalog,
    };
  }

  // Removes the card and rescores the hand. Drops the choices the card leaves invalid: its own, any of it, and any that depended on what it chose.
  async execute(cardId: CardId): Promise<void> {
    const { hands, variant, handLock, rescore } = this.ports;

    await handLock.runExclusive(async () => {
      hands.save(
        await withValidChoices(
          this.ports,
          variant.get(),
          removeCardFromHand(hands.get(), cardId),
        ),
      );
    });
    await rescore.execute();
  }
}
