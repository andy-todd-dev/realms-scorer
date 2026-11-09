import { CardId, Suit } from "./card";
import { Choices } from "./choices";

export type Hand = {
  readonly cardIds: readonly CardId[];
  // Only choices that have been made. A card that needs a choice and has none here is pending.
  readonly choices: Choices;
};

// The hand size is the variant's. Cards an effect adds to the hand during scoring, such as the Necromancer's, aren't in the hand, so they don't count.
export function isHandFull(hand: Hand, handSize: number): boolean {
  return hand.cardIds.length >= handSize;
}

export function isCardInHand(hand: Hand, cardId: CardId): boolean {
  return hand.cardIds.includes(cardId);
}

// Adding a card that's already in the hand changes nothing. Adding one to a full hand is an error, as the player can't do it. Choices it leaves invalid are dropped by the caller, as for removing.
export function addCardToHand(
  hand: Hand,
  cardId: CardId,
  handSize: number,
): Hand {
  if (isCardInHand(hand, cardId)) {
    return hand;
  }

  if (isHandFull(hand, handSize)) {
    throw new Error(`The hand is full, so ${cardId} can't be added`);
  }

  return { ...hand, cardIds: [...hand.cardIds, cardId] };
}

// Removes the card. Choices it leaves invalid, its own and any of it, are dropped by the caller with withInvalidChoicesDropped, which needs the cards themselves.
export function removeCardFromHand(hand: Hand, cardId: CardId): Hand {
  return isCardInHand(hand, cardId)
    ? { ...hand, cardIds: hand.cardIds.filter((id) => id !== cardId) }
    : hand;
}

// Records a choice, with a suit for a choice that includes one, replacing any earlier one for the same card. Checking that the choice is valid needs the cards themselves, so it's up to the caller.
export function chooseCard(
  hand: Hand,
  chooserId: CardId,
  targetId: CardId,
  suit?: Suit,
): Hand {
  return {
    ...hand,
    choices: {
      ...hand.choices,
      [chooserId]: { cardId: targetId, ...(suit !== undefined && { suit }) },
    },
  };
}

export function emptyHand(): Hand {
  return { cardIds: [], choices: {} };
}
