import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, ErrorText } from '../components/form'
import { Card } from '../components/ui'
import { importDump, importSave } from '../data/api'
import type { DumpSummary } from '../import/dump'
import {
  fmNation,
  isUnconfirmedKnowledge,
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
  const [kind, setKind] = useState<StatsKind>('overall')
  const [season, setSeason] = useState(career.current_season ?? '')
  const [includeOther, setIncludeOther] = useState(false)
  const [saveWorld, setSaveWorld] = useState(true)

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
      if (data.competitions) {
        await uploadCompetitions(career.id, { version: 1, ...data.competitions })
      }
      return { squad: squad.players, ...rest }
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
      ])
        qc.invalidateQueries({ queryKey: [key] })
    },
  })

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
          {saveWorld && (
            <li>
              World database: {summary.totalPlayers.toLocaleString()} players, on all your devices
            </li>
          )}
        </ul>
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

  const first = summary.players.filter((p) => p.level === 'first').length
  const other = summary.players.length - first
  const scouts = data.scouts ?? []
  const unconfirmed = scouts.flatMap((s) =>
    s.knowledge
      .filter((k) => isUnconfirmedKnowledge(knowledgeWord(k.value)))
      .map((k) => `${s.name} – ${fmNation(k.nation)} (${k.value})`),
  )
  const withStats = new Set(data.stats.filter((s) => s.kind === kind).map((s) => s.uniqueId)).size
  const wrongClub =
    !data.club.toLowerCase().includes(career.club.toLowerCase()) &&
    !career.club.toLowerCase().includes(data.club.toLowerCase())

  return (
    <Card className="mt-4">
      <h2 className="font-semibold">FM save</h2>
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
