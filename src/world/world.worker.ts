/// <reference lib="webworker" />
import type { WorldFile } from './world'

// Unzips and parses the world file (or a season stats file) off the main thread.
self.onmessage = async (e: MessageEvent<Blob | { blob: Blob; kind: 'stats' }>) => {
  try {
    const blob = e.data instanceof Blob ? e.data : e.data.blob
    const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'))
    const parsed = JSON.parse(await new Response(stream).text()) as unknown
    if (e.data instanceof Blob) {
      const file = parsed as WorldFile
      // Files uploaded before unnamed placeholder players were filtered out
      file.rows = file.rows.filter((r) => r[1] !== '?')
      self.postMessage({ ok: true, file })
    } else self.postMessage({ ok: true, file: parsed })
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
