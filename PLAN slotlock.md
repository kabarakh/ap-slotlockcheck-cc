# Slotlock Tracker – Implementation Plan

Version: draft v3 (2026-10-24)
Language: ASD-STE100 (Simplified Technical English)

References in the form "6.7" mean section 6, item 7.

Sections 1 to 11 and 13 describe the functions. Sections 2, 12 and 14 to 24 describe the technical implementation. Section 24 lists the deviations during the implementation.

## Glossary

Always use the same word for a term. Do not use a synonym. The terms agree with the glossary of the project Archipolygo (`.claude/skills/deutsch-ste/SKILL.md`, German terms in the column "Archipolygo").

| Term | Meaning | Archipolygo | Do not use |
|---|---|---|---|
| room | The multiworld game on the Archipelago server. In this application: one tracked room with its Cheese Tracker, SlotLock slots and settings (`Room`). | Raum | event, multiworld (as a term), session (for the room) |
| slot | A player position in the room. | Slot | player account |
| SlotLock slot | A slot with the game "SlotLock". It receives the unlock items. | – | lock slot |
| locked slot | A slot that one or more SlotLock slots lock (6.4). | – | blocked slot |
| start slot | A playable slot that no selected SlotLock slot locks. SlotLock gives its unlock item as start item, so the slot is open from the start (6.9). UI: "Frei ab Start" / "Open from start". | – | not locked (for a start slot) |
| roster | The list of all slots in the room (11.2, `RosterView`). | Roster | slot list, player list |
| item | An object that a slot receives or sends. | Item | object |
| unlock item | An item "Unlock &lt;slot name&gt;" (6.1). | – | key, lock item |
| hint | A message from Archipelago about the location of an item. | Hint | tip |
| user | A person who uses the application. | Benutzer | – |
| visitor | A user without login (10.4). | – | guest |
| player | A logged-in user with one or more slots in the room (10.5). Never use "player" for a slot. | – | participant |
| admin | A user with admin rights for a room (10.6). | – | moderator, organizer |
| tracker owner | The owner of the Cheese Tracker of the room (4.3). | – | organizer |
| synchronization | The periodic fetch of Cheese and Archipelago data by the server (section 5). | – | catch-up, refresh |
| developer | The person who maintains this repository and makes the decisions. | Entwickler | user (for this person) |

Technical names stay unchanged, for example Socket.IO "rooms" (always written "Socket.IO room") and Socket.IO messages.

## 1. Scope

1. The application shows the lock status of all slots in an Archipelago room.
2. The application can keep more than one room at the same time.
3. Each room has one Cheese Tracker and one or more SlotLock slots.
4. The application gets data from the Cheese Tracker API and the Archipelago API.
5. The application does not change data in these systems.

## 2. Technical stack

1. Backend: NestJS (TypeScript), folder `server`.
2. Database: SQLite with Prisma.
3. Frontend: Vue 3, Vite, Pinia, Vue Router, vue-i18n (German, English), PrimeVue. Folder `app`.
4. Initial data transfer to the browser: HTTP requests (AJAX) with a typed client (`openapi-fetch`).
5. Live updates to the browser: Socket.IO. The server sends changes after each synchronization.
6. The connection from the server to Cheese and Archipelago uses HTTP polling only.
7. Shared types between `server` and `app`: OpenAPI document from NestJS, TypeScript types generated in `app` (see section 17).
8. Login: Discord OAuth. Session: JWT in an HttpOnly cookie.
9. Tests: Vitest in both workspaces. End-to-end tests: Playwright.
10. Lint and format: ESLint, oxlint, Prettier. Each workspace has its own configuration.
11. Runtime: Node.js 26.
12. Delivery: one Node process. NestJS serves the API, the Socket.IO endpoint and the built frontend (`app/dist`).
13. Hosting: punkt.de proServer. pm2 monitors the Node process. nginx is the reverse proxy. Docker is not used.
14. Validation of external API responses: Zod.
15. Repository and CI: GitHub, GitHub Actions. Deployment from GitHub Actions with rsync and SSH.

## 3. Data sources

1. Cheese Tracker (main instance: `https://cheesetrackers.theincrediblewheelofchee.se`):
   1. `GET /api/tracker/{tracker_id}`:
      - Tracker: `title`, `description`, `owner_ct_user_id`, `owner_discord_username`, `room_link`, `upstream_url` (Archipelago tracker URL), `last_port`, `inactivity_threshold_yellow_hours`, `inactivity_threshold_red_hours`, `updated_at`.
      - `games[]` (one entry for each slot): `id`, `position`, `name`, `game`, `checks_done`, `checks_total`, `last_activity`, `notes`, `discord_username`, `effective_discord_username`, `effective_discord_user_id`, `claimed_by_ct_user_id`, `user_is_away`, `tracker_status`, `progression_status`, `completion_status`, `availability_status`.
      - `hints[]`: not used.
   2. `GET /api/tracker/{tracker_id}/checks_history`: `checks_done` for each slot (key: `games[].id`) in steps of 10 minutes, also for the time before the first synchronization. Used for 7.4.
   3. Enum values:
      - `tracker_status`: `disconnected`, `connected`, `ready`, `playing`, `goal_completed`
      - `progression_status`: `unknown`, `unblocked`, `bk`, `go`, `soft_bk`
      - `completion_status`: `incomplete`, `all_checks`, `goal`, `done`, `released`
      - `availability_status`: `unknown`, `open`, `claimed`, `public`
      - The JSON spelling is `snake_case` (`#[serde(rename_all = "snake_case")]` in the Cheese source code).
   4. Data formats:
      - `tracker_id` is a UUID in URL-safe Base64 without padding (22 characters). Validate the input in this format.
      - `effective_discord_user_id` is a string (64-bit number). Keep it as a string in Zod, in the database and in TypeScript.
      - Optional fields can be missing in the JSON. Use `.optional()` in Zod, not only `.nullable()`.
   5. Each `GET /api/tracker/{tracker_id}` can make Cheese read the Archipelago tracker again (if its data is older than the Cheese setting `tracker_update_interval`).
2. Archipelago:
   - `GET /api/room_status/{room_id}`: slot names and games.
   - `GET /api/tracker/{tracker_id}`: received items, activity timers, checks.
   - `GET /api/static_tracker/{tracker_id}`: datapackage checksums, total locations.
   - `GET /api/datapackage/{checksum}`: item names.
