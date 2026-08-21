import localforage from "localforage";

/**
 * localForage touches IndexedDB at construction, which is not available while
 * the app prerenders on the server. Instances are created lazily so importing
 * anything from here stays safe in a Server Component tree.
 */
const instances = new Map<string, LocalForage>();

function store(name: string): LocalForage | null {
  if (typeof window === "undefined") {
    return null;
  }
  const existing = instances.get(name);
  if (existing) {
    return existing;
  }
  const created = localforage.createInstance({ name: "qRunner", storeName: name });
  instances.set(name, created);
  return created;
}

export async function storageGet<T>(storeName: string, key: string): Promise<T | null> {
  const instance = store(storeName);
  if (!instance) {
    return null;
  }
  return (await instance.getItem<T>(key)) ?? null;
}

export async function storageSet<T>(storeName: string, key: string, value: T): Promise<void> {
  await store(storeName)?.setItem(key, value);
}

export async function storageRemove(storeName: string, key: string): Promise<void> {
  await store(storeName)?.removeItem(key);
}

export async function storageKeys(storeName: string): Promise<string[]> {
  return (await store(storeName)?.keys()) ?? [];
}

export async function storageValues<T>(storeName: string): Promise<T[]> {
  const instance = store(storeName);
  if (!instance) {
    return [];
  }
  const keys = await instance.keys();
  const values: T[] = [];
  for (const key of keys) {
    const value = await instance.getItem<T>(key);
    if (value !== null && value !== undefined) {
      values.push(value);
    }
  }
  return values;
}
