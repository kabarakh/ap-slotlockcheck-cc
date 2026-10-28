# Pace Statistics – Implementation Plan

Version: draft v1 (2026-10-28)
Language: ASD-STE100 (Simplified Technical English)

This plan describes the implementation of the functions in `PLAN pace statistics.md`. References in the form "F 3.2" mean `PLAN pace statistics.md`, section 3, item 2. References in the form "main 15.2" mean `PLAN slotlock.md`. References without a prefix mean this file.

All rules of `PLAN slotlock.md` apply: code rules (main 15.3), component rules (main 16.3), stores (main 16.4), shared types (main 17), tests (main 19), definition of done (main 21), no code comments.

## 1. Overview

| Part | Server | App |
|---|---|---|
| Classification of the steps | `pace/pace.logic.ts` | – |
| Signals from the snapshots | `pace/pace-signals.ts` | – |
| Values for each slot and game | module `pace` | tab "Pace" of the game control |
| Timeline of a slot | module `pace` | side panel |

No new packages. The signals and the checks need no change of the data model: all data is already in `SyncSnapshot`, `SyncRun`, `Slot` and `UnlockItem`, and in the checks history of Cheese. Only the two limits are new fields of `Room` (3.7).

## 2. Data sources

| Data | Source | Precision |
|---|---|---|
| Checks of each slot over time | `GET /api/tracker/{tracker_id}/checks_history` of Cheese (`CheeseService.getChecksHistory`) | 10 minutes (main 3), also before the first synchronization. Not verified with a real room. |
| Status `bk` / `soft_bk` | `SyncSnapshot` with source `cheese`, field `games[].progression_status` | sync interval (5 minutes) |
| Received progression items | `SyncSnapshot` with source `ap_tracker`, field `player_items_received[].items` (flags bit 1 = progression) | sync interval |
| Start of a slot | unlock time of the lock state (`evaluateSlotLockStates`) | as the roster |
| End of a slot | `Slot.goalTime` | as the roster |
| Player of a slot | `SyncSnapshot` with source `cheese`, field `games[].effective_discord_user_id`, name as in `room-source.mapper.ts` (`effective_discord_username`, else `discord_username`) | sync interval |

1. A snapshot is saved only when its content changes (main 22, "Snapshots"). So a snapshot is valid from `SyncRun.startedAt` of its `firstSyncRunId` up to `SyncRun.startedAt` of the `firstSyncRunId` of the next snapshot of the same source. The last snapshot is valid up to the current time. There are no gaps between two snapshots.
2. `player_items_received` of a slot only gets longer (F 3.8). The item with index `n` is new in the first snapshot in which the list has more than `n` entries. Its time is the start time of this snapshot. Items of the first snapshot of the room have no time and are not used.
3. All progression items count, also items from the own locations (F 3.1).
4. The key of a slot is the player number, as in the rest of the server. The team is not checked.
5. The checks history is fetched on request, not in each synchronization. Cache it in memory for each room for 10 minutes.
6. Snapshots of failed synchronizations are used (F 3.6). Do not filter by `SyncRun.result`.
7. A snapshot that cannot be read (JSON or Zod error) is not used. The reader does not change its state for this snapshot. The service writes a warning with the snapshot ID into the log (F 3.7).

## 3. Server: module `pace`

Folder `server/src/pace`. Files from the Nest CLI where possible (main 15.1.5).

### 3.1 Files

| File | Content |
|---|---|
| `pace.module.ts` | Module |
| `pace.controller.ts` | Endpoints 3.5 |
| `pace.service.ts` | Loads the data, calls the pure functions, cache 3.6 |
| `pace-signals.ts` | Pure functions: snapshots → signals for each slot (3.2) |
| `pace.logic.ts` | Pure functions: classification (3.3) and values (3.4) |
| `pace.constants.ts` | `MIN_ACTIVE_MINUTES_FOR_PACE = 30` |
| `dto/pace.dto.ts` | DTOs 3.5 |

### 3.2 Signals

```ts
interface SlotSignals {
  progressionItemTimes: Date[];
  bkPeriods: { from: Date; to: Date }[];
  playerPeriods: { from: Date; to: Date; discordUserId: string | null; discordName: string | null }[];
  statusChanges: { time: Date; status: ProgressionStatus }[];
  signalsFrom: Date | null;
}
```

