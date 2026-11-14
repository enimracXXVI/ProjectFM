import { clsx } from 'clsx'
import { Info } from 'lucide-react'
import { useState } from 'react'
import type { FmAbout } from '../tactics/fm'

/** FM's explanation: short lines, description, pros (+) and cons (−). */
export function FmAboutBox({ about, className }: { about: FmAbout; className?: string }) {
  return (
    <div className={clsx('grid gap-1 rounded-lg bg-surface-2/60 p-2 text-xs', className)}>
      {about.short?.filter(Boolean).map((s) => (
        <p key={s} className="font-semibold">
          {s}
        </p>
      ))}
      {about.text && <p className="text-muted">{about.text}</p>}
      {!!(about.pros?.length || about.cons?.length) && (
        <ul className="mt-0.5 grid gap-0.5">
          {about.pros?.filter(Boolean).map((s) => (
            <li key={s} className="flex gap-1.5">
              <span className="font-bold text-emerald-400">+</span>
              {s}
            </li>
          ))}
          {about.cons?.filter(Boolean).map((s) => (
            <li key={s} className="flex gap-1.5">
              <span className="font-bold text-red-400">−</span>
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** A first short line, with the full explanation one tap away. */
export function FmAboutLine({ about }: { about?: FmAbout }) {
  const [open, setOpen] = useState(false)
  if (!about || !(about.short?.length || about.text || about.pros?.length)) return null
  return (
    <div className="grid gap-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-7 items-start gap-1 text-left text-[11px] text-muted hover:text-text"
      >
        <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
        <span className="line-clamp-2">{about.short?.[0] ?? about.text}</span>
      </button>
      {open && <FmAboutBox about={about} />}
    </div>
  )
}
