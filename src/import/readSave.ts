import type { DumpSummary } from './dump'
import type { SaveData } from './save'

export interface ReadSaveResult {
  data: SaveData
  /** Squad and scouts, as from a Reader dump. */
  summary: DumpSummary
  /** Gzipped world file (all players). */
  world: Blob
}

/**
 * Reads an FM save in a worker with Pyodide + fmsave. The first time, the browser downloads
 * the Python runtime (about 13 MB, served by ProjectFM); `onStage` reports progress.
 */
export function readSave(
  file: File,
  knownUids: number[],
  onStage: (stage: string) => void,
): Promise<ReadSaveResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./save.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (
      e: MessageEvent<{ ok?: boolean; stage?: string; error?: string } & Partial<ReadSaveResult>>,
    ) => {
      if (e.data.stage) return onStage(e.data.stage)
      worker.terminate()
      if (e.data.ok) resolve({ data: e.data.data!, summary: e.data.summary!, world: e.data.world! })
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
      base: new URL(import.meta.env.BASE_URL, location.href).href,
    })
  })
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
