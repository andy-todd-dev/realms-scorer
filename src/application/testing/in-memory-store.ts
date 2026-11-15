import { Store } from "../observable";

/*
  A store that keeps its value in memory, for use-case and component tests. Listeners hear only about saves that change
  the value, as with the Redux adapter, which compares references.
*/
export class InMemoryStore<T> implements Store<T> {
  private value: T;
  private readonly listeners = new Set<() => void>();

  constructor(initial: T) {
    this.value = initial;
  }

  // Arrow functions, so they stay bound when passed around on their own, as useSyncExternalStore does.
  get = (): T => this.value;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  save = (value: T): void => {
    if (value === this.value) {
      return;
    }

    this.value = value;
    // A copy, so a listener that unsubscribes while being told doesn't skip the next one.
    [...this.listeners].forEach((listener) => listener());
  };
}
