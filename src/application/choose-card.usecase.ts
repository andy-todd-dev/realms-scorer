import { CardId } from "../domain/card";
import { isValidChoice } from "../domain/choices";
import { chooseCard, Hand } from "../domain/hand";
import { CardCatalog, ChooseCardPorts } from "./choose-card.ports";

export interface ChooseCard {
  execute(hand: Hand, chooserId: CardId, targetId: CardId): Promise<Hand>;
}

export class ChooseCardUseCase implements ChooseCard {
  private readonly cardCatalog: CardCatalog;

  constructor({ cardCatalog }: ChooseCardPorts) {
    this.cardCatalog = cardCatalog;
  }

  // Rejects a choice the chooser can't make, such as a card not in the hand or of the wrong suit.
  async execute(
    hand: Hand,
    chooserId: CardId,
    targetId: CardId,
  ): Promise<Hand> {
    const cards = await this.cardCatalog.getByIds(hand.cardIds);
    const chooser = cards.find((card) => card.id === chooserId);

    if (!chooser || !isValidChoice(chooser, targetId, cards)) {
      throw new Error(`${chooserId} can't choose ${targetId}`);
    }

    return chooseCard(hand, chooserId, targetId);
  }
}