3. The Cheese API has no documentation. The source code is public: `https://github.com/cdhowie/cheese-trackers` (Rust, AGPL-3). Use `server/src/api/tracker.rs` and `server/src/db/model.rs` as reference for the Zod schemas. Do not copy code. Isolate all API access in one module for each source.
4. Cheese does not give the received items. The Archipelago API is necessary for the lock logic.

## 4. Room creation

1. The user logs in with Discord.
2. The user enters a Cheese Tracker ID.
3. The application reads the tracker owner from the Cheese data. Cheese gives only `owner_ct_user_id` (internal Cheese user ID) and `owner_discord_username`. Cheese does not give the Discord user ID of the owner.
4. The application checks the owner in this sequence:
   1. Slot check: find a slot with `claimed_by_ct_user_id` = `owner_ct_user_id`. If its `effective_discord_user_id` is the Discord user ID of the user, the user is the owner.
   2. Name check: if no such slot exists, compare `owner_discord_username` with the Discord user name of the user.
   3. If no check agrees, stop the creation. Show an error message. The message tells the user what to do: claim a slot in Cheese, log in to Cheese again (to update the user name there), or set the own Cheese account as owner of the tracker.
   4. Never ask the user for a Cheese API key.
5. The application reads the Archipelago room and the Archipelago tracker from the Cheese data.
6. The application finds all slots with the game "SlotLock". The admin selects the SlotLock slots for the room.
7. The application makes a URL for the room, for example `/room/big-chill`.
8. The tracker owner becomes the first admin of the room.

## 5. Data synchronization

1. Synchronize each room every 5 minutes.
2. An admin can start a synchronization manually with the button "Synchronize now".
3. Do not start a manual synchronization if the last synchronization is less than 1 minute old.
4. Get the datapackage only when its checksum changes.
5. Keep the data of each synchronization in the database.
6. If an API request fails, keep the last data. Show the time of the last successful synchronization.
7. After each synchronization, send the changes to all connected browsers.

## 6. Lock logic

1. Find the unlock items. An unlock item is a received item of a SlotLock slot with the name "Unlock &lt;slot name&gt;".
2. Ignore all items with the name "Unlock Bonus Slot &lt;n&gt;". Bonus slots are virtual slots. Do not show them.
3. Ignore all items with the name "Nothing".
4. A slot is locked by a SlotLock slot when an "Unlock &lt;slot name&gt;" item for this slot exists.
5. An admin can change the lock assignment for each SlotLock slot. An admin can mark a slot as "not locked".
6. If one SlotLock slot receives more than one unlock item for the same slot, use only the first item.
7. A slot is unlocked when each SlotLock slot that locks it has received at least one unlock item for it.
8. "Unlocked by" is the sender of each first unlock item. Show one sender for each SlotLock slot.
9. A playable slot that no selected SlotLock slot locks is a start slot. SlotLock gives the unlock item of each slot that it does not lock as start item. The Archipelago API does not show start items, so the server uses the slot data: a selected SlotLock slot has slot data and the slot is not in its `locked_slots`. SlotLock slots and slots without slot data have the status "not locked".

## 7. Unlock time

1. The Archipelago API gives no time for received items.
2. Record the time when the application finds an unlock item for the first time.
3. The unlock time of a slot is the time of the last necessary unlock item (see 6.7).
4. Unlock items from the first synchronization have no known time. Estimate their time automatically:
   1. Get `GET /api/tracker/{tracker_id}/checks_history` from Cheese.
   2. The estimated unlock time of a locked slot is the time of the first data point where `checks_done` of this slot increases.
   3. Mark this time as "estimated". The precision is 10 minutes.
   4. If no increase exists, mark the time as "time unknown".
5. An admin can import unlock times from a CSV file.
6. An admin can set or change one unlock time manually.
7. Priority of the sources: manual and CSV before estimated, estimated before "time unknown". An estimation never replaces a manual or CSV time.
8. Show the source of each unlock time in the roster (icon or tooltip).

## 8. Inactivity

1. Calculate inactivity only for unlocked slots and start slots.
2. Inactivity = current time minus the latest of these values: the last activity in Cheese, the last "Still BK" click in Cheese (`last_checked`), the activity timer of Archipelago, or the unlock time.
3. If a value is unknown, use the other values only. Cheese also sets `last_checked` when a player sets the status to BK.
4. Use the yellow and red limits from the Cheese Tracker as default values.
5. An admin can change the limits for each room.
6. Show yellow or red color when inactivity is more than the limit.

## 9. Warnings

1. Admins give warnings manually.
2. A warning has a slot, a date, an admin, and a text.
3. An admin can delete a warning.
4. The application shows the number of warnings for each slot and for each player.

## 10. Users and roles

1. Use Discord OAuth for login.
2. Compare the Discord user ID with the Cheese field `effective_discord_user_id`. This gives the slots of a user in each room.
3. Roles for each room: visitor, player, admin.
4. A visitor has no login. A visitor can see all public views.
5. A player is a logged-in user with at least one slot in the room. A player can see "My slots".
6. An admin can:
   - select other players of the room as admins,
   - remove admin rights (but not from the tracker owner),
   - change the room settings,
   - start a manual synchronization,
   - give and delete warnings,
   - set unlock times.
7. Optional: An admin can make an invitation link for a Discord user who has no slot in the room. The link is valid for one use and for a limited time. The user opens the link and logs in with Discord. Then the user becomes an admin of the room.

## 11. Views

1. Room list: all rooms, with title, status, and percentage of unlocked slots.
2. Roster: slot number, slot name, Discord user, game, lock status, unlocked by, unlock time, inactivity, progression status, completion status, availability status (all three from Cheese), Cheese notes, warnings, number of unlock items that this slot sent ("has unlocked").
3. Player summary: number of slots, unlocked slots, goaled slots, locked slots, warnings.
   - A slot is "goaled" when its Cheese `completion_status` is `goal`, `done` or `released`, or when Archipelago reports the client status "goal" (30). This applies to 11.3, 11.4 and 11.9.
   - Each count also shows the names of the slots.
4. Global statistics: number and percentage of unlocked slots, goaled slots, slots with all checks, number of players for each count of locked slots, number of players for each count of unlocked slots.
5. My slots: the slots of the logged-in user, with the same columns as 11.2.
6. Admins see a hint with the slots that have no Discord user in Cheese.
7. Admin area: room settings, lock assignment, admins, warnings, unlock times, CSV import, "Synchronize now".
8. Make filters and sort functions for all tables.
9. Unlock tree: a tree graphic. The selected SlotLock slot is the root. Each unlocked slot is below the slot that sent its unlock item. If more than one unlock item was necessary, the sender of the last one counts. If the sender is unknown, the slot is below the SlotLock slot. Start slots are below the SlotLock slot. Slots with reached goal have their own color. Locked slots are not in the tree.

