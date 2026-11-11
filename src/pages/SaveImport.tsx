import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, ErrorText } from '../components/form'
import { Card } from '../components/ui'
import { importSave } from '../data/api'
import {
  fmNation,
  isUnconfirmedKnowledge,
  knowledgeWord,
  type SaveData,
  type StatsKind,
} from '../import/save'
import { useCurrentCareer } from '../lib/career'

const KINDS: [StatsKind, string][] = [
  ['overall', 'All competitive matches'],
  ['league', 'League'],
  ['cup', 'Cups'],
  ['non_competitive', 'Friendlies'],
]

export function SaveImport({
  data,
  fileName,
  onDone,
}: {
  data: SaveData
  fileName: string
  onDone: () => void
}) {
  const career = useCurrentCareer()
  const qc = useQueryClient()
  const [kind, setKind] = useState<StatsKind>('overall')
  const [season, setSeason] = useState(career.current_season ?? '')

  const mutation = useMutation({
    mutationFn: () => importSave({ career, data, kind, season: season || null, fileName }),
    onSuccess: () => {
      for (const key of ['players', 'imports', 'player', 'snapshots', 'staff'])
        qc.invalidateQueries({ queryKey: [key] })
    },
  })

  if (mutation.data)
    return (
      <Card className="mt-4 border-accent/50">
        <p className="font-semibold text-accent">Save import complete</p>
        <p className="mt-1 text-sm">
          {mutation.data.updated} squad players updated with contract details, season stats and feet
          {mutation.data.notInSquad
            ? ` · ${mutation.data.notInSquad} players in the save are not in your ProjectFM squad (import them with dump.json first)`
            : ''}
        </p>
        {mutation.data.scoutsAdded + mutation.data.scoutsUpdated > 0 && (
          <p className="mt-1 text-sm">
            Scouts: {mutation.data.scoutsUpdated} updated, {mutation.data.scoutsAdded} added
            (attributes with Authority, and scouting knowledge)
          </p>
        )}
        <div className="mt-2 flex gap-4 text-sm font-semibold text-accent">
          <Link to="/squad" className="underline">
            Squad
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
      .map((k) => `${s.name} – ${fmNation(k.nation)} (${k.value}/100)`),
  )
  const withStats = new Set(data.stats.filter((s) => s.kind === kind).map((s) => s.uniqueId)).size

  return (
    <Card className="mt-4">
      <h2 className="font-semibold">FM save</h2>
      <p className="mt-1 text-sm text-muted">
        {data.club} · in-game {data.gameDate ?? '?'} · {data.players.length} players,{' '}
        {data.contracts.length} contracts
      </p>
      <ul className="mt-3 grid gap-1 text-sm">
        <li>
          <strong>Contracts:</strong> playing time, contract type, wage, expiry, release clause,
          club extension option
        </li>
        <li>
          <strong>Season stats</strong> for {withStats} players: apps, minutes, rating, goals,
          assists, xG, xA, per-90 figures and more
        </li>
        <li>
          <strong>Feet</strong> (left and right)
        </li>
        {scouts.length > 0 && (
          <li>
            <strong>{scouts.length} scouts:</strong> attributes including Authority, and scouting
            knowledge per nation
          </li>
        )}
        <li className="text-muted">Only players already in your ProjectFM squad are updated.</li>
      </ul>
      {unconfirmed.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted">
            {unconfirmed.length} knowledge values not matched to an FM word yet (kept as shown, or
            your own level where you set one)
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
            className="min-h-11 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm"
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
          <input
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="min-h-11 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm"
          />
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
