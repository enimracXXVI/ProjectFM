import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, ErrorText } from '../components/form'
import { Card } from '../components/ui'
import { uploadCompetitions } from '../competitions/storage'
import {
  createCareer,
  importFmSave,
  importSaveTactics,
  isMissingTable,
  updateCareer,
} from '../data/api'
import type { Career } from '../data/db'
import { usePlayers, useStaff } from '../data/hooks'
import { seasonText } from '../data/seasons'
import type { DumpSummary } from '../import/dump'
import { READER_VERSION, type SaveData } from '../import/save'
import { useCareer, useCurrentCareer } from '../lib/career'
import { uploadWorld } from '../world/storage'

const sameClub = (a: string, b: string) =>
  a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase())

/**
 * Imports an FM save in one step: squad, staff, competitions, tactics and the world database.
 * A save from another club than the career's offers a new career instead.
 */
export function SaveImport({
  data,
  summary,
  world,
  fileName,
  onDone,
  onBusy,
}: {
  data: SaveData
  summary: DumpSummary
  world: Blob
  fileName: string
  onDone: () => void
  /** True while the save is being written into the app (the page shows the progress). */
  onBusy?: (busy: boolean) => void
}) {
  const career = useCurrentCareer()
  const { setCurrentId } = useCareer()
  const qc = useQueryClient()
  const [into, setInto] = useState<Career | null>(null)

  const mutation = useMutation({
    mutationFn: async (target: Career) => {
      // A career with nothing in it yet takes the save's club name
      if (!sameClub(target.club, data.club))
        target = await updateCareer(target.id, { club: data.club })
      const result = await importFmSave({ career: target, data, summary, fileName })
      await uploadWorld(target.id, world)
      let competitions = 0
      if (data.competitions) {
        await uploadCompetitions(target.id, { version: 1, ...data.competitions })
        competitions = data.competitions.competitions.length
      }
      // Tactics need the 0006 tables; the rest of the import never depends on them
      let tactics: number | string = 0
      if (data.tactics) {
        try {
          tactics = await importSaveTactics(target.id, data.tactics)
        } catch (e) {
          tactics = isMissingTable(e)
            ? 'needs the one-time database update (see Tactics)'
            : e instanceof Error
              ? e.message
              : String(e)
        }
      }
      return { ...result, competitions, tactics }
    },
    onSuccess: () => qc.invalidateQueries(),
  })

  // Another club than the career's: only a problem when the career already holds data
  const players = usePlayers(career.id)
  const staff = useStaff(career.id)
  const check: 'checking' | 'ok' | 'other-club' = sameClub(career.club, data.club)
    ? 'ok'
    : players.isPending || staff.isPending
      ? 'checking'
      : players.data?.length || staff.data?.length
        ? 'other-club'
        : 'ok'

  const newCareer = useMutation({
    mutationFn: async () => {
      const year = data.competitions?.season ?? null
      const created = await createCareer({
        name: data.club,
        club: data.club,
        nation: null,
        start_season: year ? seasonText(year) : null,
        current_season: year ? seasonText(year) : null,
      })
      await qc.invalidateQueries({ queryKey: ['careers'] })
      setCurrentId(created.id)
      setInto(created)
      mutation.mutate(created)
    },
  })

  // One step: import straight away, unless the save is from another club or the reader is old
  const outdated = (data.reader ?? 0) < READER_VERSION
  const started = useRef(false)
  useEffect(() => {
    if (started.current || check !== 'ok' || outdated) return
    started.current = true
    mutation.mutate(career)
  }, [check, outdated, mutation, career])

  const busy = mutation.isPending || newCareer.isPending || check === 'checking'
  useEffect(() => onBusy?.(busy), [busy, onBusy])
  if (busy) return null

  const r = mutation.data
  if (r)
    return (
      <Card className="mt-4 border-accent/50">
        <p className="font-semibold text-accent">
          Import complete{into ? ` · new career ${into.name}` : ''}
        </p>
        <ul className="mt-1 grid gap-0.5 text-sm">
          <li>
            {data.club} · in-game {data.gameDate ?? '?'} · season {r.season ?? '?'}
          </li>
          <li>
            Squad: {r.players.added} added · {r.players.updated} updated
            {r.players.left ? ` · ${r.players.left} no longer at the club` : ''}
          </li>
          <li className={r.staffNeedsUpdate ? 'text-amber-300' : ''}>
            {r.staffNeedsUpdate
              ? `Scouts only: ${r.staffUpdated} updated · ${r.staffAdded} added (all staff needs the one-time database update, see Staff)`
              : `Staff: ${r.staffUpdated} updated · ${r.staffAdded} added · ${r.staffRemoved} no longer at the club`}
          </li>
          <li className={typeof r.tactics === 'number' ? '' : 'text-amber-300'}>
            {typeof r.tactics === 'number'
              ? `Tactics: ${r.tactics}`
              : `Tactics: not saved (${r.tactics})`}
          </li>
          <li className={r.competitions ? '' : 'text-amber-300'}>
            {r.competitions
              ? `Competitions: ${r.competitions} this season`
              : `Competitions: not read${data.competitionsError ? ` (${data.competitionsError})` : ''}`}
          </li>
          <li>World: {summary.totalPlayers.toLocaleString()} players</li>
        </ul>
        <div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold text-accent">
          <Link to="/squad" className="underline">
            Squad
          </Link>
          <Link to="/staff" className="underline">
            Staff
          </Link>
          <Link to="/competitions" className="underline">
            Competitions
          </Link>
          <button type="button" className="underline" onClick={onDone}>
            Close
          </button>
        </div>
      </Card>
    )

  return (
    <Card className="mt-4">
      {outdated && (
        <p className="rounded-lg border border-amber-400/50 bg-amber-400/10 p-2 text-sm text-amber-200">
          This save was read with an older copy of the save reader, so some data is missing. Close
          the app completely, open it again and import the save once more.
        </p>
      )}
      {check === 'other-club' && (
        <>
          <h2 className="font-semibold">This save is for {data.club}</h2>
          <p className="mt-1 text-sm text-muted">
            The career {career.name} is {career.club}. Start a new career for {data.club} and import
            the save there? {career.name} stays as it is.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => newCareer.mutate()}>Start a new career for {data.club}</Button>
            <Button variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </>
      )}
      {check === 'ok' && outdated && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => mutation.mutate(career)}>Import anyway</Button>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      )}
      <ErrorText error={mutation.error ?? newCareer.error} />
    </Card>
  )
}