## 12. Implementation steps

Each phase ends with: lint without errors, type check without errors, all tests pass.

### Phase 0 – Repository

1. Make the root project and the two workspaces (section 14).
2. Make the NestJS project with the Nest CLI (15.1).
3. Make the Vue project with `create-vue` (16.1).
4. Make the root scripts (section 18). Make sure that `npm run dev`, `npm run build`, `npm run lint` and `npm test` work for both workspaces.
5. Install the latest versions of all tools (section 14.6).
6. Initialize Git. Activate the Husky Git hooks (18.1).
7. Make the GitHub repository. Make the CI workflow (20.1).
8. Add Playwright and one smoke test (19.4).

### Phase 1 – Data sources and prototype

1. Make the modules `config`, `prisma`, `cheese` and `archipelago` (15.2).
2. Save real API responses as test fixtures (`server/test/fixtures`), also `checks_history`.
3. Make the prototype CLI command `prototype:report` (15.9). The command uses the real API modules and the real lock logic. It prints the roster and the player summary.
4. Compare the output with the Google sheet "BigChill". Correct the differences.

### Phase 2 – Database, lock logic, synchronization

1. Make the Prisma schema and the first migration (15.5).
2. Make the `lock` module as pure functions. Write unit tests for the lock logic: one SlotLock slot, more SlotLock slots, duplicates, bonus slots, "Nothing" items, admin overrides, name case differences. Write unit tests for the estimation of unlock times (7.4): increase found, no increase, priority of the sources (7.7).
3. Compare the estimated unlock times with the times in the Google sheet "BigChill".
4. Make the `sync` module: scheduler, manual synchronization, snapshots, datapackage cache (15.6).
5. Make the `rooms` module with the public read endpoints.

### Phase 3 – OpenAPI and frontend public views

1. Make the OpenAPI export and the type generation (section 17).
2. Make the Pinia stores and the API client (16.4).
3. Make the public views: room list, roster, player summary, global statistics (11.1 to 11.4).
4. Add filters and sort functions (11.8).

### Phase 4 – Live updates

1. Make the Socket.IO gateway `live` (15.7).
2. Make the store `useLiveStore` in `app`. The store joins the Socket.IO room of the current room and gives the changes to the other stores.

### Phase 5 – Login and roles

1. Make the `auth` module: Discord OAuth, JWT cookie, guards (15.8).
2. Make room creation (section 4).
3. Make the view "My slots" (11.5).

### Phase 6 – Admin area

1. Make the modules `admins`, `warnings`, `unlock-times`.
2. Make the admin views (11.7), the CSV import (7.5) and "Synchronize now" (5.2, 5.3).

### Phase 7 – Optional: invitation links (10.7)

Each phase from 3 to 7 adds Playwright tests for its views (19.4).

### Phase 8 – Delivery

1. Prepare the proServer: nvm, Node, pm2, nginx configuration (20.2 to 20.4).
2. Make the deployment workflow (20.5). Deploy the application.
3. Use the application and the Google sheet in parallel for one room. Compare the data.
4. Stop the use of the Google sheet when the data agrees.

## 13. Risks

1. The Cheese API can change without notice. Monitor errors of the API module.
2. Unlock times before the first synchronization are not known. Use the CSV import.
3. Too many requests can cause a block by the API owners. Do not decrease the interval below 5 minutes. Limit manual synchronization.
4. Slot names in "Unlock &lt;slot name&gt;" items can differ from the slot names in Archipelago (for example in uppercase and lowercase letters). Compare the names without case. Show an error to the admin if a name does not agree.
5. Generated types can be out of date if a developer does not run the generation. Do a check in the build (17.6).
6. The Cheese source code has no rate limit. The main instance can have limits in front of the application. Contact for the main instance: `@theincrediblewheelofcheese` on Discord (from `INSTALL.md`). Each request can make Cheese read the Archipelago tracker (3.1.5). Use the 5-minute interval, sequential requests and a `User-Agent` with the URL of the GitHub repository (15.6.3).
7. If the Cheese or Archipelago response format changes, the Zod validation fails. Then the synchronization keeps the last data (5.6) and the admin sees the error.
8. The owner check by name (4.4.2) can fail if the Discord user name in Cheese is old. The error message tells the user what to do.
9. The estimated unlock time (7.4) can be wrong, for example if a slot has checks that do not need the unlock. The admin can correct it.

## 14. Repository structure

1. Use one root npm project with two workspaces: `server` and `app`. Do not add a third workspace.
2. Structure:

   ```
   /
   ├─ package.json            root, "workspaces": ["server", "app"], scripts only
   ├─ package-lock.json       the only lock file
   ├─ .nvmrc                  Node version (26)
   ├─ .editorconfig
   ├─ .gitignore              node_modules, dist, *.db, .env, test results
   ├─ .gitattributes
   ├─ .husky/                 pre-commit, pre-push
   ├─ .github/workflows/      ci.yml, deploy.yml
   ├─ deploy/                 ecosystem.config.cjs (pm2), nginx.conf.example, post-deploy.sh
   ├─ PLAN slotlock.md
   ├─ server/
   │  ├─ src/
   │  ├─ dist/
   │  ├─ prisma/              schema.prisma, migrations/
   │  ├─ test/                fixtures, integration tests
   │  ├─ openapi.json         generated, in version control
   │  ├─ nest-cli.json
   │  ├─ package.json
   │  └─ tsconfig*.json, eslint.config.*, .prettierrc.json, vitest.config.ts
   └─ app/
      ├─ src/
      ├─ dist/
      ├─ public/
      ├─ e2e/                 Playwright tests
      ├─ index.html
      ├─ playwright.config.ts
      ├─ package.json
      └─ tsconfig*.json, eslint.config.ts, .prettierrc.json, vite.config.ts, vitest.config.ts
   ```

3. Install all packages from the root: `npm install <package>@latest -w server` or `-w app`.
4. Do not keep `package-lock.json` or `node_modules` in the workspace folders.
5. Use the package names `@slotlock/server` and `@slotlock/app`.
6. Versions of tools:
   1. Always install the latest stable version of each tool and each package. Use `@latest` in all create and install commands.
   2. Do not write fixed versions in this plan.
   3. Before each phase, run `npm outdated` in the root. Update all packages to the latest version (`npx npm-check-updates@latest -u --workspaces --root`, then `npm install`).
   4. If a new major version has breaking changes, read the migration guide. Do the update in a separate commit.
   5. Use the latest TypeScript version that `vue-tsc` and the Nest CLI support.

