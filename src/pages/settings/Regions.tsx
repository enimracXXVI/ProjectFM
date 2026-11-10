import { clsx } from 'clsx'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import type { Region } from '../../data/regions'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

const input =
  'min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

export function RegionsSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('regions')
  const [regions, setRegions] = useState(config.regions)
  const [prev, setPrev] = useState(config.regions)
  if (config.regions !== prev) {
    // Settings reloaded (after save/reset): show the stored version
    setPrev(config.regions)
    setRegions(config.regions)
  }
  const [openId, setOpenId] = useState<string | null>(null)
  const [newCountry, setNewCountry] = useState('')

  const update = (id: string, patch: Partial<Region>) =>
    setRegions(regions.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const moveCountry = (country: string, from: string, to: string) =>
    setRegions(
      regions.map((r) =>
        r.id === from
          ? { ...r, countries: r.countries.filter((c) => c !== country) }
          : r.id === to
            ? { ...r, countries: [...r.countries, country].sort() }
            : r,
      ),
    )

  // Borders are kept two-way: ticking A→B also ticks B→A
  const toggleNeighbour = (a: string, b: string) => {
    const on = regions.find((r) => r.id === a)?.neighbours.includes(b)
    setRegions(
      regions.map((r) =>
        r.id === a || r.id === b
          ? {
              ...r,
              neighbours: on
                ? r.neighbours.filter((n) => n !== (r.id === a ? b : a))
                : [...r.neighbours, r.id === a ? b : a],
            }
          : r,
      ),
    )
  }

  const addRegion = () => {
    const id = `region-${Date.now()}`
    setRegions([...regions, { id, name: 'New region', countries: [], neighbours: [] }])
    setOpenId(id)
  }

  const removeRegion = (id: string) =>
    setRegions(
      regions
        .filter((r) => r.id !== id)
        .map((r) => ({ ...r, neighbours: r.neighbours.filter((n) => n !== id) })),
    )

  const dirty = JSON.stringify(regions) !== JSON.stringify(config.regions)

  return (
    <SettingsShell
      title="Regions"
      subtitle="Scouting regions, their countries, and which regions border each other."
      dirty={dirty}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess || reset.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(regions)}
      onReset={() => reset.mutate()}
    >
      <ul className="grid gap-2">
        {regions.map((r) => {
          const open = openId === r.id
          return (
            <li key={r.id} className="rounded-xl border border-border bg-surface">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : r.id)}
                className="flex min-h-12 w-full items-center justify-between gap-2 px-4 text-left"
              >
                <span className="font-semibold">{r.name}</span>
                <span className="text-xs text-muted">{r.countries.length} countries</span>
              </button>
              {open && (
                <div className="grid gap-4 border-t border-border p-4">
                  <div className="flex items-end gap-2">
                    <label className="grid flex-1 gap-1 text-xs text-muted">
                      Name
                      <input
                        value={r.name}
                        onChange={(e) => update(r.id, { name: e.target.value })}
                        className={input}
                      />
                    </label>
                    <button
                      type="button"
                      aria-label={`Delete ${r.name}`}
                      disabled={r.countries.length > 0}
                      title={r.countries.length ? 'Move its countries out first' : undefined}
                      onClick={() => removeRegion(r.id)}
                      className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-red-400 disabled:opacity-30"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-muted">Countries</p>
                    <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {r.countries.map((c) => (
                        <li key={c} className="flex items-center gap-2 text-sm">
                          <span className="min-w-0 flex-1 truncate">{c}</span>
                          <select
                            aria-label={`Move ${c} to region`}
                            value={r.id}
                            onChange={(e) => moveCountry(c, r.id, e.target.value)}
                            className="min-h-10 w-32 rounded-lg border border-border bg-surface-2 px-1 text-xs"
                          >
                            {regions.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.name}
                              </option>
                            ))}
                          </select>
                        </li>
                      ))}
                    </ul>
                    <form
                      className="mt-2 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        const c = newCountry.trim()
                        if (c && !regions.some((x) => x.countries.includes(c)))
                          update(r.id, { countries: [...r.countries, c].sort() })
                        setNewCountry('')
                      }}
                    >
                      <input
                        value={newCountry}
                        onChange={(e) => setNewCountry(e.target.value)}
                        placeholder="Add country"
                        aria-label="Add country"
                        className={`${input} sm:max-w-xs`}
                      />
                      <button
                        type="submit"
                        className="min-h-11 shrink-0 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-surface-2"
                      >
                        Add
                      </button>
                    </form>
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-muted">Borders</p>
                    <div className="flex flex-wrap gap-1.5">
                      {regions
                        .filter((x) => x.id !== r.id)
                        .map((x) => {
                          const on = r.neighbours.includes(x.id)
                          return (
                            <button
                              key={x.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggleNeighbour(r.id, x.id)}
                              className={clsx(
                                'min-h-9 rounded-full border px-3 text-sm',
                                on
                                  ? 'border-accent bg-accent/15 text-accent'
                                  : 'border-border text-muted hover:text-text',
                              )}
                            >
                              {x.name}
                            </button>
                          )
                        })}
                    </div>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        onClick={addRegion}
        className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent"
      >
        <Plus className="size-4" aria-hidden /> Add region
      </button>
    </SettingsShell>
  )
}
