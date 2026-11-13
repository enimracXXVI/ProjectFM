import { clsx } from 'clsx'
import { FileUp } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { ErrorText } from '../components/form'
import { PageHeader } from '../components/ui'
import { useImports, usePlayers } from '../data/hooks'
import { readSave, type ReadSaveResult } from '../import/readSave'
import { useCurrentCareer } from '../lib/career'
import { SaveImport } from './SaveImport'

/** Import: your FM save (.fm). */
export function Import() {
  const career = useCurrentCareer()
  const imports = useImports(career.id)
  const [error, setError] = useState<unknown>(null)
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState<string | null>(null)
  const [save, setSave] = useState<({ name: string } & ReadSaveResult) | null>(null)
  const { data: knownPlayers } = usePlayers(career.id)

  const load = async (f: File | undefined) => {
    if (!f) return
    setError(null)
    setSave(null)
    if (!/\.fm$/i.test(f.name)) {
      setError(new Error('Choose your FM save file (.fm).'))
      return
    }
    setReading('Loading Python for the save reader (about 13 MB the first time)…')
    try {
      const uids = (knownPlayers ?? []).map((p) => p.fm_uid).filter((u): u is number => u != null)
      const result = await readSave(f, uids, (stage) =>
        setReading(
          stage === 'reading'
            ? 'Reading the save… this can take a minute or two.'
            : 'Loading Python for the save reader (about 13 MB the first time)…',
        ),
      )
      setSave({ name: f.name, ...result })
    } catch (err) {
      setError(err)
    } finally {
      setReading(null)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    load(e.dataTransfer.files[0])
  }

  return (
    <>
      <PageHeader title="Import" subtitle={`Into ${career.name} · ${career.club}`} />

      <label
        onDragOver={(e) => (e.preventDefault(), setDragging(true))}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={clsx(
          'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
          dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-muted',
        )}
      >
        <FileUp className="size-8 text-muted" aria-hidden />
        <span className="font-semibold">Choose your FM save</span>
        <span className="text-sm text-muted">
          <span className="hidden md:inline">or drop it here · </span>the .fm file from FM's save
          folder
        </span>
        <input
          type="file"
          className="sr-only"
          onChange={(e) => (load(e.target.files?.[0]), (e.target.value = ''))}
        />
      </label>
      <div className="mt-3">
        <ErrorText error={error} />
        {reading && (
          <p className="text-sm text-muted" role="status">
            {reading}
          </p>
        )}
      </div>

      {save && (
        <SaveImport
          key={save.name + save.data.gameDate}
          data={save.data}
          summary={save.summary}
          world={save.world}
          fileName={save.name}
          onDone={() => setSave(null)}
        />
      )}

      {!!imports.data?.length && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-muted">Recent imports</h2>
          <ul className="grid gap-1 text-sm">
            {imports.data.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap justify-between gap-2 rounded-lg bg-surface px-3 py-2"
              >
                <span className="truncate">{i.file_name}</span>
                <span className="text-muted">
                  {i.row_count} players · {i.season} · {new Date(i.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
