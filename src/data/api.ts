import type { DevSnapshot } from '../lib/development'
import type { Team } from './teams'
import { supabase } from '../lib/supabase'
import { jobTitle, STAFF_ATTRS } from './staffJobs'
import { personalityName } from '../lib/personality'
import { scaleWord } from './staffInfo'
import { byLastName } from '../lib/names'
import { relabel, type LearnedKind } from '../lib/learned'
import { UNKNOWN_WORD, withValue } from '../lib/valueWord'
import { loadStoredConfig, mergeConfig, saveConfig } from './config'
import { closeSeasonIfNew, recordLeavers } from './seasons'
import { applyImportWords, DUMP_PRESENT, type DumpSummary } from '../import/dump'
import type { CoreField } from '../import/fields'
import type { ImportColumns, ImportedPlayer } from '../import/types'
import {
  SAVE_CONTRACT_KEYS,
  SAVE_STATS_KEYS,
  fmNation,
  mergeKnowledge,
  saveScouts,
  saveUpdates,
  type SaveData,
} from '../import/save'
import type { Career, ImportRow, PlayerRow, ScoutingNetwork, SnapshotRow, StaffRow } from './db'
import type { MatchLogRow, SaveTactics, TacticRow, TacticSlot } from '../tactics/types'
import { fromSave } from '../tactics/fm'

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
  const rows = check(
    await supabase.from('players').select('*').eq('career_id', careerId),
  ) as PlayerRow[]
  // Every list starts sorted by last name (or nickname)
  return rows.sort(byLastName)
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

/**
 * Older save imports were logged twice (a squad line named "FM save", then the contracts and
 * stats line with the file name, seconds apart). This folds each pair into the second line:
 * each player's two development copies become one, and the extra line goes.
 */
export async function mergeImportPairs(careerId: string): Promise<number> {
  const rows = (
    check(
      await supabase
        .from('imports')
        .select('*')
        .eq('career_id', careerId)
        .eq('view_type', 'FM save')
        .order('created_at'),
    ) as ImportRow[]
  ).map((r) => ({ ...r, t: Date.parse(r.created_at) }))
  let merged = 0
  for (let i = 0; i < rows.length - 1; i++) {
    const squad = rows[i]
    const rest = rows[i + 1]
    if (squad.file_name !== 'FM save' || rest.file_name === 'FM save') continue
    if (rest.t - squad.t > 120_000) continue
    const snaps = check(
      await supabase
        .from('player_snapshots')
        .select('id, player_id, import_id, extra')
        .in('import_id', [squad.id, rest.id]),
    ) as { id: string; player_id: string; import_id: string; extra: Record<string, string> }[]
    const statsOf = new Map(
      snaps.filter((x) => x.import_id === rest.id).map((x) => [x.player_id, x]),
    )
    // The squad copy keeps the attributes and takes the stats; the stats-only copy goes
    for (const x of snaps.filter((y) => y.import_id === squad.id)) {
      const stats = statsOf.get(x.player_id)
      check(
        await supabase
          .from('player_snapshots')
          .update({ import_id: rest.id, extra: { ...x.extra, ...stats?.extra } })
          .eq('id', x.id),
      )
    }
    const statsOnly = snaps.filter((x) => x.import_id === rest.id).map((x) => x.id)
    if (statsOnly.length)
      check(await supabase.from('player_snapshots').delete().in('id', statsOnly))
    check(await supabase.from('imports').update({ row_count: squad.row_count }).eq('id', rest.id))
    check(await supabase.from('imports').delete().eq('id', squad.id))
    merged++
    i++
  }
  return merged
}

/** Which copies the clean-up deletes, and which keep only their positions (see below). */
export function planTidy(
  all: {
    id: string
    player_id: string
    age: number | null
    attributes: Record<string, unknown>
    extra: Record<string, string> | null
  }[],
) {
  type Copy = (typeof all)[number]
  const byPlayer = new Map<string, Copy[]>()
  for (const c of all) byPlayer.set(c.player_id, [...(byPlayer.get(c.player_id) ?? []), c])
  const drop: string[] = []
  const slim: { id: string; extra: Record<string, string> }[] = []
  for (const copies of byPlayer.values()) {
    let kept: Copy | null = null
    for (const c of copies) {
      // Copies with no attributes held only stats: nothing for Development
      const empty = !Object.keys(c.attributes ?? {}).length
      const same =
        kept &&
        kept.age === c.age &&
        (kept.extra?.positions ?? null) === (c.extra?.positions ?? null) &&
        stableJson(kept.attributes) === stableJson(c.attributes)
      if (empty || same) {
        drop.push(c.id)
        continue
      }
      kept = c
      const extra: Record<string, string> = c.extra?.positions
        ? { positions: c.extra.positions }
        : {}
      if (Object.keys(c.extra ?? {}).length !== Object.keys(extra).length)
        slim.push({ id: c.id, extra })
    }
  }
  return { drop, slim }
}

