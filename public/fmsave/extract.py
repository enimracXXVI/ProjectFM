"""ProjectFM: reads the managed club's squad from an FM save with fmsave (MIT).

Returns JSON with, per player (by FM Unique ID): feet, personality values, contract terms
and clauses, and this season's stats per competition kind. Also the club's scouts: their
attributes (Authority included) and scouting knowledge per nation.
"""
import json
import re
import struct
from dataclasses import asdict, is_dataclass
from datetime import date, datetime, timedelta

import fmsave
from fmsave.readers import contracts as _contracts

# Squad numbers sit on contract records, which fmsave decodes but does not expose: note
# where each one is (by player pindex) while fmsave reads them. Found by ProjectFM in FM27
# saves: the byte 12 before a contract record's tag (255 = no number). A loaned or newly
# bought player has two records; the number is on the one at the club he plays for.
_CHAIN_RECORDS = []
_decode_chain_record = _contracts.ContractDecoder.decode_chain_record




_TRAINING_ROLES = re.compile(rb"\x01\x02([\x01-\x10])\x04\x05")
_TRAINING_KEEP = re.compile(rb"\x01\x01..[\x6c\xe0-\xff]\x07\x00\x00", re.S)
_TRAINING_INTENSITY = re.compile(rb"(?=[\xff\x00-\x02][\x10-\x20]\x00\x00\x00[\x10-\x20]\x00\x00\x00)")


def _date(raw):
    """FM's 4-byte date as ISO text: day of the year from 1 (low 9 bits; the rest is the time),
    then the year. None when unset (year 1900)."""
    day, year = struct.unpack("<HH", raw)
    day &= 0x1FF
    if year < 1950 or year > 2200 or not day:
        return None
    return (date(year, 1, 1) + timedelta(days=day - 1)).isoformat()


def _training(rec):
    """A player's individual training from his record in game_db, found by ProjectFM on the
    user's FM27 saves (27.1) by changing one setting at a time in game:

    - roles list "01 02 N 04" then N entries "05 <role u16> <date> ...": the last one is the
      in-possession role being trained (the u16 is role number x 64 + position number);
    - "01 03 <focus>": the training focus (FM's focus code, FF none);
    - "01 01 <date> 00 00 <oop i16>": the out-of-possession role (FM's out-of-possession role
      number minus 32; 50 is None);
    - then the intensity byte (FF automatic, 0 half, 1 normal, 2 double) and, 20 bytes on,
      the first day back from a rest (no pitch or gym work): 2 days set on 19 Dec is 22 Dec.
    Anything not found is left out."""
    out = {}
    m = _TRAINING_ROLES.search(rec, 0, 1400)
    if not m:
        return out
    at = m.start() + 4
    role = None
    for _ in range(m.group(1)[0]):
        if rec[at:at + 1] != b"\x05":
            break
        role = struct.unpack_from("<H", rec, at + 1)[0]
        more = rec[at + 23] if at + 23 < len(rec) else 1
        at += 24
        if more != 4:
            break
    if role is not None:
        out["ipRole"] = role
    keep = _TRAINING_KEEP.search(rec, at, at + 1200)
    if not keep:
        return out
    k = keep.end()
    out["oopRole"] = struct.unpack_from("<h", rec, k)[0]
    focus = rec.rfind(b"\x01\x03", max(at, k - 40), k)
    out["focus"] = None if focus < 0 or rec[focus + 2] == 0xFF else rec[focus + 2]
    inten = _TRAINING_INTENSITY.search(rec, k, k + 90)
    if inten:
        i = inten.start()
        out["intensity"] = {0xFF: "auto", 0: "half", 1: "normal", 2: "double"}[rec[i]]
        out["restUntil"] = _date(rec[i + 20:i + 24])
    return out


def _training_by_uid(save, uids):
    """Individual training of these players (by person uid)."""
    records = save._context.player_records()
    offsets = records.record_offsets
    out = {}
    with save._context.section("game_db") as game_db:
        for k, uid in enumerate(records.uids):
            if uid not in uids:
                continue
            end = offsets[k + 1] if k + 1 < len(offsets) else offsets[k] + 6000
            try:
                out[uid] = _training(bytes(game_db[offsets[k]:end]))
            except Exception:
                out[uid] = {}
    return out

def _pid(person):
    """A person's ID as FM shows it: the database unique ID. People the game made (newgens,
    regens) have none in fmsave, so they were left out everywhere; FM shows their record ID
    plus one (checked on three Fiorentina youth players: record 2002049883 is FM's
    2002049884, and so on), so they get that."""
    return person.unique_id if person.unique_id is not None else person.uid + 1

def _note_chain_record(self, game_db, offset):
    selector = struct.unpack_from("<I", game_db, offset + self.selector_offset)[0]
    _CHAIN_RECORDS.append((selector - 1, game_db[offset - 12]))
    return _decode_chain_record(self, game_db, offset)


_contracts.ContractDecoder.decode_chain_record = _note_chain_record

# Morale (1-20, as the ProjectFM Reader reads it) is the byte 97 into a player's record:
# matched all 46 players of the user's squad.
_MORALE_OFFSET = 97


def _plain(v):
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    label = getattr(v, "label", None)  # fmsave CodedValue: use the enum name, e.g. "regular_starter"
    if label is not None:
        return getattr(label, "name", str(label)).lower()
    if hasattr(v, "name") and hasattr(v, "value"):  # plain enum
        return v.name.lower()
    return str(v)


