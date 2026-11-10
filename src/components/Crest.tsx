import { clsx } from 'clsx'
import { Shield } from 'lucide-react'

/** Club crest, or a neutral shield when none is uploaded. */
export function Crest({ url, className }: { url: string | null | undefined; className?: string }) {
  return url ? (
    <img src={url} alt="" className={clsx('shrink-0 object-contain', className)} />
  ) : (
    <Shield className={clsx('shrink-0 text-muted', className)} aria-hidden />
  )
}
