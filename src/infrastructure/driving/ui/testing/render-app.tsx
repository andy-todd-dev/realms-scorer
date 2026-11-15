import { Mutex } from "async-mutex";
import {
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { AddCardToHandUseCase } from "../../../../application/add-card-to-hand.usecase";
import type { AppUseCases } from "../../../../application/app-use-cases";
import {
  ChooseCard,
  ChooseCardUseCase,
} from "../../../../application/choose-card.usecase";
import { ClearHandUseCase } from "../../../../application/clear-hand.usecase";
import type { AppInfoView } from "../../../../application/load-app-info.usecase";
import { LoadVariantUseCase } from "../../../../application/load-variant.usecase";
import type { ScanResult } from "../../../../application/recognise-hand.usecase";
import { RemoveCardFromHandUseCase } from "../../../../application/remove-card-from-hand.usecase";
import {
  ReplaceHand,
  ReplaceHandUseCase,
} from "../../../../application/replace-hand.usecase";
import {
  Rescore,
  RescoreUseCase,
} from "../../../../application/rescore.usecase";
import type { Card, CardId } from "../../../../domain/card";
import type { DeckId } from "../../../../domain/deck";
import type { Hand } from "../../../../domain/hand";
import type { HandScore } from "../../../../domain/score";
import type { Variant, VariantId } from "../../../../domain/variant";
import { reduxStores } from "../../state/redux-stores";
import { createAppStore } from "../../state/store";
import { BASE_VARIANT_ID } from "../../state/variant-slice";
import { App } from "../App";
import { cards, sumStrengths, totalOnly } from "./fixtures";

/*
  Renders the real app, with its real components, store and use cases, over fake catalogs and a fake or real scorer,
  as the component tests need. Returns helpers for pressing what the player would.
*/

// Fakes for the catalogs, serving the given cards as the deck of a variant with the store's default ID.
function catalogsFor(
  loadCards: () => Promise<Card[]>,
  preScoring: readonly CardId[],
  handSize: number,
) {
  const variant: Variant = {
    id: BASE_VARIANT_ID,
    name: "Test variant",
    deckId: "deck",
    handSize,
    preScoring,
  };

  return {
    cardCatalog: {
      getAll: loadCards,
      getByIds: async (_: DeckId, cardIds: readonly CardId[]) =>
        (await loadCards()).filter((card) => cardIds.includes(card.id)),
    },
    variantCatalog: {
      getById: async (variantId: VariantId) => {
        if (variantId !== variant.id) {
          throw new Error(`Unknown variant: ${variantId}`);
        }
        return variant;
      },
    },
  };
}

export async function renderApp({
  scoreHand = sumStrengths,
  scoreByTheRules = false,
  preScoring = [],
  handSize = 7,
  loadCards = async () => cards,
  chooseCard,
  recogniseHand = () => Promise.reject(new Error("No scan expected")),
  replaceHand,
  loadAppInfo = async () => ({ version: null, buildNumber: null }),
}: {
  scoreHand?: (hand: Hand) => Promise<number | HandScore>;
  // Scores with the real use case, so the options and any added cards come from the rules.
  scoreByTheRules?: boolean;
  preScoring?: readonly CardId[];
  handSize?: number;
  loadCards?: () => Promise<Card[]>;
  // In place of the real use cases, for holding a change in flight or failing it.
  chooseCard?: ChooseCard["execute"];
  recogniseHand?: (imageUri: string) => Promise<ScanResult>;
  replaceHand?: ReplaceHand["execute"];
  loadAppInfo?: () => Promise<AppInfoView>;
} = {}) {
  const catalogs = catalogsFor(loadCards, preScoring, handSize);
  const store = createAppStore({
    loadAppInfo: { execute: loadAppInfo },
    // The real use case, so card views and choice descriptions are built as in the app.
    loadVariant: new LoadVariantUseCase(catalogs),
    recogniseHand: { execute: (_, imageUri) => recogniseHand(imageUri) },
  });
  const stores = reduxStores(store);
  /*
    Scores with the real use case, or saves the score the test gives in its place, keeping a score only while the hand
    is still the one it was asked for. RescoreUseCase's own tests cover how it drops those for older hands.
  */
  const rescore: Rescore = scoreByTheRules
    ? new RescoreUseCase({ ...stores, ...catalogs })
    : {
        execute: async () => {
          const hand = stores.hands.get();
          let handScore: HandScore | null;

          try {
            const score = await scoreHand(hand);
            handScore = typeof score === "number" ? totalOnly(score) : score;
          } catch {
            handScore = null;
          }

          if (stores.hands.get() === hand) {
            stores.scores.save(handScore);
          }
        },
      };
  // The real use cases, which change the hand with the same cards that loading serves.
  const ports = { ...stores, ...catalogs, handLock: new Mutex(), rescore };
  const useCases: AppUseCases = {
    addCardToHand: new AddCardToHandUseCase(ports),
    chooseCard: chooseCard
      ? { execute: chooseCard }
      : new ChooseCardUseCase(ports),
    clearHand: new ClearHandUseCase(ports),
    removeCardFromHand: new RemoveCardFromHandUseCase(ports),
    replaceHand: replaceHand
      ? { execute: replaceHand }
      : new ReplaceHandUseCase(ports),
    rescore,
  };
  const user = userEvent.setup();

  await render(<App store={store} useCases={useCases} />);
  await screen.findByTestId("hand-score");

  const press = (testID: string) => user.press(screen.getByTestId(testID));

  return {
    press,
    showBreakdown: () => press("show-breakdown"),
    backToCards: () => press("back-to-cards"),
    tapCard: (cardId: CardId) => press(`card-tile-${cardId}`),
  };
}

export const expectScore = (score: string) =>
  waitFor(() =>
    expect(screen.getByTestId("hand-score")).toHaveTextContent(score),
  );

export const expectCount = (text: string) =>
  waitFor(() =>
    expect(screen.getByTestId("hand-count")).toHaveTextContent(text),
  );