# Raised whenever extract() returns new data, so the app can spot an outdated copy
READER_VERSION = 25

JOB_SCOUT, JOB_CHIEF_SCOUT = 14, 44
_FF8 = b"\xff" * 8


def _knowledge(game_db, uid, nation_db_ids):
    """A staff member's scouting knowledge: [(nation database id, value 0-100)].

    Not read by fmsave. Found by ProjectFM in FM27 saves: after the person's header
    (uid twice) comes `01 01 <count>` and then `count` 39-byte entries:
    [?][04][nation u16][6 x 00][two 8-byte ids][value][date: day u16, year u16][8 x ff].
    Checked against FM27's staff screen for 5 scouts (100 = Complete).
    """
    head = game_db.find(struct.pack("<II", uid, uid))
    if head < 0:
        return []
    for p in range(head + 8, min(head + 600, len(game_db))):
        n = game_db[p]
        if not 1 <= n <= 100 or game_db[p - 2:p] != b"\x01\x01":
            continue
        out = []
        for k in range(n):
            e = p + 1 + 39 * k
            if game_db[e + 1] != 4 or game_db[e + 31:e + 39] != _FF8:
                break
            nation = struct.unpack_from("<H", game_db, e + 2)[0]
            out.append({"nation": nation_db_ids.get(nation), "value": game_db[e + 26]})
        if len(out) == n:
            return out
    return []


# Board members are not staff on FM's staff screen
_BOARD_JOBS = {4, 6, 8}


def _all_staff(save, club_uid):
    """Every member of the club's staff, all teams (FM's Coaching / Recruitment / Medical)."""
    nation_db_ids = {n.nation_id: n.database_id for n in save.nations()}
    out = []
    for s in save.staff():
        job = getattr(s.job, "raw", None)
        if s.club_uid != club_uid or job is None or job in _BOARD_JOBS:
            continue
        out.append({
            "uniqueId": _pid(s),
            "name": s.name,
            "lastName": getattr(s, "last_name", None),
            "commonName": getattr(s, "common_name", None),
            "age": s.age,
            "nation": nation_db_ids.get(s.nation_id) if s.nation_id is not None else None,
            "job": job,
            "team": s.team_slot or 0,
            "attributes": asdict(s.attributes) if is_dataclass(s.attributes) else None,
            "personality": asdict(s.personality) if is_dataclass(s.personality) else None,
            "contractEnd": s.contract_end.isoformat() if getattr(s, "contract_end", None) else None,
            "wage": getattr(s, "wage", None),
        })
    return out


def _scouts(save, club_uid):
    nation_db_ids = {n.nation_id: n.database_id for n in save.nations()}
    staff = [
        s for s in save.staff()
        if s.club_uid == club_uid and getattr(s.job, "raw", None) in (JOB_SCOUT, JOB_CHIEF_SCOUT)
    ]
    out = []
    with save._context.section("game_db") as game_db:
        for s in staff:
            out.append({
                "uniqueId": _pid(s),
                "name": s.name,
                "age": s.age,
                "chief": s.job.raw == JOB_CHIEF_SCOUT,
                "attributes": asdict(s.attributes) if is_dataclass(s.attributes) else None,
                "personality": asdict(s.personality) if is_dataclass(s.personality) else None,
                "knowledge": _knowledge(game_db, s.uid, nation_db_ids),
            })
    return out


def _camel(name):
    return {"free_kick_taking": "FreeKicks"}.get(name) or "".join(w.title() for w in name.split("_"))


_POSITION = {"STC": "ST"}
_PERSONALITY = (
    "ambition", "loyalty", "professionalism", "adaptability",
    "pressure", "sportsmanship", "temperament", "controversy",
)


def _squad_numbers_and_morale(save):
    """{player uid: (squad number or None, morale or None)}."""
    _CHAIN_RECORDS.clear()
    list(save.contracts())
    if not _CHAIN_RECORDS:  # contracts were read earlier: read them again
        save._context._cache.clear()
        list(save.contracts())
    number_by_pindex = {}
    for pindex, number in _CHAIN_RECORDS:
        if 0 < number < 100:
            number_by_pindex[pindex] = number
    records = save._context.player_records()
    out = {}
    with save._context.section("game_db") as game_db:
        for k, uid in enumerate(records.uids):
            morale = game_db[records.record_offsets[k] + _MORALE_OFFSET]
            out[uid] = (number_by_pindex.get(records.pindexes[k]), morale if 1 <= morale <= 20 else None)
    return out