/**
 * One-time clean-up of development copies made before copies were kept only on change:
 * a copy identical to the player's previous one (attributes, age, positions) is deleted,
 * and season stats are taken out of the copies that stay. Returns the copies removed.
 */
export async function tidyDevelopmentCopies(careerId: string): Promise<number> {
  type Copy = {
    id: string
    player_id: string
    age: number | null
    attributes: Record<string, unknown>
    extra: Record<string, string> | null
    created_at: string
  }
  const all: Copy[] = []
  for (let from = 0; ; from += 1000) {
    const rows = check(
      await supabase
        .from('player_snapshots')
        .select('id, player_id, age, attributes, extra, created_at')
        .eq('career_id', careerId)
        .order('created_at')
        .range(from, from + 999),
    ) as Copy[]
    all.push(...rows)
    if (rows.length < 1000) break
  }
  const { drop, slim } = planTidy(all)
  for (let i = 0; i < drop.length; i += 200)
    check(
      await supabase
        .from('player_snapshots')
        .delete()
        .in('id', drop.slice(i, i + 200)),
    )
  for (const x of slim)
    check(await supabase.from('player_snapshots').update({ extra: x.extra }).eq('id', x.id))
  return drop.length
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

const stableJson = (o: Record<string, unknown>) =>
  JSON.stringify(
    Object.keys(o ?? {})
      .sort()
      .map((k) => [k, o[k]]),
  )

/** Each player's most recent development copy (read newest first, page by page). */
async function lastCopies(careerId: string, wanted: Set<string>) {
  type Copy = {
    player_id: string
    age: number | null
    attributes: Record<string, unknown>
    extra: Record<string, string> | null
  }
  const last = new Map<string, Copy>()
  const page = 1000
  for (let from = 0; last.size < wanted.size; from += page) {
    const rows = check(
      await supabase
        .from('player_snapshots')
        .select('player_id, age, attributes, extra, created_at')
        .eq('career_id', careerId)
        .order('created_at', { ascending: false })
        .range(from, from + page - 1),
    ) as Copy[]
    for (const r of rows) if (!last.has(r.player_id)) last.set(r.player_id, r)
    if (rows.length < page) break
  }
  return last
}

/**
 * Saves parsed players into a career.
 * Matches on FM Unique ID (falls back to name), merges with stored data, records a
 * snapshot per player for development history, and for full-squad imports marks
 * players missing from the file as gone.
 */
async function importPlayers(opts: {
  careerId: string
  season: string | null
  importId: string
  players: ImportedPlayer[]
  columns: ImportColumns
  markMissingAsLeft: boolean
}): Promise<ImportSummary> {
  const { careerId, season, importId, players, columns, markMissingAsLeft } = opts

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
  // Development copies: attributes, age and positions only, and only when one of them changed
  // since the player's last copy (FM moves attributes slowly; most imports change nothing)
  const last = await lastCopies(careerId, new Set(saved.map((x) => x.id)))
  const snapshots = players
    .map((p) => ({
      player_id: savedId(p),
      career_id: careerId,
      import_id: importId,
      season,
      age: p.age,
      attributes: p.attributes,
      extra: p.positions ? { positions: p.positions } : {},
    }))
    .filter((x) => {
      if (!x.player_id) return false
      const before = last.get(x.player_id)
      return (
        !before ||
        before.age !== x.age ||
        (before.extra?.positions ?? null) !== (x.extra.positions ?? null) ||
        stableJson(before.attributes) !== stableJson(x.attributes)
      )
    })
  if (snapshots.length) check(await supabase.from('player_snapshots').insert(snapshots))

  let left = 0
  if (markMissingAsLeft) {
    const keep = new Set(saved.map((s) => s.id))
    const gone = existing.filter((p) => p.in_squad && !keep.has(p.id)).map((p) => p.id)
    if (gone.length) {
      const rows = check(
        await supabase.from('players').update({ in_squad: false }).in('id', gone).select('*'),
      ) as PlayerRow[]
      await recordLeavers(careerId, rows)
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
  const rows = check(
    await supabase.from('staff').select('*').eq('career_id', careerId),
  ) as StaffRow[]
  return rows.sort(byLastName)
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

// --- FM save import ---

export interface DumpImportResult {
  players: ImportSummary
  scoutsAdded: number
  scoutsUpdated: number
}

/** What one FM save import changed. */
export interface FmImportResult {
  season: string | null
  players: ImportSummary
  staffAdded: number
  staffUpdated: number
  staffRemoved: number
  staffNeedsUpdate: boolean
}

/**
 * Imports an FM save into a career in one go. The save is the truth: every player at the club
 * (all teams) is added or updated (attributes, profile, contract, season stats, feet, number,
 * team) with one development copy each, players no longer at the club leave the squad, and the
 * staff list becomes the save's. A save from a new season first closes the old one.
 */
export async function importFmSave(opts: {
  career: Career
  data: SaveData
  summary: DumpSummary
  fileName: string
}): Promise<FmImportResult> {
  const { career, data, summary, fileName } = opts
  const config = mergeConfig(await loadStoredConfig())
  const season = await closeSeasonIfNew(
    career,
    data.competitions?.season ?? null,
    await listPlayers(career.id),
  )
  const importRow = check(
    await supabase
      .from('imports')
      .insert({
        career_id: career.id,
        view_type: 'FM save',
        file_name: fileName,
        season,
        row_count: summary.players.length,
      })
      .select('id')
      .single(),
  ) as { id: string }

  // Contract, season stats (all competitive matches) and feet, by Unique ID
  const fromSave = new Map(saveUpdates(data, 'overall', config).map((u) => [u.uniqueId, u]))
  const chosen = summary.players.map(({ player, team, squadNo }) => {
    let p = team && team !== 'first' ? { ...player, extra: { ...player.extra, team } } : player
    if (p.extra.Morale)
      p = { ...p, extra: { ...p.extra, Morale: relabel(p.extra.Morale, config.learned.morale) } }
    p = applyImportWords(p, config)
    const u = p.fm_uid != null ? fromSave.get(p.fm_uid) : undefined
    return {
      ...p,
      squad_number: squadNo,
      left_foot: u?.leftFoot ?? p.left_foot,
      right_foot: u?.rightFoot ?? p.right_foot,
      extra: { ...p.extra, ...u?.contract, ...u?.stats },
    }
  })

  // Every field the save provides replaces what was stored (a blank clears it)
  const attributeNames = new Set(chosen.flatMap((p) => Object.keys(p.attributes)))
  const columns: ImportColumns = [
    ...[...DUMP_PRESENT.core, 'squad_number', 'left_foot', 'right_foot'].map((field) => ({
      header: field,
      target: { kind: 'core' as const, field: field as CoreField },
    })),
    ...[...attributeNames].map((name) => ({
      header: name,
      target: { kind: 'attribute' as const, name },
    })),
    ...[...DUMP_PRESENT.extra, 'team', ...SAVE_CONTRACT_KEYS, ...SAVE_STATS_KEYS].map((key) => ({
      header: key,
      target: { kind: 'extra' as const, key },
    })),
  ]
  const players = await importPlayers({
    careerId: career.id,
    season,
    importId: importRow.id,
    players: chosen,
    columns,
    markMissingAsLeft: true,
  })

  // Staff: everyone on FM's staff screen (needs migration 0007), else the scouts only
  let staff: { added: number; updated: number; removed?: number; needsUpdate: boolean }
  try {
    staff = { ...(await importAllStaff(career, data)), needsUpdate: false }
  } catch (e) {
    if (!isMissingColumn(e)) throw e
    staff = { ...(await importScoutsOnly(career, data)), needsUpdate: true }
  }
  return {
    season,
    players,
    staffAdded: staff.added,
    staffUpdated: staff.updated,
    staffRemoved: staff.removed ?? 0,
    staffNeedsUpdate: staff.needsUpdate,
  }
}

/** Moves a player between first team, U20 and U18 (kept in extra, untouched by imports). */
export async function setPlayerTeam(player: PlayerRow, team: Team): Promise<void> {
  const extra = { ...player.extra }
  if (team === 'first') delete extra.team
  else extra.team = team
  check(await supabase.from('players').update({ extra }).eq('id', player.id))
}

/** True when the staff table has no team / job_code / extra columns yet (migration 0007). */
export const isMissingColumn = (e: unknown) =>
  e instanceof Error && /column|schema cache/i.test(e.message)

async function importScoutsOnly(career: Career, data: SaveData) {
  const staff = await listStaff(career.id)
  const { learned, personalityRules } = mergeConfig(await loadStoredConfig())
  let scoutsAdded = 0
  let scoutsUpdated = 0
  for (const raw of saveScouts(data, personalityRules)) {
    const s = {
      ...raw,
      knowledge: raw.knowledge.map((k) => ({
        ...k,
        level: relabel(k.level, learned.knowledge),
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
  return { added: scoutsAdded, updated: scoutsUpdated }
}

/** Every member of staff from the save: job, team, attributes, personality, names. */
async function importAllStaff(career: Career, data: SaveData) {
  const staff = await listStaff(career.id)
  const { learned, staffScale, staffScaleMin, personalityRules } = mergeConfig(
    await loadStoredConfig(),
  )
  const scouts = new Map(saveScouts(data, personalityRules).map((s) => [s.fm_uid, s]))
  let added = 0
  let updated = 0
  const kept = new Set<string>()
  for (const raw of data.staff ?? []) {
    const title = jobTitle(raw.job, learned.jobs)
    const scout = scouts.get(raw.uniqueId)
    const attributes: Record<string, string> = {}
    for (const [key, label, scale] of STAFF_ATTRS) {
      const v = raw.attributes?.[key]
      if (typeof v === 'number' && v > 0) {
        const n = Math.floor(v / scale)
        attributes[label] = withValue(scaleWord(n, staffScale, staffScaleMin), n)
      }
    }
    const knowledge = (scout?.knowledge ?? []).map((k) => ({
      ...k,
      level: relabel(k.level, learned.knowledge),
    }))
    const extra: Record<string, string> = {}
    if (raw.lastName) extra['Last name'] = raw.lastName
    if (raw.commonName) extra['Common name'] = raw.commonName
    if (raw.contractEnd) extra['Contract expires'] = raw.contractEnd
    const row = {
      fm_uid: raw.uniqueId,
      name: raw.name,
      role: title ?? `Job ${raw.job}`,
      job_code: raw.job,
      team: (['first', 'u21', 'u18'] as const)[raw.team] ?? 'first',
      age: raw.age,
      nation: raw.nation != null ? fmNation(raw.nation) : null,
      personality: raw.personality
        ? personalityName(
            {
              ...raw.personality,
              determination:
                typeof raw.attributes?.determination === 'number'
                  ? Math.floor(raw.attributes.determination / 5)
                  : undefined,
            },
            personalityRules,
          )
        : null,
      attributes,
      extra,
    }
    const match =
      staff.find((x) => x.fm_uid === raw.uniqueId) ??
      staff.find((x) => x.name.toLowerCase() === raw.name.toLowerCase())
    if (match) {
      check(
        await supabase
          .from('staff')
          .update({
            ...row,
            personality: row.personality ?? match.personality,
            attributes: { ...match.attributes, ...attributes },
            extra: { ...match.extra, ...extra },
            ...(scout ? { knowledge: mergeKnowledge(knowledge, match.knowledge) } : {}),
          })
          .eq('id', match.id),
      )
      kept.add(match.id)
      updated++
    } else {
      const created = check(
        await supabase
          .from('staff')
          .insert({ ...row, career_id: career.id, knowledge })
          .select('id')
          .single(),
      ) as { id: string }
      kept.add(created.id)
      added++
    }
  }
  // The staff list is the save's: anyone no longer at the club (sacked, left, retired) goes,
  // and leaves the scouting network with them
  const removed = staff.filter((x) => !kept.has(x.id)).map((x) => x.id)
  if (removed.length && (data.staff ?? []).length) {
    const gone = new Set(removed)
    // Read fresh: the network may have changed since the page loaded
    const fresh = check(
      await supabase.from('careers').select('scouting').eq('id', career.id).single(),
    ) as { scouting: Career['scouting'] }
    const net = fresh.scouting ?? {}
    await saveScouting(career.id, {
      ...net,
      heads: Object.fromEntries(Object.entries(net.heads ?? {}).filter(([, id]) => !gone.has(id))),
      scouts: Object.fromEntries(Object.entries(net.scouts ?? {}).filter(([id]) => !gone.has(id))),
    })
    check(await supabase.from('staff').delete().in('id', removed))
  }
  return { added, updated, removed: removed.length }
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

// --- Tactics and match log (migration 0006) ---

/** True when the tactics / match log tables are not in Supabase yet. */
export const isMissingTable = (e: unknown) =>
  e instanceof Error && /(relation|table).*(does not exist|not find|schema cache)/i.test(e.message)

export async function listTactics(careerId: string): Promise<TacticRow[]> {
  return check(
    await supabase.from('tactics').select('*').eq('career_id', careerId).order('created_at'),
  )
}

export async function saveTactic(
  careerId: string,
  id: string | null,
  input: Partial<Omit<TacticRow, 'id' | 'career_id' | 'created_at' | 'updated_at'>>,
): Promise<TacticRow> {
  const q = id
    ? supabase.from('tactics').update(input).eq('id', id)
    : supabase.from('tactics').insert({ ...input, career_id: careerId })
  return check(await q.select('*').single()) as TacticRow
}

export async function deleteTactic(id: string): Promise<void> {
  check(await supabase.from('tactics').delete().eq('id', id))
}

/**
 * Tactics from the save: new ones are added with the save's current XI as preferred XI;
 * existing ones are updated from the save (shape, roles, instructions), keeping the
 * preferred XI and notes. Codes are read with Settings > Roles, Instructions and FM codes.
 */
export async function importSaveTactics(careerId: string, data: SaveTactics): Promise<number> {
  const existing = await listTactics(careerId)
  const players = await listPlayers(careerId)
  const config = mergeConfig(await loadStoredConfig())
  const byUid = new Map(players.map((p) => [p.fm_uid, p.id]))
  const starters = data.selection.filter((s) => !s.substitute)
  for (const t of data.tactics) {
    const old = existing.find((x) => x.save_index === t.index)
    const read = fromSave(t, config.roles, config.fmCodes)
    const slots: TacticSlot[] = read.slots.map((s, i) => ({
      ...s,
      // A role the save names wins; otherwise the user's earlier choice stays
      role: s.role ?? old?.slots[i]?.role ?? null,
      roleOop: s.roleOop ?? old?.slots[i]?.roleOop ?? null,
      player:
        old?.slots[i]?.player ??
        byUid.get(starters.find((x) => x.slot === t.slots[i].number)?.uniqueId ?? -1) ??
        null,
    }))
    await saveTactic(careerId, old?.id ?? null, {
      name: t.name,
      style: t.style,
      mentality: read.mentality,
      slots,
      instructions: read.team ? { team: read.team } : (old?.instructions ?? {}),
      save_index: t.index,
    })
  }
  return data.tactics.length
}

export async function getMatchLog(careerId: string, key: string): Promise<MatchLogRow | null> {
  return check(
    await supabase
      .from('match_log')
      .select('*')
      .eq('career_id', careerId)
      .eq('match_key', key)
      .maybeSingle(),
  ) as MatchLogRow | null
}

export async function listMatchLog(careerId: string): Promise<MatchLogRow[]> {
  return check(await supabase.from('match_log').select('*').eq('career_id', careerId))
}

export async function saveMatchLog(
  careerId: string,
  input: Omit<MatchLogRow, 'id' | 'career_id'>,
): Promise<void> {
  check(
    await supabase
      .from('match_log')
      .upsert({ ...input, career_id: careerId }, { onConflict: 'career_id,match_key' }),
  )
}

/**
 * Names a role number the save stores (Check in game): the number goes on that role in
 * Settings > Roles, and tactics that had it get the role straight away.
 */
export async function teachRole(
  careerId: string,
  stored: string,
  phase: 'ip' | 'oop',
  roleId: string,
): Promise<void> {
  const config = mergeConfig(await loadStoredConfig())
  const code = (BigInt(stored) & BigInt(config.fmCodes.roleCodeMask)).toString()
  await saveConfig(
    'roles',
    config.roles.map((r) => (r.id === roleId ? { ...r, fm: { ...r.fm, code } } : r)),
  )
  for (const t of await listTactics(careerId)) {
    let changed = false
    const slots = t.slots.map((s) => {
      if (phase === 'ip' && s.unknownRole === stored) {
        changed = true
        return { ...s, role: roleId, unknownRole: null }
      }
      if (phase === 'oop' && s.unknownRoleOop === stored) {
        changed = true
        return { ...s, roleOop: roleId, unknownRoleOop: null }
      }
      return s
    })
    if (changed) await saveTactic(careerId, t.id, { slots })
  }
}

/** Names an FM job code (Check in game): remembered, and written on every staff with it. */
export async function teachJob(careerId: string, code: number, title: string): Promise<void> {
  const config = mergeConfig(await loadStoredConfig())
  await saveConfig('learned', {
    ...config.learned,
    jobs: { ...config.learned.jobs, [String(code)]: title },
  })
  check(
    await supabase
      .from('staff')
      .update({ role: title })
      .eq('career_id', careerId)
      .eq('job_code', code),
  )
}
