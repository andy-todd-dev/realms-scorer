import { InMemoryStore } from "./in-memory-store";

describe("InMemoryStore", () => {
  it("starts with the initial value and returns what was saved", () => {
    const store = new InMemoryStore(0);

    expect(store.get()).toBe(0);

    store.save(1);

    expect(store.get()).toBe(1);
  });

  it("tells listeners about a save that changes the value, and only then", () => {
    const store = new InMemoryStore(0);
    const listener = jest.fn();
    store.subscribe(listener);

    store.save(1);
    store.save(1);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops telling a listener once it unsubscribes", () => {
    const store = new InMemoryStore(0);
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.save(1);

    expect(listener).not.toHaveBeenCalled();
  });
});
