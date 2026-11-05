# 3D LiDAR Training, Annotation & Assessment Portal — Build Spec

Internal company training portal for 3D LiDAR / point-cloud annotation. Replaces week-long manual training. Trainee logs in, learns via short lessons, does annotation exercises, gets expert feedback, revises, gets certified. Must be a reusable, configurable platform (not project-specific).

## Architecture decisions (FIXED — do not change)

- **Stack:** Next.js 15 (App Router, `src/` dir, TypeScript strict), Tailwind CSS, Prisma ORM, SQLite by default (`DATABASE_URL="file:./dev.db"`), Postgres swappable via env. Auth: Auth.js (next-auth v5) with Credentials provider, bcrypt password hashing, JWT session with `role` + `userId`. 3D: Three.js (plain, no react-three-fiber). Tests: Vitest for unit/API, Playwright for e2e flows.
- **Location:** app lives in `/Users/chirkut/Documents/Office/Lidar-tool/app`. Repo root has `SPEC.md` (this), `example/` (reference screenshots of Encord's 3D editor tutorial — UI inspiration only; NOT data).
- **Roles:** `TRAINEE`, `REVIEWER`, `ADMIN`. One role per user. Admin can do everything reviewer can.
- **Registration:** self-registration page exists, but gated by env `ALLOWED_EMAIL_DOMAINS` (comma list; empty = any) and optional `REGISTRATION_INVITE_CODE`. New users default to TRAINEE.
- **Admin bootstrap:** `/setup` page only works while zero ADMIN users exist; requires `SETUP_TOKEN` from env to match. No default credentials anywhere.
- **Coordinate convention:** stored annotations are in the asset's native frame. Per-asset/per-program config: `upAxis` (`Z` default, or `Y`), `yawConvention` (`CCW_ABOUT_UP` default), `boxDefinition` (`CENTER_DIMS_YAW` default: center xyz, dims l/w/h, yaw radians). Viewer converts Z-up → Three.js Y-up with an explicit root-group rotation. Never silently assume.
- **Navigation profiles:** viewer supports both `orbit` (rotate/pan/zoom around target) and `fly` (WASD move, Q/E elevate, Shift faster, mouse-drag look, click-to-set-camera-target). Per-program config `navigationProfile` defaults to `orbit`. Both must have Reset, Top, Front, Side, Perspective presets and axis helper.
- **Point cloud storage:** assets stored as files under `app/data/assets/<assetId>/`. Parsed server-side into a normalized binary cache (`Float32Array` xyz + optional `Uint8Array` rgb + optional `Float32Array` intensity) saved as `.bin` with a JSON header. Client fetches normalized cache via API, never raw files. Upload cap 5M points; render cap 1M (uniform random subsample, deterministic seed).
- **Demo data:** deterministic synthetic scenes (seeded PRNG) with ground plane, walls/background, simple geometric objects (boxes, cylinders, pedestrians as capsules, etc.) with hidden reference cuboids / point labels. Every demo asset flagged `isSynthetic=true` and labelled "DEMO / SYNTHETIC TRAINING DATA" in the UI.
- **Segmentation labels:** stored as `Uint16Array` label-per-point blob (base64 in DB for SQLite simplicity; file for large), NOT JSON rows.
- **Scoring:** system computes advisory metrics against hidden reference (class match, center error, IoU 3D, yaw error, point-label accuracy) and shows them to reviewer. Reviewer sets final score. Never auto-approve.
- **Notifications:** in-app only (DB table + bell in topbar).
- **Certificate:** HTML page with print stylesheet; no PDF generation.
- **Activity tracking:** meaningful events only (see list below). No screen recording.

## Primary navigation (fixed)

Left sidebar 250px, four items in order: **Learn, Annotate, Review, Complete**. Always visible. Locked items show lock icon, disabled styling, tooltip explaining what to complete, not clickable. Top bar: user name, learning progress %, notifications bell, profile menu (logout).

Dark theme default. Minimal decoration, big workspace.

## Learning gate (core)

Trainee: Learn available; Annotate/Review/Complete locked until ALL mandatory modules completed (every lesson marked complete + module quiz passed) AND final assessment passed (default 80%, configurable per program). Unlock state persisted in DB (`Enrollment.learnCompletedAt`). Failed assessment = stays locked. Reviewer/Admin bypass gate for their staff screens. Retries allowed; every attempt stored.

## Learn content

Modules (each: short explanation, visual demo, practical example, things to remember, common mistakes, knowledge check, complete button; 3–7 min):
1. Understanding LiDAR and 3D Point Clouds (interactive sample cloud)
2. Navigating a 3D Scene (interactive scene, must try controls)
3. Understanding Objects and Labels (editable example schema, not project taxonomy)
4. Understanding 3D Bounding Boxes (interactive cuboid demo)
5. Difficult Annotation Situations
6. Annotation Quality and Professional Workflow

Optional tracks (admin toggles per program): cuboid detection, semantic segmentation, instance segmentation, multi-frame tracking, scene classification, sensor fusion/context images.

Question types: multiple choice, true/false, point-cloud/image interpretation, identify-incorrect-annotation, choose-correct-decision, identify-object-from-evidence. Final assessment tests understanding, not definitions.

## Annotate

Task list shows: task ID, title, difficulty, annotation type, est. time, instructions, required output, status, previous feedback. Opening task → large 3D workspace.

Viewer: load/render cloud, rotate/pan/zoom, reset, top/front/side/perspective, axes, point size, point visibility (by label/class toggle), selection, undo/redo, save draft, autosave (throttled ~5s after change), submit.

Cuboid tools: create, move, resize, rotate (yaw), edit label, edit attributes, delete, select/inspect. Segmentation tools: brush/lasso point selection + label apply. Sequence tasks: frame nav + consistent track IDs. Inspection/QA tasks: checkpoints (views visited, region located) + free-text answers + per-annotation issue flags with reason.

Task types (enum `AnnotationType`): `INSPECTION`, `IDENTIFICATION`, `CUBOID`, `SEMANTIC_SEG`, `INSTANCE_SEG`, `TRACKING`, `ERROR_DETECTION`, `MIXED`.

Formats: PLY (ascii+binary), PCD (ascii+binary), XYZ/PTS, LAS (uncompressed 1.2–1.4 point formats 0–3, 6–8), BIN (only with configured record schema, e.g. KITTI `xyzi float32`). LAZ: document as unsupported unless laz-perf added later.

Submission: validate → save version → create submission (PENDING_REVIEW) → reviewer queue → record time + user. Submitted version immutable; revision creates new version from it.

## Seeded tasks (10) — see original brief; IDs TASK-01…TASK-10

01 Navigation (INSPECTION, beginner), 02 Object Identification (IDENTIFICATION), 03 Basic Cuboid (CUBOID), 04 Cuboid Precision (CUBOID, pre-populated bad boxes to fix), 05 Occlusion/Partial (CUBOID + attributes + flags), 06 Semantic Seg (track-gated), 07 Instance Seg (track-gated), 08 Multi-frame Tracking (track-gated, synthetic sequence), 09 Error Detection (ERROR_DETECTION, planted mistakes), 10 Final Practical (MIXED).

Each task record: id, title, description, objective, learningOutcome, difficulty, prerequisiteTaskId, annotationType, estimatedMinutes, instructions, assetId, expectedOutput, scoringCriteria, referenceAnnotation (hidden), commonMistakes, hints, reviewerRubric, isPublished, trackKey (nullable).

## Review (staff)

Queue: trainee, task id/title, submitted at, attempt #, type, status, prior feedback. Filters. Pending count. Open: cloud + trainee annotations + reference overlay toggle + advisory metrics + history + rubric. Approve (score, feedback) or Request Revision (error tags, feedback, instructions). Audit history. Reviewer never edits trainee's submitted version. Reviewer assignment to tasks/trainees. Trainee "Review" tab = own submissions status + feedback.

## Complete

Approved tasks: id, title, type, completed date, reviewer, score, feedback, attempts, status. Overall progress. Certificate when program's required tasks all approved (admin-configurable requirements).

## Activity events (enum `ActivityType`)

LOGIN, LOGOUT, MODULE_OPENED, LESSON_COMPLETED, MODULE_COMPLETED, QUIZ_ATTEMPTED, ASSESSMENT_ATTEMPTED, LEARN_COMPLETED, TASK_OPENED, ANNOTATION_STARTED, DRAFT_SAVED, TASK_SUBMITTED, REVISION_REQUESTED, REVISION_SUBMITTED, TASK_APPROVED, PROGRAM_COMPLETED. Plus learning time via heartbeat (`LearningSession` rows, 30s pings).

Admin dashboard: totals (registered, not started, learning, learn done, assessment failed, annotating, pending review, revision required, completed), avg assessment score, avg task score, avg time to completion. Filters trainee/task/date/status. Per-trainee full activity timeline.

## Status badges

Not Started, In Progress, Locked, Submitted, Pending Review, Revision Required, Approved, Completed.

## Security

Every API route checks session + role + ownership. Trainee cannot read others' submissions/progress or call reviewer/admin routes. Zod validation on all inputs.

## Deliverables

Working app, migrations, seed, tests, `.env.example`, README with local run commands + deploy notes + format limitations.

## UI style (OVERRIDES "dark theme default" above — user decision)

Match the reference screenshots in `/Users/chirkut/Documents/Office/Lidar-tool/example/` (Encord 3D editor tutorial). Look at ALL ten images before building any UI. Style rules:

- **Clean, flat, low-fidelity.** No gradients, shadows beyond a 1px border, no hero sections, no decorative icons, no marketing-style cards. Plain white/neutral chrome (`#fff` surfaces, `#f5f5f5` panels, `#e5e5e5` borders, `#111` text, `#6b7280` muted). One accent: lime `#c6f135` for primary buttons/active states (as in screenshots), green check `#4caf50` for completed.
- **Viewer canvas always dark** (`#0b0b0b` / olive-black like screenshots) with a subtle grid; chrome around it light.
- **Layout like screenshots:** thin top bar (app name, breadcrumb/task name, actions, help, user menu, Previous/Next task buttons), left panel for labels/objects list (~300px) inside the Annotate workspace, viewer fills the rest, thin icon toolbar strip at top of viewer, frame timeline strip at bottom for sequences, small context-image thumbnails bottom-center when present.
- **Lesson/tutorial steps** are small bottom-centered dialogs with title + one-line instruction + key hints (W A S D keycaps etc.) + Back/Next + progress dots. Interactive checkpoints show a green check when done.
- **App sidebar** (Learn/Annotate/Review/Complete) stays 250px, plain text + simple line icons, active item lime-tinted, locked items grey with lock glyph.
- System font stack (Inter if available via `next/font`), 13–14px base, tight spacing, tables over cards for lists.
- CSS variables on `:root`; keep a `[data-theme="dark"]` variant for chrome so dark mode can be flipped later, but light is default.

## Project-specific configs (`/project-configs/<slug>/`)

When a customer/project guideline document is supplied, it is converted into a config folder, never hard-coded into app logic. Format: `config.json` (validated by zod schema in `app/src/lib/project-config.ts`, Stage 2 writes it), `guidelines.md` (cleaned guideline text with image refs), `images/*.png` (reference images from the doc), `source/` (original doc). The seed loads every folder here as an additional TrainingProgram with its own labelSchema, attributes, guidelines, extra project module(s), and project-flavoured copies of the cuboid/tracking tasks. The neutral "foundations" program stays untouched. First real one: `project-configs/tonic/` (warehouse LiDAR cuboids, 22 classes, occlusion+motion attributes, human activity attribute, 10 m ROI tiers, persistent track IDs, pre-label review rules, 2D image alignment).

## Colour palette (OVERRIDES lime accent above — user decision 2026-11-05)

Primary = deep royal blue `#1F3BB3` (buttons, active nav, links), hover `#182F8F`; accent gradient `#2F6FED → #4A9BF5` for emphasis words/progress; headline text `#0F1222`; body `#3B4256`; muted `#6B7280`; page background `#F3F6FB` with a faint 24px dot grid; surfaces `#FFFFFF`, borders `#E3E8F2`, panels `#F7F9FD`; success `#22C55E`; warning `#F59E0B`; danger `#E5484D`. Corners 10–12px, pill primary CTAs, soft shadow `0 8px 30px rgba(31,59,179,0.08)` on floating cards only. Viewer canvas stays dark. Tokens live in `app/src/app/globals.css`; never hard-code colours in components.
