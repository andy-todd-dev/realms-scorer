/*
  Application state that changes over time, shaped like React's useSyncExternalStore contract without depending on
  React. Use cases read with `get` and write with `save`; the UI reads with `get` and hears about changes through
  `subscribe`.

  An implementation must keep both functions stable, built once rather than per call, and `get` must return the same
  value until a save changes it, or React resubscribes or re-renders forever.
*/

export type Unsubscribe = () => void;

export interface Observable<T> {
  get(): T;
  subscribe(listener: () => void): Unsubscribe;
}

export interface Store<T> extends Observable<T> {
  save(value: T): void;
}
