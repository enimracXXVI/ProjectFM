import { guideFor } from '../data/traitGuide'
import { traitNames } from '../data/traits'
import { useConfig } from '../lib/config'

/** A player's traits (as the save stores them, "2,8,10"), each with what it does and suits. */
export function TraitList({ traits }: { traits: string }) {
  const config = useConfig()
  const names = traitNames(traits, config.traitNames)
  return (
    <section className="mb-5">
      <h2 className="mb-1 border-b border-border pb-1 text-xs font-semibold text-muted">Traits</h2>
      {names.length ? (
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {names.map((t) => {
            const g = guideFor(t, config.traitGuide)
            return (
              <li key={t} className="rounded-lg border border-border bg-surface px-3 py-1.5">
                <span className="font-semibold">{t}</span>
                {g?.about && <span className="block text-xs">{g.about}</span>}
                {g && g.suits.length > 0 && (
                  <span className="block text-xs text-muted">Suits {g.suits.join(', ')}</span>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">No traits.</p>
      )}
    </section>
  )
}
