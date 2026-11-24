import { clsx } from 'clsx'
import { useState } from 'react'
import { useConfig } from '../lib/config'
import { nationId, pictureUrl, type PictureKind } from '../lib/pictures'

/** A picture from the online database; hidden when off, without an id, or not found. */
function Picture({
  kind,
  id,
  className,
  title,
}: {
  kind: PictureKind
  id: number | string | null | undefined
  className?: string
  title?: string
}) {
  const { pictures } = useConfig()
  const url = pictureUrl(pictures, kind, id)
  const [failed, setFailed] = useState<string | null>(null)
  if (!url || failed === url) return null
  return (
    <img
      src={url}
      alt=""
      title={title}
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setFailed(url)}
      className={clsx('shrink-0 object-contain', className)}
    />
  )
}

/** Faces found to be the picture site's blank placeholder (a plain white square), by address. */
const blank = new Map<string, boolean>()

/**
 * Whether a loaded face is the picture site's blank placeholder: a copy is loaded that the page
 * may read (only when the site allows it) and a few spots are checked for plain white. When the
 * site does not allow it, the face is kept.
 */
function checkBlank(url: string, done: (isBlank: boolean) => void) {
  if (blank.has(url)) return done(blank.get(url)!)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    try {
      const c = document.createElement('canvas')
      c.width = 8
      c.height = 8
      const g = c.getContext('2d', { willReadFrequently: true })!
      g.drawImage(img, 0, 0, 8, 8)
      const d = g.getImageData(0, 0, 8, 8).data
      let white = true
      for (let i = 0; i < d.length; i += 4)
        if (d[i + 3] > 0 && (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245)) white = false
      blank.set(url, white)
      done(white)
    } catch {
      blank.set(url, false)
    }
  }
  img.onerror = () => blank.set(url, false)
  img.src = url
}

/** A head-and-shoulders outline for players without a picture. */
function Silhouette({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx(
        'inline-grid shrink-0 place-items-end overflow-hidden rounded-full bg-surface-2 text-muted/60',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[85%]" fill="currentColor">
        <circle cx="12" cy="9" r="4.5" />
        <path d="M3.5 24c.6-5 4.2-8.5 8.5-8.5s7.9 3.5 8.5 8.5z" />
      </svg>
    </span>
  )
}

/** Player face by FM Unique ID; an outline when there is no picture (or only the blank one). */
export function Face({ id, className }: { id: number | null | undefined; className?: string }) {
  const { pictures } = useConfig()
  const url = pictureUrl(pictures, 'face', id)
  const [state, setState] = useState<{ url: string | null; bad: boolean }>({
    url: null,
    bad: false,
  })
  const bad = state.url === url && state.bad
  if (!pictures.enabled) return null
  if (!url || bad) return <Silhouette className={className} />
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setState({ url, bad: true })}
      onLoad={() => checkBlank(url, (isBlank) => isBlank && setState({ url, bad: true }))}
      className={clsx('shrink-0 object-contain', className)}
    />
  )
}

/** Club crest by the club's FM Unique ID. */
export function ClubCrest({
  id,
  className,
  title,
}: {
  id: number | string | null | undefined
  className?: string
  title?: string
}) {
  return <Picture kind="club" id={id} className={clsx('size-4', className)} title={title} />
}

/** Nation flag by nation name (as imports store it). */
export function Flag({
  nation,
  className,
}: {
  nation: string | null | undefined
  className?: string
}) {
  return (
    <Picture
      kind="flag"
      id={nationId(nation)}
      className={clsx('h-3 w-auto', className)}
      title={nation ?? undefined}
    />
  )
}
