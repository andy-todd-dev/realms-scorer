import { Hand } from "../domain/hand";

export interface Hands {
  save(hand: Hand): void;
}

// Runs one change to the hand at a time, so overlapping changes can't overwrite each other.
export interface HandLock {
  runExclusive<T>(change: () => Promise<T>): Promise<T>;
}

export interface Rescore {
  execute(): Promise<void>;
}

export interface ClearHandPorts {
  hands: Hands;
  handLock: HandLock;
  rescore: Rescore;
}
