import { clsx } from 'clsx'
import { ChevronRight, Crown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ErrorText } from '../components/form'
import { Card, PageHeader, Placeholder } from '../components/ui'
import { useStaff } from '../data/hooks'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { headedRegions, isScout, useSaveScouting } from '../lib/scouting'

export function Scouting() {
  const career = useCurrentCareer()
  const { regions } = useConfig()
  const { data: staff, isPending } = useStaff(career.id)
  const save = useSaveScouting(career)
  const net = career.scouting ?? {}
  const season = career.current_season ?? 'current'
  const limit = net.limits?.[season]

  const scouts = (staff ?? []).filter(isScout)
  const byId = new Map((staff ?? []).map((s) => [s.id, s]))
  const unassigned = scouts.filter(
    (s) => !net.scouts?.[s.id] && headedRegions(net, s.id).length === 0,
  )
  const over = limit != null && scouts.length > limit

  const setLimit = (value: string) => {
    const n = value === '' ? undefined : Math.max(0, Number(value) || 0)
    const limits = { ...net.limits }
    if (n === undefined) delete limits[season]
    else limits[season] = n
    save.mutate({ ...net, limits })
  }

  return (
    <>
      <PageHeader
        title="Scouting network"
        subtitle={`Season ${season}`}
        actions={
          <Link to="/world" className="text-sm font-semibold text-accent">
            World search
          </Link>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-4">
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Scouts allowed by the board</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={limit ?? ''}
              key={`${season}-${limit}`}
              onBlur={(e) => e.target.value !== String(limit ?? '') && setLimit(e.target.value)}
              className="min-h-11 w-28 rounded-lg border border-border bg-surface-2 px-3 text-base"
            />
          </label>
          <div className="min-w-48 flex-1">
            <p className="text-sm">
              <span className={clsx('text-2xl font-semibold tabular-nums', over && 'text-red-400')}>
                {scouts.length}
              </span>
              <span className="text-muted"> / {limit ?? '–'} scouts employed</span>
            </p>
            {limit != null && limit > 0 && (
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={clsx('h-full rounded-full', over ? 'bg-red-500' : 'bg-accent')}
                  style={{ width: `${Math.min(100, (scouts.length / limit) * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          Counts staff with the role Scout (heads of region included, Chief Scout not).
        </p>
        <ErrorText error={save.error} />
      </Card>

      {!isPending && scouts.length === 0 && (
        <Placeholder>
          No scouts yet.{' '}
          <Link to="/staff/new" className="text-accent underline">
            Add a scout
          </Link>{' '}
          to start building the network.
        </Placeholder>
      )}

      {unassigned.length > 0 && (
        <Card className="mb-5 border-amber-500/40">
          <p className="text-sm font-semibold">Not assigned ({unassigned.length})</p>
          <p className="mt-1 text-sm text-muted">{unassigned.map((s) => s.name).join(', ')}</p>
        </Card>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {/* Regions with a head or a scout first, then the rest, each in the usual order */}
        {[...regions]
          .map((r, i) => ({
            r,
            i,
            staffed:
              !!net.heads?.[r.id] || Object.values(net.scouts ?? {}).some((a) => a.region === r.id),
          }))
          .sort((a, b) => Number(b.staffed) - Number(a.staffed) || a.i - b.i)
          .map(({ r }) => {
            const head = byId.get(net.heads?.[r.id] ?? '')
            const regionScouts = Object.entries(net.scouts ?? {}).filter(
              ([, a]) => a.region === r.id,
            )
            const covered = new Set(regionScouts.flatMap(([, a]) => a.countries))
            return (
              <li key={r.id}>
                <Link
                  to={`/scouting/${r.id}`}
                  className="flex h-full items-start gap-3 rounded-xl border border-border bg-surface p-4 hover:border-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.name}</p>
                    <p
                      className={clsx(
                        'mt-1 flex items-center gap-1 text-sm',
                        head ? 'text-text' : 'text-amber-400',
                      )}
                    >
                      <Crown className="size-3.5 shrink-0" aria-hidden />
                      {head ? head.name : 'No head of region'}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {regionScouts.length} scout{regionScouts.length === 1 ? '' : 's'} ·{' '}
                      {covered.size} / {r.countries.length} countries covered
                    </p>
                  </div>
                  <ChevronRight className="mt-1 size-4 text-muted" aria-hidden />
                </Link>
              </li>
            )
          })}
      </ul>
    </>
  )
}
