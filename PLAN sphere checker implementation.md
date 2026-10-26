# Sphere Checker – Implementation Plan

Version: draft v1 (2026-10-26)
Language: ASD-STE100 (Simplified Technical English)

This plan describes the implementation of the functions in `PLAN sphere checker.md`. References in the form "F 3.4" mean `PLAN sphere checker.md`, section 3, item 4. References in the form "main 15.2" mean `PLAN slotlock.md`. References without a prefix mean this file.

All rules of `PLAN slotlock.md` apply: code rules (main 15.3), component rules (main 16.3), stores (main 16.4), shared types (main 17), tests (main 19), definition of done (main 21), no code comments.

## 1. Overview

| Part | Server | App |
|---|---|---|
| Upload of the multidata file | module `seed` | admin tab "Seed" |
| Locations and sphere overview | module `locations` | views "Spheres" and "Locations" |
| Filler marks | module `locations` | button in the location tables |
| Admin helper | `auth`, `admins` | admin tab "Admins" |
| Sphere clean-up text | module `locations` (data) | domain function and panel |
| Server login and commands | module `archipelago-admin` | admin tab "Server" |
| Status of the locations | module `sync` | live update |

## 2. New packages

| Workspace | Package | Use |
|---|---|---|
| server | `archipelago.js` (2.1.0, MIT, no dependencies) | WebSocket client for the Archipelago server (section 9). Node 26 has a global `WebSocket`. |
| server | `@types/multer` (dev) | Types for `FileInterceptor` of `@nestjs/platform-express`. `multer` is already a dependency of `@nestjs/platform-express`. |

The pickle decoder is own code (4.2). No pickle library.

## 3. Data model (Prisma)

### 3.1 New models

```prisma
model SeedData {
  roomId             Int      @id
  seedName           String
  archipelagoVersion String
  locationCount      Int
  sphereCount        Int
  uploadedAt         DateTime @default(now())
  uploadedByUserId   Int
  room               Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  uploadedBy         User     @relation(fields: [uploadedByUserId], references: [id])
}

model SeedLocation {
  id                   Int       @id @default(autoincrement())
  roomId               Int
  finderSlotId         Int
  receiverSlotId       Int
  locationId           Int
  locationName         String
  itemId               Int
  itemName             String
  itemType             String
  sphere               Int
  checked              Boolean   @default(false)
  checkedFirstSeenAt   DateTime?
  fillerMarkedAt       DateTime?
  fillerMarkedByUserId Int?
  room                 Room      @relation(fields: [roomId], references: [id], onDelete: Cascade)
  finderSlot           Slot      @relation("LocationFinder", fields: [finderSlotId], references: [id], onDelete: Cascade)
  receiverSlot         Slot      @relation("LocationReceiver", fields: [receiverSlotId], references: [id], onDelete: Cascade)
  fillerMarkedBy       User?     @relation(fields: [fillerMarkedByUserId], references: [id], onDelete: SetNull)

  @@unique([roomId, finderSlotId, locationId])
  @@index([roomId, sphere])
  @@index([roomId, checked, sphere])
  @@index([roomId, finderSlotId])
}
```

1. `itemType` is `progression`, `useful`, `normal` or `trap` (4.4).
2. The Big Chill room gives 87,757 rows. Insert them with `createMany` in blocks of 1,000 rows in one transaction.

### 3.2 Changes

1. `Room`: new fields
   - `sphereOffset Int @default(0)`: the number that the admin adds to the lowest open sphere (F 8, "Sphere limit for players").
   - `visitorsSeeLocations Boolean @default(false)` (F 8, "Visitors").
   - `playersMarkFiller Boolean @default(false)` (F 1.5, F 5.2).
2. `RoomAdmin`: new field `role String @default("admin")` with the values `admin` and `helper`. The owner is always `admin`.
3. `AdminInvitation`: new field `role String @default("admin")` (6.4.3).
4. `Datapackage`: new field `locationNames String?`. The upload fills `itemNames` and `locationNames` from the datapackage of the multidata file. The checksum stays the key.
5. Migration name: `sphere_checker`.

### 3.3 Room roles

1. `RoomRole` (`server/src/rooms/dto/room.dto.ts`) gets the value `helper`.
2. `ROLE_RANK` in `RoomRoleService`: `visitor` 0, `player` 1, `helper` 2, `admin` 3.
3. `RoomRoleService.getMembership` reads `RoomAdmin.role`.
4. All existing endpoints with `@RequireRoomRole('admin')` stay admin only. Check each place that reads `RoomAdmin` without the role (admin list, owner check, room list).

## 4. Server: module `seed`

Folder `server/src/seed`. Files from the Nest CLI where possible (main 15.1.5).

### 4.1 Files

