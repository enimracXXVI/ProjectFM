/**
 * Past seasons' squads. The Squad page only holds the current season; when a save from a new
 * season is imported, the squad as it stood is kept here, with the players who left during
 * that season. Stored as gzip JSON next to the competitions: <user>/<career>/squads/<year>.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Career, PlayerRow } from './db'

const BUCKET = 'world-data'

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export interface SeasonSquad {
  /** Year the season starts (2026 = 2026/27). */
  season: number
  /** The squad at the end of the season (null until the season is closed). */
  squad: PlayerRow[] | null
  /** Players who left during the season, as they were when they left. */
  left: PlayerRow[]
}

/** "2026/27" → 2026; null when the text has no year. */
export function seasonYear(label: string | null | undefined): number | null {
  const m = label?.match(/(\d{4})/)
  return m ? Number(m[1]) : null
}

export const seasonText = (year: number) => `${year}/${String((year + 1) % 100).padStart(2, '0')}`

async function folder(careerId: string): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) throw new Error('Not signed in')
  return `${user.id}/${careerId}/squads`
}

async function gzip(data: unknown): Promise<Blob> {
  const json = new Blob([JSON.stringify(data)])
  return new Response(json.stream().pipeThrough(new CompressionStream('gzip'))).blob()
}

/** Years with a stored squad, newest first. */
export async function listSquadSeasons(careerId: string): Promise<number[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(await folder(careerId))
  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((f) => Number(f.name.split('.')[0]))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)
}

export async function loadSquadSeason(careerId: string, season: number): Promise<SeasonSquad> {
  const { data: blob, error } = await supabase.storage
    .from(BUCKET)
    .download(`${await folder(careerId)}/${season}.json.gz`)
  if (error || !blob) return { season, squad: null, left: [] }
  const text = await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text()
  return JSON.parse(text) as SeasonSquad
}

async function saveSquadSeason(careerId: string, file: SeasonSquad): Promise<void> {
  const path = `${await folder(careerId)}/${file.season}.json.gz`
  const { error } = await supabase.storage.from(BUCKET).upload(path, await gzip(file), {
    upsert: true,
    contentType: 'application/gzip',
    cacheControl: '0',
  })
  if (error) throw new Error(error.message)
}

/**
 * Players who just left the club: kept in the current season's file (so past squads and the
 * Best XI still know them), and their development history is removed.
 */
export async function recordLeavers(careerId: string, players: PlayerRow[]): Promise<void> {
  if (!players.length) return
  const career = check(
    await supabase.from('careers').select('current_season').eq('id', careerId).single(),
  ) as Pick<Career, 'current_season'>
  const year = seasonYear(career.current_season)
  if (year !== null) {
    const file = await loadSquadSeason(careerId, year)
    const ids = new Set(players.map((p) => p.id))
    await saveSquadSeason(careerId, {
      ...file,
      left: [...file.left.filter((p) => !ids.has(p.id)), ...players],
    })
  }
  check(
    await supabase
      .from('player_snapshots')
      .delete()
      .in(
        'player_id',
        players.map((p) => p.id),
      ),
  )
}

/**
 * Called before importing a save: when the save is from a later season than the career's,
 * the current squad is kept as that season's final squad and the career moves on.
 * Returns the season label the import should use.
 */
export async function closeSeasonIfNew(
  career: Career,
  saveSeason: number | null,
  squad: PlayerRow[],
): Promise<string | null> {
  const current = seasonYear(career.current_season)
  if (saveSeason === null) return career.current_season
  if (current !== null && saveSeason > current) {
    const file = await loadSquadSeason(career.id, current)
    await saveSquadSeason(career.id, { ...file, squad: squad.filter((p) => p.in_squad) })
  }
  if (current === null || saveSeason > current) {
    const label = seasonText(saveSeason)
    check(await supabase.from('careers').update({ current_season: label }).eq('id', career.id))
    return label
  }
  return career.current_season
}

export function useSquadSeasons(careerId: string) {
  return useQuery({
    queryKey: ['squad-seasons', careerId],
    queryFn: () => listSquadSeasons(careerId),
  })
}

export function useSquadSeason(careerId: string, season: number | null) {
  return useQuery({
    queryKey: ['squad-season', careerId, season],
    queryFn: () => loadSquadSeason(careerId, season!),
    enabled: season !== null,
  })
}
