import { Card, CardChoice, CardId, CardMatcher, Suit } from "../domain/card";
import { CardCatalog, LoadCardsPorts } from "./load-cards.ports";

// What a choice can take, for describing it to the player: a suit, other than some cards, or a specific card.
export type ChoiceTargetView =
  | { readonly suit: Suit; readonly except: readonly CardId[] }
  | { readonly cardId: CardId };

// A choice the player has to make for a card, described rather than given as rules, so the UI never matches cards itself.
export type ChoiceView = {
  // Where the chosen card comes from. Only the hand so far.
  readonly from: "hand";
  readonly targets: readonly ChoiceTargetView[];
};

export type CardView = Pick<Card, "id" | "name" | "suit"> & {
  // Set when the player has to choose another card for this one to take effect.
  readonly choice: ChoiceView | null;
};

function toChoiceTargetViews(
  matcher: CardMatcher,
): readonly ChoiceTargetView[] {
  if ("suit" in matcher) {
    return [{ suit: matcher.suit, except: matcher.except ?? [] }];
  }

  // A choice never targets the chosen card itself, so that matcher has nothing to describe.
  return "cardId" in matcher ? [{ cardId: matcher.cardId }] : [];
}

function toChoiceView({ from }: CardChoice): ChoiceView {
  return { from: "hand", targets: from.flatMap(toChoiceTargetViews) };
}

function toCardView({ id, name, suit, choice }: Card): CardView {
  return { id, name, suit, choice: choice ? toChoiceView(choice) : null };
}

export interface LoadCards {
  execute(): Promise<CardView[]>;
}

export class LoadCardsUseCase implements LoadCards {
  private readonly cardCatalog: CardCatalog;

  constructor({ cardCatalog }: LoadCardsPorts) {
    this.cardCatalog = cardCatalog;
  }

  async execute(): Promise<CardView[]> {
    const cards = await this.cardCatalog.getAll();

    return cards.map(toCardView);
  }
}
