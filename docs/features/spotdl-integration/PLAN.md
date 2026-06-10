# Implementation Plan: spotdl Integration

Status: Completed
Last Updated: 2026-06-10
Related spec:
Related session log:
Related task / bug / branch:
Source of Truth: Current code, current git diff, current product behavior, and linked specs override this plan.

## Goal

- Integrate a locally working `spotdl` clone into `dynamic-lyrics` without forcing its conflicting Python dependencies into the main project environment.
- Keep Spotify audio import resumable, debuggable, and resilient to common `spotdl` provider and filtering failures.

## Current Plan

- Use `uv tool install --editable /Users/tangyiping/Documents/source/spotdl` so `spotdl` runs in an isolated tool environment while loading the local clone's code.
- Keep `dynamic-lyrics` managed by its own `uv` environment and call `spotdl` as a subprocess CLI tool.
- Configure Spotify credentials through environment variables, not hardcoded scripts or committed files:
  - `SPOTIFY_CLIENT_ID`
  - `SPOTIFY_CLIENT_SECRET`
- Let `app/services/spotdl_import.py` handle `spotdl 4.4.3` CLI arguments, provider fallback, and configurable retry without strict result filtering.

## Task Breakdown

- [x] Verify that `uv tool install --editable` uses the local `spotdl` clone through the `~/.local/bin/spotdl` launcher.
- [x] Avoid adding local `spotdl` as a normal `dynamic-lyrics` dependency because `spotdl 4.4.3` conflicts with the app's `uvicorn>=0.35.0` requirement.
- [x] Update `spotdl` invocation from `--output-format mp3` to `--format mp3` for `spotdl 4.4.3`.
- [x] Add provider fallback order: `youtube-music`, `youtube`, then `piped`.
- [x] Retry with `--dont-filter-results` when `spotdl` reports filtered or missing audio results.
- [x] Treat `spotdl` exit code 0 without an audio file as a failed attempt so fallback can continue.
- [x] Read Spotify credentials from environment variables and fetch a fresh client-credentials token when possible.
- [x] Confirm backend tests pass after the integration changes.
- [x] Confirm smoke test can successfully download audio after environment setup and fallback fixes.
- [x] Remove hardcoded Spotify client secret and token values from `/Users/tangyiping/Documents/source/spotdl/scripts/run_spotdl.sh` or convert that script to read environment variables only.
- [x] Add unit tests for `spotdl_import.py` fallback behavior by mocking subprocess execution and output files.
- [x] Document local Spotify environment variables with `.env.example` and ignore local dotenv files.
- [x] Document local setup for `uv tool install --editable` and smoke-test commands.
- [x] Run a full app flow test from Spotify import through generated audio/LRC output and player usage.
- [x] Make `spotdl` provider order and unfiltered search preference configurable for local environments where YouTube Music is blocked or strict filtering consistently removes valid results.

## Dependencies / Order

- `uv tool install --editable /Users/tangyiping/Documents/source/spotdl` must remain installed or otherwise `spotdl` must be available on `PATH`.
- `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` must contain real Spotify Developer credentials before running smoke tests or backend import flows that require Spotify metadata.
- Secret cleanup in the external `spotdl` repo is complete, but any previously exposed Spotify credentials should still be rotated if the script was committed or shared.
- Unit tests should mock `spotdl` subprocess behavior instead of depending on live Spotify, YouTube, or Piped services.
- Full app flow testing completed after credentials and CLI smoke tests were confirmed working in the local shell used to start the backend.

## Progress Notes

- Done: local `spotdl` clone is reachable through `uv tool`; `spotdl_import.py` now supports `spotdl 4.4.3`, provider fallback, `--dont-filter-results`, and client-credentials environment variables.
- Done: backend test suite passed with `30 passed` after integration changes.
- Done: smoke test successfully downloaded audio after exporting Spotify credentials and fixing zero-exit/no-audio fallback.
- Done: external `spotdl` helper script now reads `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` from the environment, with optional `SPOTIFY_AUTH_TOKEN`.
- Done: `.env.example` now documents required Spotify variables, while `.gitignore` excludes local dotenv files.
- Done: mocked tests cover provider fallback, `--dont-filter-results` retry, zero-exit/no-audio handling, and credential argument construction.
- Done: `LOCAL_SETUP.md` documents `uv tool` install, `.env.local` setup, environment loading, smoke tests, and troubleshooting.
- Done: `.env.local` now contains non-placeholder Spotify credentials, `spotdl_smoke.py` downloaded `NEWJEANS - Ditto` audio and LRC, and the API flow produced a song/player payload.
- Final verification: upload audio returned `201`, LRC import job completed as `done`, fetched song had `41` lyric lines, and backend regression tests passed.
- Done: `SPOTDL_AUDIO_PROVIDERS` and `SPOTDL_PREFER_DONT_FILTER` allow this local setup to prefer `youtube --dont-filter-results` while preserving conservative defaults for other environments.

## Open Questions

- Should generated `.lrc` files from `spotdl` become part of the primary import flow, or remain optional output for later alignment work?
- Should `dynamic-lyrics` support an explicit `SPOTDL_BIN` setting to avoid relying on `PATH`?

## Plan Changes

### 2026-06-03 - Created

- Created implementation plan for integrating the local `spotdl` clone through `uv tool` and tracking remaining hardening tasks.

### 2026-06-03 - Updated

- Marked hardcoded Spotify credential cleanup complete for the external `spotdl` helper script.
- Updated next execution step to mocked fallback tests for `spotdl_import.py`.

### 2026-06-03 - Updated

- Added local dotenv hygiene: ignore `.env` files while keeping `.env.example` tracked with placeholder Spotify credential names.

### 2026-06-04 - Updated

- Marked mocked `spotdl_import.py` fallback tests complete.
- Updated next execution step to local setup documentation and full app flow testing.

### 2026-06-04 - Updated

- Added `LOCAL_SETUP.md` for repeatable local `spotdl` setup and smoke testing.
- Updated next execution step to full app flow testing.

### 2026-06-10 - Blocked

- Full app flow testing is blocked because `.env.local` still contains placeholder Spotify credentials.
- Smoke test currently fails during client-credentials token exchange with `HTTP Error 400: Bad Request`.

### 2026-06-10 - Completed

- Unblocked full app flow after `.env.local` was updated with real Spotify credentials.
- Verified smoke download and existing upload + LRC API flow through song/player payload generation.
- Marked the implementation plan completed; remaining open questions can become future feature work if needed.

### 2026-06-10 - Updated

- Added configurable `spotdl` provider order and filter preference for local environments.
- Documented `SPOTDL_AUDIO_PROVIDERS="youtube,piped"` and `SPOTDL_PREFER_DONT_FILTER="true"` as the recommended local setup when YouTube Music is blocked and strict YouTube filtering drops valid results.