def _leagues(save, clubs):
    """Each club's domestic league and every league's strength.

    A club's league is the largest league table it is in whose clubs mostly (80%+) come from
    one nation, so continental league phases and groups do not count. A league's strength is
    the average reputation of its clubs (the save stores no league reputation).
    League ids are FM's competition database ids (32 = Serie A).
    Returns ({club uid: league id}, {league id: {name, nation (FM database id), clubs, rep}}).
    """
    nation = {c.uid: c.nation_id for c in clubs}
    rep = {c.uid: c.reputation for c in clubs}
    nation_db = {n.nation_id: n.database_id for n in save.nations()}
    try:
        comp_name = {c.id: c.name for c in save.competitions()}
        comp_db = {c.id: c.database_id for c in save.competitions()}
    except Exception:
        comp_name, comp_db = {}, {}
    best = {}
    for t in save.league_tables():
        uids = [r.club_uid for r in t.rows if r.club_uid is not None and not r.team_slot]
        if len(uids) < 4 or t.competition_id is None:
            continue
        counts = {}
        for u in uids:
            counts[nation.get(u)] = counts.get(nation.get(u), 0) + 1
        if max(counts.values()) < 0.8 * len(uids):
            continue
        for u in uids:
            if u not in best or len(uids) > best[u][1]:
                best[u] = (t, len(uids))
    league_of, leagues = {}, {}
    for u, (t, _) in best.items():
        lid = comp_db.get(t.competition_id) or t.competition_id
        league_of[u] = lid
        if lid not in leagues:
            members = [r.club_uid for r in t.rows if r.club_uid is not None and not r.team_slot]
            reps = [rep.get(m) for m in members if rep.get(m)]
            nats = [nation.get(m) for m in members]
            main = max(set(nats), key=nats.count) if nats else None
            leagues[lid] = {
                "nation": nation_db.get(main),
                "name": t.competition_name or comp_name.get(t.competition_id),
                "clubs": len(members),
                "rep": round(sum(reps) / len(reps)) if reps else None,
            }
    return league_of, {str(k): v for k, v in leagues.items()}


def _dump(save, club_uid, club_name, extras):
    """Every player in the same shape as a ProjectFM Reader dump.json (players only).

    Nations are FM database ids (`natDb`); the app turns them into names.
    """
    nation_db_ids = {n.nation_id: n.database_id for n in save.nations()}
    # Club Unique IDs (the game database ids, as picture sites use them) and reputations
    try:
        clubs = list(save.clubs())
        club_ids = {c.uid: c.unique_id for c in clubs}
        club_rep = {c.uid: c.reputation for c in clubs}
        # Based in: the nation whose football association the club belongs to (Toronto FC:
        # Canada, though it plays in the US league); older fmsave: the league's nation
        club_nation = {
            c.uid: nation_db_ids.get(getattr(c, "fa_nation_id", None) or c.nation_id)
            for c in clubs
        }
    except Exception:
        clubs, club_ids, club_rep, club_nation = [], {}, {}, {}
    try:
        league_of, leagues = _leagues(save, clubs)
    except Exception:
        league_of, leagues = {}, {}
    contracts = {}
    for c in save.contracts():
        contracts.setdefault(c.player_uid, c)
    players = []
    for p in save.players():
        if not p.name or _pid(p) is None:
            continue
        rep = p.reputation.world if p.reputation else None
        if p.club_uid is None and (rep is None or rep == 0xFFFF):
            continue
        c = contracts.get(p.uid)
        a = p.attributes
        attrs = {_camel(k): v for k, v in (asdict(a).items() if is_dataclass(a) else ())}
        pos = p.positions
        nats = [p.nation_id, *p.second_nation_ids]
        row = {
            "id": _pid(p),
            "name": p.name,
            "lastName": p.last_name,
            "commonName": p.common_name,
            "age": p.age,
            "natDb": [nation_db_ids.get(n) for n in nats if n is not None],
            "club": p.club_name,
            "clubId": club_ids.get(p.club_uid) if p.club_uid is not None else None,
            "clubRep": club_rep.get(p.club_uid) if p.club_uid is not None else None,
            "league": league_of.get(p.club_uid) if p.club_uid is not None else None,
            "basedDb": club_nation.get(p.club_uid) if p.club_uid is not None else None,
            "dob": p.birth_date.isoformat() if p.birth_date else None,
            "ca": p.ability.current if p.ability else None,
            "pa": p.ability.potential if p.ability else None,
            "height": p.height_cm or None,
            "posArr": [_POSITION.get(x, x) for x in (*p.natural_positions, *p.accomplished_positions)],
            "teamType": p.team_slot or 0,
            "footLeft": p.left_foot,
            "footRight": p.right_foot,
            "condition": p.raw_condition,
            "posRatings": {_POSITION.get(k.upper(), k.upper()): v for k, v in asdict(pos).items()}
            if is_dataclass(pos) else None,
            "attrs": attrs,
            "value": p.transfer_value,
            "wage": c.wage if c else None,
            "expires": c.end.isoformat() if c and c.end else None,
            "worldRep": rep,
        }
        number, morale = extras.get(p.uid, (None, None))
        if number is not None:
            row["squadNo"] = number
        if morale is not None:
            row["morale"] = morale
        if p.personality is not None:
            for k in _PERSONALITY:
                row[k] = getattr(p.personality, k, None)
        traits = [t.raw for t in (getattr(p, "traits", None) or ())]
        if traits:
            row["traits"] = traits
        players.append(row)
    return {
        "leagues": leagues,
        "meta": {
            "game": "FM27",
            "gameDate": save.info.game_date,
            "myClub": club_name,
            "currency": "GBP",
            "source": "FM save",
            "projectfm": 1,
        },
        "players": players,
        "staff": [],
    }


def _raw(v):
    """A CodedValue's raw number (FM's own code), or None."""
    return getattr(v, "raw", None) if v is not None else None


# Competitions with more fixtures than this (world friendlies) keep only the club's games
_MAX_ALL_FIXTURES = 1500


