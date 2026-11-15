/**
 * Names of FM's player traits by the bit the save stores them under. Bits 0–45: FM's
 * language file lists trait names in exactly this order (text 228089 + bit), which every
 * trait name fmsave confirmed in game matches (14 of 14). Bits 51 and 59 were confirmed by
 * fmsave in game; "(?)" names follow from where FM's language file keeps them, unconfirmed.
 * Unnamed bits show as "Trait #n". Editable in Settings > Player traits.
 */
export const DEFAULT_TRAIT_NAMES: Record<string, string> = {
  '0': 'Runs With Ball Down Left',
  '1': 'Runs With Ball Down Right',
  '2': 'Runs With Ball Through Centre',
  '3': 'Gets Into Opposition Area',
  '4': 'Moves Into Channels',
  '5': 'Gets Forward Whenever Possible',
  '6': 'Plays Short Simple Passes',
  '7': 'Tries Killer Balls Often',
  '8': 'Shoots From Distance',
  '9': 'Shoots With Power',
  '10': 'Places Shots',
  '11': 'Curls Ball',
  '12': 'Likes To Round Keeper',
  '13': 'Likes To Try To Beat Offside Trap',
  '14': 'Uses Outside Of Foot',
  '15': 'Marks Opponent Tightly',
  '16': 'Winds Up Opponents',
  '17': 'Argues With Officials',
  '18': 'Plays With Back To Goal',
  '19': 'Comes Deep To Get Ball',
  '20': 'Plays One-Twos',
  '21': 'Likes To Lob Keeper',
  '22': 'Dictates Tempo',
  '23': 'Attempts Overhead Kicks',
  '24': 'Looks For Pass Rather Than Attempting To Score',
  '25': 'Plays No Through Balls',
  '26': 'Stops Play',
  '27': 'Knocks Ball Past Opponent',
  '28': 'Moves Ball To Right Foot Before Dribble Attempt',
  '29': 'Moves Ball To Left Foot Before Dribble Attempt',
  '30': 'Dwells On Ball',
  '31': "Arrives Late In Opponents' Area",
  '32': 'Tries To Play Way Out Of Trouble',
  '33': 'Stays Back At All Times',
  '34': 'Avoids Using Weaker Foot',
  '35': 'Tries Tricks',
  '36': 'Tries Long Range Free Kicks',
  '37': 'Dives Into Tackles',
  '38': 'Does Not Dive Into Tackles',
  '40': 'Hugs Line',
  '41': 'Gets Crowd Going',
  '42': 'Tries First Time Shots',
  '43': 'Tries Long Range Passes',
  '44': 'Likes Ball Played Into Feet',
  '45': 'Hits Free Kicks With Power',
  '50': 'Possesses Long Flat Throw (?)',
  '51': 'Runs With Ball Often',
  '52': 'Runs With Ball Rarely (?)',
  '59': 'Crosses Early',
}

/** Trait bits as the save import stores them ("2,8,10") to names. */
export function traitNames(stored: string | undefined, names: Record<string, string>): string[] {
  if (!stored) return []
  return stored
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => names[b] ?? DEFAULT_TRAIT_NAMES[b] ?? `Trait #${b}`)
}
