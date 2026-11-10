import { clsx } from 'clsx'
import { ArrowLeft, Crown, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorText } from '../components/form'
import { Card, PageHeader, Placeholder } from '../components/ui'
import type { ScoutingNetwork, StaffRow } from '../data/db'
import { useStaff } from '../data/hooks'
import { areContiguous } from '../data/regions'
import { SCOUT_KEY_ATTRIBUTES, ratingColor } from '../data/staffInfo'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { headedRegions, isScout, useSaveScouting } from '../lib/scouting'

const select =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:w-auto md:text-sm'

export function ScoutingRegion() {
  const { regionId = '' } = useParams()
  const career = useCurrentCareer()
  const config = useConfig()
  const { data: staff } = useStaff(career.id)
  const save = useSaveScouting(career)
  const [problem, setProblem] = useState<string | null>(null)

  const region = config.regions.find((r) => r.id === regionId)
  if (!region) return <Placeholder>Region not found.</Placeholder>

  const net: ScoutingNetwork = career.scouting ?? {}
  const scouts = (staff ?? []).filter(isScout)
  const byId = new Map((staff ?? []).map((s) => [s.id, s]))
  const headId = net.heads?.[region.id] ?? ''
  const assigned = Object.entries(net.scouts ?? {})
    .filter(([, a]) => a.region === region.id)
    .map(([id, a]) => ({ staff: byId.get(id), ...a, id }))
  const regionName = (id: string) => config.regions.find((r) => r.id === id)?.name ?? id

  const commit = (next: ScoutingNetwork) => {
    setProblem(null)
    save.mutate(next)
  }

  const setHead = (staffId: string) => {
    const heads = { ...net.heads }
    if (!staffId) {
      delete heads[region.id]
      return commit({ ...net, heads })
    }
    const regions = [...new Set([...headedRegions(net, staffId), region.id])]
    if (!areContiguous(regions, config.regions)) {
      return setProblem(
        `${byId.get(staffId)?.name} already heads ${headedRegions(net, staffId).map(regionName).join(', ')}, which does not border ${region.name}.`,
      )
    }
    heads[region.id] = staffId
    commit({ ...net, heads })
  }

  const setScout = (staffId: string, countries: string[] | null) => {
    const scoutsMap = { ...net.scouts }
    if (countries === null) delete scoutsMap[staffId]
    else scoutsMap[staffId] = { region: region.id, countries }
    commit({ ...net, scouts: scoutsMap })
  }

  // Heads can't also be regular scouts, and a regular scout works in one region only
  const headOptions = scouts.filter((s) => !net.scouts?.[s.id])
  const addOptions = scouts.filter(
    (s) => !net.scouts?.[s.id] && headedRegions(net, s.id).length === 0,
  )

  const knowledgeOf = (country: string) =>
    (staff ?? []).flatMap((s) =>
      s.knowledge
        .filter((k) => k.nation === country)
        .map((k) => ({ name: s.name, level: k.level })),
    )

  return (
    <>
      <Link
        to="/scouting"
        className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Scouting network
      </Link>
      <PageHeader title={region.name} subtitle={`${region.countries.length} countries`} />

      <Card className="mb-5">
        <label className="grid gap-1 text-sm md:flex md:items-center md:gap-3">
          <span className="flex items-center gap-1 font-semibold">
            <Crown className="size-4 text-accent" aria-hidden /> Head of region
          </span>
          <select value={headId} onChange={(e) => setHead(e.target.value)} className={select}>
            <option value="">None</option>
            {headOptions.map((s) => {
              const other = headedRegions(net, s.id).filter((r) => r !== region.id)
              return (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {other.length ? ` (also heads ${other.map(regionName).join(', ')})` : ''}
                </option>
              )
            })}
          </select>
        </label>
        {byId.get(headId) && <KeyAttributes staff={byId.get(headId)!} />}
        <p className="mt-2 text-xs text-muted">
          A head can lead several regions only if they border each other.
        </p>
        <ErrorText error={problem ?? save.error} />
      </Card>

      <section className="mb-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Scouts</h2>
          {addOptions.length > 0 && (
            <select
              value=""
              aria-label="Add scout to this region"
              onChange={(e) => e.target.value && setScout(e.target.value, [])}
              className={select}
            >
              <option value="">Add scout…</option>
              {addOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {assigned.length === 0 && (
          <p className="text-sm text-muted">No scouts assigned to this region yet.</p>
        )}
        <ul className="grid gap-3">
          {assigned.map((a) => (
            <li key={a.id}>
              <Card>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{a.staff?.name ?? 'Unknown'}</p>
                    {a.staff && <KeyAttributes staff={a.staff} />}
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${a.staff?.name ?? 'scout'} from ${region.name}`}
                    onClick={() => setScout(a.id, null)}
                    className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-400"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                <p className="mt-3 mb-1 text-xs text-muted">
                  Focus countries ({a.countries.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {region.countries.map((c) => {
                    const on = a.countries.includes(c)
                    const knows = a.staff?.knowledge.some((k) => k.nation === c)
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setScout(
                            a.id,
                            on ? a.countries.filter((x) => x !== c) : [...a.countries, c],
                          )
                        }
                        className={clsx(
                          'min-h-9 rounded-full border px-3 text-sm transition-colors',
                          on
                            ? 'border-accent bg-accent/15 text-accent'
                            : 'border-border text-muted hover:text-text',
                        )}
                      >
                        {c}
                        {knows && <span title="Has scouting knowledge"> ✓</span>}
                      </button>
                    )
                  })}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Countries</h2>
        <ul className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
          {region.countries.map((c) => {
            const by = assigned.filter((a) => a.countries.includes(c))
            const known = knowledgeOf(c)
            return (
              <li
                key={c}
                className={clsx(
                  'rounded-lg border bg-surface px-3 py-2 text-sm',
                  by.length ? 'border-border' : 'border-dashed border-border',
                )}
              >
                <p className="font-medium">{c}</p>
                <p className={clsx('text-xs', by.length ? 'text-accent' : 'text-amber-400')}>
                  {by.length ? by.map((a) => a.staff?.name).join(', ') : 'Not covered'}
                </p>
                {known.length > 0 && (
                  <p className="text-xs text-muted">
                    Knowledge: {known.map((k) => `${k.name} (${k.level})`).join(', ')}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}

function KeyAttributes({ staff }: { staff: StaffRow }) {
  const { staffScale } = useConfig()
  const shown = SCOUT_KEY_ATTRIBUTES.filter((a) => staff.attributes[a])
  if (shown.length === 0) return null
  return (
    <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
      {shown.map((a) => (
        <span key={a}>
          <span className="text-muted">{a}: </span>
          <span className={`font-semibold ${ratingColor(staff.attributes[a], staffScale)}`}>
            {staff.attributes[a]}
          </span>
        </span>
      ))}
    </p>
  )
}
