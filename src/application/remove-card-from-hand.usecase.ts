import { CardId } from "../domain/card";
import { Hand, removeCardFromHand } from "../domain/hand";
import { VariantId } from "../domain/variant";
import { withValidChoices } from "./hand-rules";
import { RemoveCardFromHandPorts } from "./remove-card-from-hand.ports";

export interface RemoveCardFromHand {
  execute(variantId: VariantId, hand: Hand, cardId: CardId): Promise<Hand>;
}

export class RemoveCardFromHandUseCase implements RemoveCardFromHand {
  private readonly ports: RemoveCardFromHandPorts;

  constructor({ cardCatalog, variantCatalog }: RemoveCardFromHandPorts) {
    this.ports = { cardCatalog, variantCatalog };
  }

  // Drops the choices the card leaves invalid: its own, any of it, and any that depended on what it chose.
  async execute(
    variantId: VariantId,
    hand: Hand,
    cardId: CardId,
  ): Promise<Hand> {
    return withValidChoices(
      this.ports,
      variantId,
      removeCardFromHand(hand, cardId),
    );
  }
}
