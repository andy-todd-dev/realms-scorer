import { Mutex } from "async-mutex";
import { asFunction, asValue, createContainer, InjectionMode } from "awilix";
import { AppUseCases } from "./application/app-use-cases";
import {
  AddCardToHand,
  AddCardToHandUseCase,
} from "./application/add-card-to-hand.usecase";
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
import { UseCases } from "./application/use-cases";
import { ExpoApplicationAppInfo } from "./infrastructure/driven/expo-application-app-info";
import { InMemoryCardCatalog } from "./infrastructure/driven/in-memory-card-catalog";
import { InMemoryVariantCatalog } from "./infrastructure/driven/in-memory-variant-catalog";
import { MlKitCardRecognizer } from "./infrastructure/driven/ml-kit-card-recognizer/ml-kit-card-recognizer";
import { reduxStores } from "./infrastructure/driving/state/redux-stores";
import { AppStore, createAppStore } from "./infrastructure/driving/state/store";

type Cradle = {
  addCardToHand: AddCardToHand;
  appInfo: ExpoApplicationAppInfo;
  cardCatalog: InMemoryCardCatalog;
  cardRecognizer: MlKitCardRecognizer;
  chooseCard: ChooseCard;
  clearHand: ClearHand;
  handLock: Mutex;
  loadAppInfo: LoadAppInfo;
  loadVariant: LoadVariant;
  recogniseHand: RecogniseHand;
  removeCardFromHand: RemoveCardFromHand;
  replaceHand: ReplaceHand;
  rescore: Rescore;
  variantCatalog: InMemoryVariantCatalog;
} & ReturnType<typeof reduxStores>;

// Builds the store and the use cases. The thunks' use cases come first, as the store needs them, then the store's state is registered for the use cases that orchestrate through it.
export function createApp(): { store: AppStore; useCases: AppUseCases } {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.PROXY,
    strict: true,
  });

  container.register({
    appInfo: asFunction(() => new ExpoApplicationAppInfo()).singleton(),
    cardCatalog: asFunction(() => new InMemoryCardCatalog()).singleton(),
    cardRecognizer: asFunction(() => new MlKitCardRecognizer()).singleton(),
    chooseCard: asFunction(
      (deps: Cradle) => new ChooseCardUseCase(deps),
    ).singleton(),
    clearHand: asFunction(() => new ClearHandUseCase()).singleton(),
    loadAppInfo: asFunction(
      (deps: Cradle) => new LoadAppInfoUseCase(deps),
    ).singleton(),
    loadVariant: asFunction(
      (deps: Cradle) => new LoadVariantUseCase(deps),
    ).singleton(),
    recogniseHand: asFunction(
      (deps: Cradle) => new RecogniseHandUseCase(deps),
    ).singleton(),
    removeCardFromHand: asFunction(
      (deps: Cradle) => new RemoveCardFromHandUseCase(deps),
    ).singleton(),
    replaceHand: asFunction(
      (deps: Cradle) => new ReplaceHandUseCase(deps),
    ).singleton(),
    variantCatalog: asFunction(() => new InMemoryVariantCatalog()).singleton(),
  });

  const {
    chooseCard,
    clearHand,
    loadAppInfo,
    loadVariant,
    recogniseHand,
    removeCardFromHand,
    replaceHand,
  } = container.cradle;
  const thunkUseCases: UseCases = {
    chooseCard,
    clearHand,
    loadAppInfo,
    loadVariant,
    recogniseHand,
    removeCardFromHand,
    replaceHand,
  };
  const store = createAppStore(thunkUseCases);
  const { hands, scores, variant } = reduxStores(store);

  container.register({
    hands: asValue(hands),
    scores: asValue(scores),
    variant: asValue(variant),
    // One lock for every use case that changes the hand.
    handLock: asValue(new Mutex()),
    addCardToHand: asFunction(
      (deps: Cradle) => new AddCardToHandUseCase(deps),
    ).singleton(),
    rescore: asFunction((deps: Cradle) => new RescoreUseCase(deps)).singleton(),
  });

  const { addCardToHand, rescore } = container.cradle;

  return { store, useCases: { addCardToHand, rescore } };
}