## 15. Server (NestJS)

### 15.1 Creation

1. Make the project with the Nest CLI:

   ```
   npx @nestjs/cli@latest new server --package-manager npm --skip-git --skip-install --strict
   ```

2. Run `npm install` in the root. Delete files that the CLI makes for a standalone project and that the root has (for example a second `.gitignore` if not necessary).
3. Remove Jest from `server`. Install Vitest, `unplugin-swc` and `@swc/core`. Vitest needs SWC for decorator metadata.
4. Set `nest-cli.json`:
   - `"deleteOutDir": true`
   - `"plugins": ["@nestjs/swagger"]` with `introspectComments: true`
5. Make all files with the CLI (`nest g module|controller|service|resource|gateway|guard|filter|interceptor|decorator`). Run the CLI in `server` (`npx nest g …` or `npm run nest -w server -- g …`).
6. Keep the spec files that the CLI makes. Change their syntax from Jest to Vitest.

### 15.2 Modules

All paths are relative to `server/src`.

| Module | CLI command | Function |
|---|---|---|
| `config` | `nest g module config` | Load and validate environment variables (`@nestjs/config`, validation class). |
| `prisma` | `nest g module prisma`, `nest g service prisma` | `PrismaService`. Global module. |
| `cheese` | `nest g module sources/cheese`, `nest g service sources/cheese` | HTTP access to the Cheese API (`getTracker`, `getChecksHistory`). Zod schemas for the raw responses (`cheese.schemas.ts`, see 3.1), raw types with `z.infer`, mapping to internal types. |
| `archipelago` | `nest g module sources/archipelago`, `nest g service sources/archipelago` | HTTP access to the Archipelago API. Zod schemas as in `cheese`. Datapackage cache. |
| `lock` | `nest g module lock`, `nest g service lock` | Lock logic (section 6) and estimation of unlock times (7.4). Pure functions in `lock.logic.ts` and `unlock-estimate.logic.ts`. The service only calls them. |
| `sync` | `nest g module sync`, `nest g service sync` | Scheduler, manual synchronization, snapshots, diff. |
| `rooms` | `nest g resource rooms` (REST, with CRUD) | Room list, room details, roster, room creation, settings. |
| `players` | `nest g module players`, `nest g controller players`, `nest g service players` | Player summary (11.3). |
| `statistics` | `nest g module statistics`, `nest g controller statistics`, `nest g service statistics` | Global statistics (11.4). |
| `live` | `nest g module live`, `nest g gateway live` | Socket.IO gateway. |
| `auth` | `nest g module auth`, `nest g controller auth`, `nest g service auth`, `nest g guard auth/jwt`, `nest g guard auth/room-role` | Discord OAuth, JWT cookie, guards, decorators `@CurrentUser()` and `@RequireRoomRole()`. |
| `admins` | `nest g resource admins` | Admin list of a room. Invitation links (optional). |
| `warnings` | `nest g resource warnings` | Warnings (section 9). |
| `unlock-times` | `nest g resource unlock-times` | Manual unlock time, CSV import. |
| `health` | `nest g module health`, `nest g controller health` | `GET /api/health` with `@nestjs/terminus`: database check (Prisma), memory check, age of the last successful synchronization. The deployment (20.5) uses this endpoint. |
| `cli` | see 15.9 | Commands for the prototype and maintenance. |

Remove the folder `entities` that `nest g resource` makes. The database types come from Prisma.

### 15.3 Code rules

1. Controllers only do HTTP: read the request, call one service method, return a DTO.
2. Services contain the business logic. Only services use `PrismaService`.
3. Only the modules `cheese` and `archipelago` send HTTP requests to external APIs. They validate each response with Zod (`schema.safeParse`). If the validation fails, they throw a `SourceFormatError` with the path of the wrong field.
4. Each response of our API is a DTO class in `dto/`. Each request body is a DTO class with `class-validator` decorators. Zod is only for external data. Do not use Zod for our own DTOs.
5. Do not return Prisma objects from controllers. Map them to DTOs.
6. Use a global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
7. Use the global prefix `/api`.
8. Use one global exception filter. It gives the same error format for all errors (`ErrorDto`).
9. Dates in DTOs are ISO 8601 strings.
10. Use the Nest `Logger`. Log each external request with duration and status.

### 15.4 Roles

1. `JwtGuard` (optional mode): reads the cookie. If a valid token exists, it sets the user. If not, the request continues as visitor.
2. `RoomRoleGuard` with `@RequireRoomRole('player' | 'admin')`: reads the room slug from the route. It calculates the role of the user for this room.
3. Calculate the role in one service method (`RoomRoleService.getRole(user, room)`). Use this method in guards and in `GET /api/rooms/:slug/me`.

### 15.5 Database (Prisma)

1. Use the current Prisma version and its current setup for SQLite (configuration file, driver adapter, output folder of the client). Follow the Prisma documentation of this version.
2. Put the generated client in `server/src/generated/prisma`. Do not keep it in version control.
3. Models:

   | Model | Content |
   |---|---|
   | `User` | Discord ID, name, avatar, last login. |
   | `Room` | Slug, title, Cheese tracker ID, Archipelago room ID, Archipelago tracker ID, owner Discord ID, yellow limit, red limit, status. |
   | `RoomAdmin` | Room, user, flag "owner". |
   | `Slot` | Room, Cheese game ID (`games[].id`), slot number (`position`), name, game, Discord user ID (string), Discord name, checks done, checks total, last activity, progression status, completion status, availability status, Cheese notes, flag "SlotLock slot", flag "selected SlotLock slot". "Goaled" is not a column. It is calculated from the completion status (11.3). |
   | `LockAssignment` | Room, SlotLock slot, locked slot, source (`detected` or `admin`), flag "not locked". |
   | `UnlockItem` | Room, SlotLock slot, locked slot, sender slot, first seen time, unlock time, time source (`sync`, `estimated`, `manual`, `csv`, `unknown`). |
   | `Warning` | Room, slot, admin, date, text. |
   | `SyncRun` | Room, trigger (`schedule`, `manual`), start time, end time, result, error text. |
   | `SyncSnapshot` | Room, source (`cheese`, `ap_room`, `ap_tracker`, `ap_static`), SHA-256 hash of the raw JSON, raw JSON, first sync run, last sync run. Save a new snapshot only if the hash is different from the last snapshot of the same room and source. Else, update only "last sync run". Keep all snapshots. |
   | `Datapackage` | Checksum, game, item names (JSON). |
   | `AdminInvitation` | Room, token hash, valid until, used by, used at. Optional. |

