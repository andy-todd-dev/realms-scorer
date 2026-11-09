import { CardId } from "../domain/card";
import { addCardToHand, emptyHand, Hand } from "../domain/hand";
import { VariantId } from "../domain/variant";
import { withValidChoices } from "./hand-rules";
import { ReplaceHandPorts } from "./replace-hand.ports";

export interface ReplaceHand {
  execute(variantId: VariantId, cardIds: readonly CardId[]): Promise<Hand>;
}

export class ReplaceHandUseCase implements ReplaceHand {
  private readonly ports: ReplaceHandPorts;

  constructor({ cardCatalog, variantCatalog }: ReplaceHandPorts) {
    this.ports = { cardCatalog, variantCatalog };
  }

  /*
    A new hand of just these cards, as from a scan. It has no choices, so any card that needs one is pending until the
    player makes it. Rejects more cards than the variant's hand size, or a card that isn't in its deck.
  */
  async execute(
    variantId: VariantId,
    cardIds: readonly CardId[],
  ): Promise<Hand> {
    const { handSize } = await this.ports.variantCatalog.getById(variantId);
    const hand = cardIds.reduce(
      (current, cardId) => addCardToHand(current, cardId, handSize),
      emptyHand(),
    );

    return withValidChoices(this.ports, variantId, hand);
  }
}
