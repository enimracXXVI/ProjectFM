import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Button, ErrorText } from '../components/form'
import { Card } from '../components/ui'
import { importDump, type DumpImportResult } from '../data/api'
import { uploadWorld } from '../world/storage'
import type { DumpSummary } from '../import/dump'
import { useCurrentCareer } from '../lib/career'

export function DumpImport({
  summary,
  world,
  onDone,
}: {
  summary: DumpSummary
  world: Blob
  onDone: () => void
}) {
  const career = useCurrentCareer()
  const qc = useQueryClient()
  const [includeOther, setIncludeOther] = useState(false)
  const [saveWorld, setSaveWorld] = useState(true)
  const [season, setSeason] = useState(career.current_season ?? '')
  const [result, setResult] = useState<DumpImportResult | null>(null)

  const first = summary.players.filter((p) => p.level === 'first').length
  const other = summary.players.length - first
  const wrongClub =
    summary.meta.myClub &&
    !summary.meta.myClub.toLowerCase().includes(career.club.toLowerCase()) &&
    !career.club.toLowerCase().includes(summary.meta.myClub.toLowerCase())

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await importDump({
        career,
        summary,
        includeOtherTeams: includeOther,
        season: season || null,
      })
      if (saveWorld) await uploadWorld(career.id, world)
      return r
    },
    onSuccess: (r) => {
      setResult(r)
      for (const key of ['players', 'imports', 'player', 'snapshots', 'staff', 'world'])
        qc.invalidateQueries({ queryKey: [key] })
    },
  })

  if (result)
    return (
      <Card className="mt-4 border-accent/50">
        <p className="font-semibold text-accent">FMSuperScout import complete</p>
        <p className="mt-1 text-sm">
          Players: {result.players.added} added · {result.players.updated} updated
          {result.players.left ? ` · ${result.players.left} no longer at the club` : ''}
        </p>
        <p className="text-sm">
          Scouts: {result.scoutsAdded} added · {result.scoutsUpdated} updated
        </p>
        {saveWorld && (
          <p className="text-sm">
            World database saved: {summary.totalPlayers.toLocaleString()} players, available on all
            your devices.
          </p>
        )}
        <div className="mt-2 flex gap-4 text-sm font-semibold text-accent">
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

  return (
    <Card className="mt-4">
      <h2 className="font-semibold">FMSuperScout data</h2>
      <p className="mt-1 text-sm text-muted">
        {[
          summary.meta.game,
          summary.meta.myClub,
          summary.meta.gameDate && `in-game ${summary.meta.gameDate}`,
        ]
          .filter(Boolean)
          .join(' · ')}{' '}
        · {summary.totalPlayers.toLocaleString()} players and {summary.totalStaff.toLocaleString()}{' '}
        staff in the file
      </p>
      {wrongClub && (
        <p className="mt-2 text-sm text-amber-400">
          This file is for {summary.meta.myClub}, but the current career is {career.club}. Check you
          picked the right career before importing.
        </p>
      )}

      <ul className="mt-3 grid gap-1 text-sm">
        <li>
          <strong>{first}</strong> first-team players: attributes, positions, age, nationality,
          height{' '}
          <span className="text-muted">
            (plus CA/PA and hidden values, shown only if allowed in Settings)
          </span>
        </li>
        <li>
          <strong>{summary.scouts.length}</strong> scouts and chief scout: scouting attributes as FM
          words{' '}
          <span className="text-muted">
            (Authority, knowledge and reputation stay as you entered them)
          </span>
        </li>
        <li className="text-muted">
          Players in your squad who are now at another club are marked as no longer at the club.
        </li>
      </ul>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Season</span>
          <input
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="min-h-11 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm"
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            checked={saveWorld}
            onChange={(e) => setSaveWorld(e.target.checked)}
          />
          Save world database ({summary.totalPlayers.toLocaleString()} players,{' '}
          {(world.size / 1024 / 1024).toFixed(1)} MB)
        </label>
        {other > 0 && (
          <label className="flex min-h-11 items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={includeOther}
              onChange={(e) => setIncludeOther(e.target.checked)}
            />
            Also import reserves and youth ({other} players)
          </label>
        )}
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
