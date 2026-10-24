# Slotlock Tracker

Slotlock Tracker shows the lock status of all slots in an Archipelago room that uses the game SlotLock. It replaces a manual Google sheet. The functions and the technical plan are in `PLAN slotlock.md`. The progress is in `CHECKLIST implementation.md`.

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

### Unlock times

- Archipelago gives no time for received items. The server records the time when a synchronization finds an unlock item for the first time.
- Unlock items of the first synchronization have no known time. The server estimates the time from the checks history of Cheese: the first increase of the checks of the locked slot.
- Manual and CSV times have priority over all other times. An estimation never replaces a found, manual or CSV time.

### Inactivity, players and statistics

The browser calculates inactivity, player summaries and statistics from the roster. The inactivity counts from the latest of these times: last activity, last "Still BK" click in Cheese, unlock time. It uses the current time, so the colors change without a new synchronization.

### Unlock tree

The unlock tree shows which slot sent the unlock item of which slot. The SlotLock slot is the root. A slot that needed more than one unlock item is below the sender of the last item. Start slots are below the SlotLock slot. The browser builds the tree from the roster; `d3-hierarchy` calculates the layout.

### Vue components

- **Functional components** get all data from Pinia stores and call store actions. They have no props, no emits, no provide and no inject.
- **Presentational components** (`app/src/components/ui`) get props only. They do not use stores and send no events.
- Only store actions send HTTP requests or use the socket.

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

`npm run dev:public` starts the development environment so that it is reachable from the internet through `https://slotlock.example.com`.

1. Set `PUBLIC_BASE_URL` and `DISCORD_CALLBACK_URL` in `server/.env.development` to `https://slotlock.example.com` (without port). Set `ADDITIONAL_ORIGINS=http://localhost:5173,https://localhost:5173`, so that `localhost` also works.
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
| `npm run build` | Server build, OpenAPI export, type generation, app build |
| `npm run lint` / `npm run lint:check` | Lint with fixes / without changes |
| `npm run typecheck` | Type check of both workspaces |
| `npm test` | Unit and integration tests of both workspaces |
| `npm run test:e2e` | Playwright tests against the built server with mocked Cheese and Archipelago data |
| `npm run api:check` | Fails if the generated API types are not current |
| `npm run audit:check` | Security audit of the production packages |
| `npm run prototype:report -w server -- <trackerId>` | Prints the roster and the player summary of a real Cheese tracker |

### Git hooks

Husky runs lint and type check before each commit, and the audit and the tests before each push.

### Tests

- Unit tests check the lock logic, the estimation of unlock times, the mapping of the source data, the CSV import and the store getters.
- Integration tests start the full NestJS application with a temporary SQLite database and fixture data.
- Playwright tests start the built server with a mock server for Cheese and Archipelago. A test login replaces Discord. The test login exists only with `NODE_ENV=test`.
- The fixtures follow the source code of Cheese Tracker and Archipelago. They are not copies of real responses.

## Tool settings

- npm: no funding messages and no update notifier (`.npmrc`).
- Prisma: no telemetry (`CHECKPOINT_DISABLE=1`).
- `@scarf/scarf` (install analytics of a Swagger UI dependency) is blocked in `allowScripts`.

## Licenses

PrimeVue 5 and `@primeuix/themes` 3 need a license key (PrimeUI License). The app uses PrimeVue 4.5 with `@primeuix/themes` 2 and PrimeIcons 7. These versions use the MIT license.

## Deployment

See `deploy/README.md`.
