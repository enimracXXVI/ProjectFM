"""ProjectFM: reads the managed club's squad from an FM save with fmsave (MIT).

Returns JSON with, per player (by FM Unique ID): feet, personality values, contract terms
and clauses, and this season's stats per competition kind.
"""
import json
from dataclasses import asdict, is_dataclass
from datetime import date, datetime

import fmsave


def _plain(v):
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    label = getattr(v, "label", None)  # fmsave CodedValue: use the enum name, e.g. "regular_starter"
    if label is not None:
        return getattr(label, "name", str(label)).lower()
    if hasattr(v, "name") and hasattr(v, "value"):  # plain enum
        return v.name.lower()
    return str(v)


def extract(path):
    with fmsave.open(path) as save:
        clubs = save.managed_clubs()
        if not clubs:
            raise ValueError("No managed club found in this save.")
        club_uid = clubs[0].club_uid
        players = save.players().where(club_uid=club_uid)
        uid_to_unique = {p.uid: p.unique_id for p in players}
        out = {
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
        return json.dumps(out, default=_plain)


if __name__ == "__main__":
    import sys

    print(extract(sys.argv[1]))
