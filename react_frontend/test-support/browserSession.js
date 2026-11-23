export function mockBrowserSession(storage = new Map(), locks = new Set()) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, value); },
    } },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { locks: {
      request(name, options, callback) {
        if (locks.has(name)) return Promise.resolve(callback(null));
        locks.add(name);
        return Promise.resolve().then(() => callback({ name }))
          .finally(() => locks.delete(name));
      },
    } },
  });
  return {
    storage,
    locks,
    restore() {
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else delete globalThis.window;
      if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator);
      else delete globalThis.navigator;
    },
  };
}