def _competitions(save, club_uid, club_name):
    """Every competition the first team plays in this season: its fixtures and results,
    stages (cup rounds, groups) and per-player match stats."""
    fixtures = list(save.fixtures())
    try:
        events = _fixture_events(save)
    except Exception:  # a bonus: the competitions still import without goal times
        events = {}
    mine = [
        f for f in fixtures
        if (f.home_club_uid == club_uid and (f.home_team_slot or 0) == 0)
        or (f.away_club_uid == club_uid and (f.away_team_slot or 0) == 0)
    ]
    comp_ids = {f.competition_id for f in mine if f.competition_id is not None}
    comps = {c.id: c for c in save.competitions() if c.id in comp_ids}
    stages = [s for s in save.stages() if s.competition_id in comp_ids]
    by_comp = {}
    for f in fixtures:
        if f.competition_id in comp_ids:
            by_comp.setdefault(f.competition_id, []).append(f)

    def fixture_row(f):
        return {
            "stage": f.stage_id,
            "round": _raw(f.round),
            "roundIndex": f.round_index,
            "date": f.date.isoformat() if f.date else None,
            "time": f.kick_off_time.strftime("%H:%M") if f.kick_off_time else None,
            "season": f.season_start_year,
            "home": f.home_club_uid,
            "homeName": f.home_club_name,
            "homeShort": f.home_club_short_name,
            "homeSlot": f.home_team_slot,
            "away": f.away_club_uid,
            "awayName": f.away_club_name,
            "awayShort": f.away_club_short_name,
            "awaySlot": f.away_team_slot,
            "hg": f.home_goals,
            "ag": f.away_goals,
            "played": f.played,
            "neutral": f.is_neutral_venue,
            "stadium": f.stadium_name,
            "leg": f.unknown.get("leg") if f.unknown else None,
            **events.get((f.home_team_id, f.away_team_id, f.date), {}),
        }

    out = []
    for cid, comp in comps.items():
        fx = by_comp.get(cid, [])
        only_mine = len(fx) > _MAX_ALL_FIXTURES
        if only_mine:
            fx = [f for f in fx if f in mine]
        out.append({
            "id": cid,
            "databaseId": comp.database_id,
            "onlyMine": only_mine,
            "stages": [
                {"id": s.id, "round": _raw(s.round), "group": s.group_id, "previous": s.previous_stage_id}
                for s in stages if s.competition_id == cid
            ],
            "fixtures": [fixture_row(f) for f in sorted(fx, key=lambda f: (f.date or 0, f.kick_off_time or 0))],
        })

    # Per-player match stats in these competitions (FM keeps them for the teams it follows)
    players = {p.uid: p for p in save.players()}
    stats = []
    for m in save.player_match_stats():
        if m.competition_id not in comp_ids:
            continue
        p = players.get(m.player_uid)
        stats.append({
            "comp": m.competition_id,
            "date": m.date.isoformat(),
            "uniqueId": _pid(p) if p else None,
            "name": m.player_name,
            "club": p.club_uid if p else None,
            "clubName": p.club_short_name if p else None,
            "opponent": m.opponent_club_uid,
            "minutes": m.minutes,
            "leftAt": m.left_at_minute,
            "goals": m.goals,
            "assists": m.assists,
            "rating": m.rating,
            "position": _raw(m.position),
            # The position played: a one-bit mask in the same bit order as tactic positions
            # (checked on the user's save against 1,800 rows: each bit's players play there)
            "pos": _match_position(_raw(m.position)),
            "entered": getattr(m, "entered_at_minute", None),
            "passes": m.passes_attempted,
            "passesDone": m.passes_completed,
        })
    seasons = [f.season_start_year for f in mine if f.season_start_year]
    try:
        squads = _matchday_squads(save, club_uid, [f for fx in by_comp.values() for f in fx])
    except Exception:
        squads = []
    try:
        injuries = _injuries(save, club_uid)
    except Exception:
        injuries = []
    return {
        "squads": squads,
        "injuries": injuries,
        "club": club_uid,
        "clubName": club_name,
        "season": max(set(seasons), key=seasons.count) if seasons else None,
        "competitions": out,
        "playerMatches": stats,
    }


# Tactic position bits (fmsave names 11 of them; 5 and 6 are the wing-backs, 10 is M (C)).
# The app decodes the whole stored number (with its left/right flags) from Settings > FM codes.
def _match_position(mask):
    """FM position code of a match row's one-bit position mask, or None."""
    if not isinstance(mask, int) or mask <= 0 or mask & (mask - 1):
        return None
    return _TACTIC_POSITION.get(mask.bit_length() - 1)


_TACTIC_POSITION = {
    0: "GK", 2: "DR", 3: "DL", 4: "DC", 5: "WBR", 6: "WBL", 7: "DM", 8: "MR", 9: "ML", 10: "MC",
    11: "AMR", 12: "AML", 13: "AMC", 14: "ST",
}


def _slot_codes(role_bits, trail_bits, settings):
    """A slot block's role number, player instruction bits and marked position.

    fmsave slices the block as: first key (8 bytes), units of 24 bytes, trail (4 bytes). FM
    writes it as: count, then per entry a role key (8 bytes) followed by its player
    instructions (02 02 02, 8-byte bits, FF, 4-byte marked position), then 4 zero bytes and
    the active role number (8 bytes). So a unit's head byte and first field are an entry's
    instruction bits, its second field holds the marked position and the next entry's key; the
    last unit's top word and the trail hold the active role number. The entry whose key is
    the active role carries the instructions in use.
    """
    if not settings:
        role = ((role_bits or 0) >> 32) | ((trail_bits or 0) << 32)
        return str(role), None, None
    last = settings[-1]
    role = last.second_bits_high | ((trail_bits or 0) << 32)
    keys = [role_bits or 0] + [u.second_bits_middle | (u.second_bits_high << 32) for u in settings[:-1]]
    mask = 0xFFFFFFFBF91FFFFF
    pick = next((i for i, k in enumerate(keys) if k & mask == role & mask), len(settings) - 1)
    unit = settings[pick]
    bits = unit.head_byte | (unit.first_bits << 8)
    return str(role), str(bits), unit.second_bits_low


