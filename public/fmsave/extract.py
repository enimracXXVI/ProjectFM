"""ProjectFM: reads the managed club's squad from an FM save with fmsave (MIT).

Returns JSON with, per player (by FM Unique ID): feet, personality values, contract terms
and clauses, and this season's stats per competition kind. Also the club's scouts: their
attributes (Authority included) and scouting knowledge per nation.
"""
import json
import struct
from dataclasses import asdict, is_dataclass
from datetime import date, datetime

import fmsave
from fmsave.readers import contracts as _contracts

# Squad numbers sit on contract records, which fmsave decodes but does not expose: note
# where each one is (by player pindex) while fmsave reads them. Found by ProjectFM in FM27
# saves: the byte 12 before a contract record's tag (255 = no number). A loaned or newly
# bought player has two records; the number is on the one at the club he plays for.
_CHAIN_RECORDS = []
_decode_chain_record = _contracts.ContractDecoder.decode_chain_record


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
READER_VERSION = 12

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
            "uniqueId": s.unique_id,
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
                "uniqueId": s.unique_id,
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


def _dump(save, club_uid, club_name, extras):
    """Every player in the same shape as a ProjectFM Reader dump.json (players only).

    Nations are FM database ids (`natDb`); the app turns them into names.
    """
    nation_db_ids = {n.nation_id: n.database_id for n in save.nations()}
    contracts = {}
    for c in save.contracts():
        contracts.setdefault(c.player_uid, c)
    players = []
    for p in save.players():
        if not p.name or p.unique_id is None:
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
            "id": p.unique_id,
            "name": p.name,
            "lastName": p.last_name,
            "commonName": p.common_name,
            "age": p.age,
            "natDb": [nation_db_ids.get(n) for n in nats if n is not None],
            "club": p.club_name,
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
        players.append(row)
    return {
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
            "uniqueId": p.unique_id if p else None,
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


# Tactic position bits (fmsave names 11 of them). Bit 10 carries no name in fmsave; in the
# user's tactic it is the pair between DM and the AMs, flagged as left/right halves: M (C)
# (confirmed by the user on FM's tactic screen: CM and WCM).
_TACTIC_POSITION = {
    0: "GK", 2: "DR", 3: "DL", 4: "DC", 7: "DM", 8: "MR", 9: "ML", 10: "MC",
    11: "AMR", 12: "AML", 13: "AMC", 14: "ST",
}


def _tactics(save, club_uid):
    """The first team's tactics (formation, style, mentality) and current selection."""
    players = {p.uid: p.unique_id for p in save.players() if p.club_uid == club_uid}
    out = []
    for t in save.tactics():
        if t.club_uid != club_uid or (t.team_slot or 0) != 0:
            continue
        slots = []
        for s in t.slots:
            raw = [_raw(x) for x in s.in_possession_positions]
            raw_oop = [_raw(x) for x in s.out_of_possession_positions]
            u = s.unknown or {}

            def role(prefix, settings):
                # Role code plus its settings: one tactic is not enough to decode FM27's roles,
                # so the app matches this signature against roles the user confirmed
                return {
                    "bits": u.get(prefix + "_role_bits"),
                    "trail": u.get(prefix + "_trail_bits"),
                    "settings": [
                        [x.head_byte, x.first_bits, x.second_bits_low, x.second_bits_middle, x.second_bits_high]
                        for x in settings
                    ],
                }

            slots.append({
                "ipRole": role("in_possession", s.in_possession_settings),
                "oopRole": role("out_of_possession", s.out_of_possession_settings),
                "number": s.number,
                "position": _TACTIC_POSITION.get(raw[0]) if raw else None,
                "positionOop": _TACTIC_POSITION.get(raw_oop[0]) if raw_oop else None,
                "rawPosition": raw[0] if raw else None,
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


def _matchday_squads(save, club_uid, fixtures):
    """Both matchday squads of every match FM keeps a report for, with each player's stats.

    Player records found by ProjectFM in FM27 reports (fmsave frames the records; offsets
    from each record's anchor): player record index + 1 (u32) at -99, goals -80, xG (f32)
    -75, shots -59, on target -58, yellow -37, red -36, assists -44, minute subbed off -33
    (0 = played on), minute came on -29 (0 = started or unused), passes attempted -14 and
    completed -13, tackles -8 / won -7, aerial challenges -5 / won -4, match rating (u16,
    x100) +36. The first eleven records of a squad are the starting XI. Checked against
    fmsave's own per-player match rows on 267 players (exact) and the subs on 771 team sheets.
    """
    import re
    from fmsave.readers import team_match_stats as T
    from fmsave._layouts.fm27_27_0_0 import MATCH_REPORTS as layout

    if save.info.game != "FM27":
        return []
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
        person[records.pindexes[k] + 1] = (p.unique_id if p else None, p.name if p else None)
    try:
        named = _named_team_stats(save)
    except Exception:
        named = {}
    seed = re.compile(b"(?=" + re.escape(layout.anchor_run) + b")")
    out = []

    def player(report, a, starter):
        def b(o):
            return report[a + o]

        uid, name = person.get(struct.unpack_from("<I", report, a - 99)[0], (None, None))
        rating = struct.unpack_from("<H", report, a + 36)[0]
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
            squads = T._squads(report, layout, seed)
            if squads is None:
                continue
            sides = {}
            for side, anchors in (("home", squads.home), ("away", squads.away)):
                sides[side] = [player(report, a, i < 11) for i, a in enumerate(anchors)]
            out.append({
                "date": f.date.isoformat(),
                "home": f.home_club_uid,
                "away": f.away_club_uid,
                "homeTeam": named.get((head.home_team_id, head.away_team_id, f.date, True)),
                "awayTeam": named.get((head.home_team_id, head.away_team_id, f.date, False)),
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


# Team match stats with fmsave's own FM27 27.0.0 report layout. fmsave only enables it for
# that exact build; ProjectFM checked it on the user's 27.0.1 saves (every number it reads
# matched FM's match stats screens for Venezia and Ravenna), and each block is only used
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


def _named_team_stats(save):
    import fmsave._save as S
    from fmsave._layouts.fm27_27_0_0 import MATCH_REPORTS as fm27_reports

    if save.info.game != "FM27":
        return {}
    find = S.find_match_report_layout
    S.find_match_report_layout = lambda *a, **k: fm27_reports
    try:
        rows = list(save.team_match_stats())
    finally:
        S.find_match_report_layout = find
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
    players = {p.uid: p.unique_id for p in save.players() if p.club_uid == club_uid}
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
        uid_to_unique = {p.uid: p.unique_id for p in players}
        out = {
            "reader": READER_VERSION,
            "club": clubs[0].club_name,
            "gameDate": save.info.game_date,
            "players": [],
            "contracts": [],
            "stats": [],
        }
        for p in players:
            out["players"].append({
                "uniqueId": p.unique_id,
                "name": p.name,
                "leftFoot": p.left_foot,
                "rightFoot": p.right_foot,
                "personality": asdict(p.personality) if is_dataclass(p.personality) else None,
            })
        # By player, not by the contract's club: that is empty on some contracts
        for c in save.contracts():
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
        for st in save.player_season_stats():
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
