import { openDB } from 'idb';

const dbPromise = openDB('duang-db', 1, {
  upgrade(db) {
    db.createObjectStore('keyval');
  },
});

export async function get<T>(key: IDBValidKey): Promise<T | undefined> {
  return (await dbPromise).get('keyval', key);
}

export async function set(key: IDBValidKey, val: any): Promise<IDBValidKey> {
  return (await dbPromise).put('keyval', val, key);
}