/// <reference lib="webworker" />
// Reads an FM save in this worker with Pyodide (Python in the browser) and fmsave (MIT).
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
    writeFile(path: string, data: string): void
    filesystems: { WORKERFS: { stream_ops: { read: (...a: unknown[]) => unknown } } }
    ErrnoError: new (code: number) => Error
  }
  unpackArchive(buffer: ArrayBuffer, format: string): void
  runPython(code: string): unknown
  pyimport(name: string): { extract: (path: string) => string }
}

let ready: Promise<PyodideLike> | null = null

async function boot(base: string): Promise<PyodideLike> {
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
  const wheel = await (
    await fetch(new URL('fmsave/fmsave-0.12.1-py3-none-any.whl', base))
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

self.onmessage = async (e: MessageEvent<{ file: File; base: string; knownUids: number[] }>) => {
  try {
    ready ??= boot(e.data.base)
    const py = await ready
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
    const json = new Blob([JSON.stringify(buildWorld(dump))])
    const world = await new Response(
      json.stream().pipeThrough(new CompressionStream('gzip')),
    ).blob()
    self.postMessage({ ok: true, data, summary, world })
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