4. Make migrations with `prisma migrate dev`. Use `prisma migrate deploy` at the start of the production process.
5. Keep the SQLite file outside the source folders (environment variable `DATABASE_URL`).

### 15.6 Synchronization

1. Use `@nestjs/schedule`. One interval job runs every minute. It starts the synchronization for each room when the last synchronization is 5 minutes old or older.
2. Only one synchronization for each room at the same time (lock in memory).
3. Do the requests for one room one after the other, not in parallel. Use a timeout for each request. Send a `User-Agent` with the application name, the version and the URL of the GitHub repository (environment variable `HTTP_USER_AGENT`).
4. Sequence:
   1. Get Cheese data.
   2. Get Archipelago room status, tracker and static tracker.
   3. Get the datapackage if the checksum is new.
   4. Validate all responses with Zod.
   5. Save the raw data as `SyncSnapshot` if the hash changed (15.5).
   6. Map the data to slots. Call the lock logic.
   7. Only in the first synchronization of a room: get `checks_history` and estimate the unlock times (7.4).
   8. Write the changes to the database in one transaction.
   9. Make a diff to the last state.
   10. Send the diff to all browsers that show this room (Socket.IO room `room:<slug>`).
5. If a step fails: save `SyncRun` with error, keep the last data, send the sync status to the room.
6. Manual synchronization: `POST /api/rooms/:slug/sync`. Only admins. Give HTTP 429 if the last synchronization is less than 1 minute old.

### 15.7 Live updates (Socket.IO)

1. Use `@nestjs/platform-socket.io` and `@nestjs/websockets`.
2. The client sends `room:join` with the room slug. The server adds the client to the Socket.IO room `room:<slug>`.
3. The server sends:
   - `room:synced` with `RoomSyncedPayloadDto` (changed slot rows, sync status),
   - `room:sync-failed` with `SyncStatusDto`,
   - `room:updated` with `RoomUpdatedPayloadDto` (after admin changes, for example warnings or settings).
4. All live data is public. The gateway does not need authentication.
5. Put the Socket.IO message names and payload DTOs into the OpenAPI document (17.4).

### 15.8 Authentication

1. Use `@nestjs/passport` with a Discord OAuth strategy and `@nestjs/jwt`.
2. Endpoints:
   - `GET /api/auth/discord?returnTo=…`: start OAuth.
   - `GET /api/auth/discord/callback`: save the user, set the cookie, redirect to `returnTo`.
   - `GET /api/auth/me`: current user or `null`.
   - `POST /api/auth/logout`: delete the cookie.
3. Cookie: `HttpOnly`, `SameSite=Lax`, `Secure` in production, limited lifetime.
4. Accept only relative paths for `returnTo`.
5. Protect state-changing requests against CSRF (SameSite cookie and check of the `Origin` header).

### 15.9 CLI commands

1. Use `nest-commander` for commands. The commands use the same modules as the server.
2. Commands:
   - `prototype:report <cheeseTrackerId>`: prints the roster and the player summary (phase 1).
   - `openapi:export`: writes `server/openapi.json` (section 17).
3. Start: `npm run cli -w server -- <command>`.

### 15.10 Configuration

1. Make two template files with all variables:
   - `server/.env.development.example`: values for local development. `PUBLIC_BASE_URL=http://localhost:5173` (Vite). Discord callback: `http://localhost:5173/api/auth/discord/callback` (through the Vite proxy).
   - `server/.env.production.example`: values for production: `PUBLIC_BASE_URL=https://slotlock.example.com` and `DISCORD_CALLBACK_URL=https://slotlock.example.com/api/auth/discord/callback`. Secrets stay placeholders.
2. Keep the templates in version control. Do not keep the real files (`.env.development`, `.env.production`) in version control. They contain secrets.
3. `ConfigModule` loads `.env.${NODE_ENV}`. Validate all variables at start. The application does not start if a placeholder `<…>` is still in a value.

| Variable | Function |
|---|---|
| `PORT` | HTTP port. |
| `PUBLIC_BASE_URL` | Public URL of the application. |
| `DATABASE_URL` | SQLite file. |
| `JWT_SECRET` | Key for the session token. |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_CALLBACK_URL` | Discord OAuth. |
| `CHEESE_BASE_URL` | Base URL of the Cheese API. Default: `https://cheesetrackers.theincrediblewheelofchee.se`. The Playwright tests set it to the mock server (19.4). The Archipelago URL comes from the Cheese data (24.7). |
| `HTTP_USER_AGENT` | `User-Agent` for external requests: `SlotlockTracker/<version> (+https://github.com/<owner>/<repo>)`. |
| `HTTP_TIMEOUT_SECONDS` | Timeout of each external request. Default 30. |
| `TRUST_PROXY` | `true` behind nginx (correct client IP and protocol for the `Secure` cookie). |
| `ADDITIONAL_ORIGINS` | Optional. More origins, separated by commas, that the origin check permits. |
| `SYNC_INTERVAL_MINUTES` | Default 5. Minimum 5. |
| `MANUAL_SYNC_COOLDOWN_SECONDS` | Default 60. Minimum 60. |
| `APP_DIST_PATH` | Path to `app/dist`. |

### 15.11 Delivery of the frontend

1. Use `@nestjs/serve-static`. Root: `APP_DIST_PATH`.
2. Exclude `/api/*` and `/socket.io/*`.
3. Send `index.html` for all other paths (history mode of Vue Router).

## 16. Frontend (app)

### 16.1 Creation

1. Make the project with `create-vue`:

   ```
   npm create vue@latest app
   ```

   Options: TypeScript, Vue Router, Pinia, Vitest, Playwright, ESLint, Prettier, oxlint. No JSX.
2. Run `npm install` in the root.
3. Install: `primevue`, `@primeuix/themes`, `vue-i18n`, `socket.io-client`, `openapi-fetch`, `@vueuse/core`, `pinia-plugin-persistedstate`.
4. Install as dev dependencies: `openapi-typescript`, `vite-plugin-json5` (locale files as in the reference project), `sass-embedded` (only if necessary).
5. Use the reference project `kabarakh/dnd-resource-tracker` for: setup stores, structure of `src`, ESLint/Prettier configuration, locale files.

### 16.2 Structure of `src`

