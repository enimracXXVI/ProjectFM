/**
 * The database schema as the migrations build it (read from supabase/migrations at build
 * time, so the Settings page always matches the SQL the user ran), plus what each table is for.
 */
const files = import.meta.glob('../../supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface SchemaColumn {
  name: string
  type: string
  /** Table this column points to. */
  references: string | null
  notNull: boolean
  /** Migration that added it, e.g. "0007". */
  added: string
}

export interface SchemaTable {
  name: string
  columns: SchemaColumn[]
  /** Columns that must be unique together. */
  unique: string[][]
  added: string
}

const KEYWORDS = /\s+(not null|default|references|primary key|check|unique|generated)\b/i

function column(text: string, added: string): SchemaColumn | null {
  const m = text.trim().match(/^(\w+)\s+(.+?),?$/)
  if (!m || /^(unique|primary|check|constraint|foreign)$/i.test(m[1])) return null
  const rest = m[2]
  const type = rest.split(KEYWORDS)[0].trim()
  const ref = rest.match(/references\s+(?:public\.)?(\w+(?:\.\w+)?)/i)
  return {
    name: m[1],
    type,
    references: ref ? ref[1] : null,
    notNull: /not null|primary key/i.test(rest),
    added,
  }
}

/** Every table, in the order the migrations create them. */
export function readSchema(): SchemaTable[] {
  const tables = new Map<string, SchemaTable>()
  for (const path of Object.keys(files).sort()) {
    const added = path.match(/(\d{4})_[^/]*\.sql$/)?.[1] ?? '?'
    // Comments out first, so their words are never read as SQL
    const sql = files[path].replace(/--[^\n]*/g, '')
    for (const m of sql.matchAll(
      /create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/gi,
    )) {
      const t: SchemaTable = { name: m[1], columns: [], unique: [], added }
      for (const line of m[2].split('\n')) {
        const u = line.trim().match(/^unique\s*\(([^)]+)\)/i)
        if (u) t.unique.push(u[1].split(',').map((x) => x.trim()))
        const c = column(line, added)
        if (c) t.columns.push(c)
      }
      tables.set(t.name, t)
    }
    for (const m of sql.matchAll(/alter table (?:only )?public\.(\w+)\s+(add column[\s\S]*?);/gi)) {
      const t = tables.get(m[1])
      if (!t) continue
      for (const part of m[2].split(/,\s*\n?\s*add column/i)) {
        const c = column(
          part
            .trim()
            .replace(/^add column\s+/i, '')
            .replace(/^if not exists\s+/i, ''),
          added,
        )
        if (c && !t.columns.some((x) => x.name === c.name)) t.columns.push(c)
      }
    }
  }
  return [...tables.values()]
}

/** What each table holds, in plain words. */
export const TABLE_NOTES: Record<string, string> = {
  careers:
    'One row per FM career: club, seasons, crest and kits, and the scouting network (who heads which region).',
  players:
    'One row per player per career, matched on FM Unique ID (fm_uid): his latest state. Each import updates this row; it is never duplicated. Contract and season stats sit in extra. in_squad is false once he has left.',
  player_snapshots:
    "History: a copy of a player's attributes, age and positions, stored only when an import finds one of them changed. The Development page compares these copies. A player's copies are deleted when he leaves the club.",
  staff: 'Everyone on the staff screen of the latest save, replaced on each import.',
  imports: 'The import log: one row per save imported (file, season, number of players).',
  app_settings:
    'Your Settings, one row per section (key), shared by all your careers: words, layouts, roles, instructions…',
  tactics:
    'Tactics read from the save (save_index) or made in the app, with roles and preferred XI.',
  match_log: 'Your notes on a match: tactic used and the opponent’s shape and style.',
  notes: 'Your Dashboard notes, one set per career: text, category, pinned, done.',
  scout_targets: 'Not used by the app (left from an early version).',
  import_mappings: 'Not used by the app any more (was for HTML exports).',
}

/** Notes on single columns, by "table.column". */
export const COLUMN_NOTES: Record<string, string> = {
  'players.fm_uid': 'FM Unique ID: how an import finds the same player again',
  'players.attributes': 'Latest attributes, e.g. { "Pace": 15 }',
  'players.extra': 'Everything else from FM: contract, season stats, morale, hidden values, team',
  'players.in_squad': 'false = left the club (kept for past seasons and Best XI)',
  'player_snapshots.player_id': 'The player this copy belongs to',
  'player_snapshots.import_id': 'The import that made this copy',
  'player_snapshots.game_date': 'Not used',
  'player_snapshots.stats': 'Not used',
  'player_snapshots.extra': 'Positions at the time (older copies also hold stats)',
  'staff.fm_uid': 'FM Unique ID',
  'staff.knowledge': 'Scouting knowledge per nation',
  'careers.scouting': 'Region heads, scouts and their countries, board limits',
  'app_settings.key': 'Settings section, e.g. roles, staffShort, teamInstructions',
}

/** Files kept next to the tables (Supabase Storage). */
export const STORAGE_FILES: [string, string][] = [
  [
    'world-data / <you> / <career> / world.json.gz',
    'World: every player in the save, for World search',
  ],
  [
    'world-data / <you> / <career> / competitions / <year>.json.gz',
    'One season of competitions: fixtures, results, goals, match reports and player match stats. Each import merges into it.',
  ],
  [
    'world-data / <you> / <career> / squads / <year>.json.gz',
    'One season’s squad as it ended, plus the players who left during it',
  ],
  ['career-images / <you> / …', 'Crest and kit pictures'],
]
