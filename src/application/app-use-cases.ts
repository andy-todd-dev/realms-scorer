import { AddCardToHand } from "./add-card-to-hand.usecase";
import { ChooseCard } from "./choose-card.usecase";
import { ClearHand } from "./clear-hand.usecase";
import { LoadAppInfo } from "./load-app-info.usecase";
import { LoadVariant } from "./load-variant.usecase";
import { RecogniseHand } from "./recognise-hand.usecase";
import { RemoveCardFromHand } from "./remove-card-from-hand.usecase";
import { ReplaceHand } from "./replace-hand.usecase";
import { Rescore } from "./rescore.usecase";

// The use cases the UI calls. Each runs a whole change through the stores, apart from RecogniseHand, which returns what it found.
export interface AppUseCases {
  addCardToHand: AddCardToHand;
  chooseCard: ChooseCard;
  clearHand: ClearHand;
  loadAppInfo: LoadAppInfo;
  loadVariant: LoadVariant;
  recogniseHand: RecogniseHand;
  removeCardFromHand: RemoveCardFromHand;
  replaceHand: ReplaceHand;
  rescore: Rescore;
}
