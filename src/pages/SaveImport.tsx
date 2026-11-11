import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, ErrorText } from '../components/form'
import { Card } from '../components/ui'
import { importDump, importSave, importSaveTactics, isMissingTable } from '../data/api'
import type { DumpSummary } from '../import/dump'
import {
  fmNation,
  isUnconfirmedKnowledge,
  READER_VERSION,
  knowledgeWord,
  type SaveData,
  type StatsKind,
} from '../import/save'
import { useCurrentCareer } from '../lib/career'
import { uploadWorld } from '../world/storage'
import { uploadCompetitions } from '../competitions/storage'

const KINDS: [StatsKind, string][] = [
  ['overall', 'All competitive matches'],
  ['league', 'League'],
  ['cup', 'Cups'],
  ['non_competitive', 'Friendlies'],
]

const field = 'min-h-11 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

/** One import for everything in an FM save: squad, contracts, stats, scouts, world. */
export function SaveImport({
  data,
  summary,
  world,
  fileName,
  onDone,
}: {
  data: SaveData
  summary: DumpSummary
  world: Blob
  fileName: string
  onDone: () => void
}) {
  const career = useCurrentCareer()
  const qc = useQueryClient()
  const [saved] = useState(readOptions)
  const [kind, setKindState] = useState<StatsKind>(saved.kind)
  const [season, setSeason] = useState(career.current_season ?? '')
  const [includeOther, setIncludeOtherState] = useState(saved.includeOther)
  const [saveWorld, setSaveWorldState] = useState(saved.saveWorld)
  const remember = (patch: Partial<ImportOptions>) =>
    writeOptions({ kind, includeOther, saveWorld, ...patch })
  const setKind = (v: StatsKind) => (setKindState(v), remember({ kind: v }))
  const setIncludeOther = (v: boolean) => (setIncludeOtherState(v), remember({ includeOther: v }))
  const setSaveWorld = (v: boolean) => (setSaveWorldState(v), remember({ saveWorld: v }))

  const mutation = useMutation({
    mutationFn: async () => {
      // Squad first, so contracts and stats reach players new to ProjectFM too
      const squad = await importDump({
        career,
        summary,
        includeOtherTeams: includeOther,
        season: season || null,
      })
      const rest = await importSave({ career, data, kind, season: season || null, fileName })
      if (saveWorld) await uploadWorld(career.id, world)
      let competitions = 0
      if (data.competitions) {
        await uploadCompetitions(career.id, { version: 1, ...data.competitions })
        competitions = data.competitions.competitions.length
      }
      // Tactics need the 0006 tables; the rest of the import never depends on them
      let tactics: number | string = 0
      if (data.tactics) {
        try {
          tactics = await importSaveTactics(career.id, data.tactics)
        } catch (e) {
          tactics = isMissingTable(e)
            ? 'needs the one-time database update (see Tactics)'
            : e instanceof Error
              ? e.message
              : String(e)
        }
      }
      return { squad: squad.players, ...rest, competitions, tactics }
    },
    onSuccess: () => {
      for (const key of [
        'players',
        'imports',
        'player',
        'snapshots',
        'staff',
        'world',
        'competitions',
        'tactics',
      ])
        qc.invalidateQueries({ queryKey: [key] })
    },
  })

  const wrongClub =
    !data.club.toLowerCase().includes(career.club.toLowerCase()) &&
    !career.club.toLowerCase().includes(data.club.toLowerCase())

  // One step: import straight away with the choices used last time, unless something
  // needs a look first (another club's save, or an outdated save reader)
  const outdated = (data.reader ?? 0) < READER_VERSION
  const started = useRef(false)
  useEffect(() => {
    if (started.current || wrongClub || outdated) return
    started.current = true
    mutation.mutate()
  }, [wrongClub, outdated, mutation])

  if (mutation.isPending)
    return (
      <Card className="mt-4">
        <p className="font-semibold">Importing your save…</p>
        <p className="mt-1 text-sm text-muted">
          Squad, contracts, stats, scouts, competitions and the world database. This takes a few
          seconds.
        </p>
      </Card>
    )

  const first = summary.players.filter((p) => p.level === 'first').length
  const other = summary.players.length - first
  const options = (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Stats from</span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as StatsKind)}
          className={field}
        >
          {KINDS.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Season</span>
        <input value={season} onChange={(e) => setSeason(e.target.value)} className={field} />
      </label>
      {other > 0 && (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeOther}
            onChange={(e) => setIncludeOther(e.target.checked)}
            className="size-5"
          />
          Also add the {other} players in your other teams (reserves, youth)
        </label>
      )}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={saveWorld}
          onChange={(e) => setSaveWorld(e.target.checked)}
          className="size-5"
        />
        Save the world database
      </label>
    </div>
  )

  const r = mutation.data
  if (r)
    return (
      <Card className="mt-4 border-accent/50">
        <p className="font-semibold text-accent">Save import complete</p>
        <ul className="mt-1 grid gap-0.5 text-sm">
          <li>
            Squad: {r.squad.added} added · {r.squad.updated} updated
            {r.squad.left ? ` · ${r.squad.left} no longer at the club` : ''}
          </li>
          <li>Contracts, season stats and feet: {r.updated} players</li>
          <li>
            Scouts: {r.scoutsUpdated} updated · {r.scoutsAdded} added
          </li>
          <li className={typeof r.tactics === 'number' ? '' : 'text-amber-300'}>
            {typeof r.tactics === 'number'
              ? `Tactics: ${r.tactics} with the current XI as preferred XI`
              : `Tactics: not saved (${r.tactics})`}
          </li>
          <li className={r.competitions ? '' : 'text-amber-300'}>
            {r.competitions
              ? `Competitions: ${r.competitions} saved for this season`
              : `Competitions: not read${data.competitionsError ? ` (${data.competitionsError})` : ''}`}
          </li>
          {saveWorld && (
            <li>
              World database: {summary.totalPlayers.toLocaleString()} players, on all your devices
            </li>
          )}
        </ul>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted">Options for the next import</summary>
          {options}
        </details>
        <div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold text-accent">
          <Link to="/squad" className="underline">
            Squad
          </Link>
          <Link to="/staff" className="underline">
            Staff
          </Link>
          <Link to="/world" className="underline">
            World
          </Link>
          <button type="button" className="underline" onClick={onDone}>
            Close
          </button>
        </div>
      </Card>
    )

  const scouts = data.scouts ?? []
  const unconfirmed = scouts.flatMap((s) =>
    s.knowledge
      .filter((k) => isUnconfirmedKnowledge(knowledgeWord(k.value)))
      .map((k) => `${s.name} – ${fmNation(k.nation)} (${k.value})`),
  )
  const withStats = new Set(data.stats.filter((s) => s.kind === kind).map((s) => s.uniqueId)).size

  return (
    <Card className="mt-4">
      <h2 className="font-semibold">FM save</h2>
      {(data.reader ?? 0) < READER_VERSION && (
        <p className="mt-2 rounded-lg border border-amber-400/50 bg-amber-400/10 p-2 text-sm text-amber-200">
          This save was read with an older copy of the save reader, so some data (competitions) is
          missing. Close the app completely, open it again and import the save once more.
        </p>
      )}
      <p className="mt-1 text-sm text-muted">
        {data.club} · in-game {data.gameDate ?? '?'} · {summary.totalPlayers.toLocaleString()}{' '}
        players in the world
      </p>
      {wrongClub && (
        <p className="mt-2 text-sm text-amber-400">
          This save is for {data.club}, but the current career is {career.club}. Check you picked
          the right career before importing.
        </p>
      )}
      <ul className="mt-3 grid gap-1 text-sm">
        <li>
          <strong>Squad ({first} first-team players):</strong> attributes, positions, age,
          nationality, height, feet, squad numbers, condition, morale, personality{' '}
          <span className="text-muted">
            (plus CA/PA, hidden and personality values, shown only if allowed in Settings)
          </span>
        </li>
        <li>
          <strong>Contracts:</strong> playing time, contract type, wage, expiry, release clause,
          club extension option
        </li>
        <li>
          <strong>Season stats</strong> for {withStats} players: apps, minutes, rating, goals,
          assists, xG, xA, per-90 figures and more
        </li>
        {scouts.length > 0 && (
          <li>
            <strong>{scouts.length} scouts:</strong> attributes including Authority, and scouting
            knowledge per nation
          </li>
        )}
        {data.competitions && (
          <li>
            <strong>Competitions:</strong> {data.competitions.competitions.length} this season, with
            every fixture, result and per-player match stats
          </li>
        )}
        <li>
          <strong>World database:</strong> every player, searchable on all your devices
        </li>
      </ul>
      {unconfirmed.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted">
            {unconfirmed.length} knowledge values not matched to an FM word yet (saved as “Unknown
            (value)”, or your own word where you set one)
          </summary>
          <ul className="mt-1 list-disc pl-5 text-muted">
            {unconfirmed.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </details>
      )}
      {options}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Importing…' : 'Import'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <ErrorText error={mutation.error} />
      </div>
    </Card>
  )
}

interface ImportOptions {
  kind: StatsKind
  includeOther: boolean
  saveWorld: boolean
}

const OPTIONS_KEY = 'projectfm.saveImportOptions'

function readOptions(): ImportOptions {
  const fallback: ImportOptions = { kind: 'overall', includeOther: false, saveWorld: true }
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? '{}') }
  } catch {
    return fallback
  }
}

function writeOptions(o: ImportOptions) {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(o))
  } catch {
    // remembered only on this device, when allowed
  }
}
