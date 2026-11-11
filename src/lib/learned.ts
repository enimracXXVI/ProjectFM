import type { Learned } from '../data/config'
import { UNKNOWN_WORD, valueOf, withValue, wordOf } from './valueWord'

/** "Unknown (12)" → "Okay (12)" when the user has taught the word for 12; else unchanged. */
export function applyLearned(text: string, words: Record<string, string>): string {
  if (wordOf(text) !== UNKNOWN_WORD) return text
  const n = valueOf(text)
  const word = n === null ? undefined : words[String(n)]
  return word ? withValue(word, n!) : text
}

export type LearnedKind = keyof Learned
