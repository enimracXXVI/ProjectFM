/** Tiny IndexedDB store for the downloaded world file, so it opens offline and instantly. */
const DB = 'projectfm'
const STORE = 'world'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export interface CachedWorld {
  updatedAt: string
  blob: Blob
}

export async function getCachedWorld(key: string): Promise<CachedWorld | null> {
  try {
    const db = await open()
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key)
      req.onsuccess = () => resolve((req.result as CachedWorld) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null // private mode or storage blocked: just download each time
  }
}

export async function setCachedWorld(key: string, value: CachedWorld): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // ignore: caching is only a speed-up
  }
}

export async function deleteCachedWorld(key: string): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // nothing cached
  }
}
