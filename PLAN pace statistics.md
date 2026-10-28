# Pace Statistics – Feature List

Version: draft v1 (2026-10-28)
Language: ASD-STE100 (Simplified Technical English)

This file contains the functions of the pace statistics. The pace statistics show for each slot how fast the player does checks while the player can play. The time in BK, the breaks and the time before the unlock do not count. The technical plan is in `PLAN pace statistics implementation.md`.

## Glossary

The terms of the glossary in `PLAN slotlock.md` and `PLAN sphere checker.md` also apply.

| Term | Meaning |
|---|---|
| step | One interval of the checks history of Cheese (10 minutes). |
| active step | A step in which the checks of the slot increase. |
| quiet period | One or more steps without new checks between two active steps, or after the last active step. |
| BK period | A quiet period in which the player cannot do checks, because the player waits for an item. |
| break | A quiet period that is not a BK period and that is longer than the break limit. |
| short pause | A quiet period that is not a BK period and that is not longer than the break limit. It counts as play time. |
| bulk step | A step with more new checks than the bulk limit, for example from a release or from `/send_location`. |
| active time | Time of the active steps plus the short pauses. |
| pace | Checks per hour of active time. |

## 1. Access

1. Only admins and admin helpers of the room see the pace statistics. Players and visitors do not see them.
2. The pace statistics are a tab of the game control (`/control`).

## 2. Time range of a slot

1. Start: the unlock time of the slot. Start slots and slots that are not locked by a SlotLock slot start at the first point of the checks history.
2. A locked slot and a partially unlocked slot have no time range and show no values.
3. An unlocked slot without unlock time (source "unknown") starts at the first point of the checks history, as a start slot. The time before its first check is a quiet period. The table marks this ("start unknown").
4. End: the goal time of the slot. Slots without reached goal end at the current time.
5. A slot with reached goal and without goal time has no time range and shows no values. This occurs only if the slot reached its goal before the first synchronization of the room and Cheese gives no last activity for it.
6. Time before the start and after the end does not count.
7. An unlock time with the source "estimated" gives an estimated start. The table marks this.
8. The time from the start to the first check of the slot is a quiet period with the usual rules.
9. If the checks history of Cheese ends before the current time, the last quiet period ends at the last point of the history.

## 3. BK periods

A quiet period is a BK period if one of these signals applies:

1. **Item signal:** the slot receives a progression item in the quiet period or in the first active step after it. All progression items count: from other slots, from the own locations and from the server (for example `/send`). The time of the item comes from the Archipelago tracker of each synchronization. This signal does not need a seed upload.
2. **Status signal:** Cheese shows `bk` or `soft_bk` for the slot at a time in the quiet period.

Rules:

1. The new checks decide the end of a BK period, not the status in Cheese. A player who gets an item, does some checks and does not change the status in Cheese is not in BK during these checks.
2. A BK period starts with the last active step before it, also if the player clicks "BK" in Cheese later.
3. A BK period has no minimum length.
4. A quiet period at the end of the time range (no new check up to now) is a BK period only with the status signal. Else it is a break or a short pause.
5. The signals need synchronizations. Before the first synchronization of the room, there are no signals. Quiet periods that end before the first synchronization are breaks or short pauses. A quiet period that starts before and ends after the first synchronization uses the signals. The view shows the start of the signal data.
6. Snapshots of a synchronization that failed after the snapshots were saved are used. Their data came correctly from the sources.
7. A snapshot that the server cannot read is not used. The server writes a warning into the log and continues.
8. The list of received items of a slot in the Archipelago tracker never gets shorter. A shorter list would be a new room.

## 4. Breaks and short pauses

1. A quiet period that is not a BK period is a break if it is longer than the break limit. Else it is a short pause. The break limit is a room setting (F 9). The default is 30 minutes.
2. A short pause counts as active time. Players also play when they do not check, for example while they walk or solve a puzzle.
3. Known limit: a player in BK who gets a useful item (not progression) that helps to continue gets a break, not a BK period. The pace does not change, because breaks also do not count.

## 5. Bulk steps

1. A step with more new checks than the bulk limit is a bulk step. The bulk limit is a room setting (F 9). The default is 40 checks. A release, a collect or `/send_location` of an admin causes such steps.
2. Bulk steps do not count as active time, and their checks do not count.
3. A bulk step does not end a quiet period. In the classification, it is a step without new checks.

## 6. Values for each slot and player

A slot can change its player: another Discord user takes it. The table has one row for each player of a slot.

The SlotLock slots are not in the pace statistics: no rows, and they do not count in the values of the games.

1. The player of a slot at a time is the Discord user that Cheese shows in the snapshot of this time.
2. The classification of F 2 to F 5 is for the full slot. The change of the player cuts the parts of the slot at the time of the change. Each row gets the parts in the time of its player.
3. The time before the first synchronization of the room goes to the player of the first snapshot.
4. Time in which the slot has no Discord user is a row without player.
5. A slot with one player has one row.
6. A change of only the Discord name is not a change of the player. The row shows the last name.
7. A step with checks in which the player changes goes completely to the new player.
8. A BK period across a change of the player gives each row its part of the BK time. It counts as a BK period only in the row in which it starts.
9. If there is no snapshot of Cheese yet, the row has the current Discord user of the slot (as the roster).
10. A row without time (for example a player between two changes in one step with checks) is not shown. Each part counts as time, also a bulk step.
11. A period without Discord user ID shows the Discord name of Cheese, if Cheese gives one.
12. The marks "estimated start" and "start unknown" show only in the first shown row of the slot.
13. Slots without time range (F 2.2, F 2.5) and slots with a time range but without parts (for example only one point in the checks history) are not shown. A switch above the table shows them, with the current Discord user and without values. They do not count in the values of the games (F 7).
14. A BK period that has only bulk steps counts as a BK period with 0 minutes.

