import { ArrowLeft, Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SettingsSection } from '../../components/SettingsSection'
import { PageHeader } from '../../components/ui'
import { PALETTE } from '../../data/palette'

/** Every colour of the app with its HEX and RGB code; tap a HEX code to copy it. */
export function ColoursSettings() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (hex: string, key: string) => {
    try {
      await navigator.clipboard.writeText(hex)
    } catch {
      // Older browsers: copy through a hidden text field
      const t = document.createElement('textarea')
      t.value = hex
      document.body.append(t)
      t.select()
      document.execCommand('copy')
      t.remove()
    }
    setCopied(key)
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500)
  }

  return (
    <>
      <Link
        to="/settings"
        className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Settings
      </Link>
      <PageHeader
        title="Colours"
        subtitle="Every colour the app uses. Tap a HEX code to copy it."
      />
      <div className="grid gap-4">
        {PALETTE.map((group) => (
          <SettingsSection key={group.title} id={`colours/${group.title}`} title={group.title}>
            <p className="mb-3 text-sm text-muted">{group.note}</p>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {group.swatches.map((s) => {
                const key = `${group.title}/${s.name}`
                const done = copied === key
                return (
                  <li
                    key={key}
                    className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-surface-2/40 p-2"
                  >
                    <span
                      className="size-12 shrink-0 rounded-lg border border-border"
                      style={{ background: s.hex }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{s.name}</p>
                      <p className="truncate text-xs text-muted">{s.use}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <button
                          type="button"
                          onClick={() => copy(s.hex, key)}
                          aria-label={`Copy ${s.hex}`}
                          className="inline-flex min-h-8 items-center gap-1 rounded-md bg-surface px-2 font-mono font-semibold hover:text-accent"
                        >
                          {s.hex}
                          {done ? (
                            <Check className="size-3.5 text-accent" aria-hidden />
                          ) : (
                            <Copy className="size-3.5 text-muted" aria-hidden />
                          )}
                        </button>
                        <span className="font-mono text-muted">RGB {s.rgb.join(', ')}</span>
                        {done && <span className="text-accent">Copied</span>}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </SettingsSection>
        ))}
      </div>
    </>
  )
}