1. `signalsFrom` = start time of the first snapshot of the room. Before this time, there are no signals (F 3.5).
2. `bkPeriods`: join the snapshot ranges of each slot (key `Slot.cheeseGameId`) with `bk` or `soft_bk` into periods.
3. `progressionItemTimes`: rules 2.2 to 2.4, key `Slot.position`. Only items with flags bit 1.
4. Read the snapshots one row at a time and parse only the necessary fields with Zod. Do not keep all payloads in memory.
5. `playerPeriods`: join the snapshot ranges of each slot (key `Slot.cheeseGameId`) with the same `effective_discord_user_id` into periods. `null` is a period without player (F 6.4). A change of only the name is not a change of the player. The period shows the last name.
6. The first player period starts at the start of the time range of the slot, not at `signalsFrom` (F 6.3). The last player period ends at the current time.
7. `statusChanges`: the `progression_status` of each slot in the first Cheese snapshot, then each change to another value, with the start time of the snapshot (F 8.3). The timeline uses these marks; `bkPeriods` stays for the classification.

### 3.3 Classification

Input for each slot: the checks history points of the slot, `SlotRange`, `SlotSignals`, the limits of the room (`breakLimitMinutes`, `bulkLimitChecks`). Output: a list of segments.

Time range of a slot (F 2):

```ts
interface SlotRange {
  start: Date;
  end: Date;
  startKind: 'unlock' | 'estimated' | 'history_start' | 'unknown';
}
```

1. Lock status `locked` or `partially_unlocked`: no range (`null`), no segments (F 2.2).
2. Lock status `start_slot` or `not_locked`: `start` = the first history point, `startKind` = `history_start`.
3. Unlock time source `unknown`: `start` = the first history point, `startKind` = `unknown`.
4. Else: `start` = unlock time, `startKind` = `estimated` for the source `estimated`, else `unlock`.
5. `end` = `Slot.goalTime`. Without reached goal: the current time.
6. Reached goal and `goalTime` is `null`: no range (`null`), no segments.

```ts
type SegmentKind = 'locked' | 'active' | 'pause' | 'bk' | 'break' | 'bulk' | 'after_goal';

interface Segment {
  kind: SegmentKind;
  from: Date;
  to: Date;
  checks: number;
}
```

1. Fill the history first (F 2.9): insert each missing point of the 10-minute grid (`CHECKS_HISTORY_STEP_MINUTES = 10`) between two points with the values of the point before, and after the last point up to the last grid point not after the current time. Then make the steps from the points. New checks of a step = checks at the end minus checks at the start. A negative value counts as 0.
2. Steps before the start are `locked`. Steps after the end are `after_goal`. Cut the step at the start and at the end.
3. A step with more new checks than `bulkLimitChecks` is `bulk` (F 5).
4. A step with new checks is `active`.
5. Join the steps without new checks and the `bulk` steps into quiet periods. A `bulk` step does not end a quiet period (F 5.3). Its time counts for the length of the quiet period. It stays a `bulk` segment, and its checks do not count.
6. A quiet period is `bk` if (F 3):
   - a progression item time is after the start of the quiet period and not after the end of the next active step, or
   - a BK period of Cheese overlaps the quiet period.
7. A quiet period at the end of the time range is `bk` only with the Cheese condition (F 3.4).
8. A quiet period that is not `bk` is `break` if it is longer than `breakLimitMinutes`, else `pause`.
9. Quiet periods that end before or at `signalsFrom` use only rule 8. A quiet period that ends after `signalsFrom` uses the signals (F 3.5).
10. Join neighbor segments of the same kind.
11. The steps between the start and the first active step are a quiet period with these rules (F 2.8).
12. Because of the filled points, the last quiet period reaches the current time, up to the last grid point (F 2.9).

### 3.4 Values

1. Classify the full slot (3.3). Then cut the segments at the times of the `playerPeriods` (F 6.2). Each player period with a part in the time range of the slot gives one row.
2. For each row: the values of F 6. Active time = sum of `active` and `pause`. Checks = sum of the checks of `active`. Pace and time per check are `null` if the active time is less than `MIN_ACTIVE_MINUTES_FOR_PACE` or the checks are 0.
3. A segment cut by a change of the player keeps its kind in both rows. A step with checks that a change of the player cuts goes completely to the new player, with all its checks and its full time.
4. A BK period cut by a change of the player gives each row its part of the BK time. It counts as one BK period only in the row in which it starts (`bkCount`, `longestBkMinutes` with the full length).
5. Marks: `startKind` (3.3) only in the first given row of the slot, else `null` (F 6.12). `partialSignals` (`signalsFrom` is after the start of the row).
6. No player periods (no Cheese snapshot yet): one row with the current `Slot.discordUserId` and `Slot.discordName` (F 6.9).
7. Rows without a segment of more than 0 minutes are not given (F 6.10). A `bulk` segment counts.
8. Slots with `isSlotLock` are not used: no rows and not in the games.
9. For each game: the values of F 7. The sums use all rows with a time range. The median uses only rows with a pace. `slotCount` is the number of rows. The service gives only rows with `hasRange` `true` to `gamePaceValues` (F 6.13).

