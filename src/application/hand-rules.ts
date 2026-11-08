import { Card, CardId } from "../domain/card";
import { ChoiceRules, withInvalidChoicesDropped } from "../domain/choices";
import { DeckId } from "../domain/deck";
import { Hand } from "../domain/hand";
import { Variant, VariantId } from "../domain/variant";

// What the helpers below call. Each use case's own ports declare these too.
type Catalogs = {
  readonly cardCatalog: {
    getAll(deckId: DeckId): Promise<Card[]>;
    getByIds(deckId: DeckId, cardIds: readonly CardId[]): Promise<Card[]>;
  };
  readonly variantCatalog: {
    getById(variantId: VariantId): Promise<Variant>;
  };
};

// The variant, a hand's cards from its deck, and the rules choices need. The variant's whole deck is the discard area, as the app can't see the real one.
export async function loadHandRules(
  { cardCatalog, variantCatalog }: Catalogs,
  variantId: VariantId,
  cardIds: readonly CardId[],
): Promise<{ variant: Variant; cards: Card[]; rules: ChoiceRules }> {
  const variant = await variantCatalog.getById(variantId);
  const [cards, deckCards] = await Promise.all([
    cardCatalog.getByIds(variant.deckId, cardIds),
    cardCatalog.getAll(variant.deckId),
  ]);

  return {
    variant,
    cards,
    rules: { deckCards: deckCards, preScoring: variant.preScoring },
  };
}

// The hand with any choices that no longer fit it dropped, so that the stored choices stay valid after a change.
export async function withValidChoices(
  catalogs: Catalogs,
  variantId: VariantId,
  hand: Hand,
): Promise<Hand> {
  const { cards, rules } = await loadHandRules(
    catalogs,
    variantId,
    hand.cardIds,
  );

  return {
    ...hand,
    choices: withInvalidChoicesDropped(cards, hand.choices, rules),
  };
}
