import { LoadAppInfo } from "./load-app-info.usecase";
import { LoadVariant } from "./load-variant.usecase";
import { RecogniseHand } from "./recognise-hand.usecase";

export interface UseCases {
  loadAppInfo: LoadAppInfo;
  loadVariant: LoadVariant;
  recogniseHand: RecogniseHand;
}
