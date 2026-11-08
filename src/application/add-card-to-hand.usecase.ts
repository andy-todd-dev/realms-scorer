import { CardId } from "../domain/card";
import { addCardToHand, Hand } from "../domain/hand";
import { VariantId } from "../domain/variant";
import { AddCardToHandPorts } from "./add-card-to-hand.ports";
import { withValidChoices } from "./hand-rules";

export interface AddCardToHand {
  execute(variantId: VariantId, hand: Hand, cardId: CardId): Promise<Hand>;
}

export class AddCardToHandUseCase implements AddCardToHand {
  private readonly ports: AddCardToHandPorts;

  constructor({ cardCatalog, variantCatalog }: AddCardToHandPorts) {
    this.ports = { cardCatalog, variantCatalog };
  }

  // Rejects a card the variant's hand size has no room for, or that isn't in its deck. Drops choices the card leaves invalid, such as a choice of it from the discard area.
  async execute(
    variantId: VariantId,
    hand: Hand,
    cardId: CardId,
  ): Promise<Hand> {
    const { handSize } = await this.ports.variantCatalog.getById(variantId);

    return withValidChoices(
      this.ports,
      variantId,
      addCardToHand(hand, cardId, handSize),
    );
  }
}
