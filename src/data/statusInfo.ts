/**
 * Codes from FM's "Inf" column, shown as chips next to player names.
 * Only codes whose meaning is confirmed are listed; others show the bare code.
 */
export const STATUS_INFO: Record<string, { label: string }> = {
  Inj: {
    label: 'Injured',
  },
}

export function statusLabel(code: string): string | null {
  return STATUS_INFO[code]?.label ?? null
}
