/**
 * Attribute abbreviations, descriptions and screen layouts.
 *
 * To change a description: edit the `description` text below (GitHub web editor works fine)
 * and commit to main. Keep the attribute names exactly as they are.
 */

export interface AttributeInfo {
  /** Short column header, as in FM's squad attributes view. */
  abbr: string
  description: string
}

export const ATTRIBUTE_INFO: Record<string, AttributeInfo> = {
  // Technical
  Crossing: { abbr: 'Cro', description: 'Accuracy of crosses into the box from wide areas.' },
  Dribbling: {
    abbr: 'Dri',
    description: 'Ability to run with the ball and beat opponents in possession.',
  },
  Finishing: {
    abbr: 'Fin',
    description: 'Composure and accuracy when shooting at goal, mainly inside the box.',
  },
  'First Touch': {
    abbr: 'Fir',
    description: 'How well the player controls the ball when receiving it.',
  },
  Heading: { abbr: 'Hea', description: 'Accuracy and power of headers, attacking and defending.' },
  'Long Shots': {
    abbr: 'Lon',
    description: 'Ability to score or test the keeper from outside the box.',
  },
  Marking: {
    abbr: 'Mar',
    description: 'Ability to stay close to an opponent and deny them the ball.',
  },
  Passing: { abbr: 'Pas', description: 'Accuracy and range of passing.' },
  Tackling: {
    abbr: 'Tck',
    description: 'Ability to win the ball cleanly in a challenge without fouling.',
  },
  Technique: { abbr: 'Tec', description: 'Overall quality of touch and execution of skills.' },
  // Set pieces
  Corners: { abbr: 'Cor', description: 'Quality of corner kick delivery.' },
  'Free Kick Taking': {
    abbr: 'Fre',
    description: 'Ability to score or deliver well from direct free kicks.',
  },
  'Long Throws': { abbr: 'L Th', description: 'Distance and accuracy of throw-ins into the box.' },
  'Penalty Taking': { abbr: 'Pen', description: 'Ability to score from the penalty spot.' },
  // Mental
  Aggression: {
    abbr: 'Agg',
    description: 'Willingness to get involved physically in every situation.',
  },
  Anticipation: {
    abbr: 'Ant',
    description: 'Ability to predict and react to what will happen next.',
  },
  Bravery: {
    abbr: 'Bra',
    description: 'Willingness to put the body on the line, e.g. diving headers or blocks.',
  },
  Composure: { abbr: 'Cmp', description: 'Calmness with the ball under pressure.' },
  Concentration: { abbr: 'Cnt', description: 'Ability to stay focused for the whole match.' },
  Decisions: { abbr: 'Dec', description: 'Quality of choices made on the ball and off it.' },
  Determination: { abbr: 'Det', description: 'Drive to succeed and keep fighting when behind.' },
  Flair: { abbr: 'Fla', description: 'Creativity and ability to try the unexpected.' },
  Leadership: { abbr: 'Ldr', description: 'Ability to inspire and organise team-mates.' },
  'Off The Ball': {
    abbr: 'OtB',
    description: 'Movement into dangerous positions without the ball.',
  },
  Positioning: { abbr: 'Pos', description: 'Defensive awareness: taking up the right position.' },
  'Team Work': {
    abbr: 'Tea',
    description: 'Willingness to follow tactics and work for team-mates.',
  },
  Vision: { abbr: 'Vis', description: 'Ability to see passing options others would miss.' },
  'Work Rate': {
    abbr: 'Wor',
    description: 'Willingness to keep running and working for the team.',
  },
  // Physical
  Acceleration: { abbr: 'Acc', description: 'How quickly the player reaches top speed.' },
  Agility: { abbr: 'Agi', description: 'Ability to start, stop and change direction quickly.' },
  Balance: { abbr: 'Bal', description: 'Ability to stay on their feet under physical pressure.' },
  'Jumping Reach': { abbr: 'Jum', description: 'How high the player can reach when jumping.' },
  'Natural Fitness': {
    abbr: 'Nat',
    description: 'How well fitness is kept and how quickly the player recovers.',
  },
  Pace: { abbr: 'Pac', description: 'Top running speed.' },
  Stamina: { abbr: 'Sta', description: 'Ability to keep up physical effort through a full match.' },
  Strength: { abbr: 'Str', description: 'Physical power to hold off or push past opponents.' },
  // Goalkeeping
  'Aerial Reach': {
    abbr: 'Aer',
    description: 'How high the keeper can reach to deal with high balls.',
  },
  'Command Of Area': {
    abbr: 'Cmd',
    description: 'Authority in coming off the line to claim balls in the box.',
  },
  Communication: { abbr: 'Com', description: 'How well the keeper organises the defence.' },
  Eccentricity: {
    abbr: 'Ecc',
    description: 'Tendency to do the unexpected, e.g. dribble out or leave the box.',
  },
  Handling: { abbr: 'Han', description: 'Ability to catch and hold the ball cleanly.' },
  Kicking: { abbr: 'Kic', description: 'Distance and accuracy of kicks from hand and goal kicks.' },
  'One On Ones': {
    abbr: '1v1',
    description: 'Ability to deal with an attacker running through on goal.',
  },
  'Punching (Tendency)': {
    abbr: 'Pun',
    description: 'Tendency to punch the ball away rather than catch it.',
  },
  Reflexes: { abbr: 'Ref', description: 'Speed of reaction to shots and deflections.' },
  'Rushing Out (Tendency)': {
    abbr: 'TRO',
    description: 'Tendency to rush off the line to close down attackers.',
  },
  Throwing: { abbr: 'Thr', description: 'Distance and accuracy of throws.' },
}

