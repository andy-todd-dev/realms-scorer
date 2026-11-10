import { asFunction, createContainer, InjectionMode } from "awilix";
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
import { ScoreHand, ScoreHandUseCase } from "./application/score-hand.usecase";
import { UseCases } from "./application/use-cases";
import { ExpoApplicationAppInfo } from "./infrastructure/driven/expo-application-app-info";
import { InMemoryCardCatalog } from "./infrastructure/driven/in-memory-card-catalog";
import { InMemoryVariantCatalog } from "./infrastructure/driven/in-memory-variant-catalog";
import { MlKitCardRecognizer } from "./infrastructure/driven/ml-kit-card-recognizer/ml-kit-card-recognizer";

type Cradle = {
  addCardToHand: AddCardToHand;
  appInfo: ExpoApplicationAppInfo;
  cardCatalog: InMemoryCardCatalog;
  cardRecognizer: MlKitCardRecognizer;
  chooseCard: ChooseCard;
  clearHand: ClearHand;
  loadAppInfo: LoadAppInfo;
  loadVariant: LoadVariant;
  recogniseHand: RecogniseHand;
  removeCardFromHand: RemoveCardFromHand;
  replaceHand: ReplaceHand;
  scoreHand: ScoreHand;
  variantCatalog: InMemoryVariantCatalog;
};

export function createUseCases(): UseCases {
  const container = createContainer<Cradle>({
    injectionMode: InjectionMode.PROXY,
    strict: true,
  });

  container.register({
    addCardToHand: asFunction(
      (deps: Cradle) => new AddCardToHandUseCase(deps),
    ).singleton(),
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
    scoreHand: asFunction(
      (deps: Cradle) => new ScoreHandUseCase(deps),
    ).singleton(),
    variantCatalog: asFunction(() => new InMemoryVariantCatalog()).singleton(),
  });

  const {
    addCardToHand,
    chooseCard,
    clearHand,
    loadAppInfo,
    loadVariant,
    recogniseHand,
    removeCardFromHand,
    replaceHand,
    scoreHand,
  } = container.cradle;

  return {
    addCardToHand,
    chooseCard,
    clearHand,
    loadAppInfo,
    loadVariant,
    recogniseHand,
    removeCardFromHand,
    replaceHand,
    scoreHand,
  };
}
