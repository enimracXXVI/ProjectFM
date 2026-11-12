/**
 * FM27 staff jobs by the save's job code, in the user's categories (Managerial & Coaching,
 * Scouting, Medical, Other). Codes named by fmsave are used as they are; 26 (Fitness Coach),
 * 46 (Doctor) and 58 (Recruitment Analyst) were worked out from the user's FM staff screen,
 * where only that reading gives FM's numbers for every job. Other codes are named by the
 * user under Check in game.
 */
export type StaffGroup = 'coaching' | 'scouting' | 'medical' | 'other'

/** The staff categories, as the user named them. Which job sits in which is editable. */
export const STAFF_GROUPS: [StaffGroup, string][] = [
  ['coaching', 'Managerial & Coaching Staff'],
  ['scouting', 'Scouting Staff'],
  ['medical', 'Medical Staff'],
  ['other', 'Other Staff'],
]

/** Every FM27 job on the staff screen, in FM's order, with its group. */
export const JOB_TITLES: [string, StaffGroup][] = [
  ['Manager', 'coaching'],
  ['Head of Youth Development', 'coaching'],
  ['Assistant Manager', 'coaching'],
  ['Coach', 'coaching'],
  ['Goalkeeping Coach', 'coaching'],
  ['Fitness Coach', 'coaching'],
  ['Set Piece Coach', 'coaching'],
  ['Head Performance Analyst', 'other'],
  ['Performance Analyst', 'other'],
  ['Director of Football', 'scouting'],
  ['Chief Scout', 'scouting'],
  ['Technical Director', 'scouting'],
  ['Scout', 'scouting'],
  ['Recruitment Analyst', 'scouting'],
  ['Loan Manager', 'scouting'],
  ['Head Physio', 'medical'],
  ['Chief Doctor', 'medical'],
  ['Head of Sports Science', 'medical'],
  ['Physio', 'medical'],
  ['Doctor', 'medical'],
  ['Sports Scientist', 'medical'],
]

export const JOB_BY_CODE: Record<number, string> = {
  16: 'Manager',
  64: 'Head of Youth Development',
  20: 'Assistant Manager',
  2: 'Coach',
  34: 'Goalkeeping Coach',
  26: 'Fitness Coach',
  60: 'Performance Analyst',
  10: 'Director of Football',
  44: 'Chief Scout',
  88: 'Technical Director',
  14: 'Scout',
  58: 'Recruitment Analyst',
  50: 'Head Physio',
  38: 'Chief Doctor',
  40: 'Head of Sports Science',
  12: 'Physio',
  46: 'Doctor',
  48: 'Sports Scientist',
}

/** Job title for a code: the user's naming first, then the known ones; null when unknown. */
export const jobTitle = (code: number | null, learned?: Record<string, string>) =>
  code === null ? null : (learned?.[String(code)] ?? JOB_BY_CODE[code] ?? null)

/** Default category of each job (Settings → Staff attributes can move any job). */
export const DEFAULT_JOB_GROUPS: Record<string, StaffGroup> = Object.fromEntries(JOB_TITLES)

/** Category of a job: the user's choice, else the default; unknown jobs go to Other. */
export const groupOf = (title: string | null, groups?: Record<string, StaffGroup>): StaffGroup =>
  (title && (groups?.[title] ?? DEFAULT_JOB_GROUPS[title])) || 'other'

/** Order of jobs within a group (FM's order). */
export const jobOrder = (title: string | null) => {
  const i = JOB_TITLES.findIndex(([t]) => t === title)
  return i < 0 ? 99 : i
}

/**
 * Staff attributes from the save, by the save's names. Most are stored ×5 (17 shows as 85);
 * Adaptability, Authority and Working With Youngsters are stored 1–20 as shown.
 */
export const STAFF_ATTRS: [key: string, label: string, scale: number][] = [
  ['attacking', 'Attacking', 5],
  ['defending', 'Defending', 5],
  ['fitness', 'Fitness', 5],
  ['goalkeeping', 'Goalkeeping', 5],
  ['possession', 'Possession', 5],
  ['tactical', 'Tactical', 5],
  ['technical', 'Technical', 5],
  ['set_pieces', 'Set Pieces', 5],
  ['working_with_youngsters', 'Working With Youngsters', 1],
  ['analysing_data', 'Analysing Data', 5],
  ['judging_player_ability', 'Judging Player Ability', 5],
  ['judging_player_potential', 'Judging Player Potential', 5],
  ['judging_staff_ability', 'Judging Staff Ability', 5],
  ['negotiating', 'Negotiating', 5],
  ['tactical_knowledge', 'Tactical Knowledge', 5],
  ['physiotherapy', 'Physiotherapy', 5],
  ['sports_science', 'Sports Science', 5],
  ['adaptability', 'Adaptability', 1],
  ['authority', 'Authority', 1],
  ['determination', 'Determination', 5],
  ['motivating', 'Motivating', 5],
  ['people_management', 'People Management', 5],
]

/** Columns shown for each group on the Staff page. */
export const GROUP_COLUMNS: Record<StaffGroup, string[]> = {
  coaching: [
    'Attacking',
    'Defending',
    'Fitness',
    'Goalkeeping',
    'Possession',
    'Tactical',
    'Technical',
    'Set Pieces',
    'Working With Youngsters',
    'Motivating',
  ],
  scouting: [
    'Judging Player Ability',
    'Judging Player Potential',
    'Analysing Data',
    'Judging Staff Ability',
    'Negotiating',
    'Adaptability',
    'Authority',
  ],
  medical: ['Physiotherapy', 'Sports Science', 'Motivating', 'People Management', 'Determination'],
  other: [
    'Analysing Data',
    'Tactical Knowledge',
    'Judging Player Ability',
    'Judging Player Potential',
  ],
}
