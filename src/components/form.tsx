import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, InputHTMLAttributes } from 'react'

export function Field({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={clsx('grid gap-1 text-sm', className)}>
      <span className="text-muted">{label}</span>
      <input
        {...props}
        className="border-border bg-surface-2 text-text placeholder:text-muted/60 min-h-11 rounded-lg border px-3 text-base md:text-sm"
      />
    </label>
  )
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:opacity-50',
        variant === 'primary' && 'bg-accent text-bg hover:bg-accent-strong',
        variant === 'ghost' && 'border-border text-text hover:bg-surface-2 border',
        variant === 'danger' && 'border border-red-500/40 text-red-400 hover:bg-red-500/10',
        className,
      )}
    />
  )
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null
  const message = error instanceof Error ? error.message : String(error)
  return (
    <p role="alert" className="text-sm text-red-400">
      {message}
    </p>
  )
}
