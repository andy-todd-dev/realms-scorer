import { Card, CardEffect, CardMatcher, Suit } from "./card";

// Returns all effects of the specified card, including both bonus and penalty effects.
export function effectsOf(card: Card): readonly CardEffect[] {
  return [...(card.bonus?.effects ?? []), ...(card.penalty?.effects ?? [])];
}

// Checks if the card matches the specified matcher. A matcher can either specify a suit, optionally excepting specific cards, or a specific card ID. A matcher for a chosen card matches nothing until the choice is resolved into a card ID.
export function matches(card: Card, matcher: CardMatcher): boolean {
  if ("suit" in matcher) {
    return card.suit === matcher.suit && !matcher.except?.includes(card.id);
  }

  return "cardId" in matcher && card.id === matcher.cardId;
}

// Checks if a matcher names the specified suit. A matcher naming a specific card doesn't count, even if that card is of the suit.
export function namesSuit(matcher: CardMatcher, suit: Suit): boolean {
  return "suit" in matcher && matcher.suit === suit;
}

// Returns all cards in the hand except the specified card
export function othersIn(cards: readonly Card[], card: Card): readonly Card[] {
  return cards.filter((other) => other.id !== card.id);
}
