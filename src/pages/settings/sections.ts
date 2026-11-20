/**
 * Every settings page, grouped, with a one-line hint for the Settings list and a longer
 * explanation for the Settings guide (what the page is for and when to change it).
 */
export interface SettingsItem {
  to: string
  label: string
  hint: string
  about: string
}

export interface SettingsGroup {
  title: string
  intro: string
  items: SettingsItem[]
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    title: 'Import and help',
    intro: 'Getting your save into the app, and finding out how things work.',
    items: [
      {
        to: '/import',
        label: 'Import',
        hint: 'Your FM save (.fm)',
        about:
          'Upload your FM27 save. It updates your squad, staff, tactics, competitions, stats and the World database in one go. Do this whenever you want the app up to date.',
      },
      {
        to: '/check',
        label: 'Check in game',
        hint: 'What the app could not work out, for you to look up',
        about:
          'Things the save does not name (a trait number, a word for a value…). Look each one up in FM and type what FM shows; the app remembers it.',
      },
      {
        to: '/explain',
        label: 'How it works',
        hint: 'How each calculated value is worked out',
        about:
          'How role scores, personality, development and the other worked-out values are calculated.',
      },
      {
        to: '/settings/guide',
        label: 'Settings guide',
        hint: 'What every settings page is for',
        about: 'This guide.',
      },
      {
        to: '/settings/database',
        label: 'Database',
        hint: 'Every table and file, and what an import does',
        about:
          'Where the app keeps your data (Supabase tables and files) and what each import changes. Only needed when something looks wrong.',
      },
    ],
  },
  {
    title: 'App',
    intro: 'How the app looks and behaves. Safe to change any time.',
    items: [
      {
        to: '/settings/pictures',
        label: 'Pictures',
        hint: 'Faces, club crests and flags from sortitoutsi',
        about:
          'Turns player faces, club crests and nation flags on or off, and sets where they are loaded from (sortitoutsi, by FM Unique ID).',
      },
      {
        to: '/settings/bottom-bar',
        label: 'Phone bottom bar',
        hint: 'Which sections sit at the bottom on phones',
        about: 'Pick the sections you reach most often on a phone.',
      },
      {
        to: '/settings/note-categories',
        label: 'Note categories',
        hint: 'Categories for your notes, with colours',
        about: 'The categories you can give a note (Transfers, Training…) and their colours.',
      },
      {
        to: '/settings/colours',
        label: 'Colours',
        hint: 'Role highlight colours; every colour of the app, with HEX and RGB codes',
        about:
          'The colours marking a role’s key and preferred attributes (FM27’s green and blue by default, changeable), and a reference of every colour the app uses.',
      },
    ],
  },
  {
    title: 'Players',
    intro: 'How players are shown: attributes, hidden values, traits, contract and stats.',
    items: [
      {
        to: '/settings/attributes',
        label: 'Attributes',
        hint: 'Names, short names, descriptions and layout, hidden values included',
        about:
          'Two tabs. Names and descriptions: the name, three-letter short name and tooltip of every attribute and hidden value. Layout: which column and section each one sits in on the player page and squad table (the fourth column holds the hidden values).',
      },
      {
        to: '/settings/columns',
        label: 'Contract & Stats',
        hint: 'Columns, boxes, order, names and tooltips',
        about:
          'Which contract and stats figures are shown, their order, names and tooltips, and which box each stat sits in on the player page (General, Attacking…).',
      },
      {
        to: '/settings/traits',
        label: 'Player traits',
        hint: 'Names, what each trait does and what suits it',
        about:
          'Every trait by the number the save stores it under: its name, FM27’s description and what suits it. Traits named (?) are not confirmed yet.',
      },
      {
        to: '/settings/media-handling',
        label: 'Media handling',
        hint: 'Thresholds that give the media handling style from hidden values',
        about:
          'How the media handling style (Evasive, Reserved, Outspoken, Unflappable, Level-headed, Media-friendly) is worked out from the hidden values: the community Personality / Media Handling guide, adapted to FM27. It matches all 93 players checked in FM27; every threshold is editable.',
      },
      {
        to: '/settings/stat-profiles',
        label: 'Stat profiles',
        hint: 'The stats that matter for each role and position',
        about:
          'For each role and each position, the season stats that matter (xG, progressive passes, tackles won…). World ranks players by a profile: 0–100, the average of their percentiles against the players who play that position.',
      },
      {
        to: '/settings/statuses',
        label: 'Statuses',
        hint: 'Meaning, description and colours of FM status codes',
        about: 'The squad status codes (injured, unhappy, wants to leave…) and their colours.',
      },
      {
        to: '/settings/personality',
        label: 'Personality and feet',
        hint: 'Personality ranges and rules, foot strength words',
        about:
          'The ranges of hidden values that give each personality, the rules when two fit, and the words for foot strength (Weak … Very Strong) by value.',
      },
    ],
  },
  {
    title: 'Roles and tactics',
    intro: 'Role scores and the tactics editor.',
    items: [
      {
        to: '/settings/roles',
        label: 'Roles',
        hint: 'Roles, positions, attributes, FM codes and instructions',
        about:
          'Every FM27 role: the positions that can play it, its key and preferred attributes (which drive role scores), FM’s codes and instructions.',
      },
      {
        to: '/settings/role-weights',
        label: 'Role weights',
        hint: 'How key and preferred attributes count in role scores',
        about: 'How much key, preferred and other attributes count when scoring a role.',
      },
      {
        to: '/settings/older-roles',
        label: 'Older roles',
        hint: 'Roles from older FMs, hidden unless shown',
        about: 'Roles FM27 still knows from older FMs but no longer offers. Off by default.',
      },
      {
        to: '/settings/role-warnings',
        label: 'Role warnings',
        hint: "FM's warnings about role combinations",
        about: 'The warnings FM gives for role combinations (two playmakers…), with their limits.',
      },
      {
        to: '/settings/tactics',
        label: 'Tactics page',
        hint: 'What the tactic briefing flags; rating needed to play a position',
        about:
          'What the briefing on the Tactics page checks and warns about, and the FM position rating (default 15) a player needs to count as able to play a position when you pick players for a tactic.',
      },
      {
        to: '/settings/game-ideas',
        label: 'Game ideas',
        hint: 'How the tactic assistant thinks: Counter-attack, Possession, Catenaccio…',
        about:
          'Each way of playing the tactic assistant offers: what it needs from each line of the team, the roles that carry it out, the team instructions that go together, and player instructions it adds or never suggests. Change any of it, or add your own idea.',
      },
      {
        to: '/settings/tactic-rules',
        label: 'Tactic assistant rules',
        hint: 'Role pairings, instructions that clash, instructions from attributes',
        about:
          'Rules of thumb the assistant (and the Tactics page briefing) uses: roles that need a partner (a winger cutting inside needs a full-back who gives width…), team instructions that work against each other (direct passing at a low tempo…), and team and player instructions worked out from attributes. Switch off any you disagree with.',
      },
      {
        to: '/settings/tactical-styles',
        label: 'Tactical styles',
        hint: "FM's styles, their mentality and team instructions",
        about:
          'FM’s styles (Gegenpress, Tiki-Taka…): the mentality and team instructions each sets. Clean Slate is what a tactic has when no other style is picked.',
      },
      {
        to: '/settings/instructions',
        label: 'Team instructions',
        hint: 'Every instruction, its options and FM codes',
        about:
          'Every team instruction with its options, the codes FM stores in saves and tactic files, and complexity points.',
      },
      {
        to: '/settings/player-instructions',
        label: 'Player instructions',
        hint: 'Every player instruction, its options and codes',
        about: 'Every player instruction with its options and the codes FM stores.',
      },
    ],
  },
  {
    title: 'Training',
    intro: 'Training schedules and individual focuses.',
    items: [
      {
        to: '/settings/training-sessions',
        label: 'Training sessions',
        hint: "FM's sessions, codes, descriptions and colours",
        about:
          'Every training session with its FM code (needed to send schedules to FM), description and colour.',
      },
      {
        to: '/settings/training-focuses',
        label: 'Training focuses',
        hint: 'Individual focuses and the attributes they train',
        about: 'The individual training focuses and which attributes each works on.',
      },
    ],
  },
  {
    title: 'Staff and scouting',
    intro: 'Staff profiles, staff ratings and your scouting regions.',
    items: [
      {
        to: '/settings/staff-attributes',
        label: 'Staff attributes',
        hint: 'Staff profile tabs and Key Attributes for each job',
        about: 'How staff profiles are laid out and which attributes matter for each job.',
      },
      {
        to: '/settings/staff-ratings',
        label: 'Staff ratings',
        hint: 'Rating words and knowledge levels',
        about: 'The words FM uses for staff ratings and scouting knowledge, with their values.',
      },
      {
        to: '/settings/regions',
        label: 'Regions',
        hint: 'Scouting regions, countries and borders',
        about: 'Your scouting regions and which countries belong to each.',
      },
    ],
  },
  {
    title: 'FM game data',
    intro:
      'Numbers and words read from FM27’s own files. Only change these after a game update or for a new FM.',
    items: [
      {
        to: '/settings/fm-codes',
        label: 'FM codes',
        hint: 'Mentalities, positions and role numbers in saves and tactic files',
        about:
          'The numbers FM uses inside saves and tactic files. Needed to read your tactics and to write files FM can load.',
      },
      {
        to: '/settings/match-data',
        label: 'FM match data',
        hint: 'Match rating points by role, tactical training',
        about:
          'Two things from FM’s match engine data: how many rating points each event gives each role, and how tactical familiarity grows from training (the share each tactic gets, and the boost from coaches, players and time at the club). The Training page uses the second.',
      },
      {
        to: '/settings/names',
        label: 'FM names and words',
        hint: 'Morale words, competitions, cup rounds, staff jobs',
        about:
          'Words FM shows for values the save stores as numbers (morale, cup rounds, staff jobs) and your competitions’ names.',
      },
    ],
  },
]
