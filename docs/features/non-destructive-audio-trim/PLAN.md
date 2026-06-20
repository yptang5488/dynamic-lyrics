# Implementation Plan: Non-Destructive Audio Trim

Status: Active
Last Updated: 2026-06-20
Related spec:
Related session log:
Related task / bug / branch:
Source of Truth: Current code, current git diff, current product behavior, and linked specs override this plan.

## Goal

- Let maintainers hide extra silence or unwanted audio at the beginning or end of a source track without modifying the original audio file.
- Keep lyric timing and player behavior predictable by treating trim as playback metadata, not as a destructive media edit.

## Current Plan

- Add non-destructive trim metadata to the song audio payload first, using the same time unit style as existing lyric timing fields.
- Keep the stored audio file unchanged; the player starts playback at `trimStart` and prevents normal playback past `duration - trimEnd`.
- Present the trimmed song timeline as starting at `0` in the player UI, while keeping LRC / lyric timestamps unchanged and using them for playback and operations.
- Avoid ffmpeg-based file cutting until there is a concrete need to export trimmed files or reduce stored media size.

## Task Breakdown

- [x] Verify the current song/audio data model, persisted JSON format, import flow, and player time calculations.
- [x] Define the minimal trim metadata shape and units, including default behavior when fields are absent.
- [x] Update backend song validation / serialization so trim metadata is preserved without requiring old songs to change.
- [x] Update any song import or edit path that creates song audio payloads so maintainers can store trim values.
- [x] Update frontend player time conversion so visible time maps to raw audio time using `trimStart`.
- [x] Clamp playback end behavior so `trimEnd` stops playback before unwanted trailing audio.
- [x] Update lyric active-line, seek, and click-to-line behavior so they use the trimmed visible timeline consistently.
- [x] Support maintainer-provided trim metadata in song JSON / import metadata.
- [x] Add first-phase maintainer UI fields for editing `trimStart` and `trimEnd` seconds.
- [x] Add tests or a small runnable check for time conversion, seek mapping, and end clamp behavior.
- [ ] Document the workflow for adding an online source and applying non-destructive trim.

## Dependencies / Order

- Treat the trimmed timeline as the user-visible song start/end, while preserving existing LRC timing values as authored.
- Data model changes should happen before player changes so frontend types and defaults are clear.
- End-trim behavior depends on reliable audio duration; if duration is missing or inaccurate, start trim can ship first and end trim should stay blocked.

## Progress Notes

- Proposed direction: non-destructive trim metadata only; do not modify or re-encode source audio in the first version.
- Confirmed: trim is stored as metadata first; the trimmed timeline is the new visible start/end; LRC timing stays unchanged; trim units should match existing lyric timing fields.
- Confirmed: first implementation stores metadata only and includes simple maintainer input fields; trim preview UI is deferred.
- Done: backend `AudioPayload` and song creation now preserve `trimStart` / `trimEnd` seconds with default `0` values.
- Done: frontend player displays the trimmed timeline, maps visible seek / lyric jumps to raw audio time, and pauses at the trimmed end.
- Done: frontend `Edit details` can save `trimStart` and `trimEnd` values without adding preview controls.
- Done: verification passed with frontend build, backend pytest, and a small trim time self-check script.
- Next: document how maintainers should add `trimStart` / `trimEnd` metadata to prepared songs.

## Open Questions

- None currently.

## Plan Changes

### 2026-06-20 - Created

- Created initial implementation plan for non-destructive audio trimming.

### 2026-06-20 - Resolved Initial Trim Semantics

- Confirmed that trim should define the visible playback timeline while preserving original LRC timing values.
- Confirmed the first version should store trim as metadata and use the same time unit style as existing lyric timing fields.

### 2026-06-20 - Scoped First Version To Metadata Only

- Deferred trim editing and preview UI; first implementation should only consume maintainer-provided metadata.

### 2026-06-20 - Implemented Metadata Playback Mapping

- Added backend and frontend support for `trimStart` / `trimEnd` seconds and updated player seek / end-clamp behavior.
- Left maintainer documentation as the remaining task.

### 2026-06-20 - Added First-Phase Trim Inputs

- Added simple `Edit details` fields for maintainers to update `trimStart` and `trimEnd`; preview UI remains deferred.
