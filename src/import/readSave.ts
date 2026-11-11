import type { SaveData } from './save'

/**
 * Reads an FM save in a worker with Pyodide + fmsave. The first time, the browser downloads
 * the Python runtime (about 13 MB, served by ProjectFM); `onStage` reports progress.
 */
export function readSave(file: File, onStage: (stage: string) => void): Promise<SaveData> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./save.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (
      e: MessageEvent<{ ok?: boolean; stage?: string; data?: SaveData; error?: string }>,
    ) => {
      if (e.data.stage) return onStage(e.data.stage)
      worker.terminate()
      if (e.data.ok) resolve(e.data.data!)
      else reject(new Error(e.data.error))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'Could not read the save.'))
    }
    onStage('loading')
    worker.postMessage({ file, base: new URL(import.meta.env.BASE_URL, location.href).href })
  })
}