def _tactics(save, club_uid):
    """The first team's tactics (formation, style, mentality, roles, instructions) and selection."""
    players = {p.uid: _pid(p) for p in save.players() if p.club_uid == club_uid}
    out = []
    for t in save.tactics():
        if t.club_uid != club_uid or (t.team_slot or 0) != 0:
            continue
        slots = []
        for s in t.slots:
            raw = [_raw(x) for x in s.in_possession_positions]
            raw_oop = [_raw(x) for x in s.out_of_possession_positions]
            u = s.unknown or {}
            role, pi, _ = _slot_codes(u.get("in_possession_role_bits"), u.get("in_possession_trail_bits"),
                                      s.in_possession_settings)
            role_oop, pi_oop, mark_oop = _slot_codes(u.get("out_of_possession_role_bits"),
                                                     u.get("out_of_possession_trail_bits"),
                                                     s.out_of_possession_settings)
            slots.append({
                "number": s.number,
                "position": _TACTIC_POSITION.get(raw[0]) if raw else None,
                "positionOop": _TACTIC_POSITION.get(raw_oop[0]) if raw_oop else None,
                "mask": s.in_possession_mask,
                "maskOop": s.out_of_possession_mask,
                "role": role,
                "roleOop": role_oop,
                "pi": pi,
                "piOop": pi_oop,
                "markOop": mark_oop,
            })
        out.append({
            "index": t.index,
            "name": t.name,
            "style": t.style_name,
            "mentality": _plain(t.mentality),
            "instructionCodes": [v for k, v in sorted((t.unknown or {}).items()) if k.startswith("team_instruction_")],
            "slots": slots,
        })
    selection = [
        {"slot": s.slot, "substitute": s.substitute, "uniqueId": players.get(s.player_uid), "name": s.player_name}
        for s in save.selections()
        if s.club_uid == club_uid and (s.team_slot or 0) == 0
    ]
    return {"tactics": out, "selection": selection}


def _substitutions(report, squads):
    """Who replaced whom, from the list of the managed team's touchline actions at the end of
    its match reports (found by ProjectFM in FM27 saves). A substitution is: 04, time (u32),
    team (0 home, 1 away), minute, slot going off, slot coming on, where slots are the order of
    the squad's player records (0-10 the starting XI). Kept only when both players' own records
    agree (one went off and the other came on at that minute). Only the managed team's
    substitutions are in this list.
    """
    import re

    sides = (squads.home, squads.away)
    tail = max(sides[0][-1], sides[1][-1]) + 250
    found = []
    seen = set()
    for m in re.finditer(rb"(?=\x04(.{4})([\x00\x01])(.)(.)(.))", report[tail:], re.S):
        team, minute, off, on = m.group(2)[0], m.group(3)[0], m.group(4)[0], m.group(5)[0]
        side = sides[team]
        if not minute or off == on or off >= len(side) or not 11 <= on < len(side) or (team, on) in seen:
            continue
        if report[side[off] - 33] == minute and report[side[on] - 29] == minute:
            seen.add((team, on))
            found.append((team, off, on))
    return found


# FM27 27.1.0 put 5 more bytes in each player record of a match report, right after byte +35
# from the anchor (found by ProjectFM on the user's 27.1.0 save: records 222 -> 227 bytes, the
# match rating moved from +36 to +41, everything before +35 unchanged; the team block before
# each squad, read backwards from its first record, is the same). fmsave 0.14 only knows
# the 27.0 layout, so reports are framed with it first and with it moved by 5 bytes if that
# fails.
_REPORT_INSERT_AT = 35
_REPORT_INSERT = 5


def _shifted_layout(layout, by):
    import dataclasses

    def move(o):
        return o + by if o >= _REPORT_INSERT_AT else o

    changes = {
        "record_bytes": layout.record_bytes + by,
        "event_count_offset": move(layout.event_count_offset),
        "player_fields": tuple((n, t, move(o)) for n, t, o in layout.player_fields),
    }
    for name in ("distance_field", "progressive_passes_field"):
        t, o = getattr(layout, name)
        changes[name] = (t, move(o))
    return dataclasses.replace(layout, **changes)


