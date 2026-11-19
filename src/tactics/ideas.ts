/**
 * Game ideas: how a manager thinks about a tactic. An idea says what it needs from each line
 * of the team, which roles carry it out, and the team instructions that go together. Rules of
 * thumb (general football knowledge, not FM27 data), all editable in Settings > Tactic
 * assistant. On top of the ideas:
 * - role pairings: roles that need a partner (a winger cutting inside needs a full-back who
 *   gives width…), checked on every tactic the assistant builds;
 * - instruction conflicts: team instructions that work against each other (direct passing at
 *   a low tempo…), checked by the assistant and the Tactics page briefing.
 */
import type { PlayerRow } from '../data/db'
import { attrNumber } from '../lib/attributes'
import { playsPosition } from './analysis'
import { choose, chosen, type FmInstruction } from './fm'
import type { PositionCode, TacticSlot } from './types'

/** Lines of the team, by FM position. */
export type Line = 'GK' | 'CB' | 'FB' | 'WB' | 'DM' | 'CM' | 'WM' | 'WAM' | 'AMC' | 'ST'

export const LINE_NAMES: Record<Line, string> = {
  GK: 'Goalkeeper',
  CB: 'Centre-backs',
  FB: 'Full-backs',
  WB: 'Wing-backs',
  DM: 'Defensive midfield',
  CM: 'Central midfield',
  WM: 'Wide midfielders',
  WAM: 'Wingers',
  AMC: 'Attacking midfield',
  ST: 'Strikers',
}

const LINE_POSITIONS: Record<Line, PositionCode[]> = {
  GK: ['GK'],
  CB: ['DC'],
  FB: ['DL', 'DR'],
  WB: ['WBL', 'WBR'],
  DM: ['DM'],
  CM: ['MC'],
  WM: ['ML', 'MR'],
  WAM: ['AML', 'AMR'],
  AMC: ['AMC'],
  ST: ['ST'],
}

export const lineOf = (pos: PositionCode | null | undefined): Line | null =>
  pos
    ? ((Object.keys(LINE_POSITIONS) as Line[]).find((l) => LINE_POSITIONS[l].includes(pos)) ?? null)
    : null

export interface IdeaNeed {
  lines: Line[]
  attributes: string[]
  why: string
}
export interface IdeaRoles {
  line: Line
  /** Role ids in possession and out of possession, best first. */
  ip: string[]
  oop: string[]
  why: string
}
export interface IdeaInstruction {
  instruction: string
  option: string
  why: string
}
export interface GameIdea {
  id: string
  name: string
  /** The idea in a manager's words. */
  about: string
  mentality: string
  /** Formations (names from the formation list) that suit the idea. */
  shapes: string[]
  needs: IdeaNeed[]
  roles: IdeaRoles[]
  /** The team instructions that make the idea. */
  team: IdeaInstruction[]
  /** Player instructions every player in these lines gets (where FM offers them). */
  players: (IdeaInstruction & { lines: Line[] })[]
  /** Player instructions that go against the idea: never suggested. */
  avoid: { instruction: string; option: string }[]
}

const i = (instruction: string, option: string, why: string): IdeaInstruction => ({
  instruction,
  option,
  why,
})

