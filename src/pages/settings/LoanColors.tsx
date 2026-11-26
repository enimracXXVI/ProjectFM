import { useState } from 'react'
import { DEFAULT_LOAN_COLORS, type LoanColors } from '../../data/config'
import { useConfig } from '../../lib/config'
import { useSaveConfig } from '../../lib/useSaveConfig'
import { loanNameStyle, loanRowStyle } from '../../lib/loanStyle'

const MODES: [LoanColors['mode'], string][] = [
  ['name', 'Name only'],
  ['row', 'Whole row'],
  ['off', 'Off'],
]

/** How Squad marks players on loan at the club, with a preview. */
export function LoanColorsEditor() {
  const { loanColors } = useConfig()
  const { save, reset } = useSaveConfig('loanColors')
  const [form, setForm] = useState(loanColors)
  const [prev, setPrev] = useState(JSON.stringify(loanColors))
  if (prev !== JSON.stringify(loanColors)) {
    setPrev(JSON.stringify(loanColors))
    setForm(loanColors)
  }
  const dirty = JSON.stringify(form) !== prev
  return (
    <section className="mb-6 grid gap-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="font-semibold">Players on loan</h2>
      <p className="text-sm text-muted">
        How Squad marks players you have on loan from another club.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg border border-border p-1" role="radiogroup">
          {MODES.map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={form.mode === m}
              onClick={() => setForm({ ...form, mode: m })}
              className={
                form.mode === m
                  ? 'min-h-9 rounded-md bg-surface-2 px-3 text-sm font-semibold'
                  : 'min-h-9 rounded-md px-3 text-sm text-muted'
              }
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="color"
            aria-label="Loan colour"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            className="size-10 cursor-pointer rounded border border-border bg-transparent"
          />
          Colour <span className="font-mono text-xs text-muted">{form.color.toUpperCase()}</span>
        </label>
      </div>
      <ul className="grid max-w-sm gap-0.5 text-sm">
        <li className="rounded px-2 py-1" style={loanRowStyle(form)}>
          <span style={loanNameStyle(form)}>Franco Mastantuono</span>
        </li>
        <li className="rounded px-2 py-1">Moise Kean</li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate(form)}
          className="min-h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-black disabled:opacity-40"
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            setForm(DEFAULT_LOAN_COLORS)
            reset.mutate()
          }}
          className="min-h-10 rounded-lg border border-border px-4 text-sm"
        >
          Default
        </button>
        {save.isSuccess && !dirty && <span className="self-center text-sm text-accent">Saved</span>}
      </div>
    </section>
  )
}
