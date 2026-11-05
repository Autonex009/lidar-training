# 3D LiDAR Training, Annotation and Assessment Portal

## What it is

An internal training portal that replaces week-long manual onboarding for 3D LiDAR / point-cloud annotation. A trainee registers, works through short lessons and quizzes, passes a final assessment, then does graded annotation exercises in a browser 3D workspace (cuboids, segmentation, tracking, error detection). Reviewers give feedback and request revisions; trainees revise and resubmit until approved; a print-ready certificate is issued when the program's required tasks are approved.

It is a reusable platform, not a single-project tool. A generic "foundations" program ships with the app. Customer or project guidelines are converted into `project-configs/<slug>/` folders (label schema, attributes, rules, guideline text, images) and seeded as additional programs, never hard-coded in app logic. All demo data is deterministic synthetic data, flagged `isSynthetic` and labelled "DEMO / SYNTHETIC TRAINING DATA" in the UI.

## Architecture

- Stack: Next.js 15 (App Router, `src/`, TypeScript strict), Tailwind CSS 4, Prisma 6 with SQLite by default (Postgres swappable), Auth.js v5 (Credentials, bcrypt, JWT session with `role` and `userId`), plain Three.js for 3D, Zod validation, Vitest (unit/integration) and Playwright (e2e).
- Folders:
  - `app/src/app` routes (pages, API route handlers, server actions); `(app)` group holds the authenticated shell (Learn, Annotate, Review, Complete, Admin).
  - `app/src/lib` domain logic: `learn/` (modules, quizzes, gate), `tasks/` (assignments, drafts, submit), `review/` (decisions, notifications, certificate), `admin/` (queries, single `/api/admin/op/[name]` mutation endpoint with per-op role check), `annotation/` (document model, metrics, validation), `pointcloud/` (parsers, binary cache), `synthetic/` (scene generator), `project-config.ts`.
  - `app/src/components` UI (viewer engine, annotate workspace, review workspace, admin forms); `app/src/content` lesson, quiz and task content.
  - `app/prisma` schema, migrations, seed; `app/data/assets/<id>/` generated point-cloud caches (git-ignored); `app/e2e` Playwright specs; `project-configs/` project configs; `example/` UI reference screenshots.
- Data flow: seed or upload -> parser -> normalized binary cache (`.bin` with JSON header; xyz f32, optional intensity, rgb, labels) under `data/assets` -> `GET /api/assets/:id/frames/:n` (session required) -> viewer. Trainee annotations are JSON documents stored as `AnnotationDraft` (autosave about 5 s after a change) and immutable `SubmissionVersion` rows on submit; reviewers see advisory metrics against the hidden reference, set the final score, and a revision creates a new version from the submitted one. In-app notifications and activity events are DB rows.
- Ground truth stays server-side: reference annotations and planted errors are never sent to trainee views, and frame caches are served without per-point labels unless the requester is staff and asks for `?withLabels=1` (a stripped copy `frame_NNN.nolabels.bin` is generated lazily next to the original).

## Local setup

Requires Node 20+ and npm.

```bash
cd app
npm ci
cp .env.example .env          # then edit: set AUTH_SECRET (openssl rand -base64 32) and SETUP_TOKEN
npx prisma migrate deploy     # creates prisma/dev.db
npm run assets:generate       # synthetic demo point clouds into data/assets/
npx prisma db seed            # programs, lessons, quizzes, tasks, demo assets (also loads ../project-configs/*)
npm run dev                   # http://localhost:3000 (any port works; no AUTH_URL needed locally)
```

- First run: open `/setup`. It only works while no ADMIN exists and requires the `SETUP_TOKEN` from `.env`. There are no default credentials.
- Trainees: self-register at `/register`. `ALLOWED_EMAIL_DOMAINS` (comma list, empty = any) and optional `REGISTRATION_INVITE_CODE` gate registration. New users are TRAINEE and are enrolled in `DEFAULT_PROGRAM_SLUG`.
- Reviewers and extra admins: sign in as admin, open Admin > Users, create a user with role REVIEWER (or ADMIN), or change an existing user's role. Admins can also assign reviewers to trainees/submissions.

