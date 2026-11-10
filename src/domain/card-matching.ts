import { Card, CardEffect, CardId, CardMatcher, Suit } from "./card";

// Returns all effects of the specified card, including both bonus and penalty effects.
export function effectsOf(card: Card): readonly CardEffect[] {
  return [...(card.bonus?.effects ?? []), ...(card.penalty?.effects ?? [])];
}

// Checks if the card has the specified ID, or took the name of the card with it.
function isNamed(card: Card, cardId: CardId): boolean {
  return card.id === cardId || card.namedAs === cardId;
}

// Checks if the card matches the specified matcher. A matcher can either specify a suit, optionally excepting specific cards, or a specific card ID. A card that took another card's name matches as that card too. A matcher for a chosen card matches nothing until the choice is resolved, and then only the card chosen.
export function matches(card: Card, matcher: CardMatcher): boolean {
  if ("suit" in matcher) {
    return (
      card.suit === matcher.suit &&
      !matcher.except?.some((cardId) => isNamed(card, cardId))
    );
  }

  if ("chosen" in matcher) {
    return matcher.id !== undefined && card.id === matcher.id;
  }

  return isNamed(card, matcher.cardId);
}

// Checks if a matcher names the specified suit. A matcher naming a specific card doesn't count, even if that card is of the suit.
export function namesSuit(matcher: CardMatcher, suit: Suit): boolean {
  return "suit" in matcher && matcher.suit === suit;
}

// Returns all cards in the hand except the specified card
export function othersIn(cards: readonly Card[], card: Card): readonly Card[] {
  return cards.filter((other) => other.id !== card.id);
}

// The suit or card that a matcher names, for reporting what an effect looked for. A chosen card is reported as the card chosen, and as nothing while pending.
export type CardTarget = { readonly suit: Suit } | { readonly cardId: CardId };

export function targetOf(matcher: CardMatcher): CardTarget | null {
  if ("suit" in matcher) {
    return { suit: matcher.suit };
  }

  if ("chosen" in matcher) {
    return matcher.id === undefined ? null : { cardId: matcher.id };
  }

  return { cardId: matcher.cardId };
}
