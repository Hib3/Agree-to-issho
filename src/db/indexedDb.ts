import { DB_NAME, DB_VERSION, type StoreName, type StoreRecordMap, storeNames } from "./schema";
import type { WordFrame } from "../types/domain";

let dbPromise: Promise<IDBDatabase> | null = null;

export function openAppDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of storeNames) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: "id" });
          if (storeName === "words") {
            store.createIndex("surface", "surface", { unique: false });
            store.createIndex("reading", "reading", { unique: false });
            store.createIndex("category", "category", { unique: false });
          }
          if (storeName === "diary_entries") {
            store.createIndex("entry_date", "entry_date", { unique: true });
          }
          if (storeName === "event_flags") {
            store.createIndex("key", "key", { unique: true });
          }
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function txDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function withStore<TStore extends StoreName, TResult>(
  storeName: TStore,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<TResult> | void
): Promise<TResult | undefined> {
  const db = await openAppDatabase();
  const transaction = db.transaction(storeName, mode);
  const store = transaction.objectStore(storeName);
  const request = run(store);
  const result = request
    ? new Promise<TResult>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
    : Promise.resolve(undefined as TResult);
  const [value] = await Promise.all([result, txDone(transaction)]);
  return value;
}

export const appDb = {
  get<TStore extends StoreName>(storeName: TStore, key: IDBValidKey): Promise<StoreRecordMap[TStore] | undefined> {
    return withStore(storeName, "readonly", (store) => store.get(key)) as Promise<StoreRecordMap[TStore] | undefined>;
  },

  async getAll<TStore extends StoreName>(storeName: TStore): Promise<StoreRecordMap[TStore][]> {
    const result = await withStore(storeName, "readonly", (store) => store.getAll());
    return (result ?? []) as StoreRecordMap[TStore][];
  },

  async put<TStore extends StoreName>(storeName: TStore, value: StoreRecordMap[TStore]): Promise<void> {
    await withStore(storeName, "readwrite", (store) => {
      store.put(value);
    });
  },

  async delete(storeName: StoreName, key: IDBValidKey): Promise<void> {
    await withStore(storeName, "readwrite", (store) => {
      store.delete(key);
    });
  },

  async clear(storeName: StoreName): Promise<void> {
    await withStore(storeName, "readwrite", (store) => {
      store.clear();
    });
  }
};

export async function findWordBySurface(surface: string): Promise<WordFrame | undefined> {
  const words = await appDb.getAll("words");
  return words.find((word) => word.surface === surface);
}
