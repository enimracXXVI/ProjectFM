import { supabase } from '../lib/supabase'
import { getCachedWorld, setCachedWorld, deleteCachedWorld } from '../world/cache'
import type { CompetitionsFile } from './types'

const BUCKET = 'world-data'

async function folder(careerId: string): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) throw new Error('Not signed in')
  return `${user.id}/${careerId}/competitions`
}

const cacheKey = (careerId: string, season: number) => `competitions:${careerId}:${season}`

async function gzip(data: unknown): Promise<Blob> {
  const json = new Blob([JSON.stringify(data)])
  return new Response(json.stream().pipeThrough(new CompressionStream('gzip'))).blob()
}

async function gunzip(blob: Blob): Promise<CompetitionsFile> {
  const text = await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text()
  return JSON.parse(text) as CompetitionsFile
}

/**
 * Saves a season's competitions, merged into the copy already stored: FM drops old match
 * reports and per-match player rows as the season goes on, so what an earlier import read is
 * kept (newer data wins where both have the same match).
 */
export async function uploadCompetitions(careerId: string, file: CompetitionsFile): Promise<void> {
  if (file.season == null) return
  const path = `${await folder(careerId)}/${file.season}.json.gz`
  const { data: old } = await supabase.storage.from(BUCKET).download(path)
  const merged = old ? mergeCompetitions(await gunzip(old).catch(() => null), file) : file
  const { error } = await supabase.storage.from(BUCKET).upload(path, await gzip(merged), {
    upsert: true,
    contentType: 'application/gzip',
    cacheControl: '0',
  })
  if (error) throw new Error(error.message)
}

/** Seasons saved for the career, newest first. */
export async function listSeasons(
  careerId: string,
): Promise<{ season: number; updatedAt: string }[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(await folder(careerId))
  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((f) => ({
      season: Number(f.name.split('.')[0]),
      updatedAt: f.updated_at ?? f.created_at ?? '',
    }))
    .filter((s) => Number.isFinite(s.season))
    .sort((a, b) => b.season - a.season)
}

/** One season, from this device when it is current (or offline), else downloaded. */
export async function loadSeason(
  careerId: string,
  season: number,
  updatedAt: string | null,
): Promise<CompetitionsFile> {
  const key = cacheKey(careerId, season)
  const cached = await getCachedWorld(key)
  if (cached && (updatedAt === null || cached.updatedAt === updatedAt)) return gunzip(cached.blob)
  const { data: blob, error } = await supabase.storage
    .from(BUCKET)
    .download(`${await folder(careerId)}/${season}.json.gz`)
  if (error || !blob) {
    if (cached) return gunzip(cached.blob)
    throw new Error(error?.message ?? 'Download failed')
  }
  await setCachedWorld(key, { updatedAt: updatedAt ?? '', blob })
  return gunzip(blob)
}

/** Removes every saved season of the career. */
export async function deleteCompetitions(careerId: string): Promise<void> {
  const seasons = await listSeasons(careerId).catch(() => [])
  if (!seasons.length) return
  const dir = await folder(careerId)
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove(seasons.map((s) => `${dir}/${s.season}.json.gz`))
  if (error) throw new Error(error.message)
  for (const s of seasons) await deleteCachedWorld(cacheKey(careerId, s.season))
}

const unionBy = <T>(older: T[] | undefined, newer: T[] | undefined, key: (x: T) => string) => {
  const out = new Map<string, T>()
  for (const x of older ?? []) out.set(key(x), x)
  for (const x of newer ?? []) out.set(key(x), x)
  return [...out.values()]
}

/** The newer file, plus whatever only the older one still holds. */
export function mergeCompetitions(
  older: CompetitionsFile | null,
  newer: CompetitionsFile,
): CompetitionsFile {
  if (!older || older.club !== newer.club) return newer
  const fixtureKey = (f: CompetitionsFile['competitions'][number]['fixtures'][number]) =>
    `${f.date}_${f.home}_${f.away}`
  const competitions = newer.competitions.map((c) => {
    const was = older.competitions.find((o) => o.id === c.id)
    if (!was) return c
    const oldFixtures = new Map(was.fixtures.map((f) => [fixtureKey(f), f]))
    return {
      ...c,
      fixtures: c.fixtures.map((f) => {
        const o = oldFixtures.get(fixtureKey(f))
        // Goal times and penalties read earlier stay when the save no longer has them
        return o && !f.events?.length && o.events?.length
          ? { ...f, events: o.events, pens: f.pens ?? o.pens }
          : f
      }),
    }
  })
  for (const o of older.competitions)
    if (!competitions.some((c) => c.id === o.id)) competitions.push(o)
  return {
    ...newer,
    competitions,
    playerMatches: unionBy(
      older.playerMatches,
      newer.playerMatches,
      (m) => `${m.comp}_${m.date}_${m.uniqueId ?? m.name}`,
    ),
    squads: unionBy(older.squads, newer.squads, (s) => `${s.date}_${s.home}_${s.away}`),
    injuries: unionBy(older.injuries, newer.injuries, (i) => `${i.uniqueId}_${i.date}_${i.cause}`),
  }
}
