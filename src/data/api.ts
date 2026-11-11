import type { DevSnapshot } from '../lib/development'
import type { Team } from './teams'
import { supabase } from '../lib/supabase'
import { applyLearned, type LearnedKind } from '../lib/learned'
import { UNKNOWN_WORD, withValue } from '../lib/valueWord'
import { loadStoredConfig, mergeConfig, saveConfig } from './config'
import { DUMP_PRESENT, isReaderDump, type DumpSummary } from '../import/dump'
import type { CoreField } from '../import/fields'
import type { ImportedPlayer, ParseResult } from '../import/parse'
import {
  SAVE_CONTRACT_KEYS,
  SAVE_STATS_KEYS,
  isSaveDump,
  mergeKnowledge,
  saveScouts,
  saveUpdates,
  type SaveData,
  type StatsKind,
} from '../import/save'
import type { Career, ImportRow, PlayerRow, ScoutingNetwork, SnapshotRow, StaffRow } from './db'

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

export interface FreshStart {
  /** Squad players, their history and the import log. */
  squad: boolean
  /** Staff and the scouting network (scouts, heads of region, board limits). */
  staff: boolean
}

/**
 * Clears a career's data for a fresh start. The career itself, its crest and kits, and
 * Settings stay. The world database is removed separately (deleteWorld).
 */
export async function startFresh(career: Career, what: FreshStart): Promise<void> {
  if (what.squad) {
    // Snapshots go with their players
    check(await supabase.from('players').delete().eq('career_id', career.id))
    check(await supabase.from('imports').delete().eq('career_id', career.id))
  }
  if (what.staff) {
    check(await supabase.from('staff').delete().eq('career_id', career.id))
    await saveScouting(career.id, {})
  }
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
  // A personality the app could not work out never wipes one already known (or set by hand)
  if (merged.personality == null) merged.personality = existing.personality
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
    const { data: auth } = await supabase.auth.getSession()
    const user = auth.session?.user
    if (!user) throw new Error('Not signed in')
    const ext = file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1] || 'png'
    const path = `${user.id}/${career.id}/${slot.replace('_url', '')}-${Date.now()}.${ext}`
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

// --- Staff (scouts) ---

export type StaffInput = Omit<StaffRow, 'id' | 'career_id' | 'created_at' | 'fm_uid'>

export async function listStaff(careerId: string): Promise<StaffRow[]> {
  return check(
    await supabase
      .from('staff')
      .select(
        'id, career_id, fm_uid, name, role, age, nation, personality, reputation, attributes, knowledge, notes, created_at',
      )
      .eq('career_id', careerId)
      .order('name'),
  )
}

export async function saveStaff(
  careerId: string,
  id: string | null,
  input: StaffInput,
): Promise<StaffRow> {
  const query = id
    ? supabase.from('staff').update(input).eq('id', id)
    : supabase.from('staff').insert({ ...input, career_id: careerId })
  return check(await query.select().single())
}

/** Deletes a staff member and removes them from the career's scouting network. */
export async function deleteStaff(career: Career, id: string): Promise<void> {
  const net = career.scouting ?? {}
  const heads = Object.fromEntries(Object.entries(net.heads ?? {}).filter(([, s]) => s !== id))
  const scouts = Object.fromEntries(Object.entries(net.scouts ?? {}).filter(([s]) => s !== id))
  await saveScouting(career.id, { ...net, heads, scouts })
  check(await supabase.from('staff').delete().eq('id', id))
}

export async function saveScouting(careerId: string, scouting: ScoutingNetwork): Promise<void> {
  check(await supabase.from('careers').update({ scouting }).eq('id', careerId))
}

/** All attribute snapshots of a career (for the development page). */
export async function listCareerSnapshots(careerId: string): Promise<DevSnapshot[]> {
  return check(
    await supabase
      .from('player_snapshots')
      .select('player_id, created_at, season, attributes')
      .eq('career_id', careerId)
      .neq('attributes', '{}')
      .order('created_at'),
  )
}

// --- FMSuperScout dump import ---

export interface DumpImportResult {
  players: ImportSummary
  scoutsAdded: number
  scoutsUpdated: number
}

/**
 * Saves a dump: chosen squad players (merged like any import, plus hidden values),
 * marks squad players now at another club as gone, and updates or adds scouts.
 */
