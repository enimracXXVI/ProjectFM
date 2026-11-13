/** Notes: one set per career, kept in the `notes` table (database update 0008). */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface NoteRow {
  id: string
  career_id: string
  category: string | null
  body: string
  pinned: boolean
  done: boolean
  player_id: string | null
  staff_id: string | null
  match_key: string | null
  created_at: string
  updated_at: string
}

export interface NoteCategory {
  id: string
  name: string
  /** Badge colour (HEX). */
  color: string
}

/** Starting categories (editable in Settings > Note categories). */
export const DEFAULT_NOTE_CATEGORIES: NoteCategory[] = [
  { id: 'recruitment', name: 'Recruitment', color: '#22c55e' },
  { id: 'tactics', name: 'Tactics', color: '#3987e5' },
  { id: 'squad-depth', name: 'Squad depth', color: '#c98500' },
  { id: 'contracts', name: 'Contracts', color: '#d95926' },
  { id: 'youth', name: 'Youth', color: '#7dd3fc' },
  { id: 'board', name: 'Board & finances', color: '#c4b5fd' },
  { id: 'medical', name: 'Medical & training', color: '#fca5a5' },
  { id: 'opposition', name: 'Opposition', color: '#d55181' },
  { id: 'goals', name: 'Season goals', color: '#fcd34d' },
]

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export async function listNotes(careerId: string): Promise<NoteRow[]> {
  return check(
    await supabase
      .from('notes')
      .select('*')
      .eq('career_id', careerId)
      .order('created_at', { ascending: false }),
  )
}

export async function saveNote(
  careerId: string,
  id: string | null,
  patch: Partial<
    Pick<NoteRow, 'category' | 'body' | 'pinned' | 'done' | 'player_id' | 'staff_id' | 'match_key'>
  >,
): Promise<void> {
  if (id) check(await supabase.from('notes').update(patch).eq('id', id))
  else check(await supabase.from('notes').insert({ career_id: careerId, ...patch }))
}

export async function deleteNote(id: string): Promise<void> {
  check(await supabase.from('notes').delete().eq('id', id))
}

export const useNotes = (careerId: string) =>
  useQuery({ queryKey: ['notes', careerId], queryFn: () => listNotes(careerId), retry: false })

/** Pinned first, then open before done, newest first. */
export function sortNotes(notes: NoteRow[]): NoteRow[] {
  return [...notes].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      Number(a.done) - Number(b.done) ||
      b.created_at.localeCompare(a.created_at),
  )
}

/** What a note can be linked to: a player, a staff member or a match. */
export type NoteLink =
  { kind: 'player'; id: string } | { kind: 'staff'; id: string } | { kind: 'match'; id: string }

/** A match's link key: competition database id, fixture key and season, e.g. "32|2026-08-22_1129_1179|2026". */
export const matchLinkKey = (dbId: number | null, fixtureKey: string, season: number | null) =>
  `${dbId ?? ''}|${fixtureKey}|${season ?? ''}`

/** The match page of a match link key. */
export function matchLinkHref(key: string): string {
  const [db, fixture, season] = key.split('|')
  return `/competitions/${db}/match/${fixture}${season ? `?season=${season}` : ''}`
}

export const linkOf = (
  n: Pick<NoteRow, 'player_id' | 'staff_id' | 'match_key'>,
): NoteLink | null =>
  n.player_id
    ? { kind: 'player', id: n.player_id }
    : n.staff_id
      ? { kind: 'staff', id: n.staff_id }
      : n.match_key
        ? { kind: 'match', id: n.match_key }
        : null

/** The note columns for a link (the other two cleared). */
export const linkColumns = (link: NoteLink | null) => ({
  player_id: link?.kind === 'player' ? link.id : null,
  staff_id: link?.kind === 'staff' ? link.id : null,
  match_key: link?.kind === 'match' ? link.id : null,
})

/** "player:<id>" and back, for pickers. */
export const linkValue = (link: NoteLink | null) => (link ? `${link.kind}:${link.id}` : '')
export function parseLinkValue(v: string): NoteLink | null {
  const i = v.indexOf(':')
  if (i < 0) return null
  const kind = v.slice(0, i) as NoteLink['kind']
  return ['player', 'staff', 'match'].includes(kind)
    ? ({ kind, id: v.slice(i + 1) } as NoteLink)
    : null
}

export const sameLink = (a: NoteLink | null, b: NoteLink | null) =>
  !!a && !!b && a.kind === b.kind && a.id === b.id
