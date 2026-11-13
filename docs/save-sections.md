# FM27 save: what ProjectFM reads, and what is left to explore

Notes from reverse-engineering the user's FM27 save (build 27.0.1). Sizes are decompressed.
Kept so a later session can pick up any area without starting over.

## Read by the app today

| Data                                                                                           | Where                                   | How                                         |
| ---------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------- |
| Players, attributes, personality, contracts, season stats, staff, tactics, fixtures, finances… | many sections                           | fmsave readers (`public/fmsave/extract.py`) |
| Squad numbers, morale                                                                          | `game_db`                               | ProjectFM offsets (see extract.py)          |
| Goals, assists, penalty shoot-outs                                                             | fixture result packets (`game_db` span) | ProjectFM (`_fixture_events`)               |
| Team match stats                                                                               | `match_stats_cfg`                       | fmsave FM27 layout, forced for 27.0.1       |
| Every player's match stats, line-ups, on/off minutes                                           | `match_stats_cfg` player records        | ProjectFM offsets (`_matchday_squads`)      |
| Who replaced whom (managed team only)                                                          | end of the managed team's match reports | ProjectFM (`_substitutions`)                |

## Match reports (`match_stats_cfg`)

- Your own matches: full report (~270 KB): player records, team blocks, a "players who took
  part" list per team, the 2D replay data, and at the end a list of **your touchline actions**:
  substitutions `04 · time u32 · team · minute · slot off · slot on` (used), plus other event
  types (likely shape / mentality / instruction changes: tags `1b`, `0e`, `11`, `07`…). Not decoded.
- Opponents' substitutions: only "player joins" entries (incoming player, position, minute).
  No entry links him to the player he replaced. Checked: the replaced player's ID (pid, pindex,
  uid, unique) never appears within 64 bytes of the incoming one in any of the save's 70 sections.
  Not ruled out: the 2D replay data (who fills which pitch slot over time).
- Other clubs' matches: short summary reports (~12 KB) or ~89 KB snapshots without an event list.
- Per-player event lists in each record are **shots**: x, y (f32), type, minute, per shot.
  Not used yet (shot maps).

## Readable by fmsave but not used yet

finances (monthly, per club), player_season_history (career at previous clubs), sponsorships,
mentoring groups, training schedules, injuries history, job vacancies, league tables with
home/away and half splits, set pieces, facilities, transfer windows.

## Not explored (binary, needs reverse-engineering; hours per section)

| Section                        | Size    | Likely content                                         | User interest  |
| ------------------------------ | ------- | ------------------------------------------------------ | -------------- |
| scout_man                      | 0.2 MB  | Scout assignments and reports                          | **Yes (next)** |
| shortlist_man                  | 4.2 MB  | Shortlists                                             |                |
| transfer_man                   | 1.5 MB  | Transfer history, offers, rumours                      |                |
| interaction_manager            | 0.5 MB  | Promises, conversations                                |                |
| press_conference_manager       | 0.4 MB  | Press answers, media promises                          |                |
| backroom_advice_manager        | 0.06 MB | Staff meeting advice                                   |                |
| award_year_hist_*              | 0.2 MB  | Awards (player/manager of the month, team of the year) |                |
| comp_history_dt                | 3.8 MB  | Past winners of every competition                      |                |
| tc_record_man, person_record_* | ~30 MB  | Club and player records                                |                |
| hall_of_fame                   | 0.8 MB  | Hall of fame                                           |                |
| humans, manager_manager        | 1.9 MB  | Manager profile and history                            |                |
| news                           | 10 MB   | Inbox items (structured, ids; no match write-ups)      |                |

## scout_man (first pass)

- **Assignments**: name strings (user-made, e.g. "terzino sx", and "Serie A Enilive", "Serie BKT",
  "Head - Italy", "Head - Southern Europe", "Scout - Brazil, Argentina & Uruguay"…), each with a
  filter block of 4-letter tags stored reversed (`frlptlif`, `lvlf` level filters, `roip`, `rfsc`…).
- **Player lists with dates**: entries `02 · player pid (record index + 1) · date · 00000000 0100 6c07`.
  Date = u16 (low 9 bits: day of year) + u16 year (e.g. `c9 1a ea 07` = day 201 of 2026, 20 July).
  Runs of 2 to 291 players (young Italian prospects, Bundesliga, Ligue 1, South America…). Which
  assignment or scout a run belongs to is not settled: runs do not line up with the name before them.
- **~3,900 entries with three value pairs** `05 xx xx · 01 a b · 01 c d · 01 e f · 04 · u32 · player pid
· u32` (pairs like 17-19, 17-17, 18-18; `ff ff` = unknown), including every Fiorentina player.
  Likely the club's star estimates (value / 4 = stars, 20 = 5 stars) of ability and potential; the
  u32s either side look like values. To confirm against FM's screens.

## Tactics (`tactics_man`) and FM tactic files (.fmf)

Decoded from the user's own FM Tactic Generator (its role and instruction list is kept in
`docs/fm27-tactic-catalog.json`; the app's editable defaults are `src/tactics/fm-defaults.json`).

- **Team instructions:** fmsave's 19 `team_instruction_*` bytes. Byte 2 is the mentality
  (1 = Very Defensive … 7 = Very Attacking). Bytes 6–17 are a 96-bit field: each option is
  one bit (its code); an instruction with no bit set is on its standard option.
- **Slot block** (per slot, in and out of possession): `44 00 02`, position (u32: position bit
  plus bit 20 = left / bit 21 = right of a pair or trio), `00 01 01`, entry count (u32), then
  per entry a role key (u64) and its player instructions (`02 02 02`, u64 bits, `FF`, u32
  marked position), then u32 0 and the active role number (u64). The out-of-possession block
  ends with an index byte pairing it with an in-possession block.
- **Role:** the active role number with FM's flag bits removed (mask `0xFFFFFFFBF91FFFFF`).
  The entry whose key is that role carries the player instructions in use.
- fmsave slices the same bytes as: first key (8), 24-byte units (head byte + 7-byte field =
  the entry's instruction bits; 12-byte field = marked position + next key), trail (4) — see
  `_slot_codes` in `public/fmsave/extract.py`.
- **.fmf:** archive header `02 01 fmf. 08 00 00`, the tactic (`.tac`) and details (`.aom`)
  members as Zstandard frames, and a directory frame at the end. Written by
  `src/tactics/fmf.ts`; raw (uncompressed) Zstandard blocks are enough.