| File | Content |
|---|---|
| `seed.module.ts` | Module |
| `seed.controller.ts` | Endpoints 4.6 |
| `seed.service.ts` | Upload, check against the room, save |
| `multidata.reader.ts` | Pure function: `Buffer` → `MultidataContent` (4.3) |
| `pickle/pickle-decoder.ts` | Restricted pickle decoder (4.2) |
| `pickle/pickle-decoder.spec.ts` | Tests (4.7) |
| `multidata.reader.spec.ts` | Tests (4.7) |
| `item-type.ts` | `itemTypeFromFlags(flags)` (4.4) |
| `dto/seed.dto.ts` | `SeedDataDto`, `SeedUploadErrorDto` |

### 4.2 Pickle decoder

1. Input: the decompressed bytes. Output: plain JavaScript values.
2. Supported opcodes (pickle protocol 4 and 5): `PROTO`, `FRAME`, `STOP`, `MARK`, `POP`, `POP_MARK`, `MEMOIZE`, `BINGET`, `LONG_BINGET`, `BINPUT`, `LONG_BINPUT`, `NONE`, `NEWTRUE`, `NEWFALSE`, `BININT`, `BININT1`, `BININT2`, `LONG1`, `LONG4`, `BINFLOAT`, `SHORT_BINUNICODE`, `BINUNICODE`, `BINUNICODE8`, `SHORT_BINBYTES`, `BINBYTES`, `EMPTY_LIST`, `APPEND`, `APPENDS`, `LIST`, `EMPTY_TUPLE`, `TUPLE`, `TUPLE1`, `TUPLE2`, `TUPLE3`, `EMPTY_DICT`, `DICT`, `SETITEM`, `SETITEMS`, `EMPTY_SET`, `ADDITEMS`, `FROZENSET`, `STACK_GLOBAL`, `NEWOBJ`, `REDUCE`, `BUILD`.
3. `STACK_GLOBAL` accepts only these names: `NetUtils.NetworkSlot`, `NetUtils.SlotType`, `NetUtils.Hint`, `NetUtils.HintStatus`. The decoder gives a marker object `{ __class: 'NetUtils.NetworkSlot', args: [...] }`. It never loads or runs code.
4. `NEWOBJ`, `REDUCE` and `BUILD` are accepted only on these marker objects.
5. Each other opcode or class name stops the decoder with `UnsupportedPickleError`.
6. Dictionary keys can be integers (player numbers, location IDs). Use `Map` for dictionaries.
7. Python integers can be larger than 2^53. `LONG1` and `LONG4` give `bigint`. The reader converts to `number` and stops with an error if a value is too large.

### 4.3 Multidata reader

1. Byte 0 is the format version. Accept version 3. Other versions: error `UNSUPPORTED_MULTIDATA_VERSION`.
2. Decompress the rest with `inflateSync` from `node:zlib` with `maxOutputLength` 500 MB.
3. Decode with 4.2. Validate the result with Zod (`multidata.schemas.ts`).
4. Result `MultidataContent`:
   - `seedName`, `version`,
   - `players`: player number, name, game (from `slot_info`),
   - `locations`: finder player number, location ID, item ID, receiver player number, item flags (from `locations`),
   - `sphereByLocation`: from `spheres` (list index = sphere number),
   - `datapackage`: for each game the checksum, `item_name_to_id` and `location_name_to_id`.
5. Do not read `server_options`, `connect_names`, `precollected_hints` and `er_hint_data`. `server_options` contains passwords.
6. Item name: `item_name_to_id` of the game of the receiver. Location name: `location_name_to_id` of the game of the finder.

### 4.4 Item type

`itemTypeFromFlags(flags)`: bit 1 (value 1) → `progression`; else bit 2 (value 2) → `useful`; else bit 3 (value 4) → `trap`; else `normal`.

### 4.5 Check against the room

1. `Slot.position` is the Archipelago player number. Make sure of this with the Big Chill room in phase P1.
2. Each slot of the room has a player with the same number, the same name (original name, main 24.13) and the same game. Else error `SEED_DOES_NOT_MATCH_ROOM` with the list of differences.
3. The selected SlotLock slot has the game `SlotLock`.

### 4.6 Endpoints

| Method and path | Role | Function |
|---|---|---|
| `GET /api/rooms/{slug}/seed` | helper | `SeedDataDto` or 404 |
| `POST /api/rooms/{slug}/seed` | admin | Upload (`multipart/form-data`, field `file`, maximum 50 MB). Then a synchronization (main 5.2). |

1. Each room accepts only one upload. If the room has seed data, the upload stops with HTTP 409 `SEED_ALREADY_UPLOADED`. There is no endpoint to replace or delete the seed data. The seed data is deleted only with the room (`onDelete: Cascade`).
2. The check of 4.5 runs before the server saves data. A wrong file is never saved.
3. `FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })`.
4. nginx: `client_max_body_size 50m` only for `location /api/rooms/` with `~ /seed$` (`deploy/nginx.conf.example`). All other paths keep `2m`.
5. After the upload: `RoomUpdatesService.publish` and the live message 7.2.

