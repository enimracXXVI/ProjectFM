import { useSearchParams } from 'react-router-dom'

/**
 * A page setting (tab, filter, sort…) kept in the address bar, so the back button, a reload
 * or a shared link return to the same view. The default value is left out of the address.
 * Changes replace the current history entry instead of adding one.
 */
export function useUrlState<T>(
  key: string,
  initial: T,
  codec: { parse: (s: string) => T; format: (v: T) => string } = JSON_CODEC as never,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [params, setParams] = useSearchParams()
  const read = (raw: string | null) => {
    if (raw === null) return initial
    try {
      return codec.parse(raw)
    } catch {
      return initial
    }
  }
  const value = read(params.get(key))
  const set = (arg: T | ((prev: T) => T)) => {
    // The live address, so several settings changed together all stick
    const live = new URLSearchParams(window.location.search)
    const next =
      typeof arg === 'function' ? (arg as (prev: T) => T)(read(live.get(key))) : (arg as T)
    const text = codec.format(next)
    if (text === codec.format(initial)) live.delete(key)
    else live.set(key, text)
    setParams(live, { replace: true, preventScrollReset: true })
  }
  return [value, set]
}

const JSON_CODEC = {
  parse: (s: string) => JSON.parse(s) as unknown,
  format: (v: unknown) => JSON.stringify(v),
}

/** Plain text, e.g. a tab name or a search box. */
export const TEXT = { parse: (s: string) => s, format: (s: string) => s }

/** On / off. */
export const BOOL = { parse: (s: string) => s === '1', format: (b: boolean) => (b ? '1' : '0') }

/** A whole number. */
export const NUM = { parse: (s: string) => Number(s), format: (n: number) => String(n) }

/** Column and direction, e.g. "age-desc". */
export const SORT = {
  parse: (s: string) => {
    const i = s.lastIndexOf('-')
    return { col: s.slice(0, i), asc: s.slice(i + 1) !== 'desc' }
  },
  format: (v: { col: string; asc: boolean }) => `${v.col}-${v.asc ? 'asc' : 'desc'}`,
}
