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

/** Player face by FM Unique ID. */
export function Face({ id, className }: { id: number | null | undefined; className?: string }) {
  return <Picture kind="face" id={id} className={className} />
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