### 3.5 Endpoints

| Method and path | Role | Function |
|---|---|---|
| `GET /api/rooms/{slug}/pace` | helper | `RoomPaceDto` |
| `GET /api/rooms/{slug}/pace/slots/{slotId}` | helper | `SlotTimelineDto` |

1. `@RequireRoomRole('helper')`. Players and visitors get 403 (F 1.1).
2. `RoomPaceDto`: `calculatedAt`, `signalsFrom`, `limits` (the room settings of 3.7), `slots: SlotPaceDto[]`, `games: GamePaceDto[]`.
3. `SlotPaceDto` (one for each row of F 6): `slotId`, `name`, `game`, `hasRange`, `discordUserId`, `discordName`, `from`, `to`, `activeMinutes`, `checks`, `checksPerHour`, `minutesPerCheck`, `bkMinutes`, `bkShare`, `bkCount`, `longestBkMinutes`, `breakMinutes`, `startKind`, `partialSignals`. A slot without range, or with a range but without rows from `slotPaceRows`, gives one row with `hasRange` `false`, the current Discord user, `from`/`to` `null`, `startKind` `null` and all number values `null`. The app hides these rows by default (F 6.13).
4. `GamePaceDto`: `game`, `slotCount`, `activeMinutes`, `checks`, `checksPerHour`, `medianChecksPerHour`.
5. `SlotTimelineDto`: `slotId`, `from`, `to`, `segments: SegmentDto[]`, `progressionItemTimes`, `statusChanges: { time, status }[]`, `playerPeriods`, `unreadableSnapshots: { from, to }[]` (the validity time of each snapshot that could not be read, F 8.3).
6. If the checks history of Cheese is not available: HTTP 503 with the code `CHECKS_HISTORY_NOT_AVAILABLE`.
7. Timeline of a SlotLock slot, of a slot of another room or of an unknown slot ID: HTTP 404.

### 3.6 Cache

1. Key: room ID, `Room.lastSuccessfulSyncAt`, `paceBreakLimitMinutes` and `paceBulkLimitChecks`. A new synchronization or a change of the limits makes the old result not valid.
3. `RoomUpdatesService.publish` runs after each change of a room by an admin (unlock times, lock assignments, settings and more). Each publish removes the cached result of the room (F 9.4). Only the result, not the checks history.
2. Keep the result of the last key for each room in memory. The timeline uses the same cached segments.

### 3.8 Saved signals

1. New model `PaceSignalState` (one row for each room): `roomId` (key), `state` (JSON of the reader state), `lastSnapshotIds` (JSON: the last read snapshot ID of `cheese` and `ap_tracker`), `unreadableSnapshots` (JSON), `updatedAt`. Migration name: `pace_signal_state`.
2. `pace-signals.ts` gets functions to write the reader state to JSON and to make a reader from this JSON. The result of `finish(now)` does not change.
3. After the synchronization saved its snapshots, the server reads only the new snapshots of the room into the saved state and saves it again. An error here does not stop the synchronization; the server writes a warning into the log.
4. The calculation (3.6) reads the saved state and the snapshots that are newer than `lastSnapshotIds`, and does not read the old payloads again.
5. A room without saved state builds it at the first request from all snapshots (one time slow), then saves it (decision of the developer).
6. The validity of the last snapshot of each source ends at `now` (2.1). The state keeps it open, so a new snapshot closes it correctly.

### 3.7 Room settings

1. `Room`: new fields `paceBreakLimitMinutes Int @default(30)` and `paceBulkLimitChecks Int @default(40)`. Migration name: `pace_limits`.
2. `UpdateRoomSettingsDto`: new optional fields with `@IsInt()`. Break limit `@Min(10)` `@Max(1440)`. Bulk limit `@Min(1)` `@Max(10000)` (F 10). The endpoint `PATCH` of `RoomSettingsController` stays admin only.
3. `RoomDto` gives both fields. `AdminsService.updateSettings` saves them as `sphereOffset`.
4. After a change: `RoomUpdatesService.publish`. The pace store loads again (4.2.2).

## 4. App

