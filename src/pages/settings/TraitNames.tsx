import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import type { TraitGuideEntry } from '../../data/traitGuide'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

const input =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

/**
 * Player traits in one place: the name of each trait by the number the save stores it
 * under, what it does (FM27's tooltip) and what suits it (FM27's staff advice rules).
 */
export function TraitsSettings() {
  const config = useConfig()
  const names = useSaveConfig('traitNames')
  const guide = useSaveConfig('traitGuide')
  const stored = { names: config.traitNames, guide: config.traitGuide }
  const [form, setForm] = useState(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  const [filter, setFilter] = useState('')
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }

  const entryOf = (name: string) =>
    name.trim() ? form.guide.findIndex((g) => norm(g.trait) === norm(name)) : -1
  const setEntry = (i: number, name: string, patch: Partial<TraitGuideEntry>) =>
    setForm({
      ...form,
      guide:
        i >= 0
          ? form.guide.map((g, j) => (j === i ? { ...g, ...patch } : g))
          : [...form.guide, { trait: name, suits: [], ...patch }],
    })
  const rename = (bit: string, name: string) => {
    // The guide entry follows its trait's new name
    const i = entryOf(form.names[bit] ?? '')
    setForm({
      names: { ...form.names, [bit]: name },
      guide: i >= 0 ? form.guide.map((g, j) => (j === i ? { ...g, trait: name } : g)) : form.guide,
    })
  }
  const named = new Set(Object.values(form.names).map(norm))
  const others = form.guide.map((g, i) => ({ g, i })).filter(({ g }) => !named.has(norm(g.trait)))
  const q = norm(filter)
  const shows = (name: string) => !q || norm(name).includes(q)

  const fields = (i: number, name: string) => {
    const g = i >= 0 ? form.guide[i] : null
    return (
      <>
        <textarea
          aria-label={`What ${name} does`}
          value={g?.about ?? ''}
          rows={2}
          placeholder="What the trait does"
          onChange={(e) => setEntry(i, name, { about: e.target.value })}
          className={`${input} py-2`}
        />
        <input
          aria-label={`What suits ${name}`}
          value={g?.suits.join(', ') ?? ''}
          placeholder="What suits it (comma separated)"
          onChange={(e) => setEntry(i, name, { suits: e.target.value.split(',') })}
          className={input}
        />
      </>
    )
  }

  return (
    <SettingsShell
      title="Player traits"
      subtitle="Each trait by the number the save stores it under: its name, what it does (FM27's own tooltip) and what suits it (FM27's staff advice rules). (?) marks a name not confirmed yet; an empty name shows as Trait #n."
      dirty={JSON.stringify(form) !== prev}
      saving={names.save.isPending || guide.save.isPending || names.reset.isPending}
      saved={names.save.isSuccess && guide.save.isSuccess}
      error={names.save.error ?? guide.save.error ?? names.reset.error ?? guide.reset.error}
      onSave={() => {
        names.save.mutate(
          Object.fromEntries(
            Object.entries(form.names)
              .map(([k, v]) => [k, v.trim()])
              .filter(([, v]) => v),
          ),
        )
        guide.save.mutate(
          form.guide
            .filter((g) => g.trait.trim())
            .map((g) => ({
              trait: g.trait.trim(),
              about: g.about?.trim() || undefined,
              suits: g.suits.map((x) => x.trim()).filter(Boolean),
            })),
        )
      }}
      onReset={() => {
        names.reset.mutate()
        guide.reset.mutate()
      }}
    >
      <input
        type="search"
        placeholder="Find trait"
        aria-label="Find trait"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className={`${input} mb-3 bg-surface md:max-w-xs`}
      />
      <ul className="grid gap-2">
        {Array.from({ length: 64 }, (_, bit) => String(bit))
          .filter((bit) => shows(form.names[bit] ?? `Trait ${bit}`))
          .map((bit) => {
            const name = form.names[bit] ?? ''
            return (
              <li
                key={bit}
                className="grid gap-2 rounded-xl border border-border bg-surface p-3 md:grid-cols-[2rem_16rem_minmax(0,1fr)_16rem]"
              >
                <span className="text-sm text-muted tabular-nums md:pt-3">{bit}</span>
                <input
                  aria-label={`Name of trait ${bit}`}
                  value={name}
                  placeholder={`Trait #${bit}`}
                  onChange={(e) => rename(bit, e.target.value)}
                  className={`${input} font-semibold`}
                />
                {name.trim() ? fields(entryOf(name), name) : <span className="md:col-span-2" />}
              </li>
            )
          })}
      </ul>
      {others.some(({ g }) => shows(g.trait)) && (
        <>
          <h2 className="mt-6 mb-2 text-sm font-semibold">Traits without a save number yet</h2>
          <ul className="grid gap-2">
            {others
              .filter(({ g }) => shows(g.trait))
              .map(({ g, i }) => (
                <li
                  key={i}
                  className="grid gap-2 rounded-xl border border-border bg-surface p-3 md:grid-cols-[18rem_minmax(0,1fr)_16rem]"
                >
                  <input
                    aria-label="Trait"
                    value={g.trait}
                    onChange={(e) => setEntry(i, g.trait, { trait: e.target.value })}
                    className={`${input} font-semibold`}
                  />
                  {fields(i, g.trait)}
                </li>
              ))}
          </ul>
        </>
      )}
    </SettingsShell>
  )
}
