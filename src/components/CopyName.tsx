import { clsx } from 'clsx'
import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * A small button that copies a person's name, to paste into FM's search. Shows a tick for a
 * moment once copied. Clicks do not reach the row or link around it.
 */
export function CopyName({ name, className }: { name: string; className?: string }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const t = window.setTimeout(() => setDone(false), 1500)
    return () => window.clearTimeout(t)
  }, [done])
  const copy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(name)
    } catch {
      // Older browsers: copy through a hidden text box
      const box = document.createElement('textarea')
      box.value = name
      box.style.position = 'fixed'
      box.style.opacity = '0'
      document.body.appendChild(box)
      box.select()
      document.execCommand('copy')
      box.remove()
    }
    setDone(true)
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={done ? `Copied ${name}` : `Copy ${name}`}
      title={done ? 'Copied' : 'Copy name'}
      className={clsx(
        'inline-grid size-7 shrink-0 place-items-center rounded-md align-middle text-muted hover:bg-surface-2 hover:text-text',
        done && 'text-accent',
        className,
      )}
    >
      {done ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
    </button>
  )
}
