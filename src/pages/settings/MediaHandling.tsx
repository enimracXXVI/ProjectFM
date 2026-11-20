import { useState } from 'react'
import { SettingsSection } from '../../components/SettingsSection'
import { SettingsShell } from '../../components/SettingsShell'
import { useConfig } from '../../lib/config'
import { MEDIA_THRESHOLD_TEXT, mediaHandling, type MediaThresholds } from '../../lib/mediaHandling'
import { useSaveConfig } from '../../lib/useSaveConfig'

const small =
  'min-h-11 w-20 shrink-0 rounded-lg border border-border bg-surface-2 px-2 text-center text-base tabular-nums md:text-sm'

/** Players checked in FM27, to see the rules at work as the thresholds change. */
const EXAMPLES: { name: string; fm: string; v: Record<string, number> }[] = [
  {
    name: 'Lapo Zipoli',
    fm: 'Evasive, Reserved',
    v: {
      Controversy: 5,
      Temperament: 12,
      Pressure: 15,
      Professionalism: 19,
      Sportsmanship: 12,
      Loyalty: 12,
    },
  },
  {
    name: 'Marin Pongračić',
    fm: 'Outspoken',
    v: {
      Controversy: 19,
      Temperament: 5,
      Pressure: 10,
      Professionalism: 10,
      Sportsmanship: 5,
      Loyalty: 5,
    },
  },
  {
    name: 'Víctor Valdepeñas',
    fm: 'Media-friendly, Reserved',
    v: {
      Controversy: 4,
      Temperament: 14,
      Pressure: 9,
      Professionalism: 15,
      Sportsmanship: 9,
      Loyalty: 9,
    },
  },
  {
    name: 'Giulio Orlando',
    fm: 'Outspoken, Media-friendly',
    v: {
      Controversy: 4,
      Temperament: 6,
      Pressure: 11,
      Professionalism: 11,
      Sportsmanship: 11,
      Loyalty: 11,
    },
  },
  {
    name: 'Harry Amass',
    fm: 'Unflappable',
    v: {
      Controversy: 5,
      Temperament: 15,
      Pressure: 15,
      Professionalism: 14,
      Sportsmanship: 13,
      Loyalty: 13,
    },
  },
  {
    name: 'Radu Drăguşin',
    fm: 'Level-headed',
    v: {
      Controversy: 12,
      Temperament: 12,
      Pressure: 13,
      Professionalism: 14,
      Sportsmanship: 13,
      Loyalty: 12,
    },
  },
]

/** The thresholds that give FM's media handling style from the hidden personality values. */
export function MediaHandlingSettings() {
  const config = useConfig()
  const { save, reset } = useSaveConfig('mediaHandling')
  const stored = config.mediaHandling
  const [form, setForm] = useState<MediaThresholds>(stored)
  const [prev, setPrev] = useState(JSON.stringify(stored))
  if (prev !== JSON.stringify(stored)) {
    setPrev(JSON.stringify(stored))
    setForm(stored)
  }
  const keys = Object.keys(MEDIA_THRESHOLD_TEXT) as (keyof MediaThresholds)[]
  return (
    <SettingsShell
      title="Media handling"
      subtitle="FM's media handling style, worked out from the hidden personality values (1–20) with the community Personality / Media Handling guide's logic, adapted to FM27 (FM27 shows the old Volatile and Short-tempered as Outspoken and no longer shows Confrontational). It matches all 93 players checked in FM27."
      dirty={JSON.stringify(form) !== prev}
      saving={save.isPending || reset.isPending}
      saved={save.isSuccess}
      error={save.error ?? reset.error}
      onSave={() => save.mutate(form)}
      onReset={() => reset.mutate()}
    >
      <SettingsSection id="media/order" title="How the style is worked out" className="mb-4">
        <ol className="grid list-decimal gap-1 pl-5 text-sm text-muted">
          <li>
            Controversy {form.outspokenControversy}+: <b className="text-text">Outspoken</b> (plus
            Unflappable).
          </li>
          <li>
            Pressure {form.evasivePressure}+ and Professionalism {form.evasiveProfessionalism}+:{' '}
            <b className="text-text">Evasive</b>, plus Reserved, Unflappable or Outspoken where they
            fit.
          </li>
          <li>
            Otherwise the extras: <b className="text-text">Unflappable</b> (Temperament{' '}
            {form.unflappableTemperament}+ and Pressure {form.unflappablePressure}+),{' '}
            <b className="text-text">Outspoken</b> (Temperament {form.outspokenTemperament} or
            less), <b className="text-text">Reserved</b> (Controversy {form.reservedControversy} or
            less, Professionalism {form.reservedProfessionalism}+). A steady player (Loyalty{' '}
            {form.steadyLoyalty}+ and Sportsmanship {form.steadySportsmanship}+ or Professionalism{' '}
            {form.steadyProfessionalism}+) shows only them; anyone else also shows Media-friendly.
          </li>
          <li>
            No extras: <b className="text-text">Level-headed</b> when steady, else{' '}
            <b className="text-text">Media-friendly</b>.
          </li>
        </ol>
      </SettingsSection>

      <SettingsSection id="media/thresholds" title="Thresholds" className="mb-4">
        <ul className="grid gap-2">
          {keys.map((k) => (
            <li key={k} className="flex items-center justify-between gap-3">
              <span className="min-w-0 text-sm">{MEDIA_THRESHOLD_TEXT[k]}</span>
              <input
                aria-label={MEDIA_THRESHOLD_TEXT[k]}
                inputMode="numeric"
                value={form[k]}
                onChange={(e) =>
                  setForm({ ...form, [k]: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })
                }
                className={small}
              />
            </li>
          ))}
        </ul>
      </SettingsSection>

      <SettingsSection id="media/examples" title="Players checked in FM27">
        <ul className="grid gap-1 text-sm">
          {EXAMPLES.map((x) => {
            const got = mediaHandling((k) => x.v[k], form)
            const ok =
              new Set(got?.split(', ')).size === new Set(x.fm.split(', ')).size &&
              x.fm.split(', ').every((s) => got?.includes(s))
            return (
              <li key={x.name} className="flex flex-wrap items-center gap-x-3">
                <span className="font-semibold">{x.name}</span>
                <span className="text-muted">FM: {x.fm}</span>
                <span className={ok ? 'text-emerald-400' : 'text-amber-300'}>
                  {ok ? '✓' : `rules give: ${got}`}
                </span>
              </li>
            )
          })}
        </ul>
      </SettingsSection>
    </SettingsShell>
  )
}
