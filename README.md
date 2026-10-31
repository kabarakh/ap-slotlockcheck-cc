# SlotLockCheck

SlotLockCheck shows the lock status of all slots in an Archipelago room that uses the game SlotLock. It replaces a manual Google sheet. The functions and the technical plan are in `PLAN slotlock.md`. The progress is in `CHECKLIST implementation.md`.

Language: ASD-STE100 (Simplified Technical English)

## Glossary

The terms are defined in the glossary of `PLAN slotlock.md`. Important: a **room** is the multiworld game on the Archipelago server. The word "event" is not used for a room.

## Architecture

- One npm project with two workspaces: `server` (NestJS) and `app` (Vue).
- The server gets data from the Cheese Tracker and the Archipelago web host by HTTP polling. It keeps the data in SQLite (Prisma).
- The browser gets the first data by HTTP and all later changes by Socket.IO.
- In production, one Node process serves the API, Socket.IO and the built frontend. pm2 monitors the process. nginx is the reverse proxy.

## Concepts

### Shared types

The DTO classes of the server are the only source of the API types. The server writes an OpenAPI document from these classes. The app generates its TypeScript types from this document and uses a typed fetch client. The Socket.IO messages and their payloads are also part of the OpenAPI document. A check in the build fails if the generated files are not current.

### Lock detection

- Each selected SlotLock slot tells in its slot data which slots it locks (`locked_slots`). Archipelago gives this data through the slot data tracker. So the lock assignment is known before the first unlock.
- A slot is unlocked when each SlotLock slot that locks it has received an item "Unlock &lt;slot name&gt;". Only the first item of each pair counts. Items "Nothing" and "Unlock Bonus Slot n" are ignored.
- Slot names are compared without case. Unknown names are shown to the admins.
- An admin can add or remove a lock assignment. This replaces the detected value until the admin resets it.

### Rooms without SlotLock

The functions are in `PLAN async without slotlock.md`.

- A room without a selected SlotLock slot is a room without SlotLock. The admin sets this when the room is made; it cannot be changed later.
- The synchronization makes each slot that is not a SlotLock slot a start slot. So the inactivity, the statistics and the pace statistics work without changes.
- The app hides the lock functions (`hasSlotLock` of the room): lock columns and filters, unlock tree, lock tabs of the setup, lock parts of the statistics and of the room list.
- The server commands connect as a slot that the admin selects from all slots that are not SlotLock slots.

### Room archive

The functions are in `PLAN room archive.md`.

- An archived room (`Room.archivedAt`) is not synchronized: the scheduler ignores it, and a manual synchronization answers `ROOM_ARCHIVED`. All data stays visible, and admins can still change the room.
- Admins archive and reopen a room in the setup tab "Room". The synchronization archives a room automatically when all slots that are not SlotLock slots have reached the goal (`autoArchive`, on by default, in the settings).
- Reopen starts a synchronization at once. Reopen of an automatic archive switches `autoArchive` off, so that the next synchronization does not archive the room again.
- Inactivity and pace use the archive time as the current time, so the values do not change after the archive.
- The room list hides archived rooms. A checkbox shows them.

### Unlock times

- Archipelago gives no time for received items. The server records the time when a synchronization finds an unlock item for the first time.
- Unlock items of the first synchronization have no known time. The server estimates the time from the checks history of Cheese: the first increase of the checks of the locked slot.
- Manual and CSV times have priority over all other times. An estimation never replaces a found, manual or CSV time.

### Inactivity, players and statistics

The browser calculates inactivity, player summaries and statistics from the roster. The statistics show a donut chart for each part of a total and a bar chart for each distribution. `d3-shape` and `d3-scale` calculate the geometry (`charts.ts`); Vue draws the SVG, as for the unlock tree. The colors are CSS variables (`--app-chart-*`), so the charts follow the light and the dark mode. The inactivity counts from the latest of these times: last activity in Cheese, last "Still BK" click in Cheese, activity timer of Archipelago, unlock time. Slots with reached goal have no inactivity. It uses the current time, so the colors change without a new synchronization.

### Game control and setup

Admins and admin helpers have two areas:

- **Game control** (`/control`) contains the work during the game: spheres, the admin view of the locations, messages (inactivity reminder and sphere clean-up), warnings and the Archipelago server. A click on a sphere shows its open locations in a side panel. From there, the admin opens the clean-up text for this sphere or the location list with this sphere as filter. The tabs show counters: the lowest open sphere, the red and yellow slots, the warnings.
- **Setup** (`/admin`) contains the work for the setup of a room: settings, lock assignment, admins, seed, unlock times and room. Admin helpers see only the tabs seed and room.

