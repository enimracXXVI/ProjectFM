import { clsx } from 'clsx'
import { CopyName } from './CopyName'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { usePlayers } from '../data/hooks'
import { useCurrentCareer } from '../lib/career'

/**
 * A player's name linking to his page: your squad's page when he is yours, else his World page
 * (by FM Unique ID). Without an ID it is plain text.
 */
export function PlayerLink({
  uid,
  children,
  className,
}: {
  uid: number | string | null | undefined
  children: ReactNode
  className?: string
}) {
  const career = useCurrentCareer()
  const { data: squad } = usePlayers(career.id)
  const id = uid == null || uid === '' ? null : Number(uid)
  const copy = typeof children === 'string' ? <CopyName name={children} className="-my-1" /> : null
  if (id === null || !Number.isFinite(id))
    return (
      <>
        <span className={className}>{children}</span>
        {copy}
      </>
    )
  const mine = squad?.find((p) => p.fm_uid === id)
  return (
    <>
      <Link
        to={mine ? `/squad/${mine.id}` : `/world/${id}`}
        className={clsx('hover:text-accent hover:underline', className)}
      >
        {children}
      </Link>
      {copy}
    </>
  )
}