```
src/
├─ main.ts
├─ App.vue
├─ api/
│  ├─ schema.d.ts        generated (section 17), do not edit
│  ├─ types.ts           short type aliases for the generated schemas
│  ├─ client.ts          openapi-fetch client
│  └─ socket.ts          typed Socket.IO client
├─ stores/               one file for each store
├─ router/index.ts
├─ views/                one component for each route
├─ components/<Area>/    for example Slots/, Players/, Admin/, Layout/
├─ locale/de.json5, en.json5
└─ utils/                pure functions (for example time format)
```

### 16.3 Component rules

**There are two types of components: functional components and presentational components.**

- Functional components (`components/<area>/`, views): rules 1 to 9 below.
- Presentational components (`components/ui/`): they get props only. They do not use stores, do not send events (`defineEmits`) and do not use `provide` or `inject`. They can use `useI18n` for texts.

1. Functional components do not use `defineProps`, `defineEmits`, `provide` or `inject`.
2. Each functional component gets its data from Pinia stores. It uses getters (computed), state and actions of the stores.
3. Components communicate only through Pinia stores. Example: a dialog component reads `uiStore.isWarningDialogOpen`. A button calls `uiStore.openWarningDialog(slotId)`.
4. Components do not send HTTP requests and do not use the socket. Only store actions get data.
5. Forms bind with `v-model` to a draft state in the store (for example `settingsStore.draft`). The action `save()` sends the draft.
6. Show table rows and cells inside the table component with PrimeVue column templates. Do not make a component for each row or cell.
7. The router gives the route parameters to the stores. Use `beforeEnter` or a navigation guard that calls a store action (for example `currentRoomStore.open(slug)`). Components do not read `useRoute()` for data.
8. If a component needs data from outside, make it a presentational component with props. Do not add props to a functional component.
9. Use `<script setup lang="ts">`. Use `storeToRefs()` for state and getters.

### 16.4 Stores

All stores use the setup syntax (as in the reference project). All types come from `api/types.ts`.

| Store | State | Getters | Actions |
|---|---|---|---|
| `useAuthStore` | current user, loading | `isLoggedIn` | `fetchMe`, `login(returnTo)`, `logout` |
| `useRoomsStore` | room list | `sortedRooms` | `fetchRooms`, `createRoom` |
| `useCurrentRoomStore` | room, slots, sync status, own role | `isAdmin`, `isPlayer`, `slotById`, `mySlots`, `lockedSlots` | `open(slug)`, `close`, `applySync(payload)`, `requestSync` |
| `useSlotTableStore` | filters, sort for each table | `filteredSlots`, `filteredMySlots` | `setFilter`, `resetFilters` |
| `useInactivityStore` | current time (`useNow`, 1 minute) | `inactivityBySlotId`, `levelBySlotId` (none/yellow/red) | – |
| `usePlayersStore` | – | `playerSummaries` (from slots) | – |
| `useStatisticsStore` | – | `globalStatistics` (from slots) | – |
| `useLiveStore` | connection status | `isConnected` | `connect`, `joinRoom(slug)`, `leaveRoom` |
| `useAdminStore` | admins, settings draft, lock assignment draft | `canRemoveAdmin(id)` | `fetchAdmins`, `addAdmin`, `removeAdmin`, `saveSettings`, `saveLockAssignment` |
| `useWarningsStore` | warnings, dialog draft | `countBySlot`, `countByPlayer` | `fetch`, `create`, `delete` |
| `useUnlockTimesStore` | draft, CSV import result | – | `setTime`, `importCsv(file)` |
| `useUiStore` | open dialogs, messages (toasts), locale, color mode (`system`, `light`, `dark`) | `isDark` | `openDialog`, `closeDialog`, `notify`, `setLocale`, `setColorMode` |

1. Persist only the locale, the color mode and the table filters (`pinia-plugin-persistedstate`).
2. Each action catches errors. It gives them to `useUiStore.notify`.
3. `useLiveStore` gives the socket data to `useCurrentRoomStore.applySync`. It does not change other state.
4. Calculate player summary and statistics in store getters from the roster. Calculate inactivity in the browser with the current time, so the colors change without a new synchronization.

### 16.5 Routes

| Path | View | Access |
|---|---|---|
| `/` | `RoomListView` | all |
| `/rooms/new` | `RoomCreateView` | logged in |
| `/room/:slug` | `RosterView` | all |
| `/room/:slug/players` | `PlayerSummaryView` | all |
| `/room/:slug/statistics` | `StatisticsView` | all |
| `/room/:slug/my-slots` | `MySlotsView` | player |
| `/room/:slug/admin` | `AdminView` with tabs: settings, locks, admins, warnings, unlock times | admin |
| `/invite/:token` | `InvitationView` | logged in, optional |

Guards use `useAuthStore` and `useCurrentRoomStore`.

### 16.6 Development server

1. Vite proxy: `/api` and `/socket.io` (with `ws: true`) to the NestJS port.
2. The browser uses the same origin in development and in production. CORS is not necessary.

### 16.7 Internationalization

1. Use `vue-i18n` in Composition API mode. Languages: German and English.
2. Put all texts in `locale/de.json5` and `locale/en.json5`. Do not write texts directly in templates.
3. Server error messages use error codes. The frontend translates the codes.

### 16.8 Theme

1. Use the PrimeVue preset Aura.
2. Light mode and dark mode. The default is the system setting (`prefers-color-scheme`). The user can change it with a switch in the header.
3. Configure PrimeVue with `darkModeSelector: '.app-dark'`. `useUiStore` sets or removes the class `app-dark` on `<html>`.
4. Use the yellow and red inactivity colors (8.6) from PrimeVue design tokens. Make sure that they have sufficient contrast in both modes.

## 17. Shared types (OpenAPI)

1. Source of truth: the DTO classes in `server/src/**/dto`.
2. The `@nestjs/swagger` CLI plugin reads the DTO types. Add decorators only if the plugin cannot find the type (for example enums, unions).
3. Set `operationIdFactory` so that operation IDs are short and clear (for example `getRoster`).
4. Socket.IO types:
   1. Add the payload DTOs of 15.7 with `extraModels` to the OpenAPI document.
   2. Add an enum `LiveMessageName` with all Socket.IO message names.
   3. In `app/src/api/socket.ts`, make a typed map from Socket.IO message name to payload type.
5. Flow:

   ```
   server DTO classes
     → npm run openapi:export -w server   → server/openapi.json
     → npm run api:generate -w app        → app/src/api/schema.d.ts (openapi-typescript)
     → app/src/api/client.ts              createClient<paths>() (openapi-fetch)
     → app/src/api/types.ts               type SlotRow = components['schemas']['SlotRowDto'] …
   ```