The URL contains the active tab, so the back button and bookmarks work. Old links with `?view=admin` go to the game control. The browser keeps the selections of the clean-up and of the reminder. In the roster, admins and admin helpers click the inactivity of a slot to copy its reminder or to give a warning.

### Inactivity reminder

Admins and admin helpers make an English text for Discord with the slots in the yellow or red inactivity range, like the sphere clean-up. A filter selects yellow, red or both. Slots with reached goal or with all checks done are not in the text. Each line has the color, the user, the slot, the game, the inactivity and the checks. The longest inactivity is first; the lines of one user stay together. The browser makes the text from the roster, so it needs no seed and no request to the server. The sphere clean-up and the inactivity reminder share the split into messages of at most 10 pings and 2000 characters (`ping-messages.ts`).

### Unlock tree

The unlock tree shows which slot sent the unlock item of which slot. The SlotLock slot is the root. A slot that needed more than one unlock item is below the sender of the last item. Start slots are below the SlotLock slot. The browser builds the tree from the roster; `d3-hierarchy` calculates the layout. A user with own slots can highlight them in the tree; the browser remembers this choice.

### Room owner

- The first owner is the owner of the Cheese Tracker who made the room. When the Cheese Tracker gets another owner, the synchronization makes this user the owner of the room, if the user is clear. The old owner then stays admin.
- The owner can transfer the room by hand and selects if the old owner stays admin. Admins and admin helpers can leave a room. Only the owner can delete a room.

### Sphere checker

The functions are in `PLAN sphere checker.md`. The technical plan is in `PLAN sphere checker implementation.md`.

- An admin uploads the multidata file (`AP_<seed>.archipelago`) or the ZIP file of the generation one time for each room. From a ZIP file, the server reads only the multidata file. It contains the item, the receiver and the sphere of each location. The server compares its players with the slots of the room before it saves data.
- The seed check compares the seed name of the uploaded file with the seed name that the Archipelago server reports. They must be the same; otherwise the file is not the file of this room. The server wakes the room, connects to its websocket and reads the seed name from the first message (`RoomInfo`). It does not log in, so it needs no password. Admins and admin helpers start the check in the tab seed.
- The multidata file is a compressed Python pickle. A pickle can run code when Python reads it. The server never runs code from the file: an own decoder accepts only simple values and four known Archipelago classes, and it stops at all other content.
- The server keeps only the locations and the item names. It ignores the server options of the file, because they contain the passwords of the room.
- Archipelago does not put locations that are not reachable into a sphere. The server puts them after the last sphere.
- An item for an item link group has the group as receiver. The group is not a slot of the room.
- The sphere limit for players is the lowest sphere with open locations plus a number that the admin sets. Slots with reached goal do not hold the limit back.
- The socket messages of a room are public. So the live message about changed locations contains no items. The browser loads the data again through the API, which checks the role of the user.
- Admin helpers see the admin view of the locations and make the Discord text, but they cannot change the room.

### Connection to the Archipelago server

- The admin commands are chat lines that start with `!admin`, the same as in Archipolygo. The server connects as a text client of the selected SlotLock slot, logs in with the admin password, sends the lines and disconnects.
- A room on archipelago.gg stops after some time without activity and can get a new port. Before each command, the server opens the room page (this starts the room) and reads the current port.
- The passwords stay only in the memory of the server. After a restart, the admin logs in again.
- The Archipelago server answers successful admin commands only with a message to all players. It answers errors directly. So the server sends the lines with a short pause and collects the error answers.
- The chat function of `archipelago.js` waits for its own message to come back. The server hides the password in this echo, so the application sends the chat packet directly.

### Pace statistics

The functions are in `PLAN pace statistics.md`. The technical plan is in `PLAN pace statistics implementation.md`.