def _matchday_squads(save, club_uid, fixtures):
    """Both matchday squads of every match FM keeps a report for, with each player's stats.

    Player records found by ProjectFM in FM27 reports (fmsave frames the records; offsets
    from each record's anchor): player record index + 1 (u32) at -99, goals -80, xG (f32)
    -75, shots -59, on target -58, yellow -37, red -36, assists -44, minute subbed off -33
    (0 = played on), minute came on -29 (0 = started or unused), passes attempted -14 and
    completed -13, tackles -8 / won -7, aerial challenges -5 / won -4, match rating (u16,
    x100) +36 (+41 from 27.1.0). The first eleven records of a squad are the starting XI. Checked against
    fmsave's own per-player match rows on 267 players (exact) and the subs on 771 team sheets.
    """
    import re
    from fmsave.readers import team_match_stats as T
    from fmsave._layouts import MatchReportLayout, find_layout
    from fmsave.readers._common import MATCH_REPORTS_SECTION

    if save.info.game != "FM27":
        return []
    # The report layout of this save's build (or the closest earlier one with the same schema)
    info = save._context.info
    schema = info.section_schemas.get(MATCH_REPORTS_SECTION)
    if schema is None:
        return []
    layout = find_layout(MatchReportLayout, MATCH_REPORTS_SECTION, schema, info.build).layout
    by_key = {}
    for f in fixtures:
        if f.played:
            by_key[(f.home_team_id, f.away_team_id, f.date)] = f
    if not by_key:
        return []
    by_uid = {p.uid: p for p in save.players()}
    records = save._context.player_records()
    person = {}
    for k, uid in enumerate(records.uids):
        p = by_uid.get(uid)
        person[records.pindexes[k] + 1] = (_pid(p) if p else None, p.name if p else None)
    try:
        named = _named_team_stats(save)
    except Exception:
        named = {}
    seed = re.compile(b"(?=" + re.escape(layout.anchor_run) + b")")
    # 27.0 layout, then the 27.1 one (5 more bytes per player record)
    layouts = [(layout, 0), (_shifted_layout(layout, _REPORT_INSERT), _REPORT_INSERT)]
    out = []

    def player(report, a, starter, shift):
        def b(o):
            return report[a + o]

        uid, name = person.get(struct.unpack_from("<I", report, a - 99)[0], (None, None))
        rating = struct.unpack_from("<H", report, a + 36 + shift)[0]
        # Unused substitutes carry a default rating: they did not play
        if not starter and not report[a - 29]:
            rating = 0
        return {
            "id": uid,
            "name": name,
            "start": starter,
            "rating": rating / 100 if 0 < rating <= 1000 else None,
            "goals": b(-80),
            "assists": b(-44),
            "on": b(-29) or None,
            "off": b(-33) or None,
            "shots": b(-59),
            "onTarget": b(-58),
            "xg": round(struct.unpack_from("<f", report, a - 75)[0], 2),
            "passes": b(-14),
            "passesDone": b(-13),
            "tackles": b(-8),
            "tacklesWon": b(-7),
            "aerials": b(-5),
            "headersWon": b(-4),
            "yellow": b(-37),
            "red": b(-36),
            # Position played (one-bit mask at +10, starters and substitutes; checked on 800
            # line-ups of the user's save)
            "pos": _match_position(struct.unpack_from("<H", report, a + 10)[0]),
        }

    with save._context.section("match_stats_cfg") as section:
        for start, size in T.index_entries(section, layout, "save"):
            report = T._decompress(memoryview(section)[start:start + size], layout)
            head = T._header(report, layout) if report else None
            if head is None:
                continue
            f = by_key.get((head.home_team_id, head.away_team_id, head.kick_off.date()))
            if f is None:
                continue
            squads = shift = None
            for lay, by in layouts:
                squads = T._squads(report, lay, seed)
                if squads is not None:
                    shift = by
                    break
            if squads is None:
                continue
            sides = {}
            for side, anchors in (("home", squads.home), ("away", squads.away)):
                sides[side] = [player(report, a, i < 11, shift) for i, a in enumerate(anchors)]
            # Team stats: fmsave's when it framed this report, else worked out the same way
            # with the layout that framed it (27.1 reports)
            home_team = named.get((head.home_team_id, head.away_team_id, f.date, True))
            away_team = named.get((head.home_team_id, head.away_team_id, f.date, False))
            if home_team is None or away_team is None:
                try:
                    home_team, away_team = _team_rows(T, report, squads, lay)
                except Exception:
                    pass
            for team, off_slot, on_slot in _substitutions(report, squads):
                lineup = sides["home" if team == 0 else "away"]
                went, came = lineup[off_slot], lineup[on_slot]
                came["for"] = went["name"]
                went["replacedBy"] = came["name"]
            out.append({
                "date": f.date.isoformat(),
                "home": f.home_club_uid,
                "away": f.away_club_uid,
                "homeTeam": home_team,
                "awayTeam": away_team,
                "homePlayers": sides["home"],
                "awayPlayers": sides["away"],
                # Older app versions read these
                "homeSquad": [p["id"] for p in sides["home"] if p["id"]],
                "awaySquad": [p["id"] for p in sides["away"] if p["id"]],
                "homeXI": [p["id"] for p in sides["home"] if p["start"] and p["id"]],
                "awayXI": [p["id"] for p in sides["away"] if p["start"] and p["id"]],
                "homeBench": [p["id"] for p in sides["home"] if not p["start"] and p["id"]],
                "awayBench": [p["id"] for p in sides["away"] if not p["start"] and p["id"]],
                "names": {str(p["id"]): p["name"] for p in sides["home"] + sides["away"] if p["id"]},
            })
    return out


