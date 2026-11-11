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

/** Saves a season's competitions (replacing the previous copy of that season). */
export async function uploadCompetitions(careerId: string, file: CompetitionsFile): Promise<void> {
  if (file.season == null) return
  const path = `${await folder(careerId)}/${file.season}.json.gz`
  const { error } = await supabase.storage.from(BUCKET).upload(path, await gzip(file), {
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
