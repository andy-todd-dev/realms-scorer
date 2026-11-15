import { Rescore } from "./rescore.usecase";

/*
  The use cases that run a whole change through the stores, for the UI to call directly. `UseCases` holds the
  stateless ones the Redux thunks still call, until each has moved here.
*/
export interface AppUseCases {
  rescore: Rescore;
}