- The tab "Pace" of the game control shows for each slot how fast the player does checks while the player can play: active time, checks, checks per hour, BK time, BK periods and breaks. A second table shows the values of each game. Only admins and admin helpers see the tab.
- The server calculates the values from the checks history of Cheese. Cheese writes a point on a 10-minute grid only when a slot of the room changes, so the server first fills the missing grid points with the values of the point before, also after the last point up to the current time. One step of the history is then 10 minutes. A step with new checks is active. A step with more new checks than the bulk limit (for example a release) does not count. A quiet period is a BK period, a break (longer than the break limit) or a short pause. A short pause counts as play time.
- A quiet period is a BK period if the slot receives a progression item in it or in the first active step after it (Archipelago tracker), or if Cheese shows `bk` or `soft_bk` in it. The first new check ends a BK period. The signals come from the snapshots of the synchronizations, so there are no signals before the first synchronization of the room.
- A slot gets one row for each Discord user that played it. The SlotLock slots are not in the statistics.
- A click on a slot opens the timeline of the full slot in a side panel. It shows the parts, the progression items, the changes of the Cheese status and of the player, and the snapshots that the server could not read. `d3-scale` calculates the time axis (`pace-timeline.ts`); Vue draws the SVG with the colors `--app-pace-*`.
- Limits: BK periods and pauses that are shorter than one step are not visible. A useful item that ends a BK gives a break, not a BK period. Checks of different games need different effort, so compare the pace only in the same game.
- The server keeps the result of each room in memory. A new synchronization, a change of the limits or a change of the room by an admin calculates the values again.

### Vue components

- **Functional components** get all data from Pinia stores and call store actions. They have no props, no emits, no provide and no inject.
- **Presentational components** (`app/src/components/ui`) get props only. They do not use stores and send no events.
- Only store actions send HTTP requests or use the socket.
- A functional component that uses a presentational component with other content fills a slot of it (for example the sphere column of `SphereOverviewTable` or the inactivity column of `SlotTable`).
- The imports are in four groups with an empty line between them: libraries, PrimeVue, own components, own code (stores, domain, API). Inside a group the imports are in alphabetical order. Oxfmt (`fmt.sortImports` in `vite.config.ts`) checks and corrects the order. The server has two groups: libraries and own code.

## Development

### Requirements

- Node.js 26 (see `.nvmrc`). With nvm: `nvm use`.
- On Windows the native SQLite module is built for the active Node version. Use Node 26 for all commands, also for the Git hooks.

### Setup

```bash
npm install
cp server/.env.development.example server/.env.development
npm run prisma:migrate -w server
npm run dev
```

Replace the placeholders in `server/.env.development`. For a Discord login in development, add the redirect URL `http://localhost:5173/api/auth/discord/callback` to the Discord application.

The app runs on `http://localhost:5173`. Vite sends `/api` and `/socket.io` to the server on port 3000. The API documentation is on `http://localhost:5173/api/docs`.

### Public test mode

`npm run dev:public` starts the development environment so that it is reachable from the internet through the public domain, for example `https://slotlock.example.com`. Vite and `npm run cert:dev` take the domain from `PUBLIC_BASE_URL` in `server/.env.development`, so the domain is not in version control.

1. Set `PUBLIC_BASE_URL` and `DISCORD_CALLBACK_URL` in `server/.env.development` to the public domain, for example `https://slotlock.example.com` (without port). `example.com` is only a placeholder: Let's Encrypt does not issue certificates for it. Set `ADDITIONAL_ORIGINS=http://localhost:5173,https://localhost:5173`, so that `localhost` also works.
2. Add the callback URL to the Discord application.
3. Forward the external port 443 in the router to the internal port 5173 of this computer and allow the port 5173 in the firewall. If you use another external port, set `SLOTLOCK_PUBLIC_DEV_PORT` to it, so that the live reload of Vite uses the correct port.
4. Stop the test mode and close the port after the test. The Vite development server is not made for the internet.

In this mode, Vite listens on all network interfaces and uses HTTPS. Without a certificate in `app/.certs`, Vite uses a self-signed certificate (`@vitejs/plugin-basic-ssl`). Browsers show a warning, and some security programs (for example Bitdefender) block the page.

#### Trusted certificate from Let's Encrypt

1. Forward the external port 80 in the router to the port 80 of this computer and allow the port 80 in the firewall. Another local port is possible with `ACME_HTTP_PORT`.
2. Run `npm run cert:dev`. Optional: `ACME_EMAIL` for expiry mails, `-- --staging` for a test with the Let's Encrypt test system.
3. The script gets the certificate with the HTTP-01 challenge and saves it in `app/.certs` (not in version control). Running the script accepts the Let's Encrypt Subscriber Agreement.
4. Restart `npm run dev:public`. Vite uses the certificate automatically.
5. The certificate is valid for 90 days. Run `npm run cert:dev` again when less than 30 days are left (the script renews only then, or with `-- --force`).
6. Close the port 80 again after the certificate request.

