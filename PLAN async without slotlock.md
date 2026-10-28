# Async without SlotLock – Plan

Version: draft v1 (2026-10-28)
Language: ASD-STE100 (Simplified Technical English)

This plan describes the functions and the implementation for rooms without the game SlotLock. References in the form "main 15.3" mean `PLAN slotlock.md`. References in the form "pace 3.3" mean `PLAN pace statistics implementation.md`. References without a prefix mean this file.

All rules of `PLAN slotlock.md` apply: code rules (main 15.3), component rules (main 16.3), stores (main 16.4), shared types (main 17), tests (main 19), definition of done (main 21), no code comments.

## 1. Goal

An admin can use SlotLockCheck for an asynchronous room that has no SlotLock slot. The room has all functions that do not need SlotLock: roster, inactivity, inactivity reminder, player summary, statistics, pace, sphere checker, warnings, server commands. The application does not show the functions of the locks.

## 2. Terms

| Term | Meaning |
|---|---|
| **Room with SlotLock** | A room with at least one selected SlotLock slot (`Slot.isSelectedSlotLock`). This is the current behavior. |
| **Room without SlotLock** | A room with no selected SlotLock slot. The room can contain slots with the game SlotLock, but no slot is selected. |
| **Lock functions** | Lock status, unlock data, lock assignment, unlock times, unlock tree, the lock parts of the statistics and of the room list. |

## 3. Decisions

1. **No new field in the database.** The type of the room comes from the selected SlotLock slots: `hasSlotLock = slots.some((slot) => slot.isSelectedSlotLock)`. No migration.
2. **All slots are start slots.** In a room without SlotLock, the synchronization sets `isStartSlot` for each slot that is not a SlotLock slot. So each slot gets the lock status `start_slot`. Reason: inactivity (`inactivity.ts`), statistics (`summary.ts`), room counters (`countLockStates`) and pace (`slotRange`, pace 3.3) already treat `start_slot` correctly as "playable from the start". With `not_locked`, the inactivity is always `null`, so the main function of the room does not work.
3. **The type is set at creation.** An admin cannot change a room with SlotLock into a room without SlotLock, or the opposite. Reason: the stored lock assignments and unlock items of a deselected SlotLock slot stay in the database. Their clean-up is not in this plan. The rule "at least one selected SlotLock slot" (`INVALID_SLOTLOCK_SELECTION`) stays for rooms with SlotLock.
4. **The application hides the lock functions** in a room without SlotLock. It does not show empty tables or a lock status "start slot" for each slot.
5. **Server commands use any slot.** In a room without SlotLock, the admin selects the slot for the text client connection from all slots that are not SlotLock slots. Archipelago accepts a text client connection with each slot name.
6. **One new API field:** `hasSlotLock: boolean` in `RoomSummaryDto`. The room list needs it, and it has no roster. `RoomDetailDto` and `RoomListEntryDto` extend `RoomSummaryDto`, so all room responses contain the field.

## 4. Functions

### 4.1 Creation of a room

1. The setup form accepts an empty selection of SlotLock slots.
2. When the tracker has no SlotLock slot, the form shows the text: "The tracker has no slot with the game SlotLock. The room is a room without SlotLock." The "Create room" button is enabled.
3. When the tracker has SlotLock slots and the admin selects none, the form shows the text: "No SlotLock slot is selected. The room is a room without SlotLock. You cannot change this later."

### 4.2 Synchronization

1. Without a selected SlotLock slot: no lock detection, no unlock items, no unknown slot names. Each slot that is not a SlotLock slot is a start slot (decision 3.2).
2. With a selected SlotLock slot: no change.

### 4.3 Display in a room without SlotLock

| Place | Change |
|---|---|
| Room list | No unlock progress bar. The checks progress bar stays. |
| Room tabs | No tab "Unlock tree". The route `unlock-tree` goes to the roster. |
| Roster, my slots | No columns "Lock status", "Unlocked by", "Unlocks sent". No filter "Lock status". No checkbox "Hide SlotLock slots". No "locked" part in the open checks text. |
| Player summary | No columns "Unlocked" and "Locked". |
| Statistics | No donut "Unlocked". No part "Open checks in locked slots". No bar charts "Players by locked slots" and "Players by unlocked slots". |
| Setup, tab "Settings" | No selection of SlotLock slots. |
| Setup, tabs "Locks" and "Unlock times" | Not shown. The tab parameter falls back to the first available tab. |
| Game control, server | Slot selection from all slots that are not SlotLock slots (decision 3.5). |

