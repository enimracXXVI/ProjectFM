/// <reference lib="webworker" />
import { summarizeDump, type Dump } from './dump'

// Parsing a 100+ MB dump takes a few seconds: done here so the page stays responsive.
self.onmessage = async (e: MessageEvent<{ file: File; knownUids: number[] }>) => {
  try {
    const dump = JSON.parse(await e.data.file.text()) as Dump
    if (!dump.meta || !Array.isArray(dump.players) || !Array.isArray(dump.staff)) {
      throw new Error('This is not an FMSuperScout dump.json file.')
    }
    self.postMessage({ ok: true, summary: summarizeDump(dump, e.data.knownUids) })
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
