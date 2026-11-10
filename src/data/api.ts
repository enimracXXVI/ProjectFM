import { supabase } from '../lib/supabase'
import type { ImportedPlayer, ParseResult } from '../import/parse'
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

export type CareerImageSlot = 'crest_url' | 'kit_home_url' | 'kit_away_url' | 'kit_third_url'

export async function updateCareer(
  id: string,
  patch: Partial<NewCareer> & Partial<Record<CareerImageSlot, string | null>>,
): Promise<Career> {
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
      .select('id, player_id, season, age, attributes, extra, created_at')
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

const CORE_FIELDS = [
  'fm_uid',
  'name',
  'positions',
  'squad_number',
  'age',
  'nation',
  'second_nation',
  'height_cm',
  'left_foot',
  'right_foot',
  'personality',
] as const satisfies readonly (keyof ImportedPlayer)[]

type ExistingPlayer = Pick<
  PlayerRow,
  (typeof CORE_FIELDS)[number] | 'id' | 'attributes' | 'extra' | 'in_squad'
>

/**
 * Combines an imported row with what is already stored, so importing a different FM view
 * (e.g. stats or contracts) never wipes data that view doesn't contain.
 * Columns present in the file win, even when empty (e.g. an injury that has healed).
 */
export function mergePlayer(
  existing: ExistingPlayer | undefined,
  incoming: ImportedPlayer,
  present: { core: Set<string>; attributes: Set<string>; extra: Set<string> },
): Omit<ImportedPlayer, never> {
  if (!existing) return incoming
  const merged = { ...incoming } as Record<string, unknown>
  for (const f of CORE_FIELDS) {
    if (!present.core.has(f)) merged[f] = existing[f]
  }
  const attributes = { ...existing.attributes }
  for (const a of present.attributes) delete attributes[a]
  const extra = { ...existing.extra }
  for (const e of present.extra) delete extra[e]
  return {
    ...(merged as unknown as ImportedPlayer),
    attributes: { ...attributes, ...incoming.attributes },
    extra: { ...extra, ...incoming.extra },
  }
}

/**
 * Saves parsed players into a career.
 * Matches on FM Unique ID (falls back to name), merges with stored data, records a
 * snapshot per player for development history, and for full-squad imports marks
 * players missing from the file as gone.
 */
export async function importPlayers(opts: {
  careerId: string
  season: string | null
  viewType: string
  fileName: string
  players: ImportedPlayer[]
  columns: ParseResult['columns']
  markMissingAsLeft: boolean
}): Promise<ImportSummary> {
  const { careerId, season, viewType, fileName, players, columns, markMissingAsLeft } = opts

  const present = {
    core: new Set<string>(),
    attributes: new Set<string>(),
    extra: new Set<string>(),
  }
  for (const { target } of columns) {
    if (target.kind === 'core') present.core.add(target.field)
    else if (target.kind === 'attribute') present.attributes.add(target.name)
    else present.extra.add(target.key)
  }

  const existing = check(
    await supabase
      .from('players')
      .select(['id', 'attributes', 'extra', 'in_squad', ...CORE_FIELDS].join(', '))
      .eq('career_id', careerId),
  ) as unknown as ExistingPlayer[]
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

  const matched = players.map((p) => {
    const match = (p.fm_uid != null && byUid.get(p.fm_uid)) || byName.get(p.name.toLowerCase())
    return { incoming: p, match: match || undefined }
  })
  const updates = matched
    .filter((m) => m.match)
    .map(({ incoming, match }) => ({
      id: match!.id,
      career_id: careerId,
      ...mergePlayer(match, incoming, present),
      in_squad: true,
    }))
  const inserts = matched
    .filter((m) => !m.match)
    .map(({ incoming }) => ({ career_id: careerId, ...incoming, in_squad: true }))

  // Separate batches: PostgREST bulk writes need the same columns in every row
  const saved: Pick<PlayerRow, 'id' | 'fm_uid' | 'name'>[] = []
  if (updates.length) {
    saved.push(...check(await supabase.from('players').upsert(updates).select('id, fm_uid, name')))
  }
  if (inserts.length) {
    saved.push(...check(await supabase.from('players').insert(inserts).select('id, fm_uid, name')))
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

  return { added: inserts.length, updated: updates.length, left }
}

const BUCKET = 'career-images'

/** Path inside the bucket from a public URL, so old files can be deleted. */
function storagePath(url: string | null): string | null {
  const marker = `/object/public/${BUCKET}/`
  const i = url?.indexOf(marker) ?? -1
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null
}

/** Uploads a crest/kit image, stores its URL on the career and removes the previous file. */
export async function setCareerImage(
  career: Career,
  slot: CareerImageSlot,
  file: Blob | null,
): Promise<Career> {
  let url: string | null = null
  if (file) {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) throw new Error('Not signed in')
    const ext = file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1] || 'png'
    const path = `${auth.user.id}/${career.id}/${slot.replace('_url', '')}-${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, cacheControl: '31536000' })
    if (error) throw new Error(error.message)
    url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }
  const updated = await updateCareer(career.id, { [slot]: url })
  const old = storagePath(career[slot])
  if (old) await supabase.storage.from(BUCKET).remove([old]) // best effort
  return updated
}
