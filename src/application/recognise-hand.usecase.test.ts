import { Card } from "../domain/card";
import { Variant } from "../domain/variant";
import { CardMatch, CardRecognizer } from "./recognise-hand.ports";
import { RecogniseHandUseCase } from "./recognise-hand.usecase";

const card = (id: string, name: string): Card => ({
  id,
  name,
  suit: "leader",
  baseStrength: 1,
});
const deck = [card("king", "King"), card("queen", "Queen")];

const variant: Variant = {
  id: "variant",
  name: "Variant",
  deckId: "deck",
  handSize: 2,
  preScoring: [],
};

const sure = (cardId: string): CardMatch => ({
  candidates: [cardId],
  confident: true,
});

const createUseCase = (recognise: CardRecognizer["recognise"]) =>
  new RecogniseHandUseCase({
    cardCatalog: {
      getAll: async (deckId) => (deckId === variant.deckId ? deck : []),
    },
    cardRecognizer: { recognise },
    variantCatalog: {
      getById: async (variantId) => {
        if (variantId !== variant.id) {
          throw new Error(`Unknown variant: ${variantId}`);
        }
        return variant;
      },
    },
  });

describe("RecogniseHandUseCase", () => {
  it("looks for the variant's cards by name, up to its hand size", async () => {
    const recognise = jest.fn(async () => [sure("king")]);

    await createUseCase(recognise).execute("variant", "file:///hand.jpg");

    expect(recognise).toHaveBeenCalledWith(
      "file:///hand.jpg",
      [
        { id: "king", name: "King" },
        { id: "queen", name: "Queen" },
      ],
      2,
    );
  });

  it("gives the matches and the hand size", async () => {
    const unsure: CardMatch = {
      candidates: ["queen", "king"],
      confident: false,
    };

    await expect(
      createUseCase(async () => [sure("king"), unsure]).execute(
        "variant",
        "file:///hand.jpg",
      ),
    ).resolves.toEqual({ matches: [sure("king"), unsure], handSize: 2 });
  });

  it("never gives more matches than the hand holds", async () => {
    const result = await createUseCase(async () => [
      sure("king"),
      sure("queen"),
      sure("jester"),
    ]).execute("variant", "file:///hand.jpg");

    expect(result.matches).toEqual([sure("king"), sure("queen")]);
  });

  it("fails when the photo can't be read", async () => {
    await expect(
      createUseCase(() => Promise.reject(new Error("unreadable"))).execute(
        "variant",
        "file:///hand.jpg",
      ),
    ).rejects.toThrow("unreadable");
  });
});
