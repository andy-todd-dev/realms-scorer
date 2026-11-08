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
  LoadVariant,
  LoadVariantUseCase,
} from "./application/load-variant.usecase";
import {
  RemoveCardFromHand,
  RemoveCardFromHandUseCase,
} from "./application/remove-card-from-hand.usecase";
import { ScoreHand, ScoreHandUseCase } from "./application/score-hand.usecase";
import { UseCases } from "./application/use-cases";
import { InMemoryCardCatalog } from "./infrastructure/driven/in-memory-card-catalog";
import { InMemoryVariantCatalog } from "./infrastructure/driven/in-memory-variant-catalog";

type Cradle = {
  addCardToHand: AddCardToHand;
  cardCatalog: InMemoryCardCatalog;
  chooseCard: ChooseCard;
  clearHand: ClearHand;
  loadVariant: LoadVariant;
  removeCardFromHand: RemoveCardFromHand;
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
    cardCatalog: asFunction(() => new InMemoryCardCatalog()).singleton(),
    chooseCard: asFunction(
      (deps: Cradle) => new ChooseCardUseCase(deps),
    ).singleton(),
    clearHand: asFunction(() => new ClearHandUseCase()).singleton(),
    loadVariant: asFunction(
      (deps: Cradle) => new LoadVariantUseCase(deps),
    ).singleton(),
    removeCardFromHand: asFunction(
      (deps: Cradle) => new RemoveCardFromHandUseCase(deps),
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
    loadVariant,
    removeCardFromHand,
    scoreHand,
  } = container.cradle;

  return {
    addCardToHand,
    chooseCard,
    clearHand,
    loadVariant,
    removeCardFromHand,
    scoreHand,
  };
}
