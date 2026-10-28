# Room archive – Plan

Version: draft v1 (2026-10-28)
Language: ASD-STE100 (Simplified Technical English)

This plan describes the functions and the implementation of the room archive. References in the form "main 15.3" mean `PLAN slotlock.md`. All rules of `PLAN slotlock.md` apply: code rules (main 15.3), component rules (main 16.3), stores (main 16.4), shared types (main 17), tests (main 19), definition of done (main 21), no code comments.

## 1. Goal

A room that has ended goes into the archive. The server does not synchronize an archived room. The data stays visible. An admin archives a room by hand, or the server archives it automatically when all slots are finished.

## 2. Terms

| Term | Meaning |
|---|---|
| **Finished slot** | A slot with reached goal (`isGoaled` in `locations/goal.logic.ts`: Archipelago goal, or Cheese completion status `goal`, `done` or `released`). |
| **Playable slot** | A slot that is not a SlotLock slot (`isSlotLock = false`). Also SlotLock slots that are not selected do not count. |
| **Archived room** | A room with `archivedAt`. |

## 3. Decisions

1. **Three new fields of `Room`:** `archivedAt DateTime?`, `archiveReason String?` (`manual` or `auto`), `autoArchive Boolean @default(true)`.
2. **Automatic archive:** at the end of each successful synchronization, the server archives the room when `autoArchive` is `true`, the room has at least one playable slot and all playable slots are finished. The SlotLock slots do not count, because SlotLock has no goal.
3. **Manual archive:** admins (not admin helpers) archive and reopen the room. The owner is not necessary, because the archive can be undone.
4. **Reopen:** removes `archivedAt` and `archiveReason`. When the room was archived automatically, reopen also sets `autoArchive` to `false`. Else the next synchronization archives the room again at once. The admin can set `autoArchive` again in the settings.
5. **No synchronization:** the scheduler ignores archived rooms. `SyncService.syncRoom` returns `skipped` for an archived room (also for the triggers `manual`, `create` and `seed`). The manual synchronization answers `409 ROOM_ARCHIVED`.
6. **Frozen time:** in an archived room, inactivity and pace use `archivedAt` as the current time. So the values do not change after the archive.
7. **All other functions stay available.** Admins can change settings, warnings, unlock times and seed data. Server commands stay available, because the Archipelago room can still exist.
8. **Reopen synchronizes at once** (trigger `manual`, without the cooldown).

## 4. Functions

### 4.1 Room list

The room list does not show archived rooms. The checkbox "Show archived rooms" shows them (the browser keeps this selection). The active rooms are first. An archived room has the tag "Archived", and the column of the synchronization shows the date of the archive.

### 4.2 Room header

An archived room shows a tag "Archived" with the date. The button "Synchronize now" is not shown. The sync status is not shown.

### 4.3 Setup

- Tab "Settings": new checkbox "Archive the room automatically when all slots are finished" (`autoArchive`). Saved with the other settings.
- Tab "Room": new section "Archive". For an active room: button "Archive room" with a confirmation. For an archived room: the date, the reason, and the button "Reopen room". Only admins see the section.

## 5. Server

1. Prisma migration `room_archive` with the fields of 3.1.
2. `rooms/archive.logic.ts`: `shouldAutoArchive(room, slots): boolean` and `roomNow(room, now): Date`.
3. `RoomSummaryDto`: `archivedAt: string | null`, `archiveReason: 'manual' | 'auto' | null`. `RoomDetailDto`: `autoArchive: boolean`.
4. `UpdateRoomSettingsDto`: `autoArchive?: boolean`.
5. `RoomArchiveController` and `RoomArchiveService` in the admins module (`rooms/:slug/archive`, role `admin`): `POST` archives, `DELETE` reopens. Both answer `RoomDetailDto` and publish the room update. `409 ROOM_ARCHIVED` when the room is archived, `409 ROOM_NOT_ARCHIVED` when it is not archived.
6. `SyncScheduler`: `where: { archivedAt: null }`. `SyncService.syncRoom`: skip an archived room. After `applySource`, archive automatically (3.2).
7. `SyncController`: `409 ROOM_ARCHIVED`.
8. `PaceService`: `now = roomNow(room, new Date())`. The cache key contains `archivedAt`.
9. API types: `npm run api:sync`.

## 6. App

1. `current-room` store: `isArchived`, `archivedAt`.
2. `inactivity` store: uses `archivedAt` as the current time for an archived room.
3. `RoomList.vue` and `rooms` store: checkbox `showArchivedRooms` (`table-filters` store, persisted), tag, archive date, active rooms first.
4. `RoomHeader.vue`: tag, no sync button.
5. `AdminSettingsPanel.vue` and `admin` store: `autoArchive`.
6. New store `room-archive.ts` and new component `RoomArchivePanel.vue` in the tab "Room".
7. Texts in German and English.

## 7. Tests

| Place | Test |
|---|---|
| `archive.logic.spec.ts` | All playable slots finished; one not finished; SlotLock slot not finished; no playable slot; `autoArchive` false. `roomNow`. |
| `test/room-archive.e2e-spec.ts` | Manual archive and reopen; helper gets 403; manual sync of an archived room gets 409; synchronization archives automatically; reopen of an automatic archive sets `autoArchive` to `false`. |
| `stores/__tests__/room-archive.spec.ts` | Archive and reopen call the API. |
| `stores/__tests__/inactivity.spec.ts` | Frozen time. |
| `app/e2e/room-archive.spec.ts` | Own room `archive` (async tracker). Archive in the tab "Room", tag in the header, no sync button, room list filter, reopen. |

## 8. Checklist

- [x] 5 Server, migration, API types
- [x] 6 App
- [x] 7 Tests
- [x] README and `CHECKLIST implementation.md`
- [x] Definition of done (main 21)

## 9. Open points

1. The pace statistics still load the checks history from Cheese for an archived room. When Cheese deletes the tracker, the pace tab of an archived room shows an error. A later function can save the history at the archive.
