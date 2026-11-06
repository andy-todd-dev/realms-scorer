import { CardId } from "./card";
import { Choices } from "./choices";

export type Hand = {
  readonly cardIds: readonly CardId[];
  // Only choices that have been made. A card that needs a choice and has none here is pending.
  readonly choices: Choices;
};

export function isCardInHand(hand: Hand, cardId: CardId): boolean {
  return hand.cardIds.includes(cardId);
}

export function addCardToHand(hand: Hand, cardId: CardId): Hand {
  return isCardInHand(hand, cardId)
    ? hand
    : { ...hand, cardIds: [...hand.cardIds, cardId] };
}

// Removes the card, along with its own choice and any choice of it, so that a card which chose it is pending again.
export function removeCardFromHand(hand: Hand, cardId: CardId): Hand {
  if (!isCardInHand(hand, cardId)) {
    return hand;
  }

  return {
    cardIds: hand.cardIds.filter((id) => id !== cardId),
    choices: Object.fromEntries(
      Object.entries(hand.choices).filter(
        ([chooserId, targetId]) => chooserId !== cardId && targetId !== cardId,
      ),
    ),
  };
}

// Records a choice, replacing any earlier one for the same card. Checking that the choice is valid needs the cards themselves, so it's up to the caller.
export function chooseCard(
  hand: Hand,
  chooserId: CardId,
  targetId: CardId,
): Hand {
  return { ...hand, choices: { ...hand.choices, [chooserId]: targetId } };
}

export function emptyHand(): Hand {
  return { cardIds: [], choices: {} };
}
