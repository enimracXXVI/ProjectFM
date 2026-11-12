import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { setPlayerTeam } from '../data/api'
import type { PlayerRow } from '../data/db'
import { TEAMS, teamOf, type Team, teamLabel } from '../data/teams'

/** Picker for First team / U20 / U18; saves straight away. */
export function TeamSelect({ player, className }: { player: PlayerRow; className?: string }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (team: Team) => setPlayerTeam(player, team),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['players', player.career_id] })
      qc.invalidateQueries({ queryKey: ['player', player.id] })
    },
  })
  return (
    <select
      aria-label={`Team for ${player.name}`}
      value={mutation.isPending ? mutation.variables : teamOf(player)}
      disabled={mutation.isPending}
      onChange={(e) => mutation.mutate(e.target.value as Team)}
      className={clsx(
        'min-h-9 rounded-lg border border-border bg-surface-2 px-2 text-sm',
        mutation.isError && 'border-red-500',
        className,
      )}
    >
      {TEAMS.map(([t, label]) => (
        <option key={t} value={t}>
          {label}
        </option>
      ))}
    </select>
  )
}

/** Small badge for U20 / U18 players (nothing for the first team). */
export function TeamBadge({ player }: { player: Pick<PlayerRow, 'extra'> }) {
  const t = teamOf(player)
  if (t === 'first') return null
  return (
    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-sky-300">
      {teamLabel(t)}
    </span>
  )
}