### 4.7 Tests

1. A script `server/scripts/make-multidata-fixture.py` makes small multidata files with Python `pickle` and `zlib`. The fixtures contain only test names. The script runs only by hand (`python -I`). The fixture files go into `server/test/fixtures/`.
2. Decoder tests: all values of the subset, memo, `NetworkSlot`, integers above 2^31, rejection of `GLOBAL`, `INST`, `OBJ`, `REDUCE` on a not permitted class, `STACK_GLOBAL` with `os.system` and `builtins.eval`.
3. Reader tests: version, sizes, mapping of names and spheres, missing keys.
4. Do not commit a real multidata file.
5. Command `npm run seed:report -w server -- <file>`: prints players, number of locations for each sphere and each item type. Same pattern as `prototype:report`.

## 5. Server: module `locations`

Folder `server/src/locations`.

### 5.1 Files

| File | Content |
|---|---|
| `locations.module.ts` | Module |
| `locations.controller.ts` | Endpoints 5.4 |
| `locations.service.ts` | Queries, filler marks, permissions |
| `sphere-limit.logic.ts` | Pure function 5.2 |
| `sphere-overview.logic.ts` | Pure function 5.3 |
| `cleanup.logic.ts` | Pure function 5.5 |
| `location-query.ts` | Builds the Prisma `where` from the filters |
| `dto/location.dto.ts` | DTOs 5.6 |

### 5.2 Sphere limit for players

1. `lowestOpenSphere` = the lowest sphere with at least one location with `checked = false`. Ignore the locations of finder slots with reached goal (main 11.3).
2. `visibleMaxSphere` = `lowestOpenSphere + room.sphereOffset`.
3. If all locations are checked, all spheres are visible.
4. Admins and admin helpers see all spheres.

### 5.3 Sphere overview

1. For each sphere: number of open, found and total locations.
2. Admin and helper: for the open locations of each sphere, the number of each item type. Progression and filler. Filler = useful + normal + trap (F 2.2).
3. Option `excludeGoaled` (F 2.3, switch): each user sets the switch for the own views. It is a filter of the stores `sphereOverview` and `locations`, not a room setting. With the switch on, locations of finder slots with reached goal are not counted. Items for receiver slots with reached goal count as filler. "Reached goal" is the same rule as in the roster (main 11.3).
4. Player and visitor: only spheres up to `visibleMaxSphere`, without item types.

### 5.4 Endpoints

| Method and path | Role | Function |
|---|---|---|
| `GET /api/rooms/{slug}/spheres` | visitor (5.7) | Sphere overview (5.3) and `lowestOpenSphere`, `visibleMaxSphere` |
| `GET /api/rooms/{slug}/locations` | visitor (5.7) | Location list with paging, filters and sort (5.6) |
| `PUT /api/rooms/{slug}/locations/{id}/filler-mark` | player (5.8) | Set the filler mark |
| `DELETE /api/rooms/{slug}/locations/{id}/filler-mark` | player (5.8) | Remove the filler mark |
| `GET /api/rooms/{slug}/sphere-cleanup` | helper | Data for the clean-up text (5.5) |
| `PATCH /api/rooms/{slug}/settings` | admin | Existing endpoint. New fields `sphereOffset`, `visitorsSeeLocations`, `playersMarkFiller` |

### 5.5 Clean-up data

1. Query: `fromSphere`, `toSphere`, `slots` (`all` or `progression`, F 8), `excludeGoaled`.
2. Answer: for each finder slot with open locations in the spheres: slot ID, slot name, Discord user ID, Discord name, number of progression, useful, normal and trap items.
3. The app makes the text (6.6). The server does not make Discord text.

### 5.6 Location list

1. Query parameters: `state` (`open`, `found`, `filler`), `view` (`admin`, `user`), `slots` (`all`, `mine` or a list of slot IDs), `itemTypes` (list), `fromSphere`, `toSphere`, `excludeGoaled`, `sort` (`sphere`, `finder`, `location`, `game`, `receiver`, `item`), `order`, `offset`, `limit` (maximum 200).
2. `state`: `open` = `checked = false`. `found` = `checked = true`. `filler` = `fillerMarkedAt` is not null.
3. Answer: `{ total, rows }`.
4. Row for `view=user` (`LocationUserRowDto`): `id`, `sphere`, `finderSlotId`, `finderName`, `discordName`, `game`, `locationName`, `fillerMarked`, `canMarkFiller`.
5. Row for `view=admin` (`LocationAdminRowDto`): the fields of 5.6.4 and `receiverName`, `itemName`, `itemType`, `fillerMarkedByName`, `fillerMarkedAt`.
6. `view=admin` needs the role helper. Else 403.
7. `view=user`: the server ignores `itemTypes`. For `state=open`, it limits `toSphere` to `visibleMaxSphere`. For `state=found` and `state=filler`, there is no sphere limit: found locations are no spoiler, and only an admin or a helper can mark a location in a high sphere.
8. Two DTO classes, not one class with optional fields. So the user answer can never contain an item.