## Roles and the learning gate

- TRAINEE: Learn always; Annotate, Review (own submissions and feedback) and Complete are locked, with a lock icon, `aria-disabled` and a tooltip, until every mandatory module is complete (all lessons marked complete and the module quiz passed) and the final assessment is passed (80% default, per program). The unlock is persisted in `Enrollment.learnCompletedAt`; a failed assessment keeps the lock, retries are allowed and every attempt is stored. Server pages and APIs enforce this, not just the sidebar.
- REVIEWER: bypasses the gate for staff screens; review queue, decisions, read-only trainee detail.
- ADMIN: everything a reviewer can do plus dashboard, trainees, programs, tasks, assets, users.

## Project configs

To add a project: create `project-configs/<slug>/` with `config.json` (validated by the zod schema in `app/src/lib/project-config.ts`), `guidelines.md`, `images/*.png` and `source/` (original document), then run `npx prisma db seed`. The seed creates a TrainingProgram with its own label schema, attributes, guidelines, project module(s) and project-flavoured copies of the cuboid/tracking tasks. Override the folder with `PROJECT_CONFIGS_DIR`.

Example: `project-configs/tonic/` (warehouse LiDAR cuboids, 22 classes, occlusion and motion attributes, optional human activity attribute, 10 m ROI tiers, persistent track IDs, pre-label review rules, 2D image alignment).

Interpretation ambiguities recorded while converting the Tonic guideline document. The project owner must confirm each:

1. ROI units are assumed to be metres.
2. Occlusion boundaries at exactly 90% and 30% are undefined in the source.
3. "Direction of travel" is undefined for static objects.
4. Pallet Jack cuboid rules were copied from Pallet as written.
5. "Respective branch" for pre-labels is undefined.
6. The Human activity list is open-ended; it is treated as optional.
7. Several class images are loose fits (Vehicle, Tote, Kneeling, Reaching, Wheelchair).
8. AGV/AMR, Vehicle, Tote and Bin have no cuboid rules in the source.
9. Track ID is treated as per-sequence.
10. `roi3` upper bound is null (open ended).
11. The stereo-alignment Loom video is kept as a title only (no transcript).

## Point-cloud formats and limitations

- PLY (ascii and binary), PCD (ascii and binary; `binary_compressed` unsupported), XYZ/PTS, LAS 1.2-1.4 uncompressed point formats 0-3 and 6-8, BIN only with a configured record schema (e.g. KITTI `xyzi` float32 preset).
- LAZ (compressed LAS) is unsupported until laz-perf is added.
- Upload cap 5,000,000 points; the viewer renders at most 1,000,000 (deterministic uniform subsample, fixed seed).
- Demo scenes are synthetic: simple boxes, cylinders, capsule pedestrians, ground and walls. They teach the workflow, not real sensor noise.

## Annotation conventions

- Stored annotations use the asset's native frame. Default `upAxis` Z, `yawConvention` CCW about the up axis, `boxDefinition` CENTER_DIMS_YAW: centre x y z, dimensions length/width/height, yaw in radians. The viewer rotates Z-up into Three.js Y-up with an explicit root-group rotation.
- Y-up assets are view-only in the annotate tools.
- Scoring is advisory (class match, centre error, 3D IoU, yaw error, point-label accuracy). The reviewer sets the final score; nothing auto-approves.

## Learn: hands-on lessons

Lessons mix short text with interactive widgets (`LessonBlock` with `type: "interactive"`, `widget` in `src/content/types.ts`). Authored data lives in `app/src/content/interactive.ts`; pure logic (hit tests, scoring, mistake classification) in `app/src/lib/learn/interactive.ts`.

