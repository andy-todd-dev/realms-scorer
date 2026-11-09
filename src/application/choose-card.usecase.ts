import { CardId, Suit } from "../domain/card";
import { isValidChoice, withInvalidChoicesDropped } from "../domain/choices";
import { chooseCard, Hand } from "../domain/hand";
import { VariantId } from "../domain/variant";
import { ChooseCardPorts } from "./choose-card.ports";
import { loadHandRules } from "./hand-rules";

export interface ChooseCard {
  execute(
    variantId: VariantId,
    hand: Hand,
    chooserId: CardId,
    targetId: CardId,
    // Only for a choice that includes a suit, such as Book of Changes'.
    suit?: Suit,
  ): Promise<Hand>;
}

export class ChooseCardUseCase implements ChooseCard {
  private readonly ports: ChooseCardPorts;

  constructor({ cardCatalog, variantCatalog }: ChooseCardPorts) {
    this.ports = { cardCatalog, variantCatalog };
  }

  /*
    Rejects a choice the chooser can't make, such as a card of the wrong suit, or one in the wrong place: in or out of
    the hand, or a suit the card can't be given, or that the choice doesn't include. The choice is checked as scoring checks it, under the variant's rules. Choices that depended on the
    chooser's earlier choice, and no longer fit, are dropped.
  */
  async execute(
    variantId: VariantId,
    hand: Hand,
    chooserId: CardId,
    targetId: CardId,
    suit?: Suit,
  ): Promise<Hand> {
    const { cards, rules } = await loadHandRules(
      this.ports,
      variantId,
      hand.cardIds,
    );

    const choice = { cardId: targetId, ...(suit !== undefined && { suit }) };

    if (!isValidChoice(chooserId, choice, cards, hand.choices, rules)) {
      throw new Error(
        `${chooserId} can't choose ${targetId}${suit ? ` as ${suit}` : ""}`,
      );
    }

    const chosen = chooseCard(hand, chooserId, targetId, suit);

    return {
      ...chosen,
      choices: withInvalidChoicesDropped(cards, chosen.choices, rules),
    };
  }
}
