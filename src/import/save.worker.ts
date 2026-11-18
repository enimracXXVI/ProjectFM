/// <reference lib="webworker" />
// Reads an FM save in this worker with Pyodide (Python in the browser) and fmsave (MIT): the
// newest release (downloaded at each build) or, when that fails, the known-good copy.
// The file is mounted read-only with WORKERFS: its bytes are read as needed and never
// leave the computer. Pyodide and fmsave are served by ProjectFM itself.
import { buildWorld } from '../world/world'
import { summarizeDump } from './dump'
import { dumpFromSave, type SaveData } from './save'

interface PyodideLike {
  FS: {
    mkdirTree(path: string): void
    mount(type: unknown, opts: { files: File[] }, path: string): void
    unmount(path: string): void
    writeFile(path: string, data: string | Uint8Array): void
    readFile(path: string): Uint8Array
    filesystems: { WORKERFS: { stream_ops: { read: (...a: unknown[]) => unknown } } }
    ErrnoError: new (code: number) => Error
  }
  unpackArchive(buffer: ArrayBuffer, format: string): void
  runPython(code: string): unknown
  pyimport(name: string): { extract: (path: string) => string }
}

let ready: Promise<PyodideLike> | null = null

export type ReaderCopy = 'latest' | 'known-good'

async function boot(base: string, copy: ReaderCopy): Promise<PyodideLike> {
  const indexURL = new URL('pyodide/', base).href
  const { loadPyodide } = (await import(/* @vite-ignore */ indexURL + 'pyodide.mjs')) as {
    loadPyodide: (o: { indexURL: string }) => Promise<PyodideLike>
  }
  const py = await loadPyodide({ indexURL })
  // A save that changes on disk while being read (FM saving over it) must not crash Python
  const ops = py.FS.filesystems.WORKERFS.stream_ops
  const read = ops.read
  ops.read = function (this: unknown, ...args: unknown[]) {
    try {
      return read.apply(this, args)
    } catch (error) {
      if (error instanceof py.FS.ErrnoError) throw error
      throw new py.FS.ErrnoError(29)
    }
  }
  // fmsave: the newest release (downloaded at build time) or the known-good copy
  const wheel = await (
    await fetch(new URL(`fmsave/fmsave-${copy}.whl`, base), { cache: 'no-store' })
  ).arrayBuffer()
  py.unpackArchive(wheel, 'wheel')
  py.FS.writeFile(
    '/home/pyodide/extract.py',
    // Never a cached copy: an old reader would silently miss newer data
    await (await fetch(new URL('fmsave/extract.py', base), { cache: 'no-store' })).text(),
  )
  py.runPython('import sys; sys.path.insert(0, "/home/pyodide")')
  return py
}

self.onmessage = async (
  e: MessageEvent<{
    file: File
    base: string
    knownUids: number[]
    zstd?: Uint8Array
    copy?: ReaderCopy
  }>,
) => {
  try {
    ready ??= boot(e.data.base, e.data.copy ?? 'latest')
    const py = await ready
    // A Zstandard frame to unpack (FM tactic files), with the save reader's own Zstandard
    if (e.data.zstd) {
      py.FS.writeFile('/tmp/in.zst', e.data.zstd)
      py.runPython(
        [
          'from fmsave._container import zstd',
          "with open('/tmp/in.zst', 'rb') as f:",
          '    data = zstd.ZstdDecompressor().decompress(f.read())',
          "with open('/tmp/out', 'wb') as f:",
          '    f.write(data)',
        ].join('\n'),
      )
      self.postMessage({ ok: true, bytes: py.FS.readFile('/tmp/out') })
      return
    }
    self.postMessage({ stage: 'reading' })
    try {
      py.FS.unmount('/save')
    } catch {
      // nothing mounted yet
    }
    py.FS.mkdirTree('/save')
    py.FS.mount(py.FS.filesystems.WORKERFS, { files: [e.data.file] }, '/save')
    const data = JSON.parse(
      py.pyimport('extract').extract('/save/' + e.data.file.name) as string,
    ) as SaveData
    // Every player, in the same shape as a Reader dump: squad import and world database
    const dump = dumpFromSave(data)
    delete data.dump
    const summary = summarizeDump(dump, e.data.knownUids)
    const gzip = (value: unknown) =>
      new Response(
        new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('gzip')),
      ).blob()
    const world = await gzip(buildWorld(dump))
    // Every player's season stats: stored as their own file, not kept in memory
    const stats = data.worldStats ? await gzip(data.worldStats) : null
    const statsPlayers = data.worldStats ? new Set(data.worldStats.rows.map((r) => r[0])).size : 0
    delete data.worldStats
    const readerVersion = String(py.runPython('import fmsave; fmsave.__version__'))
    self.postMessage({ ok: true, data, summary, world, stats, statsPlayers, readerVersion })
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
