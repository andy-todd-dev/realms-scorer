import { emptyHand } from "../domain/hand";
import { ClearHandPorts } from "./clear-hand.ports";

export interface ClearHand {
  execute(): Promise<void>;
}

export class ClearHandUseCase implements ClearHand {
  private readonly ports: ClearHandPorts;

  constructor({ hands, handLock, rescore }: ClearHandPorts) {
    this.ports = { hands, handLock, rescore };
  }

  // Empties the hand, with its choices, and rescores it.
  async execute(): Promise<void> {
    const { hands, handLock, rescore } = this.ports;

    await handLock.runExclusive(async () => hands.save(emptyHand()));
    await rescore.execute();
  }
}