### 5.7 Visitors

1. `GET .../spheres` and `GET .../locations` with `view=user`: a visitor gets 403 if `room.visitorsSeeLocations` is false.
2. `slots=mine` needs a login.

### 5.8 Filler mark permissions

1. Admin and helper: each location.
2. Player: only if `room.playersMarkFiller` is true, and only locations of the own slots (`Slot.discordUserId` = Discord ID of the user) (F 8).
3. Visitor: never.
4. A checked location cannot get a new mark. An existing mark stays when the location becomes checked.
5. The check is a method `LocationsService.assertCanMarkFiller(user, membership, location)`. Unit tests for each case.

## 6. App

### 6.1 Routes

New child routes of `/room/:slug` in `app/src/router/index.ts`:

| Path | Name | View | Meta |
|---|---|---|---|
| `spheres` | `spheres` | `SphereOverviewView.vue` | – |
| `locations/open` | `locations-open` | `LocationsView.vue` | `locationState: 'open'` |
| `locations/found` | `locations-found` | `LocationsView.vue` | `locationState: 'found'` |
| `locations/filler` | `locations-filler` | `LocationsView.vue` | `locationState: 'filler'` |

1. `RouteMeta` gets `locationState?: 'open' | 'found' | 'filler'` and `requiresRole` gets the value `'helper'`.
2. The query parameter `view=admin` selects the admin view. The view switch shows only for helper and admin. `router.beforeResolve` removes `view=admin` for other roles.
3. `RoomHeader.vue` shows the links "Spheres" and "Locations" only if the room has seed data and the user can see it (5.7).
4. The admin settings are new tabs in `AdminView.vue` (6.4).

### 6.2 Stores

| Store | File | State and actions |
|---|---|---|
| `seed` | `stores/seed.ts` | `seed: SeedData \| null`; `fetch()`, `upload(file)` |
| `sphereOverview` | `stores/sphere-overview.ts` | `spheres`, `lowestOpenSphere`, `visibleMaxSphere`, `excludeGoaled`; `fetch()` |
| `locations` | `stores/locations.ts` | `filters`, `rows`, `total`, `loading`, `view`; `fetchPage(offset, limit, sort)`, `setFilters()`, `markFiller(id)`, `unmarkFiller(id)` |
| `sphereCleanup` | `stores/sphere-cleanup.ts` | `options`, `entries`; `fetch()`; getter `messages` (6.6) |
| `serverAdmin` | `stores/server-admin.ts` | `status`, `job`; `login()`, `logout()`, `sendLocation()`, `sendItem()`, `release()`, `collect()`, `releaseSpheres()`, `pollJob()` |

1. Only store actions send HTTP requests or use the socket (main 16.3).
2. `locations.filters` persist with `pinia-plugin-persistedstate` for each room, as `tableFilters`.
3. `currentRoom` gets `isHelper` (role helper or admin).

### 6.3 Components

Functional components (no props, no events, data from stores):

| Component | Folder | Content |
|---|---|---|
| `SphereOverviewPanel.vue` | `components/spheres` | Overview table with switch "Exclude slots with reached goal" |
| `LocationFilterBar.vue` | `components/locations` | Filters F 4: slot dropdown with "All", "Mine" and single slots with search (`MultiSelect` with `filter`), item type (`MultiSelect`, admin view only), sphere range (`Slider` with `range` and two `InputNumber`) |
| `LocationListPanel.vue` | `components/locations` | Table with lazy loading, page from the `locations` store |
| `SphereCleanupPanel.vue` | `components/spheres` | Options and the messages with copy buttons (6.6) |
| `SeedPanel.vue` | `components/admin` | Upload (`FileUpload` mode `basic`, `.archipelago`) while the room has no seed data. After the upload: only the seed data. A text tells that the upload is possible only one time. |
| `SphereCheckerSettingsPanel.vue` | `components/admin` | `sphereOffset`, `visitorsSeeLocations`, `playersMarkFiller` |
| `ServerConnectionPanel.vue` | `components/admin` | Password input, login status, log out |
| `ServerCommandsPanel.vue` | `components/admin` | Send item, release, collect for a slot; release of spheres |
| `SphereReleaseDialog.vue` | `components/admin` | Sphere range, mode (all, filler, marked), number of locations and progression items, confirmation |
| `ServerJobProgress.vue` | `components/admin` | Progress and result of a command run |