export const DEFAULT_GAME_IDEAS: GameIdea[] = [
  {
    id: 'counter',
    name: 'Counter-attack',
    about:
      'Defend compact in a mid block, win the ball and go. Quick forwards run in behind, wingers cut inside as inside forwards, so the full-backs overlap to the byline and give the width.',
    mentality: 'Balanced',
    shapes: ['4-2-3-1', '4-3-3', '4-4-2', '4-1-2-2-1 (DM, wide AMs)'],
    needs: [
      {
        lines: ['ST', 'WAM', 'WM', 'AMC'],
        attributes: ['Pace', 'Acceleration', 'Off The Ball', 'Finishing'],
        why: 'The counter is won by running in behind and finishing the chance.',
      },
      {
        lines: ['FB', 'WB'],
        attributes: ['Stamina', 'Teamwork', 'Pace', 'Crossing'],
        why: 'They run the whole flank: defend, then overlap to the byline to cross.',
      },
      {
        lines: ['CM', 'DM'],
        attributes: ['Passing', 'Vision', 'Work Rate', 'Anticipation'],
        why: 'They win it and play the first forward pass quickly.',
      },
      {
        lines: ['CB'],
        attributes: ['Positioning', 'Heading', 'Concentration', 'Marking'],
        why: 'The team defends deeper: centre-backs deal with crosses and runners.',
      },
    ],
    roles: [
      {
        line: 'WAM',
        ip: ['if', 'wfd'],
        oop: ['iow', 'wow', 'w-oop'],
        why: 'Wingers attack the box: inside forwards on the counter.',
      },
      {
        line: 'FB',
        ip: ['wb-ip', 'fb-ip'],
        oop: ['fb-oop', 'hfb'],
        why: 'Full-backs give the width the inside forwards leave.',
      },
      {
        line: 'WB',
        ip: ['wb-ip', 'awb'],
        oop: ['wb-oop', 'hwb'],
        why: 'Wing-backs give the width.',
      },
      {
        line: 'ST',
        ip: ['chf', 'p', 'cfd-ip'],
        oop: ['scf', 'ocf', 'cfd-oop'],
        why: 'A striker who runs the channels and stays up as an outlet.',
      },
      {
        line: 'DM',
        ip: ['dlp', 'dm-ip'],
        oop: ['sdm', 'dm-oop'],
        why: 'One screens and plays the first pass.',
      },
      {
        line: 'CM',
        ip: ['cm-ip', 'mpm', 'chm'],
        oop: ['cm-oop', 'scm'],
        why: 'Hard-working midfield that breaks forward.',
      },
      {
        line: 'AMC',
        ip: ['ss', 'am-ip'],
        oop: ['oam', 'am-oop'],
        why: 'Supports the striker on the break.',
      },
      {
        line: 'CB',
        ip: ['cb-ip', 'ncb'],
        oop: ['cb-oop', 'ccb'],
        why: 'Solid centre-backs.',
      },
      { line: 'GK', ip: ['gk-ip'], oop: ['gk-oop', 'lhk'], why: 'A keeper behind a deeper line.' },
    ],
    team: [
      i('Line of engagement', 'Mid block', 'Compact, inviting the opponent forward.'),
      i('Attacking transition', 'Counter-attack', 'Go forward as soon as the ball is won.'),
      i('Passing directness', 'More direct passes', 'Get the ball forward fast.'),
      i('Tempo', 'Higher', 'Direct play needs speed: a slow tempo kills the counter.'),
      i('Pass reception', 'Pass into space', 'Forwards run onto the ball.'),
      i('Defensive transition', 'Regroup', 'Get back into shape rather than press high.'),
    ],
    players: [],
    avoid: [
      { instruction: 'Passing strategy', option: 'Shorter passing' },
      { instruction: 'Dribbling direction', option: 'Run wide with ball' },
    ],
  },
  {
    id: 'possession',
    name: 'Possession',
    about:
      'Keep the ball and move the opponent with short passes, build from the back through the press, full-backs come inside, and work the ball into the box rather than cross.',
    mentality: 'Balanced',
    shapes: ['4-3-3', '4-2-3-1', '4-1-2-2-1 (DM, wide AMs)', '3-4-2-1'],
    needs: [
      {
        lines: ['CB', 'GK'],
        attributes: ['Passing', 'Composure', 'First Touch', 'Technique'],
        why: 'The build-up starts with them, under pressure.',
      },
      {
        lines: ['DM', 'CM', 'AMC'],
        attributes: ['Passing', 'Vision', 'First Touch', 'Decisions'],
        why: 'They keep the ball moving and find the free player.',
      },
      {
        lines: ['FB', 'WB'],
        attributes: ['Passing', 'Technique', 'Decisions', 'Composure'],
        why: 'Inside full-backs play in midfield.',
      },
      {
        lines: ['WAM', 'WM', 'ST'],
        attributes: ['Technique', 'First Touch', 'Dribbling', 'Off The Ball'],
        why: 'They receive in tight spaces and break the last line.',
      },
    ],
    roles: [
      { line: 'GK', ip: ['bgk'], oop: ['sk'], why: 'The keeper is part of the build-up.' },
      { line: 'CB', ip: ['bcb', 'cb-ip'], oop: ['cb-oop', 'ccb'], why: 'Centre-backs who pass.' },
      {
        line: 'FB',
        ip: ['ifb', 'iwb', 'pwb-ip'],
        oop: ['fb-oop', 'pfb'],
        why: 'Full-backs come inside to add a passer in midfield.',
      },
      {
        line: 'WB',
        ip: ['pwb-ip', 'iwb', 'wb-ip'],
        oop: ['wb-oop', 'pwb-oop'],
        why: 'Wing-backs help keep the ball.',
      },
      {
        line: 'DM',
        ip: ['dlp', 'hb'],
        oop: ['sdm', 'dm-oop'],
        why: 'A deep playmaker sets the rhythm.',
      },
      {
        line: 'CM',
        ip: ['mpm', 'cm-ip', 'ap'],
        oop: ['cm-oop', 'pcm'],
        why: 'Midfielders who pass and move.',
      },
      {
        line: 'WAM',
        ip: ['w-ip', 'iw', 'pw'],
        oop: ['w-oop', 'tw'],
        why: 'With full-backs inside, the wingers keep the width.',
      },
      { line: 'WM', ip: ['wm', 'pw'], oop: ['wmf', 'twm'], why: 'Width and an extra passer.' },
      {
        line: 'AMC',
        ip: ['ap', 'am-ip'],
        oop: ['am-oop', 'tam'],
        why: 'A creator between the lines.',
      },
      {
        line: 'ST',
        ip: ['f9', 'dlf', 'cfd-ip'],
        oop: ['tcf', 'cfd-oop'],
        why: 'A striker who drops and links play.',
      },
    ],
    team: [
      i('Passing directness', 'Shorter passes', 'Keep the ball.'),
      i('Build-up strategy', 'Play through the press', 'Start every move from the back.'),
      i('Goal kicks', 'Shorter passes', 'Keep the ball from the goal kick too.'),
      i('Pass reception', 'Pass to feet', 'Safe passes that keep possession.'),
      i('Patience', 'Work ball into box', 'Wait for the clear chance instead of crossing.'),
      i('Defensive transition', 'Counter-press', 'Win the ball back at once, near their goal.'),
    ],
    players: [],
    avoid: [
      { instruction: 'Passing strategy', option: 'More direct passing' },
      { instruction: 'Passing risk', option: 'Take more risks' },
    ],
  },
  {
    id: 'press',
    name: 'High press',
    about:
      'Win the ball high up the pitch: press from the front, a high line behind it, counter-press when the ball is lost, then attack quickly while the opponent is disorganised.',
    mentality: 'Positive',
    shapes: ['4-3-3', '4-2-3-1', '4-2-2-2', '4-4-2'],
    needs: [
      {
        lines: ['ST', 'WAM', 'AMC', 'WM'],
        attributes: ['Work Rate', 'Stamina', 'Pace', 'Aggression'],
        why: 'The press starts with them and never stops.',
      },
      {
        lines: ['CM', 'DM'],
        attributes: ['Work Rate', 'Stamina', 'Teamwork', 'Tackling'],
        why: 'They close the second ball and win it.',
      },
      {
        lines: ['CB'],
        attributes: ['Pace', 'Acceleration', 'Anticipation', 'Positioning'],
        why: 'A high line leaves space behind: centre-backs must cover it.',
      },
      {
        lines: ['FB', 'WB'],
        attributes: ['Work Rate', 'Stamina', 'Pace', 'Tackling'],
        why: 'They press the opposing wide players high up.',
      },
      {
        lines: ['GK'],
        attributes: ['Rushing Out (Tendency)', 'One On Ones', 'Reflexes'],
        why: 'The keeper sweeps behind the high line.',
      },
    ],
    roles: [
      {
        line: 'GK',
        ip: ['gk-ip', 'bgk'],
        oop: ['sk'],
        why: 'A sweeper keeper behind the high line.',
      },
      { line: 'CB', ip: ['cb-ip', 'bcb'], oop: ['cb-oop', 'ccb'], why: 'Covering centre-backs.' },
      { line: 'FB', ip: ['fb-ip', 'wb-ip'], oop: ['pfb'], why: 'Full-backs press high.' },
      { line: 'WB', ip: ['wb-ip', 'awb'], oop: ['pwb-oop'], why: 'Wing-backs press high.' },
      {
        line: 'DM',
        ip: ['dm-ip', 'bbm'],
        oop: ['pdm', 'dm-oop'],
        why: 'A midfielder who hunts the ball.',
      },
      { line: 'CM', ip: ['cm-ip', 'chm'], oop: ['pcm'], why: 'Pressing midfielders.' },
      {
        line: 'WAM',
        ip: ['wfd', 'if'],
        oop: ['tw', 'w-oop'],
        why: 'Wingers who press and attack.',
      },
      {
        line: 'WM',
        ip: ['wm', 'w-ip'],
        oop: ['twm'],
        why: 'Wide midfielders who track and press.',
      },
      { line: 'AMC', ip: ['am-ip', 'ss'], oop: ['tam'], why: 'Presses the deepest midfielder.' },
      { line: 'ST', ip: ['cfd-ip', 'chf'], oop: ['tcf', 'cfd-oop'], why: 'The first presser.' },
    ],
    team: [
      i('Line of engagement', 'High press', 'Press from the front.'),
      i('Trigger press', 'Much more often', 'Close down all the time.'),
      i('Defensive line height', 'Higher', 'Keep the team short behind the press.'),
      i('Defensive transition', 'Counter-press', 'Win it back at once when it is lost.'),
      i('Attacking transition', 'Counter-attack', 'Attack before the opponent is organised.'),
      i('Tempo', 'Higher', 'Play quickly after winning the ball.'),
    ],
    players: [],
    avoid: [{ instruction: 'Trigger press', option: 'Less often' }],
  },
  {
    id: 'direct',
    name: 'Direct',
    about:
      'Get the ball forward early to a strong target man and a runner next to him, win the second balls, cross from wide. Simple and quick.',
    mentality: 'Balanced',
    shapes: ['4-4-2', '4-4-1-1', '3-5-2', '4-1-4-1'],
    needs: [
      {
        lines: ['ST'],
        attributes: ['Heading', 'Jumping Reach', 'Strength', 'Off The Ball'],
        why: 'Long balls need a target who wins them and a runner who attacks the flick-on.',
      },
      {
        lines: ['CM', 'DM'],
        attributes: ['Work Rate', 'Stamina', 'Teamwork', 'Strength'],
        why: 'They win the second balls.',
      },
      {
        lines: ['WM', 'WAM', 'FB', 'WB'],
        attributes: ['Crossing', 'Pace', 'Stamina'],
        why: 'Crosses for the target man.',
      },
      {
        lines: ['CB', 'GK'],
        attributes: ['Heading', 'Strength', 'Kicking', 'Passing'],
        why: 'Strong in the air at the back; long kicks forward.',
      },
    ],
    roles: [
      {
        line: 'ST',
        ip: ['tf', 'p', 'chf'],
        oop: ['cfd-oop', 'scf'],
        why: 'A target forward with a runner next to him.',
      },
      { line: 'WM', ip: ['wm', 'w-ip'], oop: ['twm', 'wmf'], why: 'Wide players who cross.' },
      { line: 'WAM', ip: ['w-ip', 'wfd'], oop: ['w-oop', 'tw'], why: 'Wingers who cross.' },
      { line: 'CM', ip: ['cm-ip', 'chm'], oop: ['pcm', 'cm-oop'], why: 'Second-ball winners.' },
      { line: 'DM', ip: ['dm-ip', 'bbm'], oop: ['dm-oop', 'pdm'], why: 'Second-ball winner.' },
      { line: 'FB', ip: ['fb-ip', 'wb-ip'], oop: ['fb-oop'], why: 'Full-backs who cross.' },
      { line: 'WB', ip: ['wb-ip', 'awb'], oop: ['wb-oop'], why: 'Wing-backs who cross.' },
      { line: 'CB', ip: ['ncb', 'cb-ip'], oop: ['cb-oop', 'scb'], why: 'No risks at the back.' },
      { line: 'GK', ip: ['ngk', 'gk-ip'], oop: ['gk-oop'], why: 'Kicks it long.' },
    ],
    team: [
      i('Passing directness', 'Much more direct passes', 'Forward early.'),
      i('Tempo', 'Higher', 'Direct passing goes with a high tempo.'),
      i('Build-up strategy', 'Bypass the press', 'Go over the press, not through it.'),
      i('Goal kicks', 'Long passing', 'Goal kicks to the target man.'),
      i('Goalkeeper distribution', 'Target forward', 'The keeper looks for the target man.'),
      i('Patience', 'Hit early crosses', 'Cross early for the target man.'),
    ],
    players: [],
    avoid: [
      { instruction: 'Passing strategy', option: 'Shorter passing' },
      { instruction: 'Hold up ball', option: 'No' },
    ],
  },
  {
    id: 'wings',
    name: 'Wing play',
    about:
      'Stretch the pitch and attack down the flanks: wingers stay wide and beat their man, full-backs overlap, and crosses go to strikers who attack the box.',
    mentality: 'Balanced',
    shapes: ['4-4-2', '4-3-3', '3-5-2', '5-2-3'],
    needs: [
      {
        lines: ['WAM', 'WM'],
        attributes: ['Crossing', 'Dribbling', 'Pace', 'Acceleration'],
        why: 'They beat their full-back and cross.',
      },
      {
        lines: ['FB', 'WB'],
        attributes: ['Crossing', 'Stamina', 'Pace', 'Off The Ball'],
        why: 'They overlap and cross too.',
      },
      {
        lines: ['ST'],
        attributes: ['Heading', 'Jumping Reach', 'Off The Ball', 'Finishing'],
        why: 'Crosses need strikers who attack the box.',
      },
      {
        lines: ['CM', 'DM'],
        attributes: ['Passing', 'Vision', 'Work Rate'],
        why: 'They switch play to the free flank.',
      },
    ],
    roles: [
      { line: 'WAM', ip: ['w-ip', 'wfd'], oop: ['w-oop', 'tw'], why: 'Wingers who stay wide.' },
      { line: 'WM', ip: ['w-ip', 'wm'], oop: ['wmf', 'twm'], why: 'Wide players who stay wide.' },
      { line: 'FB', ip: ['wb-ip', 'fb-ip'], oop: ['fb-oop'], why: 'Full-backs who overlap.' },
      {
        line: 'WB',
        ip: ['awb', 'wb-ip'],
        oop: ['wb-oop'],
        why: 'Wing-backs who provide the width.',
      },
      { line: 'ST', ip: ['tf', 'p', 'cfd-ip'], oop: ['cfd-oop'], why: 'Box strikers.' },
      { line: 'CM', ip: ['cm-ip', 'mpm'], oop: ['cm-oop'], why: 'Switch play to the flanks.' },
      {
        line: 'DM',
        ip: ['dlp', 'dm-ip'],
        oop: ['dm-oop', 'sdm'],
        why: 'Covers the overlapping full-backs.',
      },
    ],
    team: [
      i('Attacking width', 'Much wider', 'Stretch the opponent.'),
      i('Progress through', 'Both flanks', 'Attack down the wings.'),
      i('Overlap', 'Overlap both flanks', 'Full-backs run outside the wingers.'),
    ],
    players: [],
    avoid: [{ instruction: 'Dribbling direction', option: 'Cut inside with ball' }],
  },
  {
    id: 'low-block',
    name: 'Low block and counter',
    about:
      'Defend deep and narrow, give the opponent the ball and no space behind, then hit them on the break with quick forwards.',
    mentality: 'Cautious',
    shapes: ['4-4-1-1', '4-5-1', '4-1-4-1', '5-4-1'],
    needs: [
      {
        lines: ['CB'],
        attributes: ['Heading', 'Positioning', 'Marking', 'Concentration'],
        why: 'Long spells defending the box.',
      },
      {
        lines: ['DM', 'CM'],
        attributes: ['Positioning', 'Teamwork', 'Work Rate', 'Tackling'],
        why: 'Screen the defence and keep the shape.',
      },
      {
        lines: ['FB', 'WB', 'WM'],
        attributes: ['Positioning', 'Teamwork', 'Work Rate', 'Stamina'],
        why: 'Track runners and keep the block narrow.',
      },
      {
        lines: ['ST', 'WAM', 'AMC'],
        attributes: ['Pace', 'Acceleration', 'Strength', 'Finishing'],
        why: 'Few chances: forwards must run and finish alone.',
      },
    ],
    roles: [
      { line: 'CB', ip: ['ncb', 'cb-ip'], oop: ['scb', 'cb-oop'], why: 'Defend first.' },
      { line: 'FB', ip: ['fb-ip'], oop: ['hfb', 'fb-oop'], why: 'Full-backs who stay back.' },
      { line: 'WB', ip: ['wb-ip'], oop: ['hwb'], why: 'Wing-backs who stay back.' },
      { line: 'DM', ip: ['dm-ip', 'dlp'], oop: ['sdm'], why: 'A screen in front of the defence.' },
      { line: 'CM', ip: ['cm-ip'], oop: ['scm', 'cm-oop'], why: 'Midfielders who hold.' },
      { line: 'WM', ip: ['wm', 'w-ip'], oop: ['twm'], why: 'Wide midfielders who track back.' },
      { line: 'WAM', ip: ['wfd', 'if'], oop: ['tw', 'wow'], why: 'Track back, then break.' },
      { line: 'AMC', ip: ['ss', 'am-ip'], oop: ['tam', 'oam'], why: 'Breaks to join the striker.' },
      { line: 'ST', ip: ['chf', 'p'], oop: ['scf', 'ocf'], why: 'Stays up as the outlet.' },
      {
        line: 'GK',
        ip: ['gk-ip'],
        oop: ['lhk', 'gk-oop'],
        why: 'Stays on the line behind a deep block.',
      },
    ],
    team: [
      i('Line of engagement', 'Low block', 'Defend deep.'),
      i('Defensive line height', 'Lower', 'No space behind.'),
      i('Trigger press', 'Less often', 'Keep the shape instead of chasing.'),
      i('Defensive transition', 'Regroup', 'Back into the block when the ball is lost.'),
      i('Attacking transition', 'Counter-attack', 'Break as soon as the ball is won.'),
      i('Passing directness', 'More direct passes', 'Get it to the forwards quickly.'),
      i('Pass reception', 'Pass into space', 'Forwards run onto the ball.'),
    ],
    players: [],
    avoid: [{ instruction: 'Trigger press', option: 'More often' }],
  },
  {
    id: 'catenaccio',
    name: 'Catenaccio',
    about:
      'The Italian way: three centre-backs, the outer two mark tight while the middle one covers behind them, wing-backs, a disciplined midfield, and quick counters for two forwards. Defend first, win 1-0.',
    mentality: 'Defensive',
    shapes: ['5-3-2', '3-5-2', '5-4-1'],
    needs: [
      {
        lines: ['CB'],
        attributes: ['Marking', 'Tackling', 'Positioning', 'Concentration', 'Heading'],
        why: 'Man-markers and a covering defender: the heart of catenaccio.',
      },
      {
        lines: ['WB'],
        attributes: ['Stamina', 'Work Rate', 'Pace', 'Teamwork'],
        why: 'They defend as full-backs and break as wingers.',
      },
      {
        lines: ['CM', 'DM'],
        attributes: ['Teamwork', 'Positioning', 'Passing', 'Work Rate'],
        why: 'A disciplined midfield that plays the counter.',
      },
      {
        lines: ['ST'],
        attributes: ['Pace', 'Finishing', 'Off The Ball', 'Composure'],
        why: 'Few chances: forwards must take them.',
      },
    ],
    roles: [
      {
        line: 'CB',
        ip: ['cb-ip', 'ncb', 'bcb'],
        oop: ['ccb', 'swd', 'scb'],
        why: 'The middle centre-back covers (the closest FM27 role to a libero (?)), the outer two step out to stop their man.',
      },
      { line: 'WB', ip: ['wb-ip'], oop: ['hwb', 'wb-oop'], why: 'Wing-backs who defend first.' },
      { line: 'DM', ip: ['dlp', 'dm-ip'], oop: ['sdm'], why: 'A deep passer for the counter.' },
      { line: 'CM', ip: ['cm-ip', 'mpm'], oop: ['scm', 'cm-oop'], why: 'Disciplined midfielders.' },
      {
        line: 'ST',
        ip: ['p', 'chf', 'dlf'],
        oop: ['scf', 'ocf'],
        why: 'Two forwards who stay up for the counter.',
      },
      { line: 'GK', ip: ['gk-ip'], oop: ['lhk'], why: 'Stays on the line.' },
    ],
    team: [
      i('Line of engagement', 'Low block', 'Defend deep.'),
      i('Defensive line height', 'Lower', 'No space behind.'),
      i('Defensive line behaviour', 'Drop off more', 'Defenders drop rather than step up.'),
      i('Trigger press', 'Less often', 'Keep the shape.'),
      i('Defensive transition', 'Regroup', 'Back into shape at once.'),
      i('Attacking transition', 'Counter-attack', 'Break quickly.'),
      i('Passing directness', 'More direct passes', 'Forward quickly to the two strikers.'),
      i('Creative freedom', 'Be more disciplined', 'Everyone keeps his job.'),
      i('Time wasting', 'More often', 'Protect the lead.'),
    ],
    players: [
      {
        lines: ['CB', 'DM'],
        instruction: 'Marking',
        option: 'Mark tighter',
        why: 'Catenaccio defenders mark their man tight.',
      },
    ],
    avoid: [
      { instruction: 'Forward runs', option: 'Make more runs' },
      { instruction: 'Trigger press', option: 'More often' },
    ],
  },
  {
    id: 'flair',
    name: 'Flair',
    about:
      'Let the talent play: creative players between the lines with freedom to dribble and try things, short passes to feet, and a hard-working midfielder or two to cover for them.',
    mentality: 'Positive',
    shapes: ['4-2-3-1', '4-3-1-2', '4-3-3', '4-2-2-2'],
    needs: [
      {
        lines: ['AMC', 'WAM', 'ST'],
        attributes: ['Flair', 'Dribbling', 'Technique', 'Vision'],
        why: 'The players who make the difference.',
      },
      {
        lines: ['CM'],
        attributes: ['Passing', 'Vision', 'Technique', 'First Touch'],
        why: 'They feed the creative players.',
      },
      {
        lines: ['DM'],
        attributes: ['Work Rate', 'Positioning', 'Tackling', 'Teamwork'],
        why: 'Someone has to cover for the artists.',
      },
      {
        lines: ['FB', 'WB'],
        attributes: ['Pace', 'Stamina', 'Crossing', 'Work Rate'],
        why: 'They give width while the creators go inside.',
      },
    ],
    roles: [
      { line: 'AMC', ip: ['fr', 'ap', 'ss'], oop: ['oam', 'am-oop'], why: 'A free creator.' },
      {
        line: 'WAM',
        ip: ['iw', 'if', 'pw'],
        oop: ['iow', 'w-oop'],
        why: 'Wide creators who come inside.',
      },
      {
        line: 'ST',
        ip: ['f9', 'dlf', 'cfd-ip'],
        oop: ['tcf', 'ocf'],
        why: 'A striker who combines.',
      },
      {
        line: 'CM',
        ip: ['mpm', 'ap', 'chm'],
        oop: ['cm-oop', 'pcm'],
        why: 'Creative midfielders.',
      },
      { line: 'DM', ip: ['dm-ip', 'bbm'], oop: ['sdm', 'dm-oop'], why: 'The worker who covers.' },
      { line: 'FB', ip: ['wb-ip', 'fb-ip'], oop: ['fb-oop'], why: 'Full-backs give the width.' },
      { line: 'WB', ip: ['awb', 'wb-ip'], oop: ['wb-oop'], why: 'Wing-backs give the width.' },
    ],
    team: [
      i('Creative freedom', 'Be more expressive', 'Let them play.'),
      i('Dribbling', 'Encourage', 'Take players on.'),
      i('Pass reception', 'Pass to feet', 'Creative players want the ball to feet.'),
      i('Patience', 'Work ball into box', 'Combine into the box.'),
      i('Tempo', 'Higher', 'Quick combinations.'),
    ],
    players: [],
    avoid: [
      { instruction: 'Dribbling frequency', option: 'Dribble less' },
      { instruction: 'Passing risk', option: 'Take fewer risks' },
    ],
  },
]

