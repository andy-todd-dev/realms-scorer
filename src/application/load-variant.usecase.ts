import { Card, CardChoice, CardId, CardMatcher, Suit } from "../domain/card";
import { Variant, VariantId } from "../domain/variant";
import {
  CardCatalog,
  LoadVariantPorts,
  VariantCatalog,
} from "./load-variant.ports";

// What a choice can take, for describing it to the player: a suit, other than some cards, or a specific card.
export type ChoiceTargetView =
  | { readonly suit: Suit; readonly except: readonly CardId[] }
  | { readonly cardId: CardId };

// A choice the player has to make for a card, described rather than given as rules, so the UI never matches cards itself.
export type ChoiceView = {
  // Where the chosen card comes from: the hand, the discard area, which in practice is any card not in the hand, or anywhere in the game.
  readonly from: ChoiceSource;
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

export type ChoiceSource = "hand" | "discardArea" | "game";

const CHOICE_SOURCES: Record<CardChoice["kind"], ChoiceSource> = {
  cardInHand: "hand",
  cardInDiscardArea: "discardArea",
  cardInGame: "game",
};

function toChoiceView({ kind, from }: CardChoice): ChoiceView {
  return {
    from: CHOICE_SOURCES[kind],
    targets: from.flatMap(toChoiceTargetViews),
  };
}

function toCardView({ id, name, suit, choice }: Card): CardView {
  return { id, name, suit, choice: choice ? toChoiceView(choice) : null };
}

// What the UI needs of a variant: its name, how many cards a hand holds, and its deck's cards.
export type VariantView = Pick<Variant, "id" | "name" | "handSize"> & {
  readonly cards: readonly CardView[];
};

export interface LoadVariant {
  execute(variantId: VariantId): Promise<VariantView>;
}

export class LoadVariantUseCase implements LoadVariant {
  private readonly cardCatalog: CardCatalog;
  private readonly variantCatalog: VariantCatalog;

  constructor({ cardCatalog, variantCatalog }: LoadVariantPorts) {
    this.cardCatalog = cardCatalog;
    this.variantCatalog = variantCatalog;
  }

  async execute(variantId: VariantId): Promise<VariantView> {
    const { id, name, handSize, deckId } =
      await this.variantCatalog.getById(variantId);
    const cards = await this.cardCatalog.getAll(deckId);

    return { id, name, handSize, cards: cards.map(toCardView) };
  }
}