# Goal and shoot-out events (found by ProjectFM in FM27 saves). Each played fixture has a
# result packet stored just before the NEXT fixture record (fmsave reads its score). Packet:
# 1f, ..., +5 home goals, +7 home shoot-out goals (ff = none), +9 away goals, +11 away
# shoot-out goals, +25 event count (u32), then 16-byte events: scorer (u32), assister
# (i32, -1 none) as player record index + 1, time (u32), side (0 home, 1 away), type, minute, added minutes.
# Types: 0 goal, 1 own goal (counts for the side, scorer from the other team), 2 penalty,
# 3 not a goal (likely a missed penalty), 4 / 5 shoot-out kick scored / missed. Checked
# on 1,700 fixtures (goals add up to the score) and Cremonese 1-1 Sampdoria (6-5 pens).
def _fixture_events(save):
    import fmsave._save as S
    from fmsave.readers import fm27_span as span_mod

    if save.info.game != "FM27":
        return {}
    span = save.experimental_span()
    limits = span_mod.Fm27SpanLimits()
    frames = S.read_region_frames_bounded(
        save._require_open(),
        S.SPAN_REGION,
        maximum_frames=limits.maximum_frames,
        maximum_decompressed_bytes=limits.maximum_span_bytes,
        maximum_frame_output_bytes=limits.maximum_frame_bytes,
    )
    data, _ = span_mod._buffer_frames(frames, limits)
    owner = {}
    for c in span.fixtures:
        nxt = span_mod._next_core(data, c.offset, len(data), limits)
        if nxt and nxt[1]:
            owner[nxt[0]] = c.offset + 54
    # Event person ids are the player's record index + 1
    by_uid = {p.uid: p.name for p in save.players()}
    records = save._context.player_records()
    names = {records.pindexes[k] + 1: by_uid.get(uid) for k, uid in enumerate(records.uids)}
    out = {}
    for f in span.fixtures:
        pk = owner.get(f.offset)
        if pk is None or data[pk] != 31:
            continue
        hg, ag = data[pk + 5], data[pk + 9]
        if max(hg, ag) > 40:
            continue
        n = struct.unpack_from("<I", data, pk + 25)[0]
        evs = []
        for k in range(min(n, 60)):
            at = pk + 29 + 16 * k
            scorer, assist = struct.unpack_from("<Ii", data, at)
            evs.append([
                data[at + 12], data[at + 13], data[at + 14], data[at + 15],
                names.get(scorer), names.get(assist) if assist >= 0 else None,
            ])
        row = {}
        if evs:
            row["events"] = evs
        hp, ap = data[pk + 7], data[pk + 11]
        if hp != 255 and ap != 255:
            row["pens"] = [hp, ap]
        if row:
            out[(f.home_team_id, f.away_team_id, f.date)] = row
    return out


# Team match stats as the save reader reads them (checked on the user's 27.0.1 saves: every
# number matched FM's match stats screens for Venezia and Ravenna); each block is only used
# when its passes agree with ProjectFM's own reading of the same report.
_NAMED_STATS = (
    "shots", "shots_on_target", "blocked_shots", "shots_outside_box", "clear_cut_chances",
    "woodwork", "fouls_made", "offsides", "yellow_cards", "red_cards", "crosses_attempted",
    "crosses_completed", "tackles_attempted", "tackles_completed",
    "aerial_challenges_attempted", "headers_won", "distance_km", "expected_goals",
    "non_penalty_expected_goals", "corners", "passes_attempted", "passes_completed",
    "final_third_passes", "progressive_passes", "possession_percent",
    "ball_distribution_percent",
)


def _team_rows(T, report, squads, layout):
    """Both teams' match stats from a framed report, as fmsave's team_match_stats works them out."""
    home = T._team_values(report, squads.home, squads.detailed, layout)
    away = T._team_values(report, squads.away, squads.detailed, layout)
    hp, ap = T._possession(int(home["passes_completed"] or 0), int(away["passes_completed"] or 0))
    hb, ab = T._shares_half_up(
        int(home.pop("ball_distribution_units") or 0), int(away.pop("ball_distribution_units") or 0)
    )
    rows = []
    for values, possession, ball in ((home, hp, hb), (away, ap, ab)):
        values = dict(values, possession_percent=possession, ball_distribution_percent=ball)
        d = {}
        for k in _NAMED_STATS:
            v = values.get(k)
            d[k] = round(v, 3) if isinstance(v, float) else v
        rows.append(d)
    return rows[0], rows[1]


def _named_team_stats(save):
    if save.info.game != "FM27":
        return {}
    rows = list(save.team_match_stats())
    out = {}
    for r in rows:
        d = {}
        for k in _NAMED_STATS:
            v = getattr(r, k, None)
            d[k] = round(v, 3) if isinstance(v, float) else v
        out[(r.home_team_id, r.away_team_id, r.date, r.is_home)] = d
    return out


def _injuries(save, club_uid):
    """Injuries recorded for the club's players (date, cause, severity; no duration)."""
    players = {p.uid: _pid(p) for p in save.players() if p.club_uid == club_uid}
    out = []
    for i in save.injuries():
        if i.club_uid != club_uid or i.player_uid not in players:
            continue
        out.append({
            "uniqueId": players[i.player_uid],
            "date": i.date.isoformat() if i.date else None,
            "cause": _plain(i.cause) if i.cause is not None else None,
            "severity": _plain(i.severity) if i.severity is not None else None,
            "type": i.type_name,
        })
    return out


# Season stats kept for every player in the game (the World stats), by competition kind
_WORLD_STAT_KINDS = ("overall", "league", "cup", "continental")
_WORLD_STAT_SKIP = {
    "player_uid", "player_name", "kind", "team_id", "club_uid", "club_name",
    "club_short_name", "team_slot", "minutes_since_last_goal",
}


