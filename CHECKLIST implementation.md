# Slotlock Tracker – Implementation Checklist

Language: ASD-STE100 (Simplified Technical English)
Reference: `PLAN slotlock.md` (section numbers in brackets).

Legend: `[x]` done and verified, `[ ]` open, `[-]` not possible without the developer (reason in the line).

## Standard check after each step

Do these checks after each step. Write the result into the log at the end of this file.

1. `npm run lint:check` has no errors.
2. `npm run typecheck` has no errors.
3. `npm test` passes.
4. `npm run api:check` has no changes (from phase 3).
5. New Vue components have no `defineProps`, `defineEmits`, `provide`, `inject` (16.3). Command: `grep -rnE "defineProps|defineEmits|provide\(|inject\(" app/src --include=*.vue`.
6. New server files come from the Nest CLI where possible (15.1.5).
7. New texts exist in `de.json5` and `en.json5` (16.7).
8. Terms agree with the glossary. Command: `grep -rniw "event" server/src app/src` gives no hit for a room.

## Phase 0 – Repository (12, phase 0)

- [ ] Root `package.json` with workspaces `server`, `app` (14.1)
- [ ] `.nvmrc`, `.editorconfig`, `.gitignore`, `.gitattributes` (14.2)
- [ ] NestJS project with Nest CLI, Jest replaced by Vitest (15.1)
- [ ] Vue project with `create-vue` (16.1)
- [ ] Latest versions of all packages (14.6)
- [ ] Root scripts (18)
- [ ] Git initialized, Husky hooks pre-commit and pre-push (18.1)
- [ ] CI workflow `ci.yml` (20.1)
- [-] GitHub repository (20.1): the developer makes the repository and adds the remote
- [ ] Playwright with one smoke test (19.4)

## Phase 1 – Data sources and prototype

- [ ] Module `config` with validation, `.env.*.example` files (15.10)
- [ ] Module `prisma` (15.2)
- [ ] Module `cheese` with Zod schemas (3.1, 15.2)
- [ ] Module `archipelago` with Zod schemas, datapackage cache (3.2, 15.2)
- [ ] Test fixtures in `server/test/fixtures` (phase 1.2)
- [ ] CLI command `prototype:report` (15.9)
- [-] Comparison with the Google sheet "BigChill" (phase 1.4): only the developer has access

## Phase 2 – Database, lock logic, synchronization

- [ ] Prisma schema and first migration (15.5)
- [ ] Lock logic as pure functions with unit tests (6, phase 2.2)
- [ ] Estimation of unlock times with unit tests (7.4, 7.7)
- [ ] Module `sync`: scheduler, manual synchronization, snapshots with hash, datapackage cache (15.6)
- [ ] Module `rooms` with public read endpoints
- [ ] Modules `players`, `statistics` (15.2)
- [ ] Module `health` with `@nestjs/terminus` (15.2)

## Phase 3 – OpenAPI and public views

- [ ] OpenAPI export, type generation, `api:check` (17)
- [ ] API client and typed socket client (16.2)
- [ ] Pinia stores (16.4)
- [ ] Router with guards (16.5)
- [ ] Views: room list, roster, player summary, statistics (11.1 to 11.4)
- [ ] Filters and sort functions (11.7)
- [ ] i18n German and English (16.7)
- [ ] Theme Aura, light and dark (16.8)
- [ ] Playwright tests for the public views (19.4)

## Phase 4 – Live updates

- [ ] Socket.IO gateway `live` (15.7)
- [ ] Store `useLiveStore` (16.4)

## Phase 5 – Login and roles

- [ ] Module `auth`: Discord OAuth, JWT cookie, guards (15.8)
- [ ] Room creation with owner check (4)
- [ ] View "My slots" (11.5)

## Phase 6 – Admin area

- [ ] Modules `admins`, `warnings`, `unlock-times`
- [ ] Admin views, CSV import, "Synchronize now" (11.6, 7.5, 5.2, 5.3)

## Phase 7 – Optional: invitation links

- [ ] Invitation links (10.7)

## Phase 8 – Delivery

- [ ] `deploy/ecosystem.config.cjs`, `deploy/nginx.conf.example`, `deploy/post-deploy.sh`, `deploy/README.md` (20.2 to 20.5)
- [ ] Deployment workflow `deploy.yml` (20.5)
- [-] Server preparation and first deployment: needs access to the proServer
- [-] Parallel use with the Google sheet: needs a live room

## Log

| Date | Step | Lint | Types | Tests | Note |
|---|---|---|---|---|---|
