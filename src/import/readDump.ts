import type { DumpSummary } from './dump'

/** Reads dump.json in a worker (it can be 100+ MB) and returns what ProjectFM imports. */
export interface ReadDumpResult {
  summary: DumpSummary
  /** Gzipped world file (all players). */
  world: Blob
}

export function readDump(file: File, knownUids: number[]): Promise<ReadDumpResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./dump.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (
      e: MessageEvent<{ ok: boolean; summary?: DumpSummary; world?: Blob; error?: string }>,
    ) => {
      worker.terminate()
      if (e.data.ok) resolve({ summary: e.data.summary!, world: e.data.world! })
      else reject(new Error(e.data.error))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'Could not read the file.'))
    }
    worker.postMessage({ file, knownUids })
  })
}
