/** FM attribute names grouped as shown in the game's player profile. */
export const ATTRIBUTE_GROUPS = {
  Technical: [
    'Corners',
    'Crossing',
    'Dribbling',
    'Finishing',
    'First Touch',
    'Free Kick Taking',
    'Heading',
    'Long Shots',
    'Long Throws',
    'Marking',
    'Passing',
    'Penalty Taking',
    'Tackling',
    'Technique',
  ],
  Mental: [
    'Aggression',
    'Anticipation',
    'Bravery',
    'Composure',
    'Concentration',
    'Decisions',
    'Determination',
    'Flair',
    'Leadership',
    'Off The Ball',
    'Positioning',
    'Team Work',
    'Vision',
    'Work Rate',
  ],
  Physical: [
    'Acceleration',
    'Agility',
    'Balance',
    'Jumping Reach',
    'Natural Fitness',
    'Pace',
    'Stamina',
    'Strength',
  ],
  Goalkeeping: [
    'Aerial Reach',
    'Command Of Area',
    'Communication',
    'Eccentricity',
    'Handling',
    'Kicking',
    'One On Ones',
    'Punching (Tendency)',
    'Reflexes',
    'Rushing Out (Tendency)',
    'Throwing',
  ],
} as const

export type AttributeGroup = keyof typeof ATTRIBUTE_GROUPS

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Normalised header -> canonical attribute name. Includes common FM header variants. */
const ATTRIBUTE_LOOKUP = new Map<string, string>()
for (const names of Object.values(ATTRIBUTE_GROUPS)) {
  for (const name of names) ATTRIBUTE_LOOKUP.set(norm(name), name)
}
for (const [alias, name] of [
  ['Teamwork', 'Team Work'],
  ['Punching', 'Punching (Tendency)'],
  ['Rushing Out', 'Rushing Out (Tendency)'],
  ['Free Kicks', 'Free Kick Taking'],
  ['Penalties', 'Penalty Taking'],
  ['Jumping', 'Jumping Reach'],
  ['One vs One', 'One On Ones'],
] as const) {
  ATTRIBUTE_LOOKUP.set(norm(alias), name)
}

/** Player profile fields stored in their own columns. */
export type CoreField =
  | 'fm_uid'
  | 'name'
  | 'positions'
  | 'squad_number'
  | 'age'
  | 'nation'
  | 'second_nation'
  | 'height_cm'
  | 'left_foot'
  | 'right_foot'
  | 'personality'

const CORE_LOOKUP = new Map<string, CoreField>([
  ['uniqueid', 'fm_uid'],
  ['uid', 'fm_uid'],
  ['player', 'name'],
  ['name', 'name'],
  ['position', 'positions'],
  ['no', 'squad_number'],
  ['number', 'squad_number'],
  ['squadnumber', 'squad_number'],
  ['age', 'age'],
  ['nation', 'nation'],
  ['nat', 'nation'],
  ['nationality', 'nation'],
  ['2ndnat', 'second_nation'],
  ['secondnationality', 'second_nation'],
  ['height', 'height_cm'],
  ['leftfoot', 'left_foot'],
  ['rightfoot', 'right_foot'],
  ['personality', 'personality'],
])

/** Short FM headers kept in `extra` under a readable key. */
const EXTRA_LOOKUP = new Map<string, string>([
  ['picked', 'selection'],
  ['inf', 'status'],
])

export type ColumnTarget =
  | { kind: 'core'; field: CoreField }
  | { kind: 'attribute'; name: string }
  | { kind: 'extra'; key: string }

/** Decides where an export column goes. Unknown columns are kept in `extra`. */
export function classifyHeader(header: string): ColumnTarget {
  const key = norm(header)
  const core = CORE_LOOKUP.get(key)
  if (core) return { kind: 'core', field: core }
  const attribute = ATTRIBUTE_LOOKUP.get(key)
  if (attribute) return { kind: 'attribute', name: attribute }
  return { kind: 'extra', key: EXTRA_LOOKUP.get(key) ?? header.trim() }
}

/** Status flags in FM's "Inf" column. */
export const STATUS_LABELS: Record<string, string> = {
  Inj: 'Injured',
  Wnt: 'Wanted',
  Lng: 'Loan listed',
  Trn: 'Transfer listed',
  PR: 'Player retired / retiring',
  nEU: 'Non-EU',
  Sus: 'Suspended',
  Unh: 'Unhappy',
  Int: 'On international duty',
  Ln: 'On loan',
  Yth: 'Youth',
}
