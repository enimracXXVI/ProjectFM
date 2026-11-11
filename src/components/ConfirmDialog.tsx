import { AlertTriangle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ConfirmContext, type Ask, type ConfirmOptions } from './confirm'
import { Button } from './form'

/** The app's own confirmation dialog, used instead of the browser's confirm/prompt boxes. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null)
  const ask = useCallback<Ask>(
    (options) => new Promise((resolve) => setCurrent({ ...options, resolve })),
    [],
  )
  const close = (ok: boolean) => {
    current?.resolve(ok)
    setCurrent(null)
  }
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {current && <Dialog key={current.title} options={current} onClose={close} />}
    </ConfirmContext.Provider>
  )
}

function Dialog({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [typed, setTyped] = useState('')
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const ready = !options.typeToConfirm || typed === options.typeToConfirm

  return (
    <dialog
      ref={ref}
      onCancel={(e) => (e.preventDefault(), onClose(false))}
      onClick={(e) => e.target === ref.current && onClose(false)}
      aria-labelledby="confirm-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-surface p-0 text-text shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready) onClose(true)
        }}
        className="grid gap-4 p-5"
      >
        <div className="flex items-start gap-3">
          {options.danger && (
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-400">
              <AlertTriangle className="size-5" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-lg font-semibold">
              {options.title}
            </h2>
            {options.message && <div className="mt-1 text-sm text-muted">{options.message}</div>}
          </div>
        </div>
        {options.typeToConfirm && (
          <label className="grid gap-1 text-sm">
            <span>
              Type <strong className="break-all">{options.typeToConfirm}</strong> to confirm
            </span>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="min-h-11 rounded-lg border border-border bg-surface-2 px-3 text-base md:text-sm"
            />
          </label>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onClose(false)}
            autoFocus={!options.typeToConfirm}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!ready}
            variant={options.danger ? 'danger-solid' : 'primary'}
          >
            {options.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
