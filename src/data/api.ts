import { supabase } from '../lib/supabase'
import type { ImportedPlayer } from '../import/parse'
import type { Career, ImportRow, PlayerRow, SnapshotRow } from './db'

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export async function listCareers(): Promise<Career[]> {
  return check(await supabase.from('careers').select('*').order('created_at'))
}

export type NewCareer = Pick<Career, 'name' | 'club' | 'nation' | 'start_season' | 'current_season'>

export async function createCareer(input: NewCareer): Promise<Career> {
  return check(await supabase.from('careers').insert(input).select().single())
}

export async function updateCareer(id: string, patch: Partial<NewCareer>): Promise<Career> {
  return check(await supabase.from('careers').update(patch).eq('id', id).select().single())
}

export async function deleteCareer(id: string): Promise<void> {
  check(await supabase.from('careers').delete().eq('id', id))
}

export async function listPlayers(careerId: string): Promise<PlayerRow[]> {
  return check(await supabase.from('players').select('*').eq('career_id', careerId).order('name'))
}

export async function getPlayer(id: string): Promise<PlayerRow> {
  return check(await supabase.from('players').select('*').eq('id', id).single())
}

export async function listSnapshots(playerId: string): Promise<SnapshotRow[]> {
  return check(
    await supabase
      .from('player_snapshots')
      .select('id, player_id, season, age, attributes, created_at')
      .eq('player_id', playerId)
      .order('created_at'),
  )
}

export async function listImports(careerId: string): Promise<ImportRow[]> {
  return check(
    await supabase
      .from('imports')
      .select('*')
      .eq('career_id', careerId)
      .order('created_at', { ascending: false })
      .limit(20),
  )
}

export interface ImportSummary {
  added: number
  updated: number
  left: number
}

/**
 * Saves parsed players into a career.
 * Matches on FM Unique ID (falls back to name), records a snapshot per player for
 * development history, and for squad views marks players missing from the file as gone.
 */
export async function importPlayers(opts: {
  careerId: string
  season: string | null
  viewType: string
  fileName: string
  players: ImportedPlayer[]
  markMissingAsLeft: boolean
}): Promise<ImportSummary> {
  const { careerId, season, viewType, fileName, players, markMissingAsLeft } = opts

  const existing = check(
    await supabase.from('players').select('id, fm_uid, name, in_squad').eq('career_id', careerId),
  ) as Pick<PlayerRow, 'id' | 'fm_uid' | 'name' | 'in_squad'>[]
  const byUid = new Map(existing.filter((p) => p.fm_uid != null).map((p) => [p.fm_uid, p]))
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p]))

  const importRow = check(
    await supabase
      .from('imports')
      .insert({
        career_id: careerId,
        view_type: viewType,
        file_name: fileName,
        season,
        row_count: players.length,
      })
      .select('id')
      .single(),
  ) as { id: string }

  const rows = players.map((p) => {
    const match = (p.fm_uid != null && byUid.get(p.fm_uid)) || byName.get(p.name.toLowerCase())
    return { ...(match ? { id: match.id } : {}), career_id: careerId, ...p, in_squad: true }
  })
  const added = rows.filter((r) => !('id' in r)).length

  // Split so each batch has the same columns (PostgREST bulk insert requirement).
  const withId = rows.filter((r) => 'id' in r)
  const withoutId = rows.filter((r) => !('id' in r))
  const saved: Pick<PlayerRow, 'id' | 'fm_uid' | 'name'>[] = []
  if (withId.length) {
    saved.push(...check(await supabase.from('players').upsert(withId).select('id, fm_uid, name')))
  }
  if (withoutId.length) {
    saved.push(
      ...check(await supabase.from('players').insert(withoutId).select('id, fm_uid, name')),
    )
  }

  const savedId = (p: ImportedPlayer) =>
    saved.find((s) => (p.fm_uid != null ? s.fm_uid === p.fm_uid : s.name === p.name))?.id
  const snapshots = players
    .map((p) => ({
      player_id: savedId(p),
      career_id: careerId,
      import_id: importRow.id,
      season,
      age: p.age,
      attributes: p.attributes,
      extra: p.extra,
    }))
    .filter((s) => s.player_id)
  if (snapshots.length) check(await supabase.from('player_snapshots').insert(snapshots))

  let left = 0
  if (markMissingAsLeft) {
    const keep = new Set(saved.map((s) => s.id))
    const gone = existing.filter((p) => p.in_squad && !keep.has(p.id)).map((p) => p.id)
    if (gone.length) {
      check(await supabase.from('players').update({ in_squad: false }).in('id', gone))
      left = gone.length
    }
  }

  return { added, updated: saved.length - added, left }
}