Presentational components (`components/ui`, props only):

| Component | Props |
|---|---|
| `SphereOverviewTable.vue` | spheres, withItemTypes |
| `ItemTypeTag.vue` | itemType |
| `SphereRangeText.vue` | fromSphere, toSphere |

1. Presentational components send no events and have no callback props (main 16.3). So the location tables with the buttons "Mark as filler" and "Send location" are in the functional component `LocationListPanel.vue`, as the tables with buttons in the admin panels. The copy buttons are in `SphereCleanupPanel.vue`.
2. The location tables use PrimeVue `DataTable` with `lazy` and `paginator`. The admin view and the user view have different columns (F 5.1, F 5.2).

### 6.4 Admin view

New tabs in `AdminView.vue`:

| Tab | Panels | Role |
|---|---|---|
| "Seed" | `SeedPanel`, `SphereCheckerSettingsPanel` | admin |
| "Server" | `ServerConnectionPanel`, `ServerCommandsPanel`, `ServerJobProgress` | admin |
| "Sphere clean-up" | `SphereCleanupPanel` | helper |

1. `AdminView` is admin only today. A helper sees only the tab "Sphere clean-up". The route `admin` gets `requiresRole: 'helper'`, and each tab checks the role.
2. `AdminListPanel.vue`: a role selection (admin, helper) when an admin adds a user, and the role in the list. As for admins, a helper is a player of the room or gets an invitation link.
3. `InvitationPanel.vue`: a role selection (admin, helper). `AdminInvitation` gets the field `role String @default("admin")`. Accepting the invitation gives this role.

### 6.5 Domain functions

| File | Function |
|---|---|
| `domain/cleanup-message.ts` | `buildCleanupMessages(entries, options)` (6.6) |
| `domain/item-type.ts` | Order and colors of the item types |

### 6.6 Clean-up text

1. Title line: `# Sphere <n>`, for a range `# Spheres <from>–<to>` (F 3.4).
2. One line for each slot: `<ping or name>, <slot name>: <p> progression, <f> filler (<u> useful, <n> normal, <t> traps)`.
3. Ping: `<@discordUserId>`. A Discord user with more slots gets a ping only in the first line. The other lines use the Discord name (F 8, "Pings").
4. A slot without a Discord user uses the slot name without ping.
5. Maximum 10 pings in one message. If there are more, start a new message with the title line. Lines of the same Discord user stay in the same message.
6. Discord has a limit of 2,000 characters for each message. Also start a new message before this limit.
7. Each message has a copy button (`navigator.clipboard.writeText`).
8. Unit tests: 0, 10, 11 and 25 pings; users with more slots; slots without a Discord user; 2,000 characters.

### 6.7 Texts

All new texts in `de.json5` and `en.json5`: navigation, column names, item types, filters, admin tabs, error codes of the upload and of the server commands.

## 7. Synchronization and live updates

### 7.1 Status of the locations

1. `SyncService.applySource` gets a new step after the slots: `LocationStatusService.applyChecks(tx, roomId, tracker)`.
2. The step reads `player_checks_done` (already in `TrackerData`). For each player number, it sets `checked = true` and `checkedFirstSeenAt = now` for the location IDs that are not checked yet.
3. Only rooms with seed data do this step.
4. Unit test with the fixture `ap-tracker.json` and a small seed.

### 7.2 Live message

1. The Socket.IO channel of a room is public (`room:<slug>`). It must not contain items or receivers.
2. New message `room:locations-changed` with `{ slug, lowestOpenSphere, changedCount }`. The server sends it after a synchronization with changes, after an upload, after a filler mark and after a server command.
3. The stores `sphereOverview` and `locations` load their data again (current page only) when the message arrives.
4. Add the message to `LiveMessageName`, to the OpenAPI document and to `app/src/api/socket.ts`.

## 8. Settings

1. `UpdateRoomSettingsDto` gets `sphereOffset` (`@IsInt() @Min(0) @Max(1000)`), `visitorsSeeLocations` (`@IsBoolean()`), `playersMarkFiller` (`@IsBoolean()`).
2. `RoomDetailDto` gets `hasSeed`, `sphereOffset`, `visitorsSeeLocations`, `playersMarkFiller`.

## 9. Server: module `archipelago-admin`

Folder `server/src/archipelago-admin`.

### 9.1 Files

| File | Content |
|---|---|
| `archipelago-admin.module.ts` | Module |
| `archipelago-admin.controller.ts` | Endpoints 9.5 |
| `admin-session.store.ts` | Passwords in memory (9.2) |
| `admin-connection.ts` | One connection with `archipelago.js` (9.3) |
| `admin-commands.ts` | Builds the command lines (9.4) |
| `admin-jobs.service.ts` | Runs and progress (9.6) |
| `dto/archipelago-admin.dto.ts` | DTOs |

