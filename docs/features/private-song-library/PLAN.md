# Implementation Plan: Private Song Library

Status: Active
Last Updated: 2026-06-13
Related spec:
Related session log:
Related task / bug / branch:
Source of Truth: Current code, current git diff, current product behavior, and linked specs override this plan.

## Goal

- Provide a private, curated song library that lets known friends use pre-prepared songs, LRC timing, translations, and idol cheering / study notes without requiring them to download audio from Spotify, YouTube, or other external services.
- Keep the first deployable version small by reusing the existing backend media serving, song payload, and player flow.

## Current Plan

- First implementation focus: establish the curated song catalog so friends can choose from maintainer-prepared songs before entering the existing player.
- Build a read-only library flow separate from `spotdl`, YouTube import, and user upload / editing flows.
- Treat audio files, LRC files, translations, and cheering / study notes as maintainer-provided content.
- Add a backend song listing endpoint and a frontend library page before expanding correction, notes, multi-audio-track, or deployment work.
- Keep the first catalog data shape small, but leave room for later sync offsets, chant notes, audio variants, tags, and deployment storage choices.
- Store shared notes inside the song payload first, reusing the existing lyric-line `notes` placeholder.
- Defer arbitrary user downloads, Spotify / YouTube account integration, full user accounts, server-side personal note sync, and complex permission systems until there is a concrete need.

## Task Breakdown

- [x] Define the minimal catalog entry shape for list display: song id, title, artist, optional cover, language, tags, availability flags, and player route target.
- [x] Verify where existing prepared songs are stored today and how `/api/songs/{songId}` loads song payloads from persisted storage or exported files.
- [x] Choose the first catalog source for prepared songs: existing persisted songs first, then a manifest / seed script only if the current storage cannot support reliable listing.
- [x] Add a backend song listing endpoint, likely `GET /api/songs`, returning lightweight catalog entries instead of full lyric payloads.
- [x] Add backend tests for empty library, populated library, and missing / invalid song records that should not break the list.
- [x] Add frontend API client support for the catalog listing endpoint.
- [x] Add a frontend library page that lists prepared songs and links into the existing `/player/:songId` route.
- [x] Make the library page the read-only friend entry point, while keeping import / upload flows available only as maintainer tools or secondary routes.
- [x] Add minimal mobile-friendly states for loading, empty library, and load failure.
- [x] Add a minimal maintainer remove action so duplicate or test songs can be removed from the library without deleting local media files.
- [x] Update README or a feature note with the first workflow for opening the library and adding a prepared song.
- [ ] Defer rendering shared cheering / study notes in the player until the catalog entry point exists.
- [ ] Defer multi-audio-track support until the single-track catalog flow is working.
- [ ] Defer deployment storage and access protection decisions until the library can be tested locally with prepared songs.

## Dependencies / Order

- Verify current song persistence before designing a new manifest or seed flow.
- Define the lightweight catalog response shape before adding the endpoint or frontend API types.
- Backend song listing should come before the frontend library page.
- Frontend library should link to the existing player before player behavior is expanded.
- Notes, manual correction, audio variants, deployment storage, and access protection should stay deferred until the catalog entry point works locally.
- Curated content import / seed strategy should be chosen before deploying, otherwise prepared songs may be difficult to reproduce across environments.

## Progress Notes

- Done: Chosen direction is a private curated song library, not an open arbitrary-download platform.
- Done: Current architecture already has useful seams: backend `/media` serving, `/api/songs/{songId}`, player payloads, and lyric-line `notes` placeholders.
- Done: File-based `data/songs` JSON records are the catalog source; exported JSON files are not required for the first listing endpoint.
- Done: Backend `GET /api/songs` returns lightweight player-ready catalog entries and skips invalid song payloads.
- Done: Frontend library entry point lists prepared songs from `GET /api/songs` and links to `/player/:songId`.
- Done: `/` is now the read-only friend library entry point; `/import` remains available as the maintainer import route.
- Done: Maintainers can remove duplicate / test songs from the library; first version deletes only the `songs` record and leaves sources / media files intact.
- Done: README and `WORKFLOW.md` document the first local workflow for opening the library, adding prepared songs, and removing duplicate / test entries.
- Current focus: decide whether shared notes rendering should be the next catalog MVP follow-up.
- Next: define the first shared `notes` schema and render it in the player, unless deployment access / storage needs to come first.
- Deferred: Spotify / YouTube arbitrary download, user-provided download credentials, full account system, and server-side personal note sync.
- Deferred until after catalog MVP: notes UI, manual timing correction, original / cheering audio variants, deployment storage choice, and access protection.

## Open Questions

- Should `GET /api/songs` list only successfully built player-ready songs, or also show draft / incomplete maintainer-prepared entries?
- Should the first catalog source stay as `data/songs` JSON records, use exported song JSON payloads, or use a checked-in manifest that points to prepared media files?
- What minimal fields should appear on the library card in the first version: cover art, language, tags, song duration, chant availability, or only title / artist?
- What should the first `notes` schema contain: cheering phrase, pronunciation hint, meaning, timing cue, display priority, or tags?
- Should private songs be created from a checked-in manifest that references external media files, or from an import script that scans a local content folder?
- Should friends be allowed to add personal notes in browser `localStorage` during the first version?
- Is simple shared-password protection enough for the first deployment, or should access remain local/manual until content sharing is tested?
- Should audio files initially live on backend persistent disk, or should the first deployed version start with object storage URLs?

## Plan Changes

### 2026-06-13 - Focused First Phase On Song Catalog

- Activated the plan for the first implementation phase: establishing a read-only song catalog / library entry point for prepared songs.
- Reordered work so backend listing, frontend library, and catalog data shape come before notes, manual correction, multi-audio-track support, deployment storage, and access protection.
- Added open questions about catalog source, list eligibility, and first library-card metadata.

### 2026-06-13 - Completed Backend Catalog Listing

- Confirmed persisted song records can support the first catalog source.
- Added backend `GET /api/songs` with lightweight catalog entries and tests for empty, populated, invalid, and not-ready records.
- Shifted next execution focus to frontend catalog API support and the library page.

### 2026-06-13 - Completed Frontend Library Entry Point

- Added frontend catalog API support and a read-only library page for prepared songs.
- Made `/` the friend-facing library route and kept `/import` for maintainer song creation.
- Added loading, empty, and failure states for the library page.

### 2026-06-13 - Added Library Song Removal

- Added backend song deletion for removing entries from the library.
- Added a frontend remove action on library cards for duplicate or test songs.
- Kept deletion conservative: remove only song records, not sources or local media files.

### 2026-06-13 - Documented Library Workflow

- Updated README with the library route, maintainer import route, catalog source, cleanup behavior, and API coverage.
- Added `WORKFLOW.md` for friend usage, maintainer add flow, cleanup flow, catalog source, and current limitations.
- Shifted next execution focus to choosing the next feature step after the catalog MVP.

### 2026-06-14 - Replaced SQLite With File Storage

- Replaced SQLite-backed records with file-based JSON records under `data/sources`, `data/jobs`, and `data/songs` while preserving the existing storage API used by routes and workers.
- Removed the obsolete SQLite table definitions.
- Updated documentation to describe JSON file storage as the current catalog source.

### 2026-06-03 - Created

- Created initial implementation plan for a private curated song library that separates pre-prepared content sharing from `spotdl` / YouTube import work.
