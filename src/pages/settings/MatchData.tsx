import { useState } from 'react'
import { SettingsSection } from '../../components/SettingsSection'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'
import type { MatchData } from '../../tactics/matchData'

const box =
  'min-h-10 min-w-0 rounded-lg border border-border bg-surface-2 px-2 text-base tabular-nums md:text-sm'

/** FM's match data: rating points by role, and how tactical training adds up. */
export function MatchDataSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('matchData')
  const stored = config.matchData
  const [form, setForm] = useState<MatchData>(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const [set, setSet] = useState(0)
  const mask = BigInt(config.fmCodes.roleCodeMask)
  // The in-possession roles that use each rating set (by the role's number)
  const rolesOf = (index: number) =>
    config.roles
      .filter((r) => r.phase === 'ip' && r.fm?.code)
      .filter((r) => {
        const code = BigInt(r.fm!.code!) & mask
        const bit = code.toString(2).length - 1
        return form.ratings.lookup.some(([b, i]) => b === bit && i === index)
      })
      .map((r) => r.name)
  const setValue = (k: number, value: number) =>
    setForm({
      ...form,
      ratings: {
        ...form.ratings,
        sets: form.ratings.sets.map((s, i) =>
          i === set ? s.map((c, j) => (j === k ? [c[0], value] : c)) : s,
        ) as MatchData['ratings']['sets'],
      },
    })
  const t = form.training
  const setBands = (key: 'coach' | 'player' | 'weeks', k: number, n: 0 | 1, value: number) =>
    setForm({
      ...form,
      training: {
        ...t,
        [key]: t[key].map((b, j) => (j === k ? (n ? [b[0], value] : [value, b[1]]) : b)),
      },
    })
  const bandEditor = (key: 'coach' | 'player' | 'weeks', label: string) => (
    <div className="grid gap-1">
      <p className="text-xs text-muted">{label}: from (left) → multiplier (right)</p>
      <div className="flex flex-wrap gap-1">
        {t[key].map(([from, mult], k) => (
          <span key={k} className="flex items-center gap-0.5">
            <input
              aria-label={`${label} from`}
              inputMode="numeric"
              value={from}
              onChange={(e) => setBands(key, k, 0, Number(e.target.value) || 0)}
              className={`${box} w-14 text-center`}
            />
            <input
              aria-label={`${label} multiplier`}
              inputMode="decimal"
              value={mult}
              onChange={(e) => setBands(key, k, 1, Number(e.target.value) || 0)}
              className={`${box} w-16 text-center`}
            />
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <SettingsShell
      title="FM match data"
      subtitle="Read from FM27's match data (simatch.fmf): the points FM's match ratings give each event by role, and how tactical training adds up. Change them after a game update or for a new FM."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(form)}
      onReset={() => reset.mutate()}
    >
      <div className="grid gap-4">
        <SettingsSection id="match-data/ratings" title="Match ratings">
          <div className="grid gap-2">
            <label className="grid gap-1 text-xs text-muted">
              Every player starts at (1000 = one rating point)
              <input
                inputMode="numeric"
                value={form.ratings.start}
                onChange={(e) =>
                  setForm({
                    ...form,
                    ratings: { ...form.ratings, start: Number(e.target.value) || 0 },
                  })
                }
                className={`${box} w-28`}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Rating set (FM groups roles)
              <select value={set} onChange={(e) => setSet(Number(e.target.value))} className={box}>
                {form.ratings.sets.map((_, i) => (
                  <option key={i} value={i}>
                    Set {i + 1}: {rolesOf(i).join(', ') || 'no role in Settings'}
                  </option>
                ))}
              </select>
            </label>
            <ul className="grid gap-1 sm:grid-cols-2">
              {(form.ratings.sets[set] ?? []).map(([name, value], k) => (
                <li key={name} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <input
                    aria-label={`${name} points`}
                    inputMode="numeric"
                    value={value}
                    onChange={(e) => setValue(k, Number(e.target.value) || 0)}
                    className={`${box} w-20 text-right`}
                  />
                </li>
              ))}
            </ul>
          </div>
        </SettingsSection>
        <SettingsSection id="match-data/training" title="Tactical training">
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2 text-xs">
              {(
                [
                  ['one', 'One tactic %'],
                  ['twoMain', 'Two: main %'],
                  ['twoOther', 'Two: other %'],
                  ['threeMain', 'Three: main %'],
                  ['threeOther', 'Three: each other %'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="grid gap-1 text-muted">
                  {label}
                  <input
                    inputMode="numeric"
                    value={t.split[k]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        training: {
                          ...t,
                          split: { ...t.split, [k]: Number(e.target.value) || 0 },
                        },
                      })
                    }
                    className={`${box} w-20`}
                  />
                </label>
              ))}
            </div>
            {bandEditor('coach', 'Coach quality')}
            {bandEditor('player', "Player's tactical ability")}
            {bandEditor('weeks', 'Weeks at the club')}
          </div>
        </SettingsSection>
      </div>
    </SettingsShell>
  )
}
