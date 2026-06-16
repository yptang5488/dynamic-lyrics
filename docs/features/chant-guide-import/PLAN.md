# Implementation Plan: Chant Guide Import

Status: Active
Last Updated: 2026-06-16
Related spec:
Related session log:
Related task / bug / branch:
Source of Truth: Current code, current git diff, current product behavior, and linked specs override this plan.

## Goal

- Add a safe maintainer workflow for storing fanchant / cheering notes outside LRC files, validating them against existing timed lyrics, and applying them to lyric-line `notes` without changing lyric text or timing.

## Current Plan

- Treat LRC files as timing and base lyric sources only.
- Store manually prepared chant data as separate source files under `data/chant-guides/{songId}.json` using a formalized `chant-guide.v1` shape.
- Add a maintainer script first, not a public API: validate a guide against the current song payload, print a reviewable summary / diff, and only persist with an explicit `--apply` flag.
- When applying, update only `lyrics[].notes` inside `data/songs/{songId}.json` and run the existing chant romanization normalization path.
- Match guide entries with both `lineId` and `lineMatchText` when available; allow `lineMatchText`-only authoring, but apply only unique high-confidence matches.
- Default apply behavior replaces existing chant notes on matched lines while preserving non-chant notes.
- Treat `needsReview` as non-blocking by default: safe entries can be applied first, while unsafe or ambiguous entries are skipped and retained in the guide file for later frontend or guide-file cleanup.

## Task Breakdown

- [x] Confirm the minimal `chant-guide.v1` schema for source files, including song identity, optional `lineId`, `lineMatchText`, note shape, and review metadata.
- [ ] Add one checked-in example guide for `MAMAMOO - 4 Flowers` under `data/chant-guides/`.
- [x] Implement a dry-run validation script that reads a guide and existing song payload, matches guide lines to lyric lines, and reports unmatched or ambiguous entries.
- [x] Add `--apply` mode that updates only matched lyric-line `notes` and leaves timestamps, lyric text, translation, audio, and metadata unchanged.
- [x] Add review handling that separates blocking validation errors from skipped `needsReview` items and writes persistent review items back to the guide file.
- [x] Add automatic backup or pre-write safety output so accidental note imports can be inspected or reversed.
- [x] Add tests for exact line-id matching, line text mismatch rejection, note-only persistence, and romanization normalization.
- [x] Document the maintainer workflow for preparing a chant guide, dry-running it, reviewing output, and applying it.
- [x] Add a marked-source preparation script for converting maintainer markdown notation into `chant-guide.v1`.

## Dependencies / Order

- Finalize schema before writing the importer, because the matching and safety checks depend on target fields.
- Implement dry-run validation before `--apply`; applying without a review path is out of scope.
- Use existing backend song payload and note normalization code where possible instead of creating a second persistence model.
- Keep public API work deferred until the CLI workflow proves useful.
- Do not require every review item to be resolved before applying safe notes; unresolved review items must not be written into the player song payload.

## Progress Notes

- Current backend persists notes inside `lyrics_json.lyrics[].notes` and exposes `PATCH /api/songs/{song_id}/lyric-notes` for per-line updates.
- Current docs include a `chant-guide.v1` example shape, but no formal import flow or backend-loaded standalone notes source exists yet.
- Confirmed: use both `lineId` and `lineMatchText`; manually review dry-run reports alongside the guide file; allow guide entries without `lineId` only when validation finds one safe match.
- Confirmed: safe entries may be applied while ambiguous entries are skipped and written back to the guide as persistent `needsReview` items.
- Done: implemented `scripts/import_chant_guide.py` with dry-run, apply, backup, chant-only replacement, romanization normalization, and persistent `needsReview` handling.
- Done: implemented `scripts/prepare_chant_source.py` for the current `**phrase**`, `(callout)`, and `~~lyric~~(chant)` source notation.
- Done: documented the maintainer workflow in `docs/features/chant-guide-import/WORKFLOW.md`.
- Next step: add a checked-in `MAMAMOO - 4 Flowers` guide under `data/chant-guides/` and dry-run it against the existing song payload.

## Open Questions

- Should backup files be written automatically, or is a dry-run diff plus git history sufficient for local maintainer workflow?
- How long should automatically written backup files be retained, and should cleanup be manual or scripted? Current implementation keeps backups indefinitely.

### 2026-06-16 - Matching and apply defaults confirmed

- Confirmed guide matching uses both `lineId` and `lineMatchText`, with strict validation for entries missing `lineId`.
- Confirmed apply should replace chant notes only while preserving any future non-chant notes.

### 2026-06-16 - Review flow confirmed

- Confirmed `needsReview` should not block safe imports by default.
- Confirmed ambiguous or unsafe entries should be skipped from the song payload and retained in the guide file for later cleanup.

### 2026-06-16 - Import script implemented

- Added the first maintainer CLI for dry-running and applying chant guides.
- Deferred the 4 Flowers guide file to the next step so it can be generated and reviewed separately from the importer mechanics.

### 2026-06-16 - Marked source preparation added

- Added a CLI for converting maintainer-authored marked lyrics into `chant-guide.v1` before running the importer.

## Plan Changes

### 2026-06-16 - Created

- Created initial implementation plan for standalone chant guide source files and safe note import.