export interface AttributeSection {
  label: string
  attributes: string[]
}

const MENTAL = [
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
]
const PHYSICAL = [
  'Acceleration',
  'Agility',
  'Balance',
  'Jumping Reach',
  'Natural Fitness',
  'Pace',
  'Stamina',
  'Strength',
]
const GOALKEEPING = [
  'Aerial Reach',
  'Command Of Area',
  'Communication',
  'Eccentricity',
  'First Touch',
  'Handling',
  'Kicking',
  'One On Ones',
  'Passing',
  'Punching (Tendency)',
  'Reflexes',
  'Rushing Out (Tendency)',
  'Throwing',
]

/** Squad table column order, as in FM's squad attributes view. */
export const TABLE_LAYOUT: Record<'outfield' | 'goalkeepers', AttributeSection[]> = {
  outfield: [
    {
      label: 'Technical',
      attributes: [
        'Crossing',
        'Dribbling',
        'Finishing',
        'First Touch',
        'Heading',
        'Long Shots',
        'Marking',
        'Passing',
        'Tackling',
        'Technique',
      ],
    },
    {
      label: 'Set Pieces',
      attributes: ['Corners', 'Free Kick Taking', 'Long Throws', 'Penalty Taking'],
    },
    { label: 'Mental', attributes: MENTAL },
    { label: 'Physical', attributes: PHYSICAL },
  ],
  goalkeepers: [
    { label: 'Goalkeeping', attributes: GOALKEEPING },
    { label: 'Mental', attributes: MENTAL },
    { label: 'Physical', attributes: PHYSICAL },
  ],
}

/** Player profile layout, as in FM's player attributes screen. */
export const PROFILE_LAYOUT: Record<'outfield' | 'goalkeepers', AttributeSection[]> = {
  outfield: [
    {
      label: 'Technical',
      attributes: [
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
    },
    { label: 'Mental', attributes: MENTAL },
    { label: 'Physical', attributes: PHYSICAL },
  ],
  goalkeepers: TABLE_LAYOUT.goalkeepers,
}

/** Descriptions for other squad-table columns and labels. */
export const FIELD_INFO: Record<string, string> = {
  Player: 'Player name. Tap or click to open the profile.',
  'No.': 'Squad number.',
  Position: 'Positions the player can play, as listed in FM.',
  Age: 'Age at the time of the last import.',
  Nation: 'Nationality. Second nationality is shown on the profile.',
  Height: 'Height in centimetres.',
  Left: 'Left foot strength.',
  Right: 'Right foot strength.',
  Personality: 'Personality type, which affects development, morale and dressing room influence.',
  Selection: 'Position or bench slot in the current team selection.',
}

/** True for players whose only listed position is goalkeeper. */
export function isGoalkeeper(positions: string | null | undefined): boolean {
  return (positions ?? '').trim().toUpperCase() === 'GK'
}
