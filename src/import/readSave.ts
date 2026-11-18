import type { DumpSummary } from './dump'
import type { SaveData } from './save'

export interface ReadSaveResult {
  data: SaveData
  /** Squad and scouts, as from a Reader dump. */
  summary: DumpSummary
  /** Gzipped world file (all players). */
  world: Blob
  /** Gzipped season stats of every player, and how many players have stats. */
  stats: Blob | null
  statsPlayers: number
  /** The fmsave version that read the save, and why the newest was not used (if so). */
  reader: { version: string; latestError?: string; latestVersion?: string }
}

type ReaderCopy = 'latest' | 'known-good'

function runReader(
  file: File,
  knownUids: number[],
  onStage: (stage: string) => void,
  copy: ReaderCopy,
): Promise<Omit<ReadSaveResult, 'reader'> & { readerVersion: string }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./save.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (
      e: MessageEvent<
        {
          ok?: boolean
          stage?: string
          error?: string
          readerVersion?: string
        } & Partial<ReadSaveResult>
      >,
    ) => {
      if (e.data.stage) return onStage(e.data.stage)
      worker.terminate()
      if (e.data.ok)
        resolve({
          data: e.data.data!,
          summary: e.data.summary!,
          world: e.data.world!,
          stats: e.data.stats ?? null,
          statsPlayers: e.data.statsPlayers ?? 0,
          readerVersion: e.data.readerVersion ?? '?',
        })
      else reject(new Error(e.data.error))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'Could not read the save.'))
    }
    onStage('loading')
    worker.postMessage({
      file,
      knownUids,
      copy,
      base: new URL(import.meta.env.BASE_URL, location.href).href,
    })
  })
}

/** The newest and known-good fmsave versions this build carries. */
async function readerVersions(): Promise<{ version: string; fallback: string } | null> {
  try {
    const url = new URL(
      'fmsave/fmsave-latest.json',
      new URL(import.meta.env.BASE_URL, location.href),
    )
    return (await (await fetch(url, { cache: 'no-store' })).json()) as {
      version: string
      fallback: string
    }
  } catch {
    return null
  }
}

/**
 * Reads an FM save in a worker with Pyodide + fmsave: the newest fmsave release first and,
 * if that fails on this save, the known-good copy. The first time, the browser downloads
 * the Python runtime (about 13 MB, served by ProjectFM); `onStage` reports progress.
 */
export async function readSave(
  file: File,
  knownUids: number[],
  onStage: (stage: string) => void,
): Promise<ReadSaveResult> {
  const versions = await readerVersions()
  try {
    const { readerVersion, ...r } = await runReader(file, knownUids, onStage, 'latest')
    return { ...r, reader: { version: readerVersion } }
  } catch (error) {
    // Same version both ways: nothing else to try
    if (versions && versions.version === versions.fallback) throw error
    const { readerVersion, ...r } = await runReader(file, knownUids, onStage, 'known-good')
    return {
      ...r,
      reader: {
        version: readerVersion,
        latestVersion: versions?.version,
        latestError: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

/**
 * Unpacks a Zstandard frame with the save reader's Python runtime (downloaded once, then kept
 * on this device). Used for FM tactic files that FM compressed itself.
 */
export function unzstd(frame: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./save.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ ok?: boolean; bytes?: Uint8Array; error?: string }>) => {
      worker.terminate()
      if (e.data.ok && e.data.bytes) resolve(e.data.bytes)
      else reject(new Error(e.data.error || 'Could not unpack the file.'))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'Could not unpack the file.'))
    }
    worker.postMessage({
      zstd: frame,
      base: new URL(import.meta.env.BASE_URL, location.href).href,
    })
  })
}