## 5. Server

### 5.1 Room setup

File `server/src/room-setup/dto/room-setup.dto.ts`:

- `CreateRoomDto.slotLockPositions`: remove `@ArrayMinSize(1)`. Add `@ArrayUnique()`, the same as `UpdateRoomSettingsDto` in `admins/dto/admins.dto.ts`.

File `server/src/room-setup/room-setup.service.ts`: no change. The check `every(...)` is true for an empty list.

### 5.2 Start slots

File `server/src/lock/lock.logic.ts`, function `detectStartSlots`:

```ts
export function detectStartSlots(
  slots: (SlotIdentity & { isSlotLock: boolean })[],
  slotLockPositions: number[],
  lockedSlotNamesByLocker: Map<number, string[]>,
  assignments: LockAssignmentResult[],
): number[] {
  if (slotLockPositions.length === 0) {
    return slots.filter((slot) => !slot.isSlotLock).map((slot) => slot.position);
  }
  if (lockedSlotNamesByLocker.size === 0) {
    return [];
  }
  ...unchanged
}
```

Callers to update:

- `server/src/sync/sync.service.ts` (call after `detectLocks`): give `selectedPositions` as the second argument.
- `server/src/prototype/prototype-report.ts`: give `lockers` as the second argument.

The behavior of a room with SlotLock but without slot data (`lockedSlotNamesByLocker.size === 0`) does not change.

### 5.3 Room summary

Files `server/src/rooms/dto/room.dto.ts` and `server/src/rooms/rooms.service.ts`:

- `RoomSummaryDto`: new field `hasSlotLock: boolean` with `@ApiProperty()`.
- `RoomsService` (method that returns the summary, near `countLockStates`): `hasSlotLock: roster.some((slot) => slot.isSelectedSlotLock)`.
- Run `npm run build` (or the OpenAPI export and the type generation) so that `server/openapi.json` and `app/src/api/schema.d.ts` are current (main 17). `npm run api:check` must pass.

### 5.4 Room settings

File `server/src/admins/admins.service.ts`: no change. The app does not send `slotLockPositions` for a room without SlotLock (6.5). The server keeps the rule "not empty" for rooms with SlotLock (decision 3.3).

### 5.5 Server commands

File `server/src/archipelago-admin/archipelago-admin.service.ts`, method `connectionSlot`:

```ts
private async connectionSlot(room: Room, slotId: number | undefined): Promise<Slot> {
  const lockers = await this.prisma.slot.findMany({
    where: { roomId: room.id, isSelectedSlotLock: true },
    orderBy: { position: 'asc' },
  });
  const candidates =
    lockers.length > 0
      ? lockers
      : await this.prisma.slot.findMany({ where: { roomId: room.id, isSlotLock: false }, orderBy: { position: 'asc' } });
  const slot = slotId === undefined && candidates.length === 1 ? candidates[0] : candidates.find((c) => c.id === slotId);
  if (!slot) {
    throw new BadRequestException('CONNECTION_SLOT_REQUIRED');
  }
  return slot;
}
```

- The new error code `CONNECTION_SLOT_REQUIRED` replaces `SLOTLOCK_SLOT_REQUIRED`. The old code is used only in this method and in `errors.SLOTLOCK_SLOT_REQUIRED` of the two locale files (6.7).
- The connection uses the slot name (`slotCommandName` in `server-target.logic.ts`) and the tags `TextOnly` (`admin-connection.ts`). This works for each slot, so no other change is necessary.

## 6. App

All changes use one new computed value in `app/src/stores/current-room.ts`:

```ts
const hasSlotLock = computed(() => room.value?.hasSlotLock ?? true);
```

Return it from the store. The default `true` keeps the current display while the room loads.

### 6.1 Room setup

