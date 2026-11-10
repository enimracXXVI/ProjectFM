import type { DumpSummary } from './dump'

/** Reads dump.json in a worker (it can be 100+ MB) and returns what ProjectFM imports. */
export function readDump(file: File, knownUids: number[]): Promise<DumpSummary> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./dump.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (
      e: MessageEvent<{ ok: boolean; summary?: DumpSummary; error?: string }>,
    ) => {
      worker.terminate()
      if (e.data.ok) resolve(e.data.summary!)
      else reject(new Error(e.data.error))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'Could not read the file.'))
    }
    worker.postMessage({ file, knownUids })
  })
}
