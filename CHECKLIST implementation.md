# Slotlock Tracker – Implementation Checklist

Language: ASD-STE100 (Simplified Technical English)
Reference: `PLAN slotlock.md` (section numbers in brackets). Deviations: `PLAN slotlock.md`, section 24.

Legend: `[x]` done and verified, `[ ]` open, `[-]` not possible without the developer (reason in the line).

## Standard check after each step

Do these checks after each step. Use Node 26 (`nvm use`). Write the result into the log at the end of this file.

1. `npm run lint:check` has no errors.
2. `npm run typecheck` has no errors.
3. `npm test` passes (unit and integration tests of both workspaces).
4. `npm run build`, then `npm run test:e2e` passes.
5. `npm run api:check` has no changes (after a commit).
6. `npm run audit:check` finds no vulnerabilities.
7. Functional components have no props: `grep -rlE "defineProps|defineEmits|provide\(|inject\(" app/src --include=*.vue | grep -v components/ui` gives no result.
8. Presentational components use no stores and no events: `grep -rnE "stores/|defineEmits|provide\(|inject\(" app/src/components/ui` gives no result.
9. The code has no comments (21.6): `grep -rnE "(^|\s)//|/\*|<!--" server/src server/test app/src app/e2e --include=*.ts --include=*.vue | grep -v "src/generated\|schema.d.ts\|https\?://"` gives no result.
10. New server files come from the Nest CLI where possible (15.1.5).
11. New texts exist in `de.json5` and `en.json5` (16.7).
12. The word "event" is not used for a room: `grep -rniw "event" server/src app/src` gives only DOM events.

## Phase 0 – Repository

- [x] Root `package.json` with workspaces `server`, `app` (14.1)
- [x] `.nvmrc` (26), `.editorconfig`, `.gitignore`, `.gitattributes`, `.npmrc` (14.2)
- [x] NestJS 12 project with Nest CLI, Vitest and oxlint from the CLI, ESLint added (15.1)
- [x] Vue project with `create-vue` (16.1)
- [x] Latest versions of all packages, exceptions in 24.1 to 24.3 (14.6)
- [x] Root scripts (18)
- [x] Git initialized, Husky hooks pre-commit and pre-push (18.1)
- [x] CI workflow `ci.yml` (20.1)
- [-] GitHub repository: the developer makes the repository and adds the remote
- [x] Playwright with tests (19.4)
- [x] Telemetry, funding messages and update notifiers off (`.npmrc`, `CHECKPOINT_DISABLE`, `@scarf/scarf` blocked)

## Phase 1 – Data sources and prototype

- [x] Module `config` with validation, `.env.*.example` files (15.10)
- [x] Module `prisma` (15.2)
- [x] Module `cheese` with Zod schemas (3.1, 15.2)
- [x] Module `archipelago` with Zod schemas, datapackage cache (3.2, 15.2)
- [x] Test fixtures in `server/test/fixtures`, built from the source code (24.11)
- [x] Command `prototype:report` (15.9, 24.4)
- [-] Comparison with the Google sheet "BigChill" (phase 1.4): needs the real tracker ID and the sheet
- [-] Real API responses as fixtures: needs a real tracker ID

## Phase 2 – Database, lock logic, synchronization

- [x] Prisma schema and migrations (15.5)
- [x] Lock logic as pure functions with unit tests (6, 24.6)
- [x] Estimation of unlock times with unit tests (7.4, 7.7)
- [x] Module `sync`: scheduler, manual synchronization with cooldown, snapshots with hash, datapackage cache (15.6)
- [x] Module `rooms` with public read endpoints
- [x] Player summary and statistics in the app (24.8)
- [x] Module `health` with `@nestjs/terminus` (15.2)
- [-] Comparison of the estimated unlock times with the Google sheet (phase 2.3): needs the sheet

## Phase 3 – OpenAPI and public views

- [x] OpenAPI export, type generation, `api:check` (17)
- [x] API client and typed socket client (16.2)
- [x] Pinia stores (16.4)
- [x] Router with guards (16.5)
- [x] Views: room list, roster, player summary, statistics (11.1 to 11.4)
- [x] Filters and sort functions (11.8)
- [x] i18n German and English (16.7)
- [x] Theme Aura, light and dark, default system setting (16.8)
- [x] Playwright tests for the public views (19.4)

## Phase 4 – Live updates

- [x] Socket.IO gateway `live` (15.7)
- [x] Store `useLiveStore`, live indicator in the room header (16.4)
- [x] Playwright test: a warning appears live in a second browser

## Phase 5 – Login and roles

- [x] Module `auth`: Discord OAuth, JWT cookie, guards, origin check (15.8, 24.5)
- [x] Room creation with owner check (4)
- [x] View "My slots" (11.5)
- [-] Discord login with a real Discord application: needs client ID and secret from the developer

## Phase 6 – Admin area

- [x] Modules `admins`, `warnings`, `unlock-times`
- [x] Admin views: settings, lock assignment, admins, warnings, unlock times, CSV import, "Synchronize now" (11.7, 7.5, 5.2, 5.3)

## Phase 7 – Optional: invitation links

- [x] Invitation links: one use, 7 days (10.7)

## Phase 8 – Delivery

- [x] `deploy/ecosystem.config.cjs`, `deploy/nginx.conf.example`, `deploy/post-deploy.sh`, `deploy/README.md` (20.2 to 20.5)
- [x] Deployment workflow `deploy.yml` (20.5)
- [ ] Test `deploy/post-deploy.sh` on the proServer (only syntax-checked)
- [-] Server preparation and first deployment: needs access to the proServer
- [-] Parallel use with the Google sheet: needs a live room

## Open decisions for the developer

See `PLAN slotlock.md`, section 23: production domain, responsibility on the proServer, GitHub repository, PrimeVue license, Node 26 or Node 24 LTS, comparison with the Google sheet.

## Log

| Date | Step | Lint | Types | Tests | Note |
|---|---|---|---|---|---|
| 2026-10-24 | Phase 0 | ok | ok | 2 ok | Workspaces, Husky, CI |
| 2026-10-24 | Phase 1–2, 5–6 server | ok | ok | 66 unit, 12 integration ok | OpenAPI export, server start checked with curl |
| 2026-10-24 | Phase 3–4 app | ok | ok | 12 unit, 7 e2e ok | Visual check in the browser (roster, admin, lock matrix) |
| 2026-10-24 | Phase 7 | ok | ok | 66 unit, 13 integration, 12 unit app, 8 e2e ok | Invitation links |
| 2026-10-24 | Phase 8 files | ok | ok | – | `post-deploy.sh` syntax check only |
