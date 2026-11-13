import { clsx } from 'clsx'
import { Check, FileUp } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type DragEvent } from 'react'
import { mergeImportPairs, tidyDevelopmentCopies } from '../data/api'
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
  const [stage, setStage] = useState<Stage | null>(null)
  const [fileName, setFileName] = useState('')
  const [save, setSave] = useState<({ name: string } & ReadSaveResult) | null>(null)
  const { data: knownPlayers } = usePlayers(career.id)
  const qc = useQueryClient()
  // Older imports were logged twice: fold each pair into one line, once
  // and tidy development copies made before they were kept only on change (once per career)
  const hasPairs = (imports.data ?? []).some((i) => i.file_name === 'FM save')
  useEffect(() => {
    if (!imports.data) return
    const key = `projectfm.tidyCopies.${career.id}`
    let tidied = false
    try {
      tidied = localStorage.getItem(key) === '1'
    } catch {
      // no storage: the clean-up simply runs again, it changes nothing the second time
    }
    if (!hasPairs && tidied) return
    ;(async () => {
      const merged = hasPairs ? await mergeImportPairs(career.id) : 0
      const removed = tidied ? 0 : await tidyDevelopmentCopies(career.id)
      try {
        localStorage.setItem(key, '1')
      } catch {
        // see above
      }
      if (merged || removed) qc.invalidateQueries()
    })().catch(() => {})
  }, [imports.data, hasPairs, career.id, qc])

  const load = async (f: File | undefined) => {
    if (!f) return
    setError(null)
    setSave(null)
    if (!/\.fm$/i.test(f.name)) {
      setError(new Error('Choose your FM save file (.fm).'))
      return
    }
    setFileName(f.name)
    setStage('loading')
    try {
      const uids = (knownPlayers ?? []).map((p) => p.fm_uid).filter((u): u is number => u != null)
      const result = await readSave(f, uids, (s) =>
        setStage(s === 'reading' ? 'reading' : 'loading'),
      )
      // The save is read: SaveImport now writes it into the app (and reports when done)
      setStage('saving')
      setSave({ name: f.name, ...result })
    } catch (err) {
      setError(err)
      setStage(null)
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

      {stage ? (
        <ImportProgress stage={stage} fileName={fileName} />
      ) : (
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
      )}
      <div className="mt-3">
        <ErrorText error={error} />
      </div>

      {save && (
        <SaveImport
          key={save.name + save.data.gameDate}
          data={save.data}
          summary={save.summary}
          world={save.world}
          fileName={save.name}
          onDone={() => setSave(null)}
          onBusy={(busy) => setStage((s) => (busy ? 'saving' : s === 'saving' ? null : s))}
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

type Stage = 'loading' | 'reading' | 'saving'

const STEPS: [Stage, string, string][] = [
  ['loading', 'Loading the save reader', 'About 13 MB the first time, then kept on this device'],
  ['reading', 'Reading the save', 'Usually a minute or two'],
  ['saving', 'Saving into the app', 'Squad, staff, competitions, tactics and the world'],
]

/** Shown instead of the file picker while a save is being imported, so only one runs. */
function ImportProgress({ stage, fileName }: { stage: Stage; fileName: string }) {
  const at = STEPS.findIndex(([s]) => s === stage)
  return (
    <div
      className="rounded-xl border-2 border-accent/40 bg-surface p-5"
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold">Importing {fileName}</p>
      <p className="mt-1 text-xs text-muted">Keep this page open until it finishes.</p>
      {/* One segment per step: done, running (moving stripe), still to come */}
      <div className="mt-4 grid grid-cols-3 gap-1.5" aria-hidden>
        {STEPS.map(([s], i) => (
          <div key={s} className="relative h-2 overflow-hidden rounded-full bg-surface-2">
            {i < at && <div className="absolute inset-0 bg-accent" />}
            {i === at && (
              <div className="absolute inset-y-0 w-1/3 animate-[import-slide_1.2s_ease-in-out_infinite] rounded-full bg-accent" />
            )}
          </div>
        ))}
      </div>
      <ol className="mt-4 grid gap-2 text-sm">
        {STEPS.map(([s, label, hint], i) => (
          <li key={s} className="flex items-start gap-2">
            <span
              className={clsx(
                'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[11px]',
                i < at && 'border-accent bg-accent text-bg',
                i === at && 'border-accent text-accent',
                i > at && 'border-border text-muted',
              )}
            >
              {i < at ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={clsx(i > at && 'text-muted')}>
              <span className={clsx(i === at && 'font-semibold')}>{label}</span>
              {i === at && <span className="block text-xs text-muted">{hint}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