6. Keep `server/openapi.json` and `app/src/api/schema.d.ts` in version control. The root script `api:check` makes both files again and fails if they changed (`git diff --exit-code`).
7. Do not write API types by hand in `app`.
8. Show the Swagger UI at `/api/docs` only in development.

## 18. Root scripts

| Script | Function |
|---|---|
| `dev` | Start `server` (watch) and `app` (Vite) in parallel. |
| `api:sync` | `openapi:export` in `server`, then `api:generate` in `app`. |
| `api:check` | `api:sync`, then check for changes (17.6). |
| `build` | Build `server`, then `api:sync`, then build `app` (type check included). |
| `start` | `prisma migrate deploy`, then `node server/dist/main.js`. |
| `lint` | `lint` in both workspaces (with `--fix`). |
| `lint:check` | Lint in both workspaces without changes to files (for the Git hooks). |
| `format` | `format` in both workspaces. |
| `typecheck` | Type check in both workspaces. |
| `test` | Vitest in both workspaces. |
| `test:e2e` | Build, then Playwright (19.4). |
| `outdated` | `npm outdated` for all workspaces (14.6). |
| `audit:check` | `npm audit --omit=dev --audit-level=moderate --workspaces --include-workspace-root`. |
| `prepare` | `husky` (installs the Git hooks after `npm install`). |

Use `npm-run-all2` (as in the reference project) for parallel and sequential scripts.

### 18.1 Git hooks (Husky)

1. Install `husky@latest` as a dev dependency of the root project. Run `npx husky init` in the root.
2. `.husky/pre-commit` (lints all files of both workspaces, not only the staged files):

   ```
   npm run lint:check
   npm run typecheck
   ```

3. `.husky/pre-push`:

   ```
   npm run audit:check
   npm test
   ```

4. If a command fails, the hook stops the commit or the push.
5. Do not use `--no-verify` to skip the hooks.
6. The pre-push hook does not run Playwright (too slow). The CI runs Playwright (20.1).
7. In CI and on the server, set `HUSKY=0`. Then `prepare` does not install hooks.

## 19. Tests

1. Unit tests (Vitest):
   - `server`: lock logic, mapping of Cheese and Archipelago data, diff, role calculation, CSV parser.
   - `app`: store getters (filters, inactivity, statistics, player summary).
2. Integration tests in `server`: controllers with a temporary SQLite database and the fixtures of 12, phase 1.2. No real external requests in tests.
3. Coverage goal for the lock logic: 100 % of the branches.
4. End-to-end tests (Playwright) in `app/e2e`:
   1. Playwright starts the built server (`npm start`) with a temporary SQLite file.
   2. A small mock HTTP server gives the fixture responses for Cheese and Archipelago. `CHEESE_BASE_URL` and `ARCHIPELAGO_BASE_URL` point to the mock server.
   3. The tests do not use the real Discord login. In test mode only, the server has a test login endpoint (`NODE_ENV=test`). The production build must not contain this endpoint.
   4. Test the main flows: room list, roster with filters, live update after a synchronization, "My slots", admin functions (warning, unlock time, "Synchronize now").
   5. Test in Chromium. Add Firefox and WebKit if the time of the CI run is acceptable.

## 20. CI and delivery

### 20.1 CI (GitHub Actions, `ci.yml`)

1. Trigger: push and pull request.
2. Node version from `.nvmrc`. Cache npm.
3. Jobs: `npm ci`, `lint:check`, `typecheck`, `test`, `api:check`, `audit:check`, `build`, `test:e2e`.
4. Upload the Playwright report as artifact if a test fails.

### 20.2 Server preparation (punkt.de proServer)

1. Install nvm for the application user. Install the Node version from `.nvmrc`.
2. Install pm2 globally for this Node version. Activate the start of pm2 after a reboot (`pm2 startup`, `pm2 save`), if the proServer permits this.
3. Folder layout:

   ```
   ~/slotlock/
   ├─ releases/<timestamp>/   one folder for each deployment
   ├─ current -> releases/<timestamp>
   ├─ shared/.env.production  made from server/.env.production.example
   └─ shared/data/slotlock.db
   ```

4. Keep the last 5 releases. Delete older releases.

### 20.3 pm2 (`deploy/ecosystem.config.cjs`)

1. One app `slotlock`, one instance (`exec_mode: 'fork'`). Do not use cluster mode: the scheduler and the in-memory locks (15.6.2) must run only once, and SQLite has one writer.
2. `cwd`: `~/slotlock/current`. Script: `server/dist/main.js`. `NODE_ENV=production`. Environment from `shared/.env.production`.
3. Restart on crash. Limit memory. Write logs with time stamps. Use `pm2-logrotate`.

### 20.3a Responsibility on the proServer

1. It is not yet decided who configures nginx and the pm2 start after a reboot: the project owner or the punkt.de support. Decide this in phase 8.
2. Make `deploy/README.md` so that both can do it: the steps of 20.2 to 20.4, the necessary rights, and the files `ecosystem.config.cjs` and `nginx.conf.example`.

### 20.4 nginx (`deploy/nginx.conf.example`)

1. TLS on nginx.
2. Proxy all requests to `127.0.0.1:<PORT>`.
3. For `/socket.io/`: set `Upgrade` and `Connection` headers, long `proxy_read_timeout`.
4. Set `X-Forwarded-For` and `X-Forwarded-Proto`. NestJS uses `TRUST_PROXY` (15.10).

### 20.5 Deployment (GitHub Actions, `deploy.yml`)

1. Trigger: manual (`workflow_dispatch`) or push of a tag `v*`. Only after a successful CI run.
2. Build in GitHub Actions: `npm ci`, `npm run build`.
3. Copy with rsync over SSH into a new folder `releases/<timestamp>`: root `package.json`, `package-lock.json`, `server/package.json`, `server/dist`, `server/prisma`, `app/dist`, `deploy/`.
4. Run `deploy/post-deploy.sh` over SSH:
   1. Load nvm. Use the Node version from `.nvmrc`.
   2. `npm ci --omit=dev --workspace server` with `HUSKY=0`.
   3. Generate the Prisma client.
   4. Make a copy of the SQLite file.
   5. `prisma migrate deploy`.
   6. Change the link `current`.
   7. `pm2 reload ecosystem.config.cjs`.
   8. Check the health endpoint (`GET /api/health`). If it fails, set `current` back to the last release and reload pm2.
5. SSH key, host and user are GitHub secrets.

