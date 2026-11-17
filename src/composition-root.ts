import { Mutex } from "async-mutex";
import { asFunction, asValue, createContainer, InjectionMode } from "awilix";
import {
  AddCardToHand,
  AddCardToHandUseCase,
} from "./application/add-card-to-hand.usecase";
import { AppUseCases } from "./application/app-use-cases";
import {
  ChooseCard,
  ChooseCardUseCase,
} from "./application/choose-card.usecase";
import { ClearHand, ClearHandUseCase } from "./application/clear-hand.usecase";
import {
  LoadAppInfo,
  LoadAppInfoUseCase,
} from "./application/load-app-info.usecase";
import {
  LoadVariant,
  LoadVariantUseCase,
} from "./application/load-variant.usecase";
import {
  RecogniseHand,
  RecogniseHandUseCase,
} from "./application/recognise-hand.usecase";
import {
  RemoveCardFromHand,
  RemoveCardFromHandUseCase,
} from "./application/remove-card-from-hand.usecase";
import {
  ReplaceHand,
  ReplaceHandUseCase,
} from "./application/replace-hand.usecase";
import { Rescore, RescoreUseCase } from "./application/rescore.usecase";
import { ExpoApplicationAppInfo } from "./infrastructure/driven/expo-application-app-info";
import { InMemoryCardCatalog } from "./infrastructure/driven/in-memory-card-catalog";
import { InMemoryVariantCatalog } from "./infrastructure/driven/in-memory-variant-catalog";
import { MlKitCardRecognizer } from "./infrastructure/driven/ml-kit-card-recognizer/ml-kit-card-recognizer";
import { BASE_VARIANT } from "./infrastructure/driven/variants/base.variant";
import { reduxStores } from "./infrastructure/driving/state/redux-stores";
import { AppStore, createAppStore } from "./infrastructure/driving/state/store";

type Cradle = AppUseCases & {
  appInfo: ExpoApplicationAppInfo;
  cardCatalog: InMemoryCardCatalog;
  cardRecognizer: MlKitCardRecognizer;
  handLock: Mutex;
  variantCatalog: InMemoryVariantCatalog;
} & ReturnType<typeof reduxStores>;

// Builds the store, then the use cases, which reach its state through the adapters in redux-stores.ts.
export function createApp(): { store: AppStore; useCases: AppUseCases } {
  // The app plays the base game until there is a way to pick another variant.
  const store = createAppStore(BASE_VARIANT.id);
  const stores = reduxStores(store);
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.PROXY,
    strict: true,
  });

  container.register({
    appInfo: asFunction(() => new ExpoApplicationAppInfo()).singleton(),
    cardCatalog: asFunction(() => new InMemoryCardCatalog()).singleton(),
    cardRecognizer: asFunction(() => new MlKitCardRecognizer()).singleton(),
    variantCatalog: asFunction(() => new InMemoryVariantCatalog()).singleton(),
    hands: asValue(stores.hands),
    scores: asValue(stores.scores),
    variant: asValue(stores.variant),
    loadedVariant: asValue(stores.loadedVariant),
    appVersion: asValue(stores.appVersion),
    // One lock for every use case that changes the hand.
    handLock: asValue(new Mutex()),
    addCardToHand: asFunction(
      (deps: Cradle): AddCardToHand => new AddCardToHandUseCase(deps),
    ).singleton(),
    chooseCard: asFunction(
      (deps: Cradle): ChooseCard => new ChooseCardUseCase(deps),
    ).singleton(),
    clearHand: asFunction(
      (deps: Cradle): ClearHand => new ClearHandUseCase(deps),
    ).singleton(),
    loadAppInfo: asFunction(
      (deps: Cradle): LoadAppInfo => new LoadAppInfoUseCase(deps),
    ).singleton(),
    loadVariant: asFunction(
      (deps: Cradle): LoadVariant => new LoadVariantUseCase(deps),
    ).singleton(),
    recogniseHand: asFunction(
      (deps: Cradle): RecogniseHand => new RecogniseHandUseCase(deps),
    ).singleton(),
    removeCardFromHand: asFunction(
      (deps: Cradle): RemoveCardFromHand => new RemoveCardFromHandUseCase(deps),
    ).singleton(),
    replaceHand: asFunction(
      (deps: Cradle): ReplaceHand => new ReplaceHandUseCase(deps),
    ).singleton(),
    rescore: asFunction(
      (deps: Cradle): Rescore => new RescoreUseCase(deps),
    ).singleton(),
  });

  const { cradle } = container;

  return {
    store,
    useCases: {
      addCardToHand: cradle.addCardToHand,
      chooseCard: cradle.chooseCard,
      clearHand: cradle.clearHand,
      loadAppInfo: cradle.loadAppInfo,
      loadVariant: cradle.loadVariant,
      recogniseHand: cradle.recogniseHand,
      removeCardFromHand: cradle.removeCardFromHand,
      replaceHand: cradle.replaceHand,
      rescore: cradle.rescore,
    },
  };
}