export async function importDump(opts: {
  career: Career
  summary: DumpSummary
  includeOtherTeams: boolean
  season: string | null
}): Promise<DumpImportResult> {
  const { career, summary, includeOtherTeams, season } = opts
  const { learned } = mergeConfig(await loadStoredConfig())
  const chosen = summary.players
    .filter((p) => includeOtherTeams || p.level === 'first')
    .map((p) => p.player)
    .map((p) =>
      p.extra.Morale
        ? { ...p, extra: { ...p.extra, Morale: applyLearned(p.extra.Morale, learned.morale) } }
        : p,
    )

  const attributeNames = new Set(chosen.flatMap((p) => Object.keys(p.attributes)))
  const columns: ParseResult['columns'] = [
    // Feet only come from the ProjectFM Reader; older FMSuperScout dumps leave them alone
    ...[
      ...DUMP_PRESENT.core,
      ...(isReaderDump(summary.meta) ? ['left_foot', 'right_foot'] : []),
    ].map((field) => ({
      header: field,
      target: { kind: 'core' as const, field: field as CoreField },
    })),
    ...[...attributeNames].map((name) => ({
      header: name,
      target: { kind: 'attribute' as const, name },
    })),
    ...[...DUMP_PRESENT.extra].map((key) => ({
      header: key,
      target: { kind: 'extra' as const, key },
    })),
  ]
  const players = await importPlayers({
    careerId: career.id,
    season,
    viewType: isSaveDump(summary.meta) ? 'FM save' : 'FMSuperScout',
    fileName: isSaveDump(summary.meta) ? 'FM save' : 'dump.json',
    players: chosen,
    columns,
    markMissingAsLeft: false,
  })

  // Squad numbers: only where the reader found one, so blanks never wipe a known number
  for (const p of summary.players) {
    if (p.squadNo === null || (!includeOtherTeams && p.level !== 'first')) continue
    check(
      await supabase
        .from('players')
        .update({ squad_number: p.squadNo })
        .eq('career_id', career.id)
        .eq('fm_uid', p.player.fm_uid!),
    )
  }

  // Players whose current club in FM is no longer yours (sold, released or loaned out)
  const myClub = summary.meta.myClub
  const gone = Object.entries(summary.clubOf)
    .filter(([, club]) => club !== myClub)
    .map(([uid]) => Number(uid))
  if (gone.length) {
    const res = check(
      await supabase
        .from('players')
        .update({ in_squad: false })
        .eq('career_id', career.id)
        .eq('in_squad', true)
        .in('fm_uid', gone)
        .select('id'),
    ) as { id: string }[]
    players.left += res.length
  }

  // Scouts: match on Unique ID, then on name (scouts typed in by hand have no ID yet)
  const staff = await listStaff(career.id)
  let scoutsAdded = 0
  let scoutsUpdated = 0
  for (const s of summary.scouts) {
    const match =
      staff.find((x) => x.fm_uid === s.fm_uid) ??
      staff.find((x) => x.name.toLowerCase() === s.name.toLowerCase())
    if (match) {
      check(
        await supabase
          .from('staff')
          .update({
            fm_uid: s.fm_uid,
            role: s.role,
            age: s.age ?? match.age,
            nation: match.nation ?? s.nation,
            // Authority is not in the dump, so the value entered by hand stays
            attributes: { ...match.attributes, ...s.attributes },
          })
          .eq('id', match.id),
      )
      scoutsUpdated++
    } else {
      check(
        await supabase.from('staff').insert({
          career_id: career.id,
          fm_uid: s.fm_uid,
          name: s.name,
          role: s.role,
          age: s.age,
          nation: s.nation,
          attributes: s.attributes,
        }),
      )
      scoutsAdded++
    }
  }
  return { players, scoutsAdded, scoutsUpdated }
}

/** Moves a player between first team, U21 and U18 (kept in extra, untouched by imports). */
export async function setPlayerTeam(player: PlayerRow, team: Team): Promise<void> {
  const extra = { ...player.extra }
  if (team === 'first') delete extra.team
  else extra.team = team
  check(await supabase.from('players').update({ extra }).eq('id', player.id))
}

// --- FM save import (fmsave) ---

