import { useState } from 'react'
import { SettingsSection } from '../../components/SettingsSection'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'

const input =
  'min-h-11 w-28 rounded-lg border border-border bg-surface-2 px-3 text-base tabular-nums md:text-sm'

/** Settings for the Tactics page. */
export function TacticsSettings() {
  const { briefingLowFit } = useConfig()
  const { save, reset } = useSaveConfig('briefingLowFit')
  const [value, setValue] = useState(String(briefingLowFit))
  const [prev, setPrev] = useState(briefingLowFit)
  if (prev !== briefingLowFit) {
    setPrev(briefingLowFit)
    setValue(String(briefingLowFit))
  }
  const n = Number(value)
  const valid = value.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 100
  return (
    <SettingsShell
      title="Tactics"
      subtitle="How the Tactics page judges your tactic."
      dirty={valid && n !== briefingLowFit}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => valid && save.mutate(n)}
      onReset={() => reset.mutate()}
    >
      <SettingsSection id="tactics/briefing" title="Briefing">
        <label className="grid gap-1 text-sm">
          <span className="text-muted">
            Flag a player in the briefing&apos;s Watch list when his fit for the roles is below
            (0–100, the same score as Squad fit)
          </span>
          <input
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={input}
          />
        </label>
      </SettingsSection>
    </SettingsShell>
  )
}
