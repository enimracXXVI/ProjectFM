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
READER_VERSION = 8

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
        squads = _matchday_squads(save, club_uid, mine)
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
            slots.append({
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
            "slots": slots,
        })
    selection = [
        {"slot": s.slot, "substitute": s.substitute, "uniqueId": players.get(s.player_uid), "name": s.player_name}
        for s in save.selections()
        if s.club_uid == club_uid and (s.team_slot or 0) == 0
    ]
    return {"tactics": out, "selection": selection}


def _team_block(report, team_id):
    """A team's statistics block in an FM27 match report (found by ProjectFM).

    Layout: 02, team id (u32), 4 + 8 bytes, 00 00, xG (f32), a variable list, then 24 u32
    counts, 36 byte counts, and u16 counts starting with passes attempted / completed.
    Returned raw so the app decides which number is which (checked against FM's match
    stats screen for Fiorentina 4-1 Venezia, and passes against the players' own totals).
    """
    pat = b"\x02" + struct.pack("<I", team_id)
    i = report.find(pat)
    while i != -1:
        q = i + 5
        if report[q + 13:q + 15] == b"\x00\x00" and 0 <= struct.unpack_from("<f", report, q + 15)[0] < 10:
            for c in range(q + 20, min(q + 400, len(report) - 240)):
                vals = struct.unpack_from("<24I", report, c)
                pa, pc = struct.unpack_from("<HH", report, c + 132)
                if max(vals) < 2000 and 100 < pa < 2000 and pc <= pa and vals[15] <= 40:
                    return {
                        "xg": round(struct.unpack_from("<f", report, q + 15)[0], 3),
                        "u": list(vals),
                        "b": list(report[c + 96:c + 132]),
                        "h": list(struct.unpack_from("<8H", report, c + 132)),
                        "h104": struct.unpack_from("<10H", report, c + 132 + 96),
                    }
        i = report.find(pat, i + 1)
    return None


def _lineup(report, uids):
    """(starting XI, bench) of one team in a match report, by Unique ID.

    The report opens with each team's starting XI as Unique IDs 50 bytes apart; every
    player of the matchday squad also has a record where his ID repeats 31 bytes later.
    """
    found = []
    for u in uids:
        pat = struct.pack("<I", u)
        i = report.find(pat)
        while i != -1:
            found.append((i, u))
            i = report.find(pat, i + 1)
    found.sort()
    at = {pos: u for pos, u in found}
    xi = []
    for pos, u in found:
        run = [u]
        nxt = pos + 50
        while nxt in at and len(run) < 11:
            run.append(at[nxt])
            nxt += 50
        if len(run) == 11:
            xi = run
            break
    squad = []
    for pos, u in found:
        if report[pos + 31:pos + 35] == struct.pack("<I", u) and u not in squad:
            squad.append(u)
    bench = [u for u in squad if u not in xi]
    return xi, bench


def _matchday_squads(save, club_uid, fixtures):
    """Who was in each of the club's matchday squads (Unique IDs), from FM's match reports.

    fmsave reads the report index and frames for FM27 but not the player records, so the
    squad is taken as the players of the two clubs whose Unique ID appears in the report.
    """
    from fmsave.readers.team_match_stats import index_entries, _decompress, _header
    from fmsave._layouts.fm26_26_3_2 import MATCH_REPORTS as layout

    mine = {}
    for f in fixtures:
        if club_uid in (f.home_club_uid, f.away_club_uid) and f.played:
            mine[(f.home_team_id, f.away_team_id, f.date)] = f
    if not mine:
        return []
    clubs = {}
    names = {}
    for p in save.players():
        if p.unique_id is not None and p.club_uid is not None:
            clubs.setdefault(p.club_uid, []).append(p.unique_id)
            names[p.unique_id] = p.name
    out = []
    with save._context.section("match_stats_cfg") as section:
        for start, size in index_entries(section, layout, "save"):
            report = _decompress(memoryview(section)[start:start + size], layout)
            head = _header(report, layout) if report else None
            if head is None:
                continue
            f = mine.get((head.home_team_id, head.away_team_id, head.kick_off.date()))
            if f is None:
                continue
            squads = {}
            lineups = {}
            for side, uid in (("home", f.home_club_uid), ("away", f.away_club_uid)):
                squads[side] = [u for u in clubs.get(uid, []) if struct.pack("<I", u) in report]
                lineups[side] = _lineup(report, squads[side])
            def block(team_id):
                try:
                    return _team_block(report, team_id)
                except Exception:
                    return None
            out.append({
                "date": f.date.isoformat(),
                "home": f.home_club_uid,
                "away": f.away_club_uid,
                "homeSquad": squads["home"],
                "awaySquad": squads["away"],
                "homeStats": block(head.home_team_id),
                "awayStats": block(head.away_team_id),
                "homeXI": lineups["home"][0],
                "homeBench": lineups["home"][1],
                "awayXI": lineups["away"][0],
                "awayBench": lineups["away"][1],
                "names": {str(u): names.get(u) for u in squads["home"] + squads["away"]},
            })
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
            out["scouts"] = _scouts(save, club_uid)
        except Exception as e:  # scouts are a bonus: never lose the squad import over them
            out["scouts"] = []
            out["scoutsError"] = str(e)
        return json.dumps(out, default=_plain)


if __name__ == "__main__":
    import sys

    print(extract(sys.argv[1]))
