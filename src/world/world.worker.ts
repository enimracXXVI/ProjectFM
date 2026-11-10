/// <reference lib="webworker" />
import type { WorldFile } from './world'

// Unzips and parses the world file off the main thread (tens of thousands of players).
self.onmessage = async (e: MessageEvent<Blob>) => {
  try {
    const stream = e.data.stream().pipeThrough(new DecompressionStream('gzip'))
    const file = JSON.parse(await new Response(stream).text()) as WorldFile
    self.postMessage({ ok: true, file })
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