### 4.1 Route and tab

1. Route `control-pace` (`/room/{slug}/control/pace`), component `ControlPaceView.vue`.
2. New tab "Pace" in `ControlView.vue` with `visible: isHelper.value`. No badge.
3. The route guard sends users without the role admin or helper to `control-messages`.

### 4.2 Store

`stores/pace.ts`:

1. `fetch()` loads `RoomPaceDto`. `fetchTimeline(slotId)` loads `SlotTimelineDto`.
2. On the live messages `room:updated` and `room:synced`, load again, but only when the view is open.

### 4.3 Components

| Component | Type | Content |
|---|---|---|
| `views/ControlPaceView.vue` | functional | Store, layout, side panel |
| `components/pace/SlotPaceTable.vue` | presentational | Table F 6 with the sort of `table-sort.ts` |
| `components/pace/GamePaceTable.vue` | presentational | Table F 7 |
| `components/pace/PaceTimeline.vue` | presentational | SVG timeline F 8. `d3-scale` for the time axis, as `charts.ts`. Colors as CSS variables `--app-pace-*` for light and dark mode. |
| `components/pace/PaceTimelineDrawer.vue` | functional | Side panel with the timeline, as `SphereLocationsDrawer.vue` |

1. Durations: `domain/duration.ts` formats minutes as "3 h 25 min".
2. Above the tables: a hint with `signalsFrom` and the limits, and a switch "Show slots without time range" (F 6.13, default off). The switch also shows the games with `slotCount` 0 (F 7.5).
3. Settings: a new panel `components/admin/PaceSettingsPanel.vue` in the setup tab "Settings", as `SphereCheckerSettingsPanel.vue`. The admin store (`stores/admin.ts`) gets the two fields.

### 4.4 Texts

German and English texts in `locale/de.json5` and `locale/en.json5`, key `pace`.

## 5. Tests

1. `pace.logic.spec.ts`:
   - Unlock, active steps, goal: correct active time and pace.
   - BK in Cheese, item, checks without a status change: BK ends with the first check (F 3.1).
   - Progression item ends a quiet period without a Cheese status: `bk`.
   - Quiet period of 20 minutes without signals: `pause`. 2 hours without signals: `break`.
   - Quiet period at the end with and without the status `bk`.
   - Bulk step after a release: not counted.
   - Quiet periods before `signalsFrom`: only `pause` or `break`.
   - Negative check differences.
   - Other limits: a quiet period of 45 minutes is `pause` with a break limit of 60 and `break` with 30.
   - Active time of 20 minutes: no pace. 40 minutes: pace.
   - Steps of different length (for example 10, 10 and 60 minutes).
   - Bulk step in a quiet period: the quiet period continues, its checks do not count.
   - Progression item from the own locations ends a quiet period: `bk`.
   - Range: locked, partially unlocked, not locked and start slot, unlock time `unknown`, reached goal without goal time.
   - Quiet period across `signalsFrom` uses the signals.
   - Player rows: one player, a change of the player, a period without player, the time before the first synchronization, a step with checks at the change (goes to the new player), a BK period across the change (time divided, counted once).
2. `pace-signals.spec.ts`: snapshots with the fixtures `cheese-tracker.json` and `ap-tracker.json`, changed for each case: new items, items of the first snapshot, BK periods across more snapshots, a BK status that lasts up to the start of the next snapshot, player periods (change of the user ID, change of only the name, no user), a snapshot that cannot be read (no change of the state).
3. Controller test: admin and helper get 200, player and visitor get 403. Settings: the admin changes the limits, a helper gets 403, values out of range get 400.
4. E2E: the admin opens the tab "Pace", sees the table and opens the timeline. A helper sees the tab. A player does not see the tab.

## 6. Implementation phases

### Phase P1 – Logic

1. Get the checks history of a real room. Write the real step length into section 8.
2. `pace.constants.ts`, `pace.logic.ts` with tests.

### Phase P2 – Signals and endpoints

1. `pace-signals.ts` with tests.
2. Measure the time to read the signals from the snapshots of the Big Chill room. Write the result into section 8. The developer decides if the signals go into a table during the synchronization (risk 7.2).
3. Room settings 3.7 with migration.
4. Module, service, cache, endpoints, DTOs, OpenAPI export, generated types.

### Phase P3 – View

1. Route, tab, store, tables, texts.
2. Settings panel.

### Phase P4 – Timeline

1. Timeline endpoint, `PaceTimeline.vue`, side panel, E2E test.
2. README: new section "Pace statistics" under "Concepts".