The production server uses its own Let's Encrypt certificate through nginx (see `deploy/README.md`).

### Scripts

| Script | Function |
|---|---|
| `npm run dev` | Server and app in watch mode |
| `npm run dev:public` | Same, reachable through the DynDNS name (public test mode) |
| `npm run cert:dev` | Gets a Let's Encrypt certificate for the public test mode |
| `npm run icons` | Makes `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png` and `logo-512.png` from `app/public/favicon.svg` and `app/public/logo.svg` |
| `npm run build` | Server build, OpenAPI export, type generation, app build |
| `npm run lint` / `npm run lint:check` | Lint and format with fixes / check without changes (`vp check`) |
| `npm run format` | Format only (`vp fmt`) |
| `npm run typecheck` | Type check of both workspaces |
| `npm test` | Unit and integration tests of both workspaces |
| `npm run test:e2e` | Playwright tests against the built server with mocked Cheese and Archipelago data |
| `npm run api:check` | Fails if the generated API types are not current |
| `npm run audit:check` | Security audit of the production packages |
| `npm run prototype:report -w server -- <trackerId>` | Prints the roster and the player summary of a real Cheese tracker |

### Tooling

The project uses [Vite+](https://viteplus.dev/) (`vp`). Vite+ contains Vite, Vitest, Oxlint and Oxfmt. The lint and format configuration for both workspaces is in the `vite.config.ts` of the root. Oxlint uses different rules for `app/**` and `server/**` through `overrides`, because Vite+ ignores the configuration files in the subfolders.

- Oxlint cannot read Vue templates. The template rules of `eslint-plugin-vue` are not checked. `vue-tsc` and the Vue compiler find most template errors. A missing `:key` at `v-for` is not found.
- The type check stays with `tsc` (server) and `vue-tsc` (app). `vp check` does not check types.
- The Playwright rules come from `eslint-plugin-playwright` through the JS plugins of Oxlint.

### Git hooks

Vite+ runs the hooks in `.vite-hooks` (`npm install` sets them up through `vp config`): lint and type check before each commit, and the audit and the tests before each push. `VP_GIT_HOOKS=0` switches them off.

### Tests

- Unit tests check the lock logic, the estimation of unlock times, the mapping of the source data, the CSV import and the store getters.
- Integration tests start the full NestJS application with a temporary SQLite database and fixture data.
- Playwright tests start the built server with a mock server for Cheese and Archipelago. A test login replaces Discord. The test login exists only with `NODE_ENV=test`.
- `server/test/e2e-server.ts` imports the built server through a calculated path. The type check runs before the build, so `server/dist/main.js` does not exist yet, and a static import fails the type check.
- The fixtures follow the source code of Cheese Tracker and Archipelago. They are not copies of real responses.

## Tool settings

- npm: no funding messages and no update notifier (`.npmrc`).
- Prisma: no telemetry (`CHECKPOINT_DISABLE=1`).
- `@scarf/scarf` (install analytics of a Swagger UI dependency) is blocked in `allowScripts`.

## Logo and favicon

The logo and the favicon show the six colored circles of the Archipelago mod icon with a large padlock in front. The gaps between the circles and around the padlock are transparent. The padlock is dark on light backgrounds and light on dark backgrounds: the favicon follows the color scheme of the system, and the header shows `logo.svg` or `logo-dark.svg` for the color mode of the app. The Apple touch icon has a white background, because iOS shows transparent areas as black. Ask the Archipelago community before a public release, because the design is based on their icon.

## Licenses

PrimeVue 5 and `@primeuix/themes` 3 need a license key (PrimeUI License). The app uses PrimeVue 4.5 with `@primeuix/themes` 2 and PrimeIcons 7. These versions use the MIT license.

## Deployment

See `deploy/README.md`.

## Thanks

- Malandor (Discord user)
- [Archipelago](https://archipelago.gg) and the JavaScript library [archipelago.js](https://www.npmjs.com/package/archipelago.js)
- [Cheese Tracker](https://cheesetrackers.theincrediblewheelofchee.se) ([source code](https://github.com/cdhowie/cheese-trackers))
- [Spheretracker](https://spheretracker.de)
