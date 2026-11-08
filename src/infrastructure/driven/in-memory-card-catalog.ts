import type { Card, CardId } from "../../domain/card";
import type { Deck, DeckId } from "../../domain/deck";
import { BASE_DECK, BASE_DECK_CARDS } from "./decks/base.cards";

type CatalogCard = Card & {
  readonly deckId: DeckId;
};

export const DECKS: readonly Deck[] = [BASE_DECK];

export const CARDS: readonly CatalogCard[] = Object.entries(
  BASE_DECK_CARDS,
).map(([id, definition]) => ({ deckId: BASE_DECK.id, id, ...definition }));

export class InMemoryCardCatalog {
  private readonly cards: readonly CatalogCard[];

  constructor(catalogCards: readonly CatalogCard[] = CARDS) {
    this.cards = catalogCards;
  }

  // A deck with no cards, or an unknown one, gives none.
  async getAll(deckId: DeckId): Promise<Card[]> {
    return this.cards
      .filter((catalogCard) => catalogCard.deckId === deckId)
      .map(withoutDeckId);
  }

  // A card in another deck counts as unknown.
  async getByIds(deckId: DeckId, cardIds: readonly CardId[]): Promise<Card[]> {
    return cardIds.map((cardId) => {
      const card = this.cards.find(
        (catalogCard) =>
          catalogCard.deckId === deckId && catalogCard.id === cardId,
      );

      if (!card) {
        throw new Error(`Unknown card: ${cardId}`);
      }

      return withoutDeckId(card);
    });
  }
}

function withoutDeckId({ deckId, ...card }: CatalogCard): Card {
  return card;
}
