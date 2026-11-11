import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RoleFitPanel } from '../components/RoleFitPanel'
import { Placeholder } from '../components/ui'
import { isGoalkeeper } from '../data/attributeInfo'
import { attributeLabel } from '../data/config'
import { usePlayers } from '../data/hooks'
import { attrColor, formatAttr } from '../lib/attributes'
import { useCurrentCareer } from '../lib/career'
import { useConfig } from '../lib/config'
import { rowToPlayer } from '../world/world'
import { useWorld } from '../world/hooks'
import { eur, eurWagePerYear } from '../lib/money'

export function WorldPlayer() {
  const { id = '' } = useParams()
  const career = useCurrentCareer()
  const config = useConfig()
  const { data, isPending, error } = useWorld(career.id)
  const { data: squad } = usePlayers(career.id)

  const p = useMemo(() => {
    const row = data?.file.rows.find((r) => String(r[0]) === id)
    return row && data ? rowToPlayer(data.file, row) : null
  }, [data, id])

  if (isPending) return <p className="text-sm text-muted">Opening the world database…</p>
  if (error) return <Placeholder>{error.message}</Placeholder>
  if (!p) return <Placeholder>Player not found in the world database.</Placeholder>

  const mine = squad?.find((s) => s.fm_uid === p.id)
  const columns = config.layout[isGoalkeeper(p.positions) ? 'goalkeepers' : 'outfield']
    .map((col) =>
      col
        .map((s) => ({
          ...s,
          attributes: s.attributes.filter((n) => p.attributes[n] !== undefined),
        }))
        .filter((s) => s.attributes.length > 0),
    )
    .filter((col) => col.length > 0)

  const info: [string, string | null][] = [
    ['Club', p.club ?? 'Free agent'],
    ['Division', p.division],
    ['Personality', p.personality],
    ['Height', p.height ? `${p.height} cm` : null],
    ['Value', eur(p.value)],
    ['Wage', eurWagePerYear(p.wage)],
    ['Contract until', p.expires],
    ['Transfer listed', p.listed ? 'Yes' : 'No'],
  ]
  if (config.showHidden)
    info.push(
      ['CA', p.ca != null ? String(p.ca) : null],
      ['PA', p.pa != null ? String(p.pa) : null],
    )

  return (
    <>
      <Link
        to="/world"
        className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> World
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
      <p className="mb-1 text-sm text-muted">
        {[
          p.positions,
          p.age && `${p.age} years`,
          [p.nation, p.secondNation].filter(Boolean).join(' / '),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {mine && (
        <p className="mb-3 text-sm">
          In your squad:{' '}
          <Link to={`/squad/${mine.id}`} className="text-accent underline">
            open player page
          </Link>
        </p>
      )}

      <dl className="my-5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {info.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-surface px-3 py-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="truncate font-medium">{value ?? '–'}</dd>
          </div>
        ))}
      </dl>

      <RoleFitPanel attributes={p.attributes} positions={p.positions} />

      <div className="grid gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((col, ci) => (
          <div key={ci} className="grid content-start gap-4">
            {col.map((section, si) => (
              <section key={si}>
                <h2 className="mb-1 border-b border-border pb-1 text-xs font-semibold text-muted">
                  {section.label}
                </h2>
                <ul className="text-sm">
                  {section.attributes.map((n) => (
                    <li
                      key={n}
                      className="flex min-h-9 items-center justify-between gap-2 px-3 odd:bg-surface even:bg-surface/40"
                    >
                      <span>{attributeLabel(config, n)}</span>
                      <span
                        className={`w-10 rounded bg-surface-2 py-0.5 text-center font-semibold tabular-nums ${attrColor(p.attributes[n])}`}
                      >
                        {formatAttr(p.attributes[n])}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ))}
      </div>

      {config.showHidden && Object.keys(p.hidden).length > 0 && (
        <section className="mt-5">
          <h2 className="mb-1 border-b border-border pb-1 text-xs font-semibold text-muted">
            Hidden attributes
          </h2>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            {Object.entries(p.hidden).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-surface px-3 py-2">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  )
}
