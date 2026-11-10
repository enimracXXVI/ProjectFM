/// <reference lib="webworker" />
import { buildWorld } from '../world/world'
import { summarizeDump, type Dump } from './dump'

// Parsing a 100+ MB dump takes a few seconds: done here so the page stays responsive.
self.onmessage = async (e: MessageEvent<{ file: File; knownUids: number[] }>) => {
  try {
    const dump = JSON.parse(await e.data.file.text()) as Dump
    if (!dump.meta || !Array.isArray(dump.players) || !Array.isArray(dump.staff)) {
      throw new Error('This is not an FMSuperScout dump.json file.')
    }
    const summary = summarizeDump(dump, e.data.knownUids)
    // Compact, gzipped copy of every player for the world database
    const json = new Blob([JSON.stringify(buildWorld(dump))])
    const world = await new Response(
      json.stream().pipeThrough(new CompressionStream('gzip')),
    ).blob()
    self.postMessage({ ok: true, summary, world })
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