- `app/src/stores/room-setup.ts`, `canCreate`: remove `slotLockPositions.value.length > 0 &&`.
- `app/src/components/rooms/RoomSetupForm.vue`: show the texts of 4.1.2 and 4.1.3. Replace the key `roomSetup.noSlotLockSlots`. New key `roomSetup.withoutSlotLock`.

### 6.2 Room list and room tabs

- `app/src/components/rooms/RoomList.vue`: show the unlock progress bar only with `(data as RoomListEntry).hasSlotLock`.
- `app/src/components/room/RoomHeader.vue`: tab `unlock-tree` with `visible: hasSlotLock.value`.
- `app/src/router/index.ts`: new route meta `requiresSlotLock?: boolean`. Set it on the route `unlock-tree`. In `router.beforeResolve`, after the location check: when `to.meta.requiresSlotLock && !useCurrentRoomStore().hasSlotLock`, go to `roster`.

### 6.3 Slot table

`app/src/components/ui/SlotTable.vue` is a presentational component (main 16.3). New prop `showLocks: boolean`. With `false`, the table does not render the columns `lockStatus`, `unlockTime` and `unlocksSent` (`v-if` on each `Column`).

Callers give `:show-locks="hasSlotLock"`:

- `app/src/components/room/RosterPanel.vue`
- `app/src/components/room/MySlotsPanel.vue`

There are no other users of `SlotTable`.

In `RosterPanel.vue` and `MySlotsPanel.vue`, also hide with `v-if="hasSlotLock"`: the `MultiSelect` of the lock status, the checkbox `hideSlotLockSlots` and the "locked" part of the open checks text. In a room without SlotLock, `hideSlotLockSlots` stays `true` in the roster, so SlotLock slots that are not selected stay hidden.

### 6.4 Player summary and statistics

- `app/src/components/room/PlayerSummaryPanel.vue`: columns `unlockedCount` and `lockedCount` with `v-if="hasSlotLock"`.
- `app/src/components/room/StatisticsPanel.vue`: the donut with key `unlocked` only with `hasSlotLock` (filter the list of donuts). The part `lockedSlots` of the open checks only with `hasSlotLock`. The sections `playersByLocked` and `playersByUnlocked` with `v-if="hasSlotLock"`.
- `app/src/domain/summary.ts`: no change. All slots are start slots, so `lockableCount` is 0 and `openChecksInLockedSlots` is 0.

### 6.5 Setup

- `app/src/views/AdminView.vue`: `ADMIN_TABS` without `locks` and `unlockTimes` when `!hasSlotLock`. The `Tab` and `TabPanel` elements of these tabs with `v-if="hasSlotLock"`. `availableTabs` uses the filtered list, so an old link falls back to `settings`.
- `app/src/components/admin/AdminSettingsPanel.vue`: the fieldset of the SlotLock slots with `v-if="hasSlotLock"`.
- `app/src/stores/admin.ts`, save of the settings: send `slotLockPositions` only when `useCurrentRoomStore().hasSlotLock`. Else omit the field. Without this change, the save fails with `INVALID_SLOTLOCK_SELECTION`.

### 6.6 Server connection

`app/src/components/admin/ServerConnectionPanel.vue`: the options come from `selectedLockers` when `hasSlotLock`, else from `playableSlots`. The label is `server.connectionSlot` ("Slot for the connection") in the second case. The select is shown when there is more than one option, as now.

### 6.7 Texts

New or changed keys in `app/src/locale/de.json5` and `app/src/locale/en.json5`:

| Key | English | German |
|---|---|---|
| `roomSetup.noSlotLockSlots` | The tracker has no slot with the game SlotLock. The room is a room without SlotLock. | Der Tracker hat keinen Slot mit dem Spiel SlotLock. Der Raum ist ein Raum ohne SlotLock. |
| `roomSetup.withoutSlotLock` | No SlotLock slot is selected. The room is a room without SlotLock. You cannot change this later. | Kein SlotLock-Slot ist ausgewählt. Der Raum ist ein Raum ohne SlotLock. Das kann später nicht geändert werden. |
| `server.connectionSlot` | Slot for the connection | Slot für die Verbindung |
| `errors.CONNECTION_SLOT_REQUIRED` (replaces `errors.SLOTLOCK_SLOT_REQUIRED`) | Select a slot for the connection. | Wähle einen Slot für die Verbindung. |

