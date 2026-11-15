import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { setPlayerFocus } from '../data/api'
import type { PlayerRow } from '../data/db'
import { useConfig } from '../lib/config'
import { FOCUS_KEY, focusesForPlayer } from '../training/focus'

/** Picker for a player's individual training focus (FM's list for his position); saves at once. */
export function FocusSelect({ player, className }: { player: PlayerRow; className?: string }) {
  const config = useConfig()
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (focus: string | null) => setPlayerFocus(player, focus),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['players', player.career_id] })
      qc.invalidateQueries({ queryKey: ['player', player.id] })
    },
  })
  const list = focusesForPlayer(player.positions, config.trainingFocuses)
  const current = mutation.isPending ? (mutation.variables ?? '') : (player.extra[FOCUS_KEY] ?? '')
  return (
    <select
      aria-label={`Individual training focus for ${player.name}`}
      value={current}
      disabled={mutation.isPending}
      onChange={(e) => mutation.mutate(e.target.value || null)}
      className={clsx(
        'min-h-9 min-w-0 rounded-lg border border-border bg-surface-2 px-2 text-sm',
        mutation.isError && 'border-red-500',
        className,
      )}
    >
      <option value="">None</option>
      {current && !list.some((f) => f.name === current) && (
        <option value={current}>{current}</option>
      )}
      {list.map((f) => (
        <option key={`${f.code}-${f.name}`} value={f.name}>
          {f.name}
        </option>
      ))}
    </select>
  )
}
