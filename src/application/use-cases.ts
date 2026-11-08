import { AddCardToHand } from "./add-card-to-hand.usecase";
import { ChooseCard } from "./choose-card.usecase";
import { ClearHand } from "./clear-hand.usecase";
import { LoadVariant } from "./load-variant.usecase";
import { RemoveCardFromHand } from "./remove-card-from-hand.usecase";
import { ScoreHand } from "./score-hand.usecase";

export interface UseCases {
  addCardToHand: AddCardToHand;
  chooseCard: ChooseCard;
  clearHand: ClearHand;
  loadVariant: LoadVariant;
  removeCardFromHand: RemoveCardFromHand;
  scoreHand: ScoreHand;
}
