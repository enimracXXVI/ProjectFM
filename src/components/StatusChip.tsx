import { STATUS_LABELS } from '../import/fields'

const tone: Record<string, string> = {
  Inj: 'bg-red-500/15 text-red-300',
  Sus: 'bg-red-500/15 text-red-300',
  Wnt: 'bg-sky-500/15 text-sky-300',
  Lng: 'bg-amber-500/15 text-amber-300',
  Trn: 'bg-amber-500/15 text-amber-300',
}

export function StatusChip({ code }: { code?: string }) {
  if (!code) return null
  return (
    <span
      title={STATUS_LABELS[code] ?? code}
      className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone[code] ?? 'bg-surface-2 text-muted'}`}
    >
      {code}
    </span>
  )
}
