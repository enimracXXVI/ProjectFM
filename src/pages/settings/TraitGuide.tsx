import { useState } from 'react'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

const input =
  'min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm'

/** What suits each player trait (from FM's staff advice rules). */
export function TraitGuideSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('traitGuide')
  const stored = config.traitGuide
  const [form, setForm] = useState(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  return (
    <SettingsShell
      title="Trait guide"
      subtitle="Each player trait and what suits it, from FM27's staff advice rules. Separate strengths with commas."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() =>
        save.mutate(
          form
            .filter((g) => g.trait.trim())
            .map((g) => ({
              trait: g.trait.trim(),
              suits: g.suits.map((x) => x.trim()).filter(Boolean),
            })),
        )
      }
      onReset={() => reset.mutate()}
    >
      <ul className="grid gap-2">
        {form.map((g, i) => (
          <li key={i} className="grid gap-1 sm:grid-cols-[16rem_minmax(0,1fr)]">
            <input
              aria-label="Trait"
              value={g.trait}
              onChange={(e) =>
                setForm(form.map((x, j) => (j === i ? { ...x, trait: e.target.value } : x)))
              }
              className={`${input} font-semibold`}
            />
            <input
              aria-label={`What suits ${g.trait}`}
              value={g.suits.join(', ')}
              onChange={(e) =>
                setForm(
                  form.map((x, j) => (j === i ? { ...x, suits: e.target.value.split(',') } : x)),
                )
              }
              className={input}
            />
          </li>
        ))}
      </ul>
    </SettingsShell>
  )
}
