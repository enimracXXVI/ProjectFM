import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const LONG_PRESS_MS = 450

/**
 * Shows a tooltip on mouse hover, keyboard focus, or long-press on touch.
 * A short tap still triggers the child's normal click (e.g. sorting).
 */
export function Tooltip({
  title,
  text,
  children,
}: {
  title?: string
  text?: string
  children: ReactNode
}) {
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const suppressClick = useRef(false)
  const [pos, setPos] = useState<{ x: number; y: number; above: number; placed?: boolean } | null>(
    null,
  )
  const bubble = useRef<HTMLSpanElement>(null)

  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    // Keep the bubble (max 256px wide) inside the viewport
    const half = Math.min(128, window.innerWidth / 2 - 8)
    const x = Math.min(Math.max(r.left + r.width / 2, half + 8), window.innerWidth - half - 8)
    setPos({ x, y: r.bottom + 6, above: r.top - 6 })
  }

  // Below the element, or above it when there is no room below (bottom of the screen)
  useLayoutEffect(() => {
    if (!pos || pos.placed) return
    const h = bubble.current?.getBoundingClientRect().height ?? 0
    const fitsBelow = pos.y + h <= window.innerHeight - 8
    setPos({ ...pos, placed: true, y: fitsBelow ? pos.y : Math.max(8, pos.above - h) })
  }, [pos])
  const hide = () => setPos(null)

  // Hide on scroll / outside touch so it never lingers on mobile.
  useEffect(() => {
    if (!pos) return
    const close = () => hide()
    window.addEventListener('scroll', close, true)
    window.addEventListener('pointerdown', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('pointerdown', close)
    }
  }, [pos])

  return (
    <span
      ref={ref}
      aria-describedby={pos ? id : undefined}
      className="inline-flex max-w-full min-w-0"
      onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
      onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}
      onFocus={show}
      onBlur={hide}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return
        e.stopPropagation()
        suppressClick.current = false
        timer.current = window.setTimeout(() => {
          suppressClick.current = true
          show()
        }, LONG_PRESS_MS)
      }}
      onPointerUp={() => window.clearTimeout(timer.current)}
      onPointerCancel={() => window.clearTimeout(timer.current)}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          e.stopPropagation()
          e.preventDefault()
          suppressClick.current = false
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
      {pos &&
        createPortal(
          <span
            id={id}
            ref={bubble}
            role="tooltip"
            style={{ left: pos.x, top: pos.y, visibility: pos.placed ? 'visible' : 'hidden' }}
            className="pointer-events-none fixed z-50 w-max max-w-64 -translate-x-1/2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-left text-xs font-normal tracking-normal text-text normal-case shadow-lg"
          >
            {title && (
              <span className={text ? 'mb-0.5 block font-semibold' : 'block font-semibold'}>
                {title}
              </span>
            )}
            {text}
          </span>,
          document.body,
        )}
    </span>
  )
}
