import { PageHeader } from '../components/ui'
import { players } from '../data/mock'
import { useCareer } from '../lib/career'
import { formatMoney, formatWage } from '../lib/format'

export function Squad() {
  const { current } = useCareer()
  const squad = players.filter((p) => p.careerId === current.id)

  return (
    <>
      <PageHeader title="Squad" subtitle={`${squad.length} players · ${current.currentSeason}`} />

      {/* Phones: cards */}
      <ul className="grid gap-2 md:hidden">
        {squad.map((p) => (
          <li key={p.id} className="border-border bg-surface rounded-xl border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{p.name}</span>
              <span className="text-accent text-sm font-semibold tabular-nums">
                {p.avgRating.toFixed(2)}
              </span>
            </div>
            <p className="text-muted text-xs">
              {p.positions} · {p.age} · {p.nationality}
            </p>
            <dl className="mt-2 grid grid-cols-4 gap-1 text-center text-xs">
              <MiniStat label="Apps" value={p.apps} />
              <MiniStat label="Gls" value={p.goals} />
              <MiniStat label="Ast" value={p.assists} />
              <MiniStat label="Value" value={formatMoney(p.value)} />
            </dl>
          </li>
        ))}
      </ul>

      {/* Tablet / desktop: table */}
      <div className="border-border hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-left text-xs tracking-wide uppercase">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Position</th>
              <th className="px-4 py-3 text-right">Age</th>
              <th className="px-4 py-3">Nat</th>
              <th className="px-4 py-3 text-right">Apps</th>
              <th className="px-4 py-3 text-right">Gls</th>
              <th className="px-4 py-3 text-right">Ast</th>
              <th className="px-4 py-3 text-right">Av Rat</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3 text-right">Wage</th>
            </tr>
          </thead>
          <tbody className="divide-border bg-surface divide-y tabular-nums">
            {squad.map((p) => (
              <tr key={p.id} className="hover:bg-surface-2">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="text-muted px-4 py-3">{p.positions}</td>
                <td className="px-4 py-3 text-right">{p.age}</td>
                <td className="px-4 py-3">{p.nationality}</td>
                <td className="px-4 py-3 text-right">{p.apps}</td>
                <td className="px-4 py-3 text-right">{p.goals}</td>
                <td className="px-4 py-3 text-right">{p.assists}</td>
                <td className="text-accent px-4 py-3 text-right font-semibold">
                  {p.avgRating.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">{formatMoney(p.value)}</td>
                <td className="px-4 py-3 text-right">{formatWage(p.wage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-2 rounded-md py-1">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