## 7. Tests

### 7.1 Server

| File | Test |
|---|---|
| `lock/lock.logic.spec.ts` | `detectStartSlots` with empty `slotLockPositions`: returns all positions that are not SlotLock slots. With SlotLock positions and empty map: returns `[]` (existing behavior). |
| `sync/sync.service.spec.ts` | First synchronization of a room without selected SlotLock slot: each slot has `isStartSlot = true`, no `LockAssignment`, no `UnlockItem`, `unknownSlotNames` is `[]`. |
| `room-setup` (new spec or e2e) | Creation with `slotLockPositions: []` is accepted. |
| `archipelago-admin` | `connectionSlot` without selected SlotLock slot: accepts a playable slot, rejects a SlotLock slot, rejects an unknown slot. |
| `rooms` | `hasSlotLock` is `false` without selected SlotLock slot, `true` with one. |

### 7.2 App

| File | Test |
|---|---|
| `stores/__tests__/room-setup.spec.ts` | `canCreate` is `true` with an empty selection. |
| `stores/__tests__/current-room.spec.ts` | `hasSlotLock` follows `room.hasSlotLock`; default `true` without room. |
| `domain/__tests__/inactivity.spec.ts` | A `start_slot` without unlock time gets an inactivity from `lastActivity` (protects decision 3.2). |
| new store or component test, if there is a pattern for it | `admin` store does not send `slotLockPositions` without SlotLock. |

### 7.3 End-to-end

`app/e2e/rooms.spec.ts` with `app/e2e/support.ts`: one new test that creates a room with `slotLockPositions: []` from the existing mocked Cheese data. Expected: no tab "Unlock tree", no column "Lock status", inactivity values are shown, the settings save works.

## 8. Order and parallel work

Other agents work on the pace statistics at the same time. These files of this plan were also changed by the pace work (commit `d99ced2` and later): `app/src/router/index.ts`, `app/src/views/AdminView.vue`, `app/src/stores/current-room.ts`, `app/src/stores/admin.ts`, `app/src/locale/*.json5`, `server/openapi.json`, `app/src/api/schema.d.ts`.

1. Start the implementation only when the pace work is committed and no agent works in this checkout, or in a separate Git worktree based on the latest `main`.
2. Do the server part first (5.1 to 5.5), with the API types (5.3) in one commit. The generated files `openapi.json` and `schema.d.ts` must not be generated at the same time by two agents.
3. Then the app part (6.1 to 6.7), then the end-to-end test.
4. Suggested commits (Conventional Commits, as in the history):
   - `feat(server): rooms without SlotLock`
   - `feat(app): rooms without SlotLock`
   - `docs: rooms without SlotLock` (README section 5.3 of the main concepts: add one paragraph "Rooms without SlotLock" under "Lock detection"; add the tasks to `CHECKLIST implementation.md`)

## 9. Checklist

- [ ] 5.1 `CreateRoomDto` accepts an empty selection
- [ ] 5.2 `detectStartSlots` with `slotLockPositions`, callers updated
- [ ] 5.3 `hasSlotLock` in `RoomSummaryDto`, API types generated
- [ ] 5.5 `connectionSlot` with playable slots, new error code
- [ ] 6.1 Room setup form and store
- [ ] 6.2 Room list, room tabs, route guard
- [ ] 6.3 `SlotTable` prop `showLocks`, roster and my slots
- [ ] 6.4 Player summary and statistics
- [ ] 6.5 Setup tabs, settings panel, settings save
- [ ] 6.6 Server connection panel
- [ ] 6.7 Texts in German and English
- [ ] 7 Tests (server, app, end-to-end)
- [ ] README and `CHECKLIST implementation.md`
- [ ] Definition of done (main 21): `npm run lint:check`, `npm run typecheck`, `npm test`, `npm run api:check`, `npm run test:e2e`

## 10. Open points

1. Verify with a real tracker that Cheese and the Archipelago tracker give the same data for a room without SlotLock (no special case in `room-source.service.ts` for a missing SlotLock datapackage: `slotLockItemNames` returns an empty map).
2. Later function, not in this plan: change of the room type after the creation, with clean-up of the lock data (decision 3.3).