| Widget | Where | What the learner does |
| --- | --- | --- |
| `find-object` | M1 (`demo-occlusion`), M3 (`demo-identify`) | "Click the ..." prompts in a seeded random order. A click counts inside the reference cuboid, a region radius, or on empty ground; a hint appears after 2 misses. M3 also asks for the label (must be correct). |
| `views-drill` | M2, lesson 3 | Switch to Top and count the vehicles, then switch to Front and name the tallest class. |
| `cuboid-live` | M4 (`demo-cuboid-basic`) | The real `CuboidTool`: drag-create, select/resize handles, move, rotate (Q/E), fit to points, label. A target car pulses; a live readout shows IoU, centre error and yaw error against the reference. "Show my mistakes" tints box faces red (cuts object points) or yellow (empty gap above 20% of the object's size). Guided by the page-scoped `lesson-cuboid` tour. Checkpoints: created, moved, resized, rotated, fit (IoU >= 0.70), label. |
| `spot-the-error` | M4, M6 (`demo-errors`) | Click the box with the wrong yaw / oversized / wrong class / duplicate. |
| `decision-cards` | M5 (6 scenarios), M6 (5) | Choose an action, get immediate feedback and the reason. 80% passes; below that, retry only the wrong cards. |
| `schema` | M3 | Add a class, add an attribute, rename a class, mark an attribute required. |
| `cloud`, `nav`, `cuboid` (sliders) | older lessons | Still supported. |

Lesson page: a progress strip ("Lesson 2 of 3 · 6 min · 4/6 checkpoints"), a checkpoint checklist beside each widget, "Mark lesson complete" turns lime when every checkpoint is ticked, with a "What's next" line; the last lesson shows "Take the knowledge check" once the module's lessons are done. Checkpoint keys must be unique within a lesson.

Checkpoints are saved server-side: `POST /api/learn/checkpoint {lessonId, key}` upserts the user's `LessonProgress` row with `checkpoints` (JSON array) and no `completedAt`; marking the lesson complete fills `completedAt` on the same row. Rows without `completedAt` never count as a completed lesson. Reloading the page restores the ticks. Re-seeding updates lessons in place (keyed by module key and lesson order), so progress rows survive.

## Guided tours

Step-by-step onboarding dialogs (intro modal, then bottom-centre step cards over the live page) in the style of the reference screenshots. A step completes only when the user actually does the action; Back / progress dots / Next sit at the bottom, Next is enabled once the step is done (or immediately for informational steps), Enter = Next, Esc or the X = skip (with confirmation). Optional spotlight dims everything except a `data-tour="..."` element.

| Tour key | Trigger (auto-starts once, when NOT_STARTED) | Steps | Completion |
| --- | --- | --- | --- |
| `welcome` | first visit to `/learn`, all roles | 7 | mostly Next; last step = click the first module |
| `navigation-3d` | first viewer on a Learn lesson (sample cloud / navigation lessons) and first task open; also offered before any task tour (chained) | 10 (9 without frames) | viewer controls: device choice, rotate, zoom, W A S D (all four), Q/E (both), pan, camera target (Ctrl/Cmd+click), frames (arrow keys, only for multi-frame assets), Reset camera |
| `task-cuboid` | first open of a CUBOID / MIXED task | 13 (12 without required attributes) | editor actions: `addCuboid`, `select`, `moveCuboid`, `resizeCuboid`, `rotateCuboid`, `fitCuboid`, `setLabel`, `setAttribute`, `undo`, `addFlag` (optional), `draft-saved`, Submit explained (never forced) |
| `task-segmentation` | first open of a SEMANTIC_SEG / INSTANCE_SEG task | 9 | `tool:brush`, `brush-radius`, `activeLabel`, `paintPoints`, `tool:lasso`, `hide-label`, `undo`, `draft-saved` |
| `task-tracking` | first TRACKING task | 7 | `addCuboid`, `frame-changed`, `copyFrame`, `setTrackId`, `draft-saved` |
| `task-inspection` | first INSPECTION task | 5-6 | checkpoints (Next), `control:preset` x2, `tool:mark`, `setAnswer`, `draft-saved` |
| `task-identification` | first IDENTIFICATION task | 6-7 | `select`, `setLabel`, `addFlag` (optional), `setAnswer`, `draft-saved` |
| `task-error-detection` | first ERROR_DETECTION task | 6 | `select`, `addError`, second `addError` (optional), `draft-saved` |
| `lesson-cuboid` | live cuboid exercise in Learn M4 (page-scoped, auto-starts once) | 7 | `lc:created`, `lc:moved`, `lc:resized`, `lc:rotated`, `lc:fit-clicked`, `lc:labelled`, then an informational step on the mistakes overlay |
| `review-first-open` | first `/review/[id]` (REVIEWER, ADMIN) | 7-8 | Next, `toggle-reference`, `select-object`, decision form / rubric explained |

- **Progress** is per user in `TourProgress` (`NOT_STARTED / IN_PROGRESS / COMPLETED / SKIPPED`, `lastStepIndex`), written by `POST /api/tours/[key]` (debounced 500 ms while stepping, immediately on finish/skip; read with `GET /api/tours`). Transitions log `TOUR_STARTED`, `TOUR_COMPLETED`, `TOUR_SKIPPED` in the activity log. COMPLETED and SKIPPED never auto-start again; IN_PROGRESS shows a small "Resume tutorial" pill instead of a modal.
- **Help menu**: the "?" button in the top bar (and in the Annotate/Review workspace headers) lists the tutorials relevant to the current page and role with their status and a Start / Restart button (always forces a restart from the intro).
- **Navigation input device**: the navigation tour asks Mouse or Trackpad and stores it in `localStorage.navInputDevice`. Mouse keeps the existing bindings. Trackpad: two-finger scroll rotates, pinch (ctrl+wheel) zooms, shift + scroll pans (`src/components/viewer/wheelBindings.ts`). In Fly mode W A S D / Q E move, Left/Right arrows step frames (when nothing is selected).
- **Lessons**: the old inline step dialog of the navigation lesson is replaced by the `navigation-3d` tour; lesson checkpoints still tick from direct control use and also when the tour completes. A "Start navigation tutorial" button restarts it.

### Adding a tour

1. Add `src/components/tour/tours/<name>.ts` exporting a `TourDefinition` (`key`, `title`, `intro`, `steps`, `scope: "global" | "page"`, optional `roles`). Each step has `title`, one-line `instruction` (`**bold**` allowed), optional `keycaps` (text or glyph ids), `spotlight: { selector: "<data-tour value>" }`, optional `choice`, `allowSkip`, `when(ctx)` and a `complete` rule: `control` (viewer control, `needs` = all listed details), `event` (any `emitTourEvent(name)`), `click-target`, `choice`, `manual`, `timer`, or `all` of several.
2. Register it in `src/components/tour/registry.ts`.
3. Add `data-tour="..."` to the real elements you spotlight.
4. On the page, call `usePageTours(["your-key"], ctx)` (or render `<PageTours keys={...} />` from a server page). Keys are tried in order: the first NOT_STARTED one auto-starts, so chain a prerequisite tour by listing it first.
5. Emit the events your steps wait for with `emitTourEvent(name, detail)` from `src/lib/tour/events.ts` (the Annotate editor already announces every reducer action, plus `draft-saved`, `tool:<mode>`, `frame-changed`, ...; the viewer announces `control:<kind>`).

Pure logic (step completion, resume, persistence payloads) lives in `src/components/tour/machine.ts` and is unit-tested.

## Testing

```bash
cd app
npm test                          # Vitest: parsers, geometry, gate, scoring, services (temp SQLite files), hardening
npx playwright install chromium   # once
npm run test:e2e                  # Playwright acceptance tests T1-T10
npm run lint
```

`npm run test:e2e` starts its own `next dev` on port 3210 (`E2E_PORT` to change) with `DATABASE_URL=file:./e2e.db` (recreated every run). Global setup runs `prisma migrate deploy`, `assets:generate` if assets are missing, `prisma db seed`, creates the admin through the real `/setup` form and a reviewer through the admin API. Specs run serially and share state through the database:

- T1 new trainee (register, locked items inert) - T2 progression persists across logout/login - T3 failed final assessment keeps the lock - T4 pass unlocks, topbar 100% - T5 annotate TASK-03 (real mouse drag on the canvas, relabel, save, reload, submit) - T6 reviewer requests revision - T7 trainee sees notification and banner, resubmits (attempt 2) - T8 approval with score appears in Complete - T9 admin timeline has LOGIN, LESSON_COMPLETED, QUIZ_ATTEMPTED, TASK_SUBMITTED, REVISION_REQUESTED, TASK_APPROVED - T10 ownership, role and ground-truth leak checks - T12 hands-on Learn widgets (find-object clicks via the dev `window.__engines` projection, live cuboid with its guided steps, decision cards with a retry, checkpoints surviving a reload) - T11 guided tours (welcome tour, navigation tour with real mouse/keyboard actions, first-task cuboid tour with skip/resume/restart, Help menu, reviewer tour). Other specs mark all tours COMPLETED for their users through fixtures so dialogs never block them.

Fixtures that would take too long through the UI (completing all mandatory modules for T3, approving prerequisite tasks, creating the second trainee) use the service layer or Prisma directly; every assertion is made through the UI or HTTP.

WebGL caveat: headless Chromium uses SwiftShader (`--use-gl=swiftshader`), which is slow but works; the canvas drag in T5 is a real mouse drag. The dev-only `window.__engine` hook (disabled when `NODE_ENV=production`) is used only to compute screen coordinates of known ground points and to wait for the cloud to load; if the drag proves flaky on a given machine, creating the box through that hook is the fallback. No step currently depends on it for the action itself.

## Deployment

- Postgres: in `app/prisma/schema.prisma` change the datasource `provider` to `"postgresql"`, set `DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public"`, then run `npx prisma migrate deploy`. The committed migrations are SQLite-generated; for a fresh Postgres database regenerate a baseline (`prisma migrate dev --name init` against Postgres) and commit it. JSON columns map to `jsonb`.
- Without Docker: `npm ci && npx prisma migrate deploy && npm run build && npm run start -- -p 3000` behind a TLS reverse proxy (keep `AUTH_TRUST_HOST=true` or set `AUTH_URL`). Run `npm run assets:generate` and `npx prisma db seed` once.
- Persistent volume: `app/data/assets` holds all uploaded sources and caches; mount it on durable storage and back it up with the database.
- Run `npx prisma db seed` after each upgrade that changes content; it is idempotent.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma connection string (SQLite file or Postgres URL) |
| `AUTH_SECRET` | Required. Signs session JWTs |
| `AUTH_TRUST_HOST` | `true` derives the URL from the Host header (default in `.env.example`) |
| `AUTH_URL` | Optional fixed public URL; leave unset locally |
| `SETUP_TOKEN` | Required for `/setup` first-admin bootstrap |
| `ALLOWED_EMAIL_DOMAINS` | Comma list for self-registration; empty = any |
| `REGISTRATION_INVITE_CODE` | Optional invite code on register |
| `DEFAULT_PROGRAM_SLUG` | Program new users are enrolled in (default `foundations`) |
| `LOGIN_RATE_LIMIT_PER_MIN` | Login attempts per IP per minute (default 10) |
| `PROJECT_CONFIGS_DIR` | Override the `project-configs` folder |
| `E2E_PORT` | Playwright dev-server port (default 3210) |

## Known limitations

- No yaw ring handle on cuboids (yaw is edited with the rotate tool, not a ring handle).
- Segmentation and tracking tools are unit-tested but not browser-verified (WebGL interaction not exercised in e2e).
- Reference comparison shows frame 0 only for single-frame references.
- The login rate limit is an in-memory per-process counter keyed by IP: it resets on restart and is not shared across instances. The IP comes from `X-Forwarded-For`/`X-Real-IP`, so it is only trustworthy behind a proxy that sets them.
- Notifications are in-app only (no email).
- The certificate is a print stylesheet page; no PDF generation.
- Interactive widget progress other than checkpoints (e.g. which find-object prompt you are on, decision-card answers) is not saved; a reload restarts the widget, but ticked checkpoints stay ticked.
- No deactivate-user action.
- Re-importing project configs/seed content overwrites admin edits to that content.
- Any signed-in user can fetch any asset by id (frames are label-stripped for trainees, but assets are not scoped per program).
- Dev server: first visit to a route compiles it, so first-hit navigations are slow in `npm run dev`.
