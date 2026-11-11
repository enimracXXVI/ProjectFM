import { clsx } from 'clsx'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useConfirm } from './confirm'
import { Button, ErrorText } from './form'
import { PageHeader } from './ui'

/** Page frame for a settings editor with a sticky Save / Reset bar. */
export function SettingsShell({
  title,
  subtitle,
  dirty,
  saving,
  saved,
  error,
  onSave,
  onReset,
  children,
}: {
  title: string
  subtitle: string
  dirty: boolean
  saving: boolean
  saved: boolean
  error: unknown
  onSave: () => void
  onReset: () => void
  children: ReactNode
}) {
  const confirm = useConfirm()
  return (
    <>
      <Link
        to="/settings"
        className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Settings
      </Link>
      <PageHeader title={title} subtitle={subtitle} />
      {children}
      {/* Pinned to the bottom only while there is something to save */}
      <div
        className={clsx(
          'z-10 mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/95 p-3 backdrop-blur',
          dirty && 'sticky bottom-20 shadow-lg md:bottom-4',
        )}
      >
        <Button onClick={onSave} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            if (
              await confirm({
                title: `Reset ${title.toLowerCase()}?`,
                message: 'Your changes on this page are replaced by the defaults.',
                confirmLabel: 'Reset',
                danger: true,
              })
            )
              onReset()
          }}
        >
          Reset to defaults
        </Button>
        {saved && !dirty && <span className="text-sm text-accent">Saved</span>}
        {dirty && <span className="text-sm text-muted">Unsaved changes</span>}
        <ErrorText error={error} />
      </div>
    </>
  )
}
