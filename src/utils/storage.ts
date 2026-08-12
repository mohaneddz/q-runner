import localforage from "localforage";

const store = localforage.createInstance({
  name: "q-runner",
  storeName: "levels",
});

export async function storageGet<T>(key: string): Promise<T | null> {
  const value = await store.getItem<T>(key);
  return value ?? null;
}

export async function storageSet<T>(key: string, value: T): Promise<void> {
  await store.setItem(key, value);
}

export async function storageRemove(key: string): Promise<void> {
  await store.removeItem(key);
}

export async function storageKeys(): Promise<string[]> {
  return store.keys();
}
