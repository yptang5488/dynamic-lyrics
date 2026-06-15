# Implementation Plan: Chant Romanization

Status: Active
Last Updated: 2026-06-15
Related spec:
Related session log:
Related task / bug / branch:
Source of Truth: Current code, current git diff, current product behavior, and linked specs override this plan.

## Goal

- Automatically generate and display romanized Korean pronunciation for chant notes, covering both imported chants and chants edited from the frontend.
- Keep romanization as derived data so users edit only the original chant text.

## Current Plan

- Move the existing Korean romanization logic from `scripts/romanize_chant_lrc.py` into a backend service module that can be reused by imports, API updates, and scripts.
- When chant notes are saved or imported, automatically populate `romanizedText` for Korean chant text and omit it for pure English / non-Hangul chant text.
- Existing persisted songs do not need immediate backfill; old notes without `romanizedText` should render safely, and later edits/imports can normalize them.
- Mixed English/Korean chant text should preserve English and romanize only Korean text; pure English chant text should not produce `romanizedText`.
- Keep the frontend display-only: render `note.text` as the source chant and render `note.romanizedText` only when present.
- Add a player-level toggle for showing chant romanization, defaulting to visible for learning / cheering use.
- Do not add manual romanization overrides in this phase.

## Task Breakdown

- [x] Extract Hangul romanization and simplified liaison logic into a backend service module.
- [x] Update the chant LRC script to call the shared backend romanization module instead of owning duplicate logic.
- [x] Add backend tests for Korean-only, English-only, mixed text, single batchim liaison, double batchim liaison, and `ㅅ -> ㅆ` liaison.
- [x] Add a note normalization function that adds or removes `romanizedText` for every chant note before persistence.
- [x] Apply note normalization in the frontend note update API path so newly added, edited, and deleted chants stay consistent.
- [x] Apply note normalization in import / song-building paths that create chant notes before the song is saved.
- [x] Update frontend note types to include optional `romanizedText`.
- [x] Render romanized text for inline chant notes without changing lyric text or timing.
- [x] Render romanized text inside standalone chant pills as a secondary line.
- [x] Add a player-level toggle for showing / hiding chant romanization, defaulting to visible.
- [x] Verify existing songs with old chant notes either render safely without `romanizedText` or are normalized on the next save/import.

## Dependencies / Order

- Shared backend romanization must happen before API save normalization, import integration, and frontend display work.
- Backend save normalization should come before frontend editing UI changes so the frontend can rely on returned data.
- Import normalization and API update normalization should use the same helper to avoid inconsistent results.
- Frontend should not implement romanization rules unless backend round-trip latency becomes a real product problem.
- The display toggle should be added with the first frontend rendering pass and default to visible.

## Progress Notes

- Done: A standalone script exists at `scripts/romanize_chant_lrc.py` and supports Hangul syllable romanization, simplified liaison, overrides, English-only chant skipping, and a `--check` self-test.
- Done: Product decisions confirmed: no immediate backfill, preserve English in mixed text, omit pure English romanization, and add a player-level display toggle defaulting to visible.
- Done: Backend service, script reuse, API update normalization, song-build normalization, frontend rendering, and visible-by-default toggle are implemented.
- Done: Existing notes without `romanizedText` render safely because frontend only shows the value when present.
- Verified: Focused backend tests, script `--check`, and frontend production build pass.
- Next: If existing persisted songs should display romanization before any edit/import, run a separate backfill migration later.
- Deferred: manual romanization overrides, frontend-side romanization, and full Korean pronunciation rules that require morphology or word segmentation.

## Open Questions

- None currently.

## Plan Changes

### 2026-06-15 - Created

- Created initial implementation plan for automatic chant romanization across import, backend note updates, and frontend display.

### 2026-06-15 - Confirmed Initial Product Decisions

- Activated the plan with lazy normalization for existing songs, mixed-text preservation, pure-English omission, and a visible-by-default player toggle.

### 2026-06-15 - Implemented Automatic Romanization Flow

- Added shared backend chant romanization and note normalization.
- Wired normalization into API note updates and song building.
- Updated the chant LRC script to reuse backend romanization.
- Added frontend romanized chant rendering and a player-level display toggle.
