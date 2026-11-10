import { DEFAULT_BADGE, type StatusInfo } from '../data/statusInfo'
import { useConfig } from '../lib/config'
import { Tooltip } from './Tooltip'

/** The badge itself; also used for the live preview in Settings → Statuses. */
export function StatusBadge({
  code,
  info,
}: {
  code: string
  info?: Pick<StatusInfo, 'bg' | 'fg'>
}) {
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[11px] leading-none font-semibold"
      style={{ backgroundColor: info?.bg ?? DEFAULT_BADGE.bg, color: info?.fg ?? DEFAULT_BADGE.fg }}
    >
      {code}
    </span>
  )
}

/** Status badge with the same tooltip as attributes: meaning as title, then description. */
export function StatusChip({ code }: { code?: string }) {
  const { statuses } = useConfig()
  if (!code) return null
  const info = statuses[code]
  const badge = <StatusBadge code={code} info={info} />
  if (!info?.label && !info?.description) return badge
  return (
    <Tooltip title={info.label || code} text={info.description || undefined}>
      <span tabIndex={0} className="inline-flex cursor-help">
        {badge}
      </span>
    </Tooltip>
  )
}