### 9.2 Passwords

1. `AdminSessionStore` is a singleton service with a `Map<roomId, { slotId, serverPassword, roomPassword? }>`. `slotId` is the SlotLock slot for the connection (9.3.2). It does not write to the disk or the database (F 8).
2. After a restart of the server, the map is empty. The status endpoint then gives `loggedIn: false`.
3. The passwords never go to the logs, the snapshots or the answers. The global exception filter (`ApiErrorFilter`) must not show the request body.
4. Optional `roomPassword`: if the Archipelago room has a password, the connection needs it. The admin enters it in the same form.

### 9.3 Connection

1. Before each run, the server wakes the room and gets the current port. A room on archipelago.gg stops after some time without activity and often gets a new port when it starts again.
   1. `GET <archipelagoOrigin>/room/<archipelagoRoomId>` starts the room (same as a visit of the room page).
   2. Then `GET /api/room_status/<archipelagoRoomId>` (`ArchipelagoService.getRoomStatus`) gives `last_port`. If the connection to this port fails, ask again every 2 seconds and try the new port. Stop after 30 seconds with the error `ROOM_NOT_REACHABLE`.
   3. If the room has no `archipelagoRoomId` (main 24.7), the run stops with the error `ROOM_LINK_MISSING`.
2. Address: `wss://<host of room.archipelagoOrigin>:<last_port>`.
3. SlotLock slot: if the room has one selected SlotLock slot, the server uses it. If the room has more, the admin selects one in the login form (`slotId`, 9.5). `client.login(address, slot.archipelagoName ?? slot.name, '', { password: roomPassword, slotData: false })`. Without a game, `archipelago.js` connects as "TextOnly" (F 8: connect as the SlotLock slot).
3. Then `client.messages.say('!admin login <serverPassword>')`.
4. The server waits for a `PrintJSON` packet of the type `AdminCommandResult` (or `CommandResult`) after each line. Timeout: 10 seconds. The text of the answer goes into the result of the command.
5. The connection is open only during one run. After the run, the server sends `!admin logout` and disconnects.
6. Only one run for each room at the same time.

### 9.4 Commands

The same lines as Archipolygo (`AdminCommands.cs`, F 7.2):

| Function | Line |
|---|---|
| Log in | `!admin login <password>` |
| Send an item | `!admin /send "<slot>" "<item>"` |
| Send an item more than one time | `!admin /send_multiple <amount> "<slot>" "<item>"` |
| Send a location | `!admin /send_location "<slot>" "<location>"` |
| Release | `!admin /release <slot>` |
| Collect | `!admin /collect <slot>` |
| Log out | `!admin logout` |