## 7. Risks

1. **Precision:** the steps of the checks history are 10 minutes. BK periods and pauses shorter than one step are not visible.
2. **Large snapshots:** a room with many slots has large `ap_tracker` payloads. Measure the time of the first calculation with the Big Chill data. If it is too slow, save the signals in a table during the synchronization.
3. **Bulk limit:** some games give many checks at the same time (for example a large area or a research). The limit can mark normal play as `bulk`. The timeline shows this to the admin, and the admin can change the limit of the room.
4. **Rooms created during the game:** no signals before the first synchronization. The view marks these slots (`partialSignals`).
5. **Checks history of Cheese:** main 3 gives steps of 10 minutes. This is not verified with a real room. The logic accepts steps of each length (3.3.1). Phase P1 measures the real length.

## 8. Questions from the implementation

The developer answered these questions on 2026-10-28. The answers are in F 2, F 3, F 6, F 7 and F 10.

1. Lock status `not_locked` and `partially_unlocked`.
2. Time before the first check, quiet period across the first synchronization, end of the checks history.
3. Rows with less than 30 minutes in the sums of a game.
4. Snapshots of failed synchronizations and snapshots that cannot be read.
5. Lists of received items that get shorter: not possible (F 3.8).
6. Change of the player: one row for each player, with the details of F 6.

7. Phase P2.4: SlotLock slots are not in the pace statistics. Each publish of a room clears the cached result.

9. Phase P1.1, measured on 2026-10-28 with the checks history of a real room (61 slots, 1,347 points, 25 days): all points are on a 10-minute grid. 1,107 steps are 10 minutes, 239 steps are 20 to 1,410 minutes. Each step ends with a change in the room, and no 10-minute step is without a change. So Cheese leaves out a grid point when no slot of the room changes. The largest increase of one slot in one step is 686 checks (release or collect). Result: the history is filled on the grid (3.3.1).

10. Phase P2.2, measured on 2026-10-28 with the real payloads of an active room (178 slots, Cheese 347 KB, Archipelago tracker 1.2 MB): the reader needs 15.6 ms for one pair of snapshots (CPU only). Estimate: about 288 pairs each day in an active room, so about 36 seconds for 8 days and about 2 minutes for 25 days. The developer decided: the signals are saved during the synchronization (3.8). Existing rooms build them at the first request.

Open: none.

8. Phase P4: the timeline endpoint gives 404 for a SlotLock slot (3.5.7). The timeline shows the full slot. Rows without time range cannot be clicked (F 8.1).

## 9. Deviations during the implementation

1. **Folder of the tables (4.3):** `SlotPaceTable.vue` and `GamePaceTable.vue` are in `components/ui/`, not in `components/pace/`. Standard check 7 permits props only in `components/ui`.
2. **Route guard (4.1.3):** the parent route `control` already needs the role helper. Players and visitors go to the roster, as for the other tabs of the game control.
3. **Width (4.3):** the slot table fits a screen of 1024 px without horizontal scrolling, as the roster (main 24.23). For this, the table has 9 columns with two-line cells: slot / game, active time / checks, pace / time per check, BK time / share, BK periods / longest, time of the player from / to. Each combined column sorts with the two-field cycle of the slot table.
4. **German terms:** break = "Break", short pause = "Pause", break limit = "Break-Grenze".
5. **Timeline (4.3):** `PaceTimeline.vue` is in `components/ui/` (same reason as 9.1). The slot name in the table is a link that opens the side panel (slot pattern of the README). The pure layout is in `domain/pace-timeline.ts`.
6. **E2E file:** `app/e2e/statistics-pace.spec.ts`, so that it runs after `rooms.spec.ts`, which makes the room through the UI.
7. **Saved signals (3.8):** `PaceSignalsService` in its own `PaceSignalsModule`; `SyncModule` and `PaceModule` import it. The saved state keeps all games and players, not only the current slots, so that it stays correct when the roster changes. `finish` filters by the slots.
8. **Time of the update in the synchronization (3.8.3):** in `finally` after the publish of the synchronization, also after a failed synchronization. The roster update does not wait for a slow first build, but the answer of a manual synchronization waits for it.
9. **Additions of the implementation (not in the plan, can be changed):** if the saved state cannot be read, or a new snapshot is older than the last read snapshot of its source, the server writes a warning and builds the state again from all snapshots. A snapshot without a synchronization run gets one warning and is then not used.
10. **Lock (3.8):** one lock for each room in memory. This needs one server process, as the pm2 configuration has it.