/* ------------------------------------------------------------------ squad check */

const attr = (p: PlayerRow, a: string) => attrNumber(p.attributes[a])
/** A player's average in some attributes (1–20), or null. */
export function needValue(p: PlayerRow, attributes: string[]) {
  const v = attributes.map((a) => attr(p, a)).filter((x): x is number => x !== null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
const playsLine = (p: PlayerRow, lines: Line[]) =>
  lines.some((l) => LINE_POSITIONS[l].some((pos) => playsPosition(p, pos)))

export interface NeedCheck {
  need: IdeaNeed
  /** Average of the best players for these lines (1–20). */
  value: number | null
  verdict: 'good' | 'fair' | 'weak'
  best: { player: PlayerRow; value: number }[]
}

/** How many players the idea uses in these lines, at most. */
const HOW_MANY: Record<Line, number> = {
  GK: 1,
  CB: 3,
  FB: 2,
  WB: 2,
  DM: 2,
  CM: 3,
  WM: 2,
  WAM: 2,
  AMC: 1,
  ST: 2,
}

/** The squad against each need of the idea: the best players for those lines. */
export function squadCheck(idea: GameIdea, squad: PlayerRow[]): NeedCheck[] {
  return idea.needs.map((need) => {
    const best = squad
      .filter((p) => playsLine(p, need.lines))
      .map((player) => ({ player, value: needValue(player, need.attributes) ?? 0 }))
      .sort((a, b) => b.value - a.value)
    const n = Math.min(4, Math.max(...need.lines.map((l) => HOW_MANY[l])))
    const top = best.slice(0, n)
    const value = top.length ? top.reduce((a, b) => a + b.value, 0) / top.length : null
    return {
      need,
      value,
      verdict: value === null || value < 12 ? 'weak' : value < 14 ? 'fair' : 'good',
      best: best.slice(0, 4),
    }
  })
}

/** 0–100: how well the squad suits the idea (average of its needs). */
export function ideaFit(checks: NeedCheck[]) {
  const v = checks.map((c) => c.value ?? 0)
  return v.length ? Math.round(((v.reduce((a, b) => a + b, 0) / v.length - 1) / 19) * 100) : 0
}

/* ------------------------------------------------------------------ role pairings */

export interface RoleLink {
  id: string
  name: string
  about: string
  /** Slot indexes to change and the roles that would fix it, or null when fine. */
  check: (
    slots: TacticSlot[],
  ) => { slots: number[]; phase: 'ip' | 'oop'; allowed: string[]; why: string } | null
}

const LEFT: PositionCode[] = ['DL', 'WBL', 'ML', 'AML']
const RIGHT: PositionCode[] = ['DR', 'WBR', 'MR', 'AMR']
const BACK_WIDE: PositionCode[] = ['DL', 'DR', 'WBL', 'WBR']
const FRONT_WIDE: PositionCode[] = ['ML', 'MR', 'AML', 'AMR']
const CUT_INSIDE = ['if', 'iw', 'pw']
const GIVES_WIDTH_BACK = ['wb-ip', 'awb', 'fb-ip', 'pwb-ip']
const INSIDE_BACK = ['ifb', 'iwb']
const STAYS_WIDE = ['w-ip', 'wm', 'wfd']
const RUNNERS = ['p', 'chf', 'cfd-ip']
const LINKERS = ['dlf', 'f9', 'tf']
const WORKERS_IP = ['cm-ip', 'bbm', 'chm', 'dm-ip', 'hb', 'wcm-ip']
const HOLDERS_OOP = ['sdm', 'scm', 'dm-oop', 'cm-oop', 'wdm', 'wcm-oop']
const CROSSERS = ['w-ip', 'wm', 'wb-ip', 'awb', 'fb-ip', 'wfd']
const RUN_BEYOND = ['if', 'wfd', 'chm', 'am-ip', 'ss', 'bbm', 'p', 'chf']

const idx = (slots: TacticSlot[], test: (s: TacticSlot) => boolean) =>
  slots.flatMap((s, k) => (test(s) ? [k] : []))

const sideCheck =
  (front: string[], back: string[], allowedBack: string[], why: string, frontFirst: boolean) =>
  (slots: TacticSlot[]) => {
    for (const side of [LEFT, RIGHT]) {
      const f = idx(
        slots,
        (s) => !!s.position && side.includes(s.position) && FRONT_WIDE.includes(s.position),
      )
      const b = idx(
        slots,
        (s) => !!s.position && side.includes(s.position) && BACK_WIDE.includes(s.position),
      )
      if (!f.length || !b.length) continue
      const fr = slots[f[0]].role ?? ''
      const br = slots[b[0]].role ?? ''
      if (
        frontFirst
          ? front.includes(fr) && back.includes(br)
          : back.includes(br) && front.includes(fr)
      )
        return { slots: frontFirst ? b : f, phase: 'ip' as const, allowed: allowedBack, why }
    }
    return null
  }

export const ROLE_LINKS: RoleLink[] = [
  {
    id: 'link-width-inside',
    name: 'A winger who cuts inside needs a full-back who gives width',
    about:
      'Inside Forward, Inside Winger or Playmaking Winger on one side: the full-back or wing-back behind him plays a role that goes outside (Wing-Back, Full-Back…), not Inside Full-Back or Inside Wing-Back.',
    check: sideCheck(
      CUT_INSIDE,
      INSIDE_BACK,
      GIVES_WIDTH_BACK,
      'A winger cutting inside needs a full-back who gives width.',
      true,
    ),
  },
  {
    id: 'link-width-outside',
    name: 'A full-back who comes inside needs a winger who stays wide',
    about:
      'Inside Full-Back or Inside Wing-Back on one side: the winger in front of him stays wide (Winger, Wide Midfielder, Wide Forward).',
    check: sideCheck(
      CUT_INSIDE,
      INSIDE_BACK,
      STAYS_WIDE,
      'A full-back coming inside needs a winger who stays wide.',
      false,
    ),
  },
  {
    id: 'link-strikers',
    name: 'Two strikers: one links, one runs',
    about:
      'With two strikers, one drops or holds the ball (Deep-Lying Forward, False Nine, Target Forward) and one runs in behind (Poacher, Channel Forward, Centre Forward). Two of the same kind get in each other’s way.',
    check: (slots) => {
      const st = idx(slots, (s) => s.position === 'ST')
      if (st.length !== 2) return null
      const [a, b] = st.map((k) => slots[k].role ?? '')
      if (RUNNERS.includes(a) && RUNNERS.includes(b))
        return {
          slots: st,
          phase: 'ip',
          allowed: LINKERS,
          why: 'Two runners: one should link play.',
        }
      if (LINKERS.includes(a) && LINKERS.includes(b))
        return {
          slots: st,
          phase: 'ip',
          allowed: RUNNERS,
          why: 'Two who drop: one should run in behind.',
        }
      return null
    },
  },
  {
    id: 'link-midfield-worker',
    name: 'Creative midfield needs a worker',
    about:
      'With two or more central or defensive midfielders, at least one is a worker in possession (Central Midfielder, Box-To-Box, Channel Midfielder, Defensive Midfielder, Half Back), not all playmakers.',
    check: (slots) => {
      const mid = idx(slots, (s) => s.position === 'MC' || s.position === 'DM')
      if (mid.length < 2 || mid.some((k) => WORKERS_IP.includes(slots[k].role ?? ''))) return null
      return {
        slots: mid,
        phase: 'ip',
        allowed: WORKERS_IP,
        why: 'All playmakers: one should do the running.',
      }
    },
  },
  {
    id: 'link-midfield-screen',
    name: 'Someone screens the defence',
    about:
      'Out of possession, at least one central or defensive midfielder holds in front of the defence (Screening, Defensive Midfielder, Central Midfielder, Wide Covering).',
    check: (slots) => {
      const mid = idx(slots, (s) => {
        const p = s.positionOop ?? s.position
        return p === 'MC' || p === 'DM'
      })
      if (!mid.length || mid.some((k) => HOLDERS_OOP.includes(slots[k].roleOop ?? ''))) return null
      return {
        slots: mid,
        phase: 'oop',
        allowed: HOLDERS_OOP,
        why: 'Nobody holds in front of the defence.',
      }
    },
  },
  {
    id: 'link-target-crosses',
    name: 'A target forward needs crosses',
    about:
      'A Target Forward needs at least one wide player who crosses (Winger, Wide Midfielder, Wing-Back, Full-Back, Wide Forward).',
    check: (slots) => {
      if (!slots.some((s) => s.position === 'ST' && s.role === 'tf')) return null
      const wide = idx(
        slots,
        (s) => !!s.position && [...BACK_WIDE, ...FRONT_WIDE].includes(s.position),
      )
      if (!wide.length || wide.some((k) => CROSSERS.includes(slots[k].role ?? ''))) return null
      return {
        slots: wide,
        phase: 'ip',
        allowed: CROSSERS,
        why: 'A target forward and nobody to cross.',
      }
    },
  },
  {
    id: 'link-false-nine',
    name: 'A false nine needs runners',
    about:
      'A False Nine drops deep and leaves the box empty: someone else runs beyond him (Inside Forward, Wide Forward, Channel Midfielder, Attacking Midfielder, Second Striker, Box-To-Box).',
    check: (slots) => {
      if (!slots.some((s) => s.role === 'f9')) return null
      const others = idx(
        slots,
        (s) => s.role !== 'f9' && !!s.position && !['GK', 'DC', 'DL', 'DR'].includes(s.position),
      )
      if (others.some((k) => RUN_BEYOND.includes(slots[k].role ?? ''))) return null
      return {
        slots: others,
        phase: 'ip',
        allowed: RUN_BEYOND,
        why: 'A false nine and nobody running beyond him.',
      }
    },
  },
]

/* ------------------------------------------------------------------ instruction conflicts */

export interface InstructionConflict {
  id: string
  a: { instruction: string; options: string[] }
  b: { instruction: string; options: string[] }
  why: string
}

const c = (
  id: string,
  a: [string, string[]],
  b: [string, string[]],
  why: string,
): InstructionConflict => ({
  id,
  a: { instruction: a[0], options: a[1] },
  b: { instruction: b[0], options: b[1] },
  why,
})

export const TEAM_CONFLICTS: InstructionConflict[] = [
  c(
    'conflict-direct-tempo',
    ['Passing directness', ['More direct passes', 'Much more direct passes']],
    ['Tempo', ['Lower', 'Much lower']],
    'Direct passing is about getting forward quickly: a low tempo works against it.',
  ),
  c(
    'conflict-block-line',
    ['Line of engagement', ['Low block']],
    ['Defensive line height', ['Higher', 'Much higher']],
    'A low block with a high line leaves a huge gap between the lines.',
  ),
  c(
    'conflict-press-line',
    ['Line of engagement', ['High press']],
    ['Defensive line height', ['Lower', 'Much lower']],
    'Pressing high with a deep line splits the team in two.',
  ),
  c(
    'conflict-block-press',
    ['Line of engagement', ['Low block']],
    ['Trigger press', ['More often', 'Much more often']],
    'Pressing all the time pulls players out of the low block.',
  ),
  c(
    'conflict-press-regroup',
    ['Trigger press', ['More often', 'Much more often']],
    ['Defensive transition', ['Regroup']],
    'Pressing more and dropping back when the ball is lost pull in opposite directions.',
  ),
  c(
    'conflict-midblock-line',
    ['Line of engagement', ['Mid block']],
    ['Defensive line height', ['Much higher']],
    'A mid block with a very high line stretches the team and leaves space in behind.',
  ),
  c(
    'conflict-block-stepup',
    ['Line of engagement', ['Low block']],
    ['Defensive line behaviour', ['Step up more']],
    'A low block defends deep: stepping up breaks it.',
  ),
  c(
    'conflict-highline-dropoff',
    ['Defensive line height', ['Higher', 'Much higher']],
    ['Defensive line behaviour', ['Drop off more']],
    'A high line that keeps dropping off never holds its height.',
  ),
  c(
    'conflict-counter-holdshape',
    ['Defensive transition', ['Counter-press']],
    ['Line of engagement', ['Low block']],
    'Counter-pressing high and defending in a low block ask for opposite things.',
  ),
  c(
    'conflict-counter-tempo',
    ['Attacking transition', ['Counter-attack']],
    ['Tempo', ['Much lower']],
    'Counter-attacks need speed.',
  ),
  c(
    'conflict-buildup-kicks',
    ['Build-up strategy', ['Play through the press']],
    ['Goal kicks', ['Long passing']],
    'Playing through the press starts short, from the goal kick too.',
  ),
  c(
    'conflict-bypass-short',
    ['Build-up strategy', ['Bypass the press']],
    ['Passing directness', ['Much shorter passes']],
    'Going over the press does not fit very short passing.',
  ),
  c(
    'conflict-early-crosses-narrow',
    ['Patience', ['Hit early crosses']],
    ['Attacking width', ['Narrower', 'Much narrower']],
    'Early crosses need players out wide.',
  ),
  c(
    'conflict-feet-direct',
    ['Pass reception', ['Pass to feet']],
    ['Passing directness', ['Much more direct passes']],
    'Long direct balls are hard to play to feet.',
  ),
  c(
    'conflict-disciplined-dribble',
    ['Creative freedom', ['Be more disciplined']],
    ['Dribbling', ['Encourage']],
    'Asking for discipline and for dribbling at once sends mixed messages.',
  ),
  c(
    'conflict-wide-through-centre',
    ['Attacking width', ['Much wider']],
    ['Progress through', ['Centre']],
    'Stretching the pitch and then attacking only through the middle wastes the width.',
  ),
]

/** The conflicts in a set of team instruction codes. */
export function teamConflicts(
  codes: number[],
  defs: FmInstruction[],
  enabled: Record<string, boolean> = {},
): { id: string; text: string }[] {
  const label = (name: string) => {
    const d = defs.find((x) => x.name === name)
    return d ? (chosen(d, codes)?.label ?? null) : null
  }
  return TEAM_CONFLICTS.filter((x) => enabled[x.id] !== false).flatMap((x) => {
    const a = label(x.a.instruction)
    const b = label(x.b.instruction)
    if (!a || !b || !x.a.options.includes(a) || !x.b.options.includes(b)) return []
    return [{ id: x.id, text: `${x.a.instruction} ${a} with ${x.b.instruction} ${b}: ${x.why}` }]
  })
}

export interface IdeaTeamItem {
  instruction: string
  from: string
  to: string
  why: string
  code: number
}

/** The idea's team instructions as changes from a starting set. */
export function ideaTeam(idea: GameIdea, base: number[], defs: FmInstruction[]): IdeaTeamItem[] {
  return idea.team.flatMap((t) => {
    const d = defs.find((x) => x.name === t.instruction)
    const o = d?.options.find((x) => x.label === t.option)
    if (!d || !o) return []
    const from = chosen(d, base)?.label ?? '?'
    return [{ instruction: d.name, from, to: o.label, why: t.why, code: o.code }]
  })
}

export const applyCodes = (
  base: number[],
  items: { instruction: string; code: number }[],
  defs: FmInstruction[],
) =>
  items.reduce((codes, x) => {
    const d = defs.find((y) => y.name === x.instruction)
    return d ? choose(d, codes, x.code) : codes
  }, base)
