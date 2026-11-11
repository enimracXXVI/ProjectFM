import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { FileUp } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, ErrorText, Field } from '../components/form'
import { Card, PageHeader } from '../components/ui'
import { importPlayers, type ImportSummary } from '../data/api'
import { useImports, usePlayers } from '../data/hooks'
import { parsePlayers, type ParseResult } from '../import/parse'
import { readDump, type ReadDumpResult } from '../import/readDump'
import { DumpImport } from './DumpImport'
import { SaveImport } from './SaveImport'
import { readSave, type ReadSaveResult } from '../import/readSave'
import { useCurrentCareer } from '../lib/career'

export function Import() {
  const career = useCurrentCareer()
  const qc = useQueryClient()
  const imports = useImports(career.id)
  const [file, setFile] = useState<{ name: string; result: ParseResult } | null>(null)
  const [parseError, setParseError] = useState<unknown>(null)
  const [season, setSeason] = useState(career.current_season ?? '')
  const [fullSquad, setFullSquad] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [dump, setDump] = useState<ReadDumpResult | null>(null)
  const [reading, setReading] = useState<string | null>(null)
  const [save, setSave] = useState<({ name: string } & ReadSaveResult) | null>(null)
  const { data: knownPlayers } = usePlayers(career.id)

  const load = async (f: File | undefined) => {
    if (!f) return
    setSummary(null)
    setParseError(null)
    setDump(null)
    setSave(null)
    if (/\.fm$/i.test(f.name)) {
      setFile(null)
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
        setParseError(err)
      } finally {
        setReading(null)
      }
      return
    }
    if (/\.json$/i.test(f.name)) {
      // FMSuperScout dump.json
      setFile(null)
      setReading('Reading dump.json… this can take a few seconds for a large database.')
      try {
        const uids = (knownPlayers ?? []).map((p) => p.fm_uid).filter((u): u is number => u != null)
        setDump(await readDump(f, uids))
      } catch (err) {
        setParseError(err)
      } finally {
        setReading(null)
      }
      return
    }
    try {
      const result = parsePlayers(await f.text())
      setFile({ name: f.name, result })
      setFullSquad(result.table.viewType === 'squad')
    } catch (err) {
      setFile(null)
      setParseError(err)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    load(e.dataTransfer.files[0])
  }

  const mutation = useMutation({
    mutationFn: () =>
      importPlayers({
        careerId: career.id,
        season: season || null,
        viewType: file!.result.table.viewType,
        fileName: file!.name,
        players: file!.result.players,
        columns: file!.result.columns,
        markMissingAsLeft: fullSquad,
      }),
    onSuccess: (s) => {
      setSummary(s)
      setFile(null)
      qc.invalidateQueries({ queryKey: ['players', career.id] })
      qc.invalidateQueries({ queryKey: ['imports', career.id] })
      qc.invalidateQueries({ queryKey: ['player'] })
      qc.invalidateQueries({ queryKey: ['snapshots'] })
    },
  })

  const counts = file && {
    core: file.result.columns.filter((c) => c.target.kind === 'core').length,
    attributes: file.result.columns.filter((c) => c.target.kind === 'attribute').length,
    extra: file.result.columns.filter((c) => c.target.kind === 'extra'),
  }

  return (
    <>
      <PageHeader title="Import" subtitle={`Into ${career.name} · ${career.club}`} />
      <p className="-mt-2 mb-4 text-sm text-muted">
        Imports update what is already saved. For a clean slate, use{' '}
        <Link to="/careers" className="text-accent underline">
          Careers → Edit → Start fresh
        </Link>{' '}
        first.
      </p>

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
        <span className="font-semibold">Choose an FM export</span>
        <span className="text-sm text-muted">
          <span className="hidden md:inline">or drop it here · </span>.html web page export of a
          squad view, dump.json from the ProjectFM Reader, or your FM save (.fm)
        </span>
        <input
          type="file"
          accept=".html,.htm,text/html,.json,application/json,.fm"
          className="sr-only"
          onChange={(e) => (load(e.target.files?.[0]), (e.target.value = ''))}
        />
      </label>
      <div className="mt-3">
        <ErrorText error={parseError} />
        {reading && (
          <p className="text-sm text-muted" role="status">
            {reading}
          </p>
        )}
      </div>

      {save && (
        <SaveImport
          data={save.data}
          summary={save.summary}
          world={save.world}
          fileName={save.name}
          onDone={() => setSave(null)}
        />
      )}

      {dump && (
        <DumpImport summary={dump.summary} world={dump.world} onDone={() => setDump(null)} />
      )}

      {summary && (
        <Card className="mt-4 border-accent/50">
          <p className="font-semibold text-accent">Import complete</p>
          <p className="mt-1 text-sm">
            {summary.added} added · {summary.updated} updated
            {summary.left ? ` · ${summary.left} marked as left the club` : ''}
          </p>
          <Link
            to="/squad"
            className="mt-2 inline-block text-sm font-semibold text-accent underline"
          >
            View squad
          </Link>
        </Card>
      )}

      {file && counts && (
        <Card className="mt-4">
          <h2 className="font-semibold">{file.name}</h2>
          <p className="mt-1 text-sm text-muted">
            View: <strong className="text-text">{file.result.table.viewType}</strong> ·{' '}
            {file.result.players.length} players · {counts.core} profile columns ·{' '}
            {counts.attributes} attributes
            {counts.extra.length > 0 &&
              ` · also kept: ${counts.extra.map((c) => c.header).join(', ')}`}
          </p>
          {file.result.warnings.map((w) => (
            <p key={w} className="mt-2 text-sm text-amber-400">
              {w}
            </p>
          ))}

          <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {file.result.players.map((p) => (
                  <tr key={p.fm_uid ?? p.name}>
                    <td className="px-3 py-1.5 font-medium whitespace-nowrap">{p.name}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-muted">{p.positions}</td>
                    <td className="px-3 py-1.5 text-right text-muted tabular-nums">{p.age}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field
              label="Season"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="2026/27"
            />
            <label className="flex min-h-11 items-center gap-2 self-end text-sm">
              <input
                type="checkbox"
                checked={fullSquad}
                onChange={(e) => setFullSquad(e.target.checked)}
              />
              This is my full squad: mark players not in the file as left the club
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Importing…' : `Import ${file.result.players.length} players`}
            </Button>
            <Button variant="ghost" onClick={() => setFile(null)}>
              Cancel
            </Button>
            <ErrorText error={mutation.error} />
          </div>
        </Card>
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
                  {i.view_type} · {i.row_count} rows · {i.season} ·{' '}
                  {new Date(i.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
