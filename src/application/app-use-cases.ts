import { AddCardToHand } from "./add-card-to-hand.usecase";
import { ChooseCard } from "./choose-card.usecase";
import { ClearHand } from "./clear-hand.usecase";
import { RemoveCardFromHand } from "./remove-card-from-hand.usecase";
import { ReplaceHand } from "./replace-hand.usecase";
import { Rescore } from "./rescore.usecase";

/*
  The use cases that run a whole change through the stores, for the UI to call directly. `UseCases` holds the
  stateless ones the Redux thunks still call, until each has moved here.
*/
export interface AppUseCases {
  addCardToHand: AddCardToHand;
  chooseCard: ChooseCard;
  clearHand: ClearHand;
  removeCardFromHand: RemoveCardFromHand;
  replaceHand: ReplaceHand;
  rescore: Rescore;
}
