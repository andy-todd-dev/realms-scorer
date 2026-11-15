import { ChooseCard } from "./choose-card.usecase";
import { ClearHand } from "./clear-hand.usecase";
import { LoadAppInfo } from "./load-app-info.usecase";
import { LoadVariant } from "./load-variant.usecase";
import { RecogniseHand } from "./recognise-hand.usecase";
import { RemoveCardFromHand } from "./remove-card-from-hand.usecase";
import { ReplaceHand } from "./replace-hand.usecase";

export interface UseCases {
  chooseCard: ChooseCard;
  clearHand: ClearHand;
  loadAppInfo: LoadAppInfo;
  loadVariant: LoadVariant;
  recogniseHand: RecogniseHand;
  removeCardFromHand: RemoveCardFromHand;
  replaceHand: ReplaceHand;
}
