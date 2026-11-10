import { TONE_CLASSES } from '../data/statusInfo'
import { useConfig } from '../lib/config'

export function StatusChip({ code }: { code?: string }) {
  const { statuses } = useConfig()
  if (!code) return null
  const info = statuses[code]
  return (
    <span
      title={info?.label || undefined}
      className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[info?.tone ?? 'gray']}`}
    >
      {code}
    </span>
  )
}
