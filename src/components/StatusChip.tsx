import { statusLabel } from '../data/statusInfo'

const tone: Record<string, string> = {
  Inj: 'bg-red-500/15 text-red-300',
}

export function StatusChip({ code }: { code?: string }) {
  if (!code) return null
  return (
    <span
      title={statusLabel(code) ?? undefined}
      className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone[code] ?? 'bg-surface-2 text-muted'}`}
    >
      {code}
    </span>
  )
}
