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
