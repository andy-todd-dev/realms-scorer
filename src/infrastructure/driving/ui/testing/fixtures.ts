import type { Card, CardId } from "../../../../domain/card";
import type { Hand } from "../../../../domain/hand";
import type { CardScore, HandScore } from "../../../../domain/score";

// Cards and scores shared by the component tests. Fixtures only one feature's tests use stay in that test file.

export const king: Card = {
  id: "king",
  name: "King",
  suit: "leader",
  baseStrength: 8,
};
export const queen: Card = {
  id: "queen",
  name: "Queen",
  suit: "leader",
  baseStrength: 6,
};
export const knights: Card = {
  id: "knights",
  name: "Knights",
  suit: "army",
  baseStrength: 20,
};
export const cards = [king, queen, knights];

// Clears the penalty on a Flood or Flame of the player's choice.
export const island: Card = {
  id: "island",
  name: "Island",
  suit: "flood",
  baseStrength: 14,
  bonus: {
    text: "",
    effects: [{ kind: "clearPenalty", targets: [{ chosen: true }] }],
  },
  choice: { kind: "cardInHand", from: [{ suit: "flood" }, { suit: "flame" }] },
};
export const swamp: Card = {
  id: "swamp",
  name: "Swamp",
  suit: "flood",
  baseStrength: 18,
};
export const withIsland = [...cards, island, swamp];

export const handOf = (...cardIds: CardId[]): Hand => ({
  cardIds,
  choices: {},
});

export const eightCards: Card[] = Array.from({ length: 8 }, (_, index) => ({
  id: `card-${index}`,
  name: `Card ${index}`,
  suit: "beast",
  baseStrength: 1,
}));

// Builds a score from card scores, adding up the totals.
export const handScoreOf = (cardScores: readonly CardScore[]): HandScore => {
  const sum = (key: "base" | "bonus" | "penalty" | "total") =>
    cardScores.reduce((total, cardScore) => total + cardScore[key], 0);

  return {
    cards: cardScores,
    base: sum("base"),
    bonus: sum("bonus"),
    penalty: sum("penalty"),
    total: sum("total"),
  };
};

// A score with only a total, for tests that only look at the total.
export const totalOnly = (total: number) => ({
  ...handScoreOf([]),
  base: total,
  total,
});

// Adds up base strengths. For the Island, it also reports its options as the rules would: the other Floods in the hand.
export const sumStrengths = async ({ cardIds, choices }: Hand) => {
  const handCards = [...withIsland, ...eightCards].filter((card) =>
    cardIds.includes(card.id),
  );

  return handScoreOf(
    handCards.map(({ id, baseStrength, choice }) => ({
      cardId: id,
      blanked: false,
      base: baseStrength,
      bonus: 0,
      penalty: 0,
      total: baseStrength,
      lines: [],
      ...(choice && {
        choice: {
          chosenId: choices[id]?.cardId ?? null,
          optionIds: handCards
            .filter((other) => other.id !== id && other.suit === "flood")
            .map((other) => other.id),
        },
      }),
    })),
  );
};