def _world_stats(save, rows):
    """Every player's season stats in a compact table: field names once, then one row per
    player and competition kind ([unique id, kind index, values in field order]). Rows of
    one player at several clubs (a transfer or loan this season) are added together; the
    average rating is weighted by rated appearances."""
    from dataclasses import fields

    if not rows:
        return None
    names = [f.name for f in fields(rows[0]) if f.name not in _WORLD_STAT_SKIP
             and f.name not in set(getattr(type(rows[0]), "COMPUTED_FIELDS", ()) or ())]
    unique = {p.uid: _pid(p) for p in save.players()}
    acc = {}
    for r in rows:
        kind = _plain(r.kind)
        if kind not in _WORLD_STAT_KINDS:
            continue
        uid = unique.get(r.player_uid)
        if uid is None or not r.minutes:
            continue
        key = (uid, _WORLD_STAT_KINDS.index(kind))
        vals = [getattr(r, n, None) for n in names]
        vals = [v if isinstance(v, (int, float)) and v == v else 0 for v in vals]
        if key in acc:
            old = acc[key]
            ra, rb = old[names.index("rated_appearances")], vals[names.index("rated_appearances")]
            i = names.index("average_rating")
            rating = (old[i] * ra + vals[i] * rb) / (ra + rb) if ra + rb else 0
            acc[key] = [a + b for a, b in zip(old, vals)]
            acc[key][i] = rating
        else:
            acc[key] = vals
    out = []
    for (uid, k), vals in acc.items():
        out.append([uid, k, *[round(v, 2) if isinstance(v, float) else v for v in vals]])
    return {"kinds": list(_WORLD_STAT_KINDS), "fields": names, "rows": out}


def extract(path):
    with fmsave.open(path) as save:
        # First, so the contract records are noted the one time fmsave reads them
        try:
            extras = _squad_numbers_and_morale(save)
        except Exception:  # a bonus: never lose the import over it
            extras = {}
        clubs = save.managed_clubs()
        if not clubs:
            raise ValueError("No managed club found in this save.")
        club_uid = clubs[0].club_uid
        players = save.players().where(club_uid=club_uid)
        uid_to_unique = {p.uid: _pid(p) for p in players}
        out = {
            "reader": READER_VERSION,
            "club": clubs[0].club_name,
            "gameDate": save.info.game_date,
            "players": [],
            "contracts": [],
            "stats": [],
        }
        try:
            training = _training_by_uid(save, {p.uid for p in players})
        except Exception:
            training = {}
        for p in players:
            out["players"].append({
                "uniqueId": _pid(p),
                # Individual training (role, focus, intensity, rest), as far as it was found
                "training": training.get(p.uid) or None,
                "name": p.name,
                "leftFoot": p.left_foot,
                "rightFoot": p.right_foot,
                "personality": asdict(p.personality) if is_dataclass(p.personality) else None,
                # Trait bit numbers (FM's player traits); names are the app's
                "traits": [t.raw for t in (getattr(p, "traits", None) or ())],
            })
        # By player, not by the contract's club: that is empty on some contracts
        try:
            contracts = list(save.contracts())
        except Exception as e:  # never lose the squad import over one part of the save
            contracts = []
            out["contractsError"] = str(e)
        for c in contracts:
            uid = uid_to_unique.get(c.player_uid)
            if uid is None:
                continue
            out["contracts"].append({
                "uniqueId": uid,
                "wage": c.wage,
                "start": c.start,
                "end": c.end,
                "squadStatus": c.squad_status,
                "kind": c.kind,
                "onLoan": c.on_loan,
                "clauses": [
                    {"kind": cl.kind, "value": getattr(cl, "value", None)} for cl in (c.clauses or ())
                ],
            })
        try:
            season_stats = list(save.player_season_stats())
        except Exception as e:
            season_stats = []
            out["statsError"] = str(e)
        try:
            out["worldStats"] = _world_stats(save, season_stats)
        except Exception as e:  # a bonus: never lose the import over it
            out["worldStats"] = None
            out["worldStatsError"] = str(e)
        for st in season_stats:
            uid = uid_to_unique.get(st.player_uid)
            # This season's rows for your players at your club (not earlier clubs)
            if uid is None or st.club_uid not in (club_uid, None):
                continue
            row = asdict(st)
            row["uniqueId"] = uid
            out["stats"].append(row)
        out["dump"] = _dump(save, club_uid, clubs[0].club_name, extras)
        try:
            out["tactics"] = _tactics(save, club_uid)
        except Exception as e:
            out["tactics"] = None
            out["tacticsError"] = str(e)
        try:
            out["competitions"] = _competitions(save, club_uid, clubs[0].club_name)
        except Exception as e:  # never lose the rest of the import over it
            out["competitions"] = None
            out["competitionsError"] = str(e)
        try:
            out["staff"] = _all_staff(save, club_uid)
        except Exception as e:
            out["staff"] = []
            out["staffError"] = str(e)
        try:
            out["scouts"] = _scouts(save, club_uid)
        except Exception as e:  # scouts are a bonus: never lose the squad import over them
            out["scouts"] = []
            out["scoutsError"] = str(e)
        return json.dumps(out, default=_plain)


if __name__ == "__main__":
    import sys

    print(extract(sys.argv[1]))
