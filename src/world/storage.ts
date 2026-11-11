import { supabase } from '../lib/supabase'
import { deleteCachedWorld, getCachedWorld, setCachedWorld } from './cache'
import type { WorldFile } from './world'

const BUCKET = 'world-data'
const NAME = 'world.json.gz'

async function folder(careerId: string): Promise<string> {
  // Session stored on this device: no network round trip, works offline
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) throw new Error('Not signed in')
  return `${user.id}/${careerId}`
}

export async function uploadWorld(careerId: string, blob: Blob): Promise<void> {
  const path = `${await folder(careerId)}/${NAME}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'application/gzip', cacheControl: '0' })
  if (error) throw new Error(error.message)
}

function unpack(blob: Blob): Promise<WorldFile> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./world.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ ok: boolean; file?: WorldFile; error?: string }>) => {
      worker.terminate()
      if (e.data.ok) resolve(e.data.file!)
      else reject(new Error(e.data.error))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'Could not open the world database.'))
    }
    worker.postMessage(blob)
  })
}

export interface LoadedWorld {
  file: WorldFile
  updatedAt: string
  /** True when the copy on this device was used (offline or already up to date). */
  fromCache: boolean
}

/**
 * The career's world database: from this device's cache when it is current (or when
 * offline), otherwise downloaded and cached. Null when none has been uploaded yet.
 */
export async function loadWorld(careerId: string): Promise<LoadedWorld | null> {
  const cached = await getCachedWorld(careerId)
  let remoteUpdated: string | null = null
  let dir: string | null = null
  try {
    dir = await folder(careerId)
    const { data, error } = await supabase.storage.from(BUCKET).list(dir)
    if (error) throw error
    const entry = data?.find((f) => f.name === NAME)
    if (!entry) return null
    remoteUpdated = entry.updated_at ?? entry.created_at ?? ''
  } catch {
    // Offline: fall back to the copy on this device
    if (cached)
      return { file: await unpack(cached.blob), updatedAt: cached.updatedAt, fromCache: true }
    throw new Error('The world database is not on this device yet and could not be downloaded.')
  }

  if (cached && cached.updatedAt === remoteUpdated) {
    return { file: await unpack(cached.blob), updatedAt: cached.updatedAt, fromCache: true }
  }
  const { data: blob, error } = await supabase.storage.from(BUCKET).download(`${dir}/${NAME}`)
  if (error || !blob) throw new Error(error?.message ?? 'Download failed')
  await setCachedWorld(careerId, { updatedAt: remoteUpdated, blob })
  return { file: await unpack(blob), updatedAt: remoteUpdated, fromCache: false }
}

/** Removes the career's world database from Supabase and from this device. */
export async function deleteWorld(careerId: string): Promise<void> {
  const path = `${await folder(careerId)}/${NAME}`
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error(error.message)
  await deleteCachedWorld(careerId)
}