| Column | Content |
|---|---|
| Slot | Slot name |
| Game | Game of the slot |
| Discord name | Discord user of the row, or "no player" |
| Time of the player | From and to, if the slot has more than one row |
| Active time | Hours and minutes |
| Checks | Checks in the active time |
| Pace | Checks per active hour |
| Time per check | Minutes of active time per check |
| BK time | Sum of the BK periods |
| BK share | BK time / (active time + BK time) |
| BK periods | Number of BK periods and the longest BK period |
| Breaks | Sum of the breaks |
| Data | Marks: estimated start, start unknown, no signal data for a part of the time range |

1. Rows with less than 30 minutes of active time show no pace. The values are not reliable.
2. The table sorts by each column, as the other tables (two fields).

## 7. Values for each game

1. Only the slots of this room. There is no comparison with other rooms. One line for each game of the room: number of rows (F 6; a slot with two players counts two times), sum of the active time, sum of the checks, pace, median pace of the slots.
2. The pace of a game is the sum of the checks divided by the sum of the active time. Slots with a long time have more weight. The sums contain all rows with a time range, also rows with less than 30 minutes of active time. The minimum of 30 minutes applies to the sum of the game.
3. The median uses only rows with a pace.
4. Checks of different games need different effort. Compare the pace of slots only in the same game.
5. A game without a row with a time range is not shown. The switch of F 6.13 shows it.

## 8. Timeline of a slot

1. A click on a row opens a side panel with the timeline of the full slot. The changes of the player are marks on the timeline. The clicked row is highlighted. Rows without time range cannot be clicked.
2. The timeline shows the time range with a color for each part: active step, short pause, BK period, break, bulk step, locked, after goal.
3. Marks on the timeline: received progression items, each change of the Cheese status (`unknown`, `unblocked`, `bk`, `soft_bk`, `go` separately; the first snapshot gives the first status; a status that is still active has no end mark), changes of the player, the time of snapshots that the server could not read (F 3.7).
4. The admin uses the timeline to check the classification of the quiet periods.

## 9. Settings

1. The admin sets the break limit (minutes) and the bulk limit (checks in one step) in the setup, tab "Settings".
2. Admin helpers do not change the settings.
3. A change calculates the pace statistics again.
4. A change of the unlock times or of the lock assignments by an admin also calculates the pace statistics again, not only the next synchronization.

## 10. Decisions

The developer decided these points on 2026-10-28.

| Topic | Decision |
|---|---|
| Access | Admins and admin helpers |
| Place | A tab of the game control |
| Item signal | From the snapshots of the Archipelago tracker. No seed upload necessary. |
| End of a BK period | The first new check, independent of the status in Cheese |
| Calculation | On the server. The checks history and the snapshots are too large for the browser. |
| Break limit and bulk limit | Room settings of the admin. Defaults 30 minutes and 40 checks. |
| Other rooms | No. The values of a game come only from the slots of this room. |
| Minimum active time for the pace | 30 minutes |
| Allowed values of the limits | Break limit 10 to 1440 minutes, bulk limit 1 to 10000 checks |
| Unlocked slot without unlock time | Starts at the first point of the checks history, marked "start unknown" |
| Reached goal without goal time | No values |
| Time of the item signal | In the quiet period or in the first active step after it |
| Items from the own locations | Count for the item signal |
| Start of a BK period | The last active step before it, also if the player clicks "BK" later |
| Quiet period up to now | BK only with the status signal of Cheese |
| Bulk step in a quiet period | Does not end the quiet period |
| Pace of a game | Weighted (sum of checks / sum of active time) and the median of the slots |
| Length of the steps | The logic accepts steps of each length. Phase P1 measures the real length. |
| Slots that are not locked / partially unlocked | Start as a start slot / no values |
| Time before the first check | A quiet period with the usual rules |
| Quiet period across the first synchronization | Uses the signals |
| Checks history ends before now | The last quiet period ends at the last point |
| Weighted pace of a game | All rows with a time range. The minimum applies to the sum. |
| Snapshots of a failed synchronization | Used |
| Snapshot that cannot be read | Not used, warning in the log |
| Change of the player | One row for each player of a slot |
| Player before the first synchronization | The player of the first snapshot |
| Slot without Discord user | Own row without player |
| Change of only the Discord name | Not a change of the player |
| Step with checks at a change of the player | Goes completely to the new player |
| BK period across a change of the player | Time divided, counts only in the row in which it starts |
| Slots without time range | Not shown, a switch shows them |
| Number of slots of a game | Number of rows |
| Player without Cheese snapshot | Current Discord user of the slot |
| Marks of the start | Only in the first row |
| Rows without time | Not shown |
| Period without Discord user ID | Shows the name of Cheese |
| Snapshot that cannot be read | Mark on the timeline |
| BK period of only bulk steps | Counts, with 0 minutes |
| Time of a row | Each part, also a bulk step |
| Marks of the start if the first row has no time | In the first shown row |
| Slot with a time range but without parts | As a slot without time range |
| Empty rows in the values of the games | Do not count |
| SlotLock slots | Not in the pace statistics |
| Game without a row with a time range | Not shown, the switch shows it |
| New calculation | After each synchronization and after each change of the room by an admin |
| Timeline of a slot with more rows | The full slot, the clicked row highlighted |
| Rows without time range | Cannot be clicked |
| Status marks on the timeline | Each Cheese status separately, no end mark for the current status |