/** Writes contract and season stats from a save into the squad (players already in ProjectFM). */
export async function importSave(opts: {
  career: Career
  data: SaveData
  kind: StatsKind
  season: string | null
  fileName: string
}): Promise<{
  updated: number
  notInSquad: number
  scoutsAdded: number
  scoutsUpdated: number
}> {
  const { career, data, kind, season, fileName } = opts
  const existing = (await listPlayers(career.id)).filter((p) => p.fm_uid != null)
  const byUid = new Map(existing.map((p) => [p.fm_uid!, p]))
  const updates = saveUpdates(data, kind)

  const importRow = check(
    await supabase
      .from('imports')
      .insert({
        career_id: career.id,
        view_type: 'FM save',
        file_name: fileName,
        season,
        row_count: updates.length,
      })
      .select('id')
      .single(),
  ) as { id: string }

  let updated = 0
  const snapshots: Record<string, unknown>[] = []
  for (const u of updates) {
    const p = byUid.get(u.uniqueId)
    if (!p) continue
    const extra = { ...p.extra }
    // Each group replaces what an earlier import wrote, so nothing goes stale
    if (u.contract) {
      for (const k of SAVE_CONTRACT_KEYS) delete extra[k]
      Object.assign(extra, u.contract)
    }
    if (u.stats) {
      for (const k of SAVE_STATS_KEYS) delete extra[k]
      Object.assign(extra, u.stats)
      snapshots.push({
        player_id: p.id,
        career_id: career.id,
        import_id: importRow.id,
        season,
        age: p.age,
        attributes: {},
        extra: u.stats,
      })
    }
    check(
      await supabase
        .from('players')
        .update({
          extra,
          left_foot: u.leftFoot ?? p.left_foot,
          right_foot: u.rightFoot ?? p.right_foot,
        })
        .eq('id', p.id),
    )
    updated++
  }
  if (snapshots.length) check(await supabase.from('player_snapshots').insert(snapshots))

  // Scouts: attributes (Authority included) and scouting knowledge
  const staff = await listStaff(career.id)
  const { learned } = mergeConfig(await loadStoredConfig())
  let scoutsAdded = 0
  let scoutsUpdated = 0
  for (const raw of saveScouts(data)) {
    const s = {
      ...raw,
      knowledge: raw.knowledge.map((k) => ({
        ...k,
        level: applyLearned(k.level, learned.knowledge),
      })),
    }
    const match =
      staff.find((x) => x.fm_uid === s.fm_uid) ??
      staff.find((x) => x.name.toLowerCase() === s.name.toLowerCase())
    if (match) {
      check(
        await supabase
          .from('staff')
          .update({
            fm_uid: s.fm_uid,
            role: s.role,
            age: s.age ?? match.age,
            personality: s.personality ?? match.personality,
            attributes: { ...match.attributes, ...s.attributes },
            knowledge: mergeKnowledge(s.knowledge, match.knowledge),
          })
          .eq('id', match.id),
      )
      scoutsUpdated++
    } else {
      check(
        await supabase.from('staff').insert({
          career_id: career.id,
          fm_uid: s.fm_uid,
          name: s.name,
          role: s.role,
          age: s.age,
          personality: s.personality,
          attributes: s.attributes,
          knowledge: s.knowledge,
        }),
      )
      scoutsAdded++
    }
  }
  return { updated, notInSquad: updates.length - updated, scoutsAdded, scoutsUpdated }
}

// --- Things the app could not work out (Check in game) ---

/**
 * Teaches the FM word for a value: remembered for future imports, and written now on
 * every squad player (morale) or scout (knowledge) of the career showing "Unknown (value)".
 */
export async function teachWord(
  careerId: string,
  kind: LearnedKind,
  value: number,
  word: string,
): Promise<void> {
  const config = mergeConfig(await loadStoredConfig())
  await saveConfig('learned', {
    ...config.learned,
    [kind]: { ...config.learned[kind], [String(value)]: word },
  })
  const unknown = withValue(UNKNOWN_WORD, value)
  const known = withValue(word, value)
  if (kind === 'morale') {
    for (const p of await listPlayers(careerId)) {
      if (p.extra.Morale !== unknown) continue
      check(
        await supabase
          .from('players')
          .update({ extra: { ...p.extra, Morale: known } })
          .eq('id', p.id),
      )
    }
  } else {
    for (const s of await listStaff(careerId)) {
      if (!s.knowledge.some((k) => k.level === unknown)) continue
      const knowledge = s.knowledge.map((k) => (k.level === unknown ? { ...k, level: known } : k))
      check(await supabase.from('staff').update({ knowledge }).eq('id', s.id))
    }
  }
}

/** Sets a player's personality by hand (kept by later imports that cannot work it out). */
export async function setPlayerPersonality(id: string, personality: string): Promise<void> {
  check(await supabase.from('players').update({ personality }).eq('id', id))
}
