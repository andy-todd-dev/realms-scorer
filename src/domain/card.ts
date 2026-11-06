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

export type CardAbility = {
  readonly text: string;
  readonly effects: readonly CardEffect[];
};

// A choice the player makes for a card, such as which card's penalty it clears. The app never makes it for them.
export type CardChoice = {
  // Another card in the hand. Later kinds may choose any card in the game, or a suit.
  readonly kind: "cardInHand";
  // The cards that can be chosen.
  readonly from: readonly CardMatcher[];
};

export type Card = {
  readonly id: CardId;
  readonly name: string;
  readonly suit: Suit;
  readonly baseStrength: number;
  readonly bonus?: CardAbility;
  readonly penalty?: CardAbility;
  readonly choice?: CardChoice;
};
