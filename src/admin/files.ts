/** Uploaded 3D model files, kept in the browser's IndexedDB (too big for localStorage). */
const DB = 'bakugan-admin-files'
const STORE = 'files'

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const saveFile = (key: string, file: Blob) => run('readwrite', (s) => s.put(file, key))
export const deleteFile = (key: string) => run('readwrite', (s) => s.delete(key))
export const loadFile = (key: string) => run<Blob | undefined>('readonly', (s) => s.get(key))

/** Model references stored in admin data look like "idb:<key>". */
export const IDB_PREFIX = 'idb:'
