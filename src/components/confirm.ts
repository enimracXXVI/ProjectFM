import { createContext, useContext, type ReactNode } from 'react'

export interface ConfirmOptions {
  title: string
  message?: ReactNode
  /** Label of the confirm button (default "Confirm"). */
  confirmLabel?: string
  /** Red confirm button, for actions that delete or clear data. */
  danger?: boolean
  /** The user must type this text exactly before confirming (for big, permanent actions). */
  typeToConfirm?: string
}

export type Ask = (options: ConfirmOptions) => Promise<boolean>

export const ConfirmContext = createContext<Ask | null>(null)

/** `const confirm = useConfirm(); if (await confirm({ title: 'Delete?' })) …` */
export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext)
  if (!ask) throw new Error('useConfirm needs <ConfirmProvider>')
  return ask
}
