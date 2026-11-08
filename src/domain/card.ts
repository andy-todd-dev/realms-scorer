export type CardId = string;

export type Suit =
  | "army"
  | "leader"
  | "wizard"
  | "weapon"
  | "artifact"
  | "beast"
  | "land"
  | "weather"
  | "flood"
  | "flame"
  | "wild";

export type SuitMatcher = {
  readonly suit: Suit;
  readonly except?: readonly CardId[];
};

export type CardIdMatcher = { readonly cardId: CardId };

// The card that the effect's owner chose, for cards with a choice. It matches nothing until the choice is resolved (choices.ts).
export type ChosenCardMatcher = { readonly chosen: true };

export type CardMatcher = SuitMatcher | CardIdMatcher | ChosenCardMatcher;

export type EffectCondition =
  | { readonly present: CardMatcher }
  | { readonly absent: CardMatcher }
  | { readonly allOf: readonly EffectCondition[] }
  | { readonly anyOf: readonly EffectCondition[] }
  | { readonly allSuitsDifferent: true };

export type CardEffect =
  | {
      readonly kind: "points";
      readonly points: number;
      readonly per?: CardMatcher;
      readonly when?: EffectCondition;
    }
  | {
      readonly kind: "sum";
      readonly of: CardMatcher;
      readonly attribute: "baseStrength";
    }
  | {
      readonly kind: "baseStrengthRun";
      readonly tiers: readonly {
        readonly length: number;
        readonly points: number;
      }[];
    }
  | {
      readonly kind: "blank";
      readonly targets: readonly CardMatcher[];
    }
  | {
      readonly kind: "blankSelf";
      readonly when: EffectCondition;
    }
  | {
      readonly kind: "clearPenalty";
      readonly targets: readonly CardMatcher[];
    }
  | {
      readonly kind: "clearPenaltySuitWord";
      readonly suit: Suit;
      readonly targets?: readonly CardMatcher[];
    };

// What a card can take from another: its name, so that rules naming that card match it, and its suit. Add others as cards need them.
export type TakenAttribute = "name" | "suit";

// An effect that fires before scoring, for cards the variant lists, in its order. Later kinds may change a suit.
export type PreScoringEffect =
  | {
      // Adds the chosen card to the hand.
      readonly kind: "addToHand";
      readonly card: ChosenCardMatcher;
    }
  | {
      // Takes the listed attributes of the chosen card. Everything else stays the card's own.
      readonly kind: "take";
      readonly from: ChosenCardMatcher;
      readonly attributes: readonly TakenAttribute[];
    };

export type CardAbility = {
  readonly text: string;
  readonly effects: readonly CardEffect[];
};

// A choice the player makes for a card, such as which card's penalty it clears. The app never makes it for them.
export type CardChoice = {
  /*
    Where the chosen card comes from. What happens to it is up to the card's effects. Later kinds may choose a suit.
    - cardInHand: another card in the hand.
    - cardInDiscardArea: a card from the discard area. The app can't see the discard area, so any card in the variant's
      deck that isn't in the hand counts as being there.
    - cardInGame: any other card in the variant's deck, in the hand or not.
  */
  readonly kind: "cardInHand" | "cardInDiscardArea" | "cardInGame";
  // The cards that can be chosen.
  readonly from: readonly CardMatcher[];
};

export type Card = {
  readonly id: CardId;
  readonly name: string;
  // Set when the card took another card's name in pre-scoring: rules naming that card match this one too.
  readonly namedAs?: CardId;
  readonly suit: Suit;
  readonly baseStrength: number;
  readonly bonus?: CardAbility;
  readonly penalty?: CardAbility;
  // Fires before scoring, only if the variant lists the card. It has no text: the card prints the rule in its bonus or penalty.
  readonly preScoring?: readonly PreScoringEffect[];
  readonly choice?: CardChoice;
};
