import { Card, CardChoice, CardId, CardMatcher, Suit } from "../domain/card";
import { Variant, VariantId } from "../domain/variant";
import { LoadVariantPorts } from "./load-variant.ports";

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

// How far loading the current variant has got, with what the UI shows of it once it has loaded.
export type LoadedVariant =
  | { readonly status: "idle" | "loading" | "failed"; readonly view: null }
  | { readonly status: "loaded"; readonly view: VariantView };

export interface LoadVariant {
  execute(): Promise<void>;
}

export class LoadVariantUseCase implements LoadVariant {
  private readonly ports: LoadVariantPorts;

  constructor({
    variant,
    loadedVariant,
    rescore,
    cardCatalog,
    variantCatalog,
  }: LoadVariantPorts) {
    this.ports = {
      variant,
      loadedVariant,
      rescore,
      cardCatalog,
      variantCatalog,
    };
  }

  /*
    Loads what the UI shows of the variant the player is playing, and rescores the hand under it. A variant that fails
    to load is saved as failed rather than rejected, as the UI shows that.
  */
  async execute(): Promise<void> {
    const { variant, loadedVariant, rescore } = this.ports;
    const variantId = variant.get();

    loadedVariant.save({ status: "loading", view: null });
    loadedVariant.save(
      await this.viewOf(variantId).then(
        (view): LoadedVariant => ({ status: "loaded", view }),
        (): LoadedVariant => ({ status: "failed", view: null }),
      ),
    );
    await rescore.execute();
  }

  private async viewOf(variantId: VariantId): Promise<VariantView> {
    const { cardCatalog, variantCatalog } = this.ports;
    const { id, name, handSize, deckId } =
      await variantCatalog.getById(variantId);
    const cards = await cardCatalog.getAll(deckId);

    return { id, name, handSize, cards: cards.map(toCardView) };
  }
}
