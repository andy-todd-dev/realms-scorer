import { CardId, Suit } from "../domain/card";
import { isValidChoice, withInvalidChoicesDropped } from "../domain/choices";
import { chooseCard } from "../domain/hand";
import { ChooseCardPorts } from "./choose-card.ports";
import { loadHandRules } from "./hand-rules";

export interface ChooseCard {
  // The suit is only for a choice that includes one, such as Book of Changes'.
  execute(chooserId: CardId, targetId: CardId, suit?: Suit): Promise<void>;
}

export class ChooseCardUseCase implements ChooseCard {
  private readonly ports: ChooseCardPorts;

  constructor({
    hands,
    variant,
    handLock,
    rescore,
    cardCatalog,
    variantCatalog,
  }: ChooseCardPorts) {
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
    Records the choice and rescores the hand. Rejects a choice the chooser can't make, leaving the hand as it was: a card
    of the wrong suit, or one in the wrong place, in or out of the hand, or a suit the card can't be given, or that the
    choice doesn't include. The choice is checked as scoring checks it, under the variant's rules. Choices that depended
    on the chooser's earlier choice, and no longer fit, are dropped.
  */
  async execute(
    chooserId: CardId,
    targetId: CardId,
    suit?: Suit,
  ): Promise<void> {
    const { hands, variant, handLock, rescore } = this.ports;

    await handLock.runExclusive(async () => {
      const hand = hands.get();
      const { cards, rules } = await loadHandRules(
        this.ports,
        variant.get(),
        hand.cardIds,
      );
      const choice = { cardId: targetId, ...(suit !== undefined && { suit }) };

      if (!isValidChoice(chooserId, choice, cards, hand.choices, rules)) {
        throw new Error(
          `${chooserId} can't choose ${targetId}${suit ? ` as ${suit}` : ""}`,
        );
      }

      const chosen = chooseCard(hand, chooserId, targetId, suit);

      hands.save({
        ...chosen,
        choices: withInvalidChoicesDropped(cards, chosen.choices, rules),
      });
    });
    await rescore.execute();
  }
}