## 21. Definition of done for each task

1. Lint, type check and tests have no errors.
2. `api:check` has no changes.
3. New texts exist in German and English.
4. New Vue components obey 16.3.
5. New server files were made with the Nest CLI where possible.
6. **The code has no comments.** Names and small functions tell what the code does. Explain ideas and concepts in `README.md`, never with references to exact code locations. This rule also applies to configuration files.
7. All tools use the latest stable version (14.6). Telemetry, funding messages and update notifiers are off.

## 22. Decisions

| Topic | Decision |
|---|---|
| Shared types | OpenAPI from NestJS + `openapi-typescript` + `openapi-fetch` |
| ORM | Prisma |
| Live updates | Socket.IO |
| Delivery | NestJS serves `app/dist` |
| Session | JWT in HttpOnly cookie |
| Languages | German and English with `vue-i18n` |
| UI library | PrimeVue 4.5 (MIT), see 24.1 |
| Tests | Vitest in both workspaces |
| Lint | ESLint + oxlint + Prettier, one configuration for each workspace |
| Node | 26, installed with nvm |
| Prototype | Standalone Nest application context in `server` (see 24.4) |
| Vue components | Functional components (stores, no props) and presentational components (props only) |
| Versions | Always the latest stable version of each tool |
| Git hooks | Husky: pre-commit = full lint + type check, pre-push = audit (production, `moderate`) + tests |
| External API validation | Zod |
| Snapshots | Save only on change (hash), keep all |
| Theme | PrimeVue Aura, light and dark, default = system setting |
| E2E tests | Playwright, in CI |
| Repository, CI | GitHub, GitHub Actions |
| Hosting | punkt.de proServer, pm2, nginx, no Docker |
| Deployment | GitHub Actions, build in CI, rsync and SSH, `pm2 reload` |
| Discord application | The project owner makes it, with callback URLs for development and production |
| Environment files | Templates for development and production. Production uses placeholders. |
| Health endpoint | `@nestjs/terminus` |
| Production domain | `slotlock.example.com` (dynamic DNS, public IPv4 of the home connection) |
| User-Agent | `SlotlockTracker/<version> (+<GitHub repository URL>)` |
| Owner check | 1. claimed slot of the owner → Discord user ID, 2. Discord user name. Never a Cheese API key. If no match: stop with an instruction. |
| Cheese status columns | `progression_status`, `completion_status`, `availability_status` |
| Goaled | `completion_status` is `goal`, `done` or `released` |
| Unknown unlock times | Automatic estimation from `checks_history`, marked "estimated", the admin can correct it |

## 23. Open points

1. Production domain: decided, `slotlock.example.com` (dynamic DNS of the router). The host is not decided yet (proServer, Raspberry Pi or mini PC at home).
2. proServer: who configures nginx and the pm2 start after a reboot (20.3a)? Decide in phase 8.
3. GitHub repository: the developer makes it and adds the remote. Then replace `<OWNER>/<REPOSITORY>` in the `User-Agent` of the environment files.
4. PrimeVue 5 needs a license key (24.1). Stay on PrimeVue 4.5 (MIT), or buy or request a PrimeUI license and update?
5. Node 26 is not an LTS version yet (October 2026). Keep Node 26 or use Node 24 LTS until Node 26 becomes LTS?
6. Compare the application with the Google sheet "BigChill" (phase 1.4, phase 2.3). This needs the real Cheese tracker ID of the room.

## 24. Deviations during the implementation

1. **PrimeVue:** PrimeVue 5 and `@primeuix/themes` 3 use the PrimeUI License and need a license key. The application uses PrimeVue 4.5, `@primeuix/themes` 2 and PrimeIcons 7 (all MIT). See open point 23.4.
2. **TypeScript:** TypeScript 7 is the latest version. `typescript-eslint` and `@nestjs/swagger` support only TypeScript 6. The project uses TypeScript 6 (14.6.5). `openapi-typescript` asks for TypeScript 5. An npm override gives it TypeScript 6.
3. **better-sqlite3:** version 13 has no prebuilt binaries and needs a C++ compiler. The project uses version 12, the same version as the Prisma adapter.
4. **Commands (15.9):** `nest-commander` does not support NestJS 12. `prototype:report` and `openapi:export` are standalone Node scripts that start a Nest application context.
5. **Discord login (15.8):** the server does the OAuth code flow without Passport. The OAuth state is in a short-lived HttpOnly cookie.
6. **Lock detection (6.4):** the SlotLock apworld writes the locked slots into its slot data (`locked_slots`). The server reads them from `GET /api/slot_data_tracker/{tracker}`. Received unlock items also add a lock assignment.
7. **Archipelago base URL (15.10):** there is no `ARCHIPELAGO_BASE_URL`. The server uses the origin of the Archipelago tracker link from Cheese. `GET /api/room_status` is not necessary and is not called.
8. **Modules (15.2):** there are no server modules `players` and `statistics`. The app calculates player summary and statistics (16.4.4). The room creation is in the module `room-setup`. The shared HTTP client is in `sources/http`.
9. **NestJS 12:** the Nest CLI makes ESM projects with Vitest and oxlint. Jest was not necessary.
10. **User-Agent:** the version is part of the value of `HTTP_USER_AGENT`. The server does not read it from `package.json`.
11. **Fixtures (phase 1.2):** there is no real tracker ID. The fixtures follow the source code of Cheese Tracker and Archipelago.
12. **Production packages:** `prisma` is a production dependency, because `prisma migrate deploy` runs on the server.
13. **Aliases:** Archipelago shows a slot with an alias as "Alias (Name)". Cheese uses this display name. The SlotLock slot data and the unlock items use the original name. The server reads the original names from `GET /api/room_status` (players in the order of the player number) and the aliases from the tracker. It matches a name with the Cheese name, the original name and the parts of the alias display. The roster shows the original name if it differs.
14. **"Still BK":** the inactivity also uses the Cheese field `last_checked` (8.2).
15. **Start slots (6.9):** a new lock status `start_slot` separates start slots from slots that are not locked.
16. **Unlock tree (11.9):** new view, added after the first plan. The app uses `d3-hierarchy` (ISC license) for the layout and draws an SVG.
17. **Statistics from the second Google sheet:** slot names in the player summary, players by number of unlocked slots, column "has unlocked", hint for slots without Discord user, goal and activity timer from Archipelago.
18. **Public test mode:** `npm run dev:public` makes the development environment reachable through the DynDNS name. The new variable `ADDITIONAL_ORIGINS` permits more origins for the origin check (15.8.5).