1. Quote: put the value in `"`, and write `\` as `\\` and `"` as `\"`.
2. Slot names: original Archipelago name (`Slot.archipelagoName ?? Slot.name`).
3. Unit tests for each line, with names that contain spaces, `"` and `\`.

### 9.5 Endpoints

All endpoints need the role admin (F 8, "Admin helper").

| Method and path | Function |
|---|---|
| `GET /api/rooms/{slug}/server-admin` | `{ loggedIn, slotId, running }` |
| `PUT /api/rooms/{slug}/server-admin/login` | Body `{ slotId?, serverPassword, roomPassword? }`. `slotId` is necessary if the room has more than one selected SlotLock slot. Connects, logs in, disconnects. Keeps the passwords in memory only if the login is successful. |
| `DELETE /api/rooms/{slug}/server-admin/login` | Removes the passwords from memory |
| `POST /api/rooms/{slug}/server-admin/send-location` | Body `{ locationIds: number[] }` (IDs of `SeedLocation`) |
| `POST /api/rooms/{slug}/server-admin/send-item` | Body `{ slotId, itemName, amount }` |
| `POST /api/rooms/{slug}/server-admin/release` | Body `{ slotId }` |
| `POST /api/rooms/{slug}/server-admin/collect` | Body `{ slotId }` |
| `GET /api/rooms/{slug}/server-admin/release-spheres/preview` | Query `fromSphere`, `toSphere`, `mode` (`all`, `filler`, `marked`). Answer: number of locations, number of progression items |
| `POST /api/rooms/{slug}/server-admin/release-spheres` | Body `{ fromSphere, toSphere, mode }` |
| `GET /api/rooms/{slug}/server-admin/jobs/{id}` | Progress and result of a run |
| `DELETE /api/rooms/{slug}/server-admin/jobs/{id}` | Stops a run after the current line |

1. Each command endpoint starts a run and gives the job ID at once (HTTP 202).
2. `release-spheres` mode `all`: all open locations in the spheres. `filler`: only open locations with an item type other than `progression`. Only the item type counts. Items for slots with reached goal are not filler in this mode. `marked`: only open locations with a filler mark (F 8, "Release of spheres").
3. `send-item`: the item name must exist in the datapackage of the game of the slot (`Datapackage.itemNames`). A new endpoint `GET /api/rooms/{slug}/server-admin/items?slotId=` gives the item names for the input field (`AutoComplete`).

### 9.6 Runs

1. `AdminJobsService` keeps the runs in memory: ID, room, user, command, number of lines, lines done, errors, state (`running`, `done`, `failed`, `stopped`).
2. The server sends the lines one after the other. A release of a sphere sends one `/send_location` for each location (F 8: acceptable).
3. The app asks for the progress every second while a run is active (`serverAdmin.pollJob`). The progress does not use the public Socket.IO channel.
4. After the run, the server starts a synchronization (main 5.2) and sends `room:locations-changed`.
5. Before each release, collect and release of spheres, the app shows a confirmation dialog (`ConfirmDialog` of PrimeVue). For `release-spheres`, the dialog shows the numbers of the preview endpoint.

### 9.7 Tests

1. Unit tests with a fake `archipelago.js` client: login, wait for the answer, timeout, stop, logout after an error.
2. No test connects to archipelago.gg.
3. Manual test with a test room on a local Archipelago server before the release of phase P6.

## 10. OpenAPI and types

1. All new DTOs and the live message go into the OpenAPI document (main 17).
2. After each server change: `npm run build`, then `npm run api:check`.

## 11. Implementation phases

Each phase ends with the standard check of `CHECKLIST implementation.md`.

### Phase P1 – Seed data

1. Pickle decoder with tests (4.2, 4.7).
2. Multidata reader, item type, fixtures (4.3, 4.4).
3. Command `seed:report`. Test with the multidata file of the Big Chill room. Make sure that `Slot.position` is the player number (4.5.1).
4. Prisma migration `sphere_checker` (section 3).
5. Upload and check, only one upload for each room (4.5, 4.6). nginx limit.
6. Admin tab "Seed" with `SeedPanel`.

### Phase P2 – Location status

1. `applyChecks` in the synchronization (7.1).
2. Live message `room:locations-changed` (7.2).

### Phase P3 – Views

1. Sphere limit and sphere overview (5.2, 5.3) with tests.
2. Location list with filters, paging and sort (5.6).
3. Routes, stores, components (6.1 to 6.3).
4. Settings `sphereOffset`, `visitorsSeeLocations` (section 8).
5. E2E test: admin uploads a fixture, opens the overview and the lists, switches between user view and admin view.

### Phase P4 – Filler marks and admin helper

1. Role `helper` (3.3), role selection in the admin list (6.4.2).
2. Filler marks with permissions (5.8), setting `playersMarkFiller`.
3. E2E test: player marks an own location, player cannot mark a location of another slot, helper sees the admin view.

### Phase P5 – Sphere clean-up

1. Clean-up data endpoint (5.5).
2. `buildCleanupMessages` with tests (6.6).
3. `SphereCleanupPanel`.

### Phase P6 – Server connection

1. `archipelago.js`, connection, command lines, password store (9.2 to 9.4).
2. Endpoints and runs (9.5, 9.6).
3. Admin tab "Server", dialogs, progress.
4. Button "Send location" in the admin table.
5. Manual test with a local Archipelago server (9.7.3).

## 12. Risks

1. **Pickle:** a mistake in the decoder can let an attacker run code only if the decoder runs code. The decoder of 4.2 has no path that runs code. The tests of 4.7.2 check the rejection.
2. **Size:** a room with more than 100,000 locations makes the upload slow. Insert in blocks (3.1.2) and show a progress spinner.
3. **Archipelago versions:** a new multidata format version or a change of the admin commands stops the functions. The reader accepts only known versions and shows a clear error.
4. **Passwords in memory:** a crash dump of the Node process can contain the passwords. The passwords are not on the disk.
5. **Chat:** all players see the admin commands in the chat (F 7.1.6). This is accepted (F 8).
6. **Wrong release:** a release cannot be undone. The confirmation dialog (9.6.5) shows the numbers before the run.

## 13. Open questions from the implementation

The implementation uses the solution in the column "Solution now". The developer can change it later.

| No. | Question | Solution now |
|---|---|---|
| 13.1 | An item for an item link group has the group as receiver. The group is not a slot. How must the views show it? | `SeedLocation.receiverSlotId` is empty, `receiverName` is the name of the group. Filters by receiver do not find these items. |
| 13.2 | With "minimal accessibility", some locations are in no sphere. Where do they go? | Sphere = number of spheres (after the last sphere). The seed data shows the number of these locations. |
| 13.3 | `Slot.position` must be the Archipelago player number (4.5.1). | Checked with the fixtures and with the multidata file of the Big Chill room (player numbers 1 to 116 in the order of the names). Not checked with the real Cheese tracker of the Big Chill room. |
| 13.4 | A game without a checksum in the datapackage of the multidata file. | The server does not save its datapackage. The item names for "Send item" then come only from the locations of the seed. |
| 13.5 | "Items for slots with reached goal count as filler" (F 2.3): in which filler type? | With the switch "Exclude slots with reached goal", a progression item for such a slot counts as "normal". Useful items and traps keep their type. |
| 13.6 | Do the location filters stay for each room? | The filters stay in the browser for all rooms together, as the roster filters. |
| 13.7 | Can an admin change the role of an existing admin or helper? | Yes: "Make admin" with the other role changes the role. The tracker owner always stays admin. An invitation link for a helper does not make an admin a helper. |
| 13.8 | Who can remove a filler mark? | The same users who can set it (5.8), also when the location is checked in the meantime. |
| 13.9 | In which language is the Discord text? | In the language of the app of the user who makes the text (German or English). |
| 13.10 | In which order are the lines of the Discord text? | In the order of the slot numbers. The lines of a Discord user with more slots stay together at the position of the first slot. |
| 13.11 | How does the server know that an admin command was successful? | The Archipelago server answers only errors directly (`AdminCommandResult`). The server sends the lines with a pause of 300 ms and shows each error answer in the result of the run. It does not check each line one by one. |
| 13.12 | Not tested with a real Archipelago server. | The protocol is tested with a small fake server (`server/test/support/fake-archipelago-server.ts`). A test with a real room is still necessary (9.7.3). |

## 14. Deviations during the implementation

1. **Prisma types:** location IDs and item IDs can be larger than 2^31. `SeedLocation.locationId` and `SeedLocation.itemId` are `BigInt`. The DTOs give them as numbers.
2. **`@types/multer`:** not added. The controller uses a small own type for the uploaded file. `FileInterceptor` uses the memory storage of `multer` by default.
3. **`SeedData`:** new field `unreachableLocationCount` (13.2).
4. **`SeedLocation`:** `receiverSlotId` is optional and `receiverName` is new (13.1).
5. **Visitors:** a request of a visitor to an endpoint with `@RequireRoomRole` gives HTTP 403, as all other endpoints of the application.
6. **Location list (5.6):** two endpoints instead of the parameter `view`: `GET /api/rooms/{slug}/locations` (user view) and `GET /api/rooms/{slug}/locations/admin` (helper). So each endpoint has exactly one row type in the OpenAPI document.
7. **Slot filter (5.6.1):** `slots` has the values `all`, `mine` and `selected`. With `selected`, the parameter `slotIds` gives the slots.
8. **Sphere overview (5.3):** the item types come in a separate list `itemTypes`. It is `null` for players and visitors.
9. **Live message (7.2):** the live store gives the message to `currentRoom.applyLocationsChanged`, because only `currentRoom` receives socket data (main 16.4.3). This action loads the sphere overview and the current page again.
10. **View switch (6.1.2):** the router gives `view=admin` to the store action `locations.enter`. The store opens the admin view only for helpers and admins.
11. **Filler marks (5.4):** the endpoints give HTTP 204 and send `room:locations-changed`. The app then loads the current page again.
12. **Tests of the role calculation:** new unit tests for `RoomRoleService` (main 19.1), also for the role `helper`.
13. **Admin page for helpers (6.4.1):** a helper opens the admin page and sees only the tab "Sphere clean-up". Without seed data, the page shows a message. The data of the other admin tabs is loaded only for admins.
14. **Clean-up endpoint (5.5):** `fromSphere` and `toSphere` are necessary. The server changes their order if `fromSphere` is larger.
15. **Chat packet (9.3):** the server sends the `Say` packet directly, because `client.messages.say()` of `archipelago.js` waits for the echo of the line. The echo of the login hides the password, so the wait never ends.
16. **Timeouts (9.3):** the connection gets 10 seconds to open. After the logout, the server waits a short time before it disconnects, so that the logout line arrives.
17. **Job endpoints (9.5):** `GET /api/rooms/{slug}/server-admin/job` gives the last run of the room. `DELETE /api/rooms/{slug}/server-admin/jobs/{id}` stops it. The status endpoint also contains the last run.
18. **Port (9.3.1):** the server reads `last_port` from `GET /api/room_status`. It does not keep the port in the database.
19. **Development packages:** `ws` and `@types/ws` for the fake Archipelago server in the tests.
20. **Item names (9.5.3):** from the newest datapackage of the game of the slot. Without a datapackage, the names of the items that the slot receives in the seed.
