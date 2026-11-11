import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { isMissingTable, saveMatchLog } from '../data/api'
import { useMatchLog, useTactics } from '../data/hooks'
import { useCurrentCareer } from '../lib/career'
import { FORMATIONS } from '../tactics/positions'
import type { MatchLogRow } from '../tactics/types'
import { Button, ErrorText } from './form'
import { Card } from './ui'

const MENTALITIES = [
  'Very Defensive',
  'Defensive',
  'Cautious',
  'Balanced',
  'Positive',
  'Attacking',
  'Very Attacking',
]

const field =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

/** Your tactic, the opponent's set-up and notes for one match. */
export function MatchLogCard({
  matchKey,
  competitionDbId,
  season,
}: {
  matchKey: string
  competitionDbId: number | null
  season: number | null
}) {
  const career = useCurrentCareer()
  const tactics = useTactics(career.id)
  const log = useMatchLog(career.id)
  const error = tactics.error ?? log.error
  if (error)
    return (
      <Card>
        <h2 className="font-semibold">Match log</h2>
        <p className="mt-1 text-sm text-muted">
          {isMissingTable(error) ? (
            <>
              Needs the one-time database update:{' '}
              <Link to="/tactics" className="text-accent underline">
                open Tactics
              </Link>{' '}
              for the steps.
            </>
          ) : (
            error.message
          )}
        </p>
      </Card>
    )
  if (!tactics.data || !log.data) return null
  const row = log.data.find((r) => r.match_key === matchKey) ?? null
  return (
    <Editor
      key={row?.id ?? 'new'}
      row={row}
      tactics={tactics.data.map((t) => ({ id: t.id, name: t.name }))}
      matchKey={matchKey}
      competitionDbId={competitionDbId}
      season={season}
    />
  )
}

function Editor({
  row,
  tactics,
  matchKey,
  competitionDbId,
  season,
}: {
  row: MatchLogRow | null
  tactics: { id: string; name: string }[]
  matchKey: string
  competitionDbId: number | null
  season: number | null
}) {
  const career = useCurrentCareer()
  const qc = useQueryClient()
  const initial = {
    tactic_id: row?.tactic_id ?? (tactics.length === 1 ? tactics[0].id : null),
    opponent_formation: row?.opponent_formation ?? null,
    opponent_style: row?.opponent_style ?? null,
    opponent_mentality: row?.opponent_mentality ?? null,
    notes: row?.notes ?? null,
  }
  const [form, setForm] = useState(initial)
  const dirty = !row || JSON.stringify(form) !== JSON.stringify(initial)
  const save = useMutation({
    mutationFn: () =>
      saveMatchLog(career.id, {
        match_key: matchKey,
        competition_db_id: competitionDbId,
        season,
        ...form,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matchlog'] }),
  })
  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v || null })

  return (
    <Card className="grid gap-3">
      <h2 className="font-semibold">Match log</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Your tactic</span>
          <select
            value={form.tactic_id ?? ''}
            onChange={(e) => set('tactic_id', e.target.value)}
            className={field}
          >
            <option value="">–</option>
            {tactics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Opponent formation</span>
          <input
            list="formations"
            value={form.opponent_formation ?? ''}
            onChange={(e) => set('opponent_formation', e.target.value)}
            placeholder="e.g. 4-2-3-1"
            className={field}
          />
          <datalist id="formations">
            {Object.keys(FORMATIONS).map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Opponent mentality</span>
          <select
            value={form.opponent_mentality ?? ''}
            onChange={(e) => set('opponent_mentality', e.target.value)}
            className={field}
          >
            <option value="">–</option>
            {MENTALITIES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Opponent style</span>
          <input
            value={form.opponent_style ?? ''}
            onChange={(e) => set('opponent_style', e.target.value)}
            placeholder="e.g. Gegenpress, low block…"
            className={field}
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Notes</span>
        <textarea
          value={form.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          rows={4}
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-base md:text-sm"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        {save.isSuccess && !dirty && <span className="text-sm text-accent">Saved</span>}
        <ErrorText error={save.error} />
      </div>
    </Card>
  )
}
