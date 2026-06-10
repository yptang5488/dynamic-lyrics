# Development Session Log

Status: Current
Last Verified: 2026-06-10
Scope: spotdl integration for Spotify audio import
Related task / bug / branch: docs/features/spotdl-integration
Source of Truth: Current code, current git diff, and current product behavior override this note.

## Current Summary

- Current goal: Use a locally working `spotdl` clone from `dynamic-lyrics` without merging `spotdl` dependencies into the app's Python environment.
- Confirmed implementation direction: install the local `spotdl` clone with `uv tool install --editable`, then call the `spotdl` CLI from `app/services/spotdl_import.py` as a subprocess.
- Important ownership / architecture decisions: `dynamic-lyrics` owns orchestration, output discovery, and fallback policy; `spotdl` remains an isolated external CLI/tool environment.
- Known pitfalls: `spotdl 4.4.3` uses `--format`, not `--output-format`; `spotdl` may return exit code 0 even when no audio file was produced; YouTube Music may be blocked; YouTube results may be filtered to zero; stale `~/.spotdl` tokens can cause 401 errors; previously exposed Spotify credentials should be rotated if they were committed or shared.
- Open questions: whether generated `.lrc` should become part of the primary import flow, whether to add an explicit `SPOTDL_BIN` setting, and whether to standardize on `direnv` or a startup script for loading local dotenv files.
- Current blocker: none for the planned local `spotdl` integration work; remaining questions are future scope decisions.

## Timeline Log

### 2026-06-03 23:00 - Started

- Context: PyPI-installed `spotdl` was problematic, but a separately cloned `/Users/tangyiping/Documents/source/spotdl` repo was known to run locally.
- Goal: Determine how `dynamic-lyrics` should use that local `spotdl` repo safely and reproducibly.

### 2026-06-03 23:05 - Rejected

- Rejected adding local `spotdl` as a normal project dependency because `spotdl 4.4.3` requires `uvicorn>=0.23.2,<0.24`, while `dynamic-lyrics` requires `uvicorn>=0.35.0`.
- Prefer using an isolated `uv tool` environment or separate `spotdl` virtual environment because `dynamic-lyrics` only needs the CLI, not direct Python imports.

### 2026-06-03 23:10 - Decision

- Chose `uv tool install --editable /Users/tangyiping/Documents/source/spotdl` because it keeps dependency resolution isolated while still loading the local clone's editable source code.
- Evidence: `~/.local/bin/spotdl` resolves to the `uv` tool launcher, and the installed module path points back to `/Users/tangyiping/Documents/source/spotdl/spotdl/__init__.py`.
- Impact: `dynamic-lyrics` can rely on `PATH` to find `spotdl` without putting `spotdl` into the main app environment.

### 2026-06-03 23:15 - Root Cause

- Problem: Initial smoke test failed with `spotdl: error: unrecognized arguments: --output-format mp3`.
- Root cause: `dynamic-lyrics` was using old `spotdl` CLI syntax. The local clone is `spotdl 4.4.3`, which expects `--format mp3`.
- Fix direction: update `spotdl_import.py` to use `--format`.

### 2026-06-03 23:20 - Root Cause

- Problem: After fixing the CLI argument, smoke tests reached Spotify metadata lookup but failed with `The access token expired`.
- Root cause: `spotdl` can read stale auth state from `~/.spotdl` config/cache, or from an expired explicit auth token.
- Fix direction: use `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` environment variables so `dynamic-lyrics` can fetch a fresh client-credentials token before invoking `spotdl`.

### 2026-06-03 23:25 - Decision

- Chose environment variables `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` for the app integration.
- Reason: the previous helper script used local shell variables named `CLIENT_ID` and `CLIENT_SECRET`, but app-level configuration needs stable names that avoid hardcoding credentials in scripts or source files.
- Impact: developers must export the `SPOTIFY_*` variables in the shell or process manager used to start the backend.

### 2026-06-03 23:30 - Root Cause

- Problem: Using the YouTube provider produced `Filtered to 0 results` after `spotdl` found candidate audio results.
- Root cause: `spotdl` result filtering can reject all candidates even when the provider search returns results.
- Fix direction: retry failed provider attempts with `--dont-filter-results` when the output contains filtered/no-result markers.

### 2026-06-03 23:35 - Decision

- Used the existing `/Users/tangyiping/Documents/source/spotdl/scripts/run_spotdl.sh` as a strategy reference, not as code to copy directly.
- Relevant proven strategy: try providers in order, refresh or avoid stale Spotify tokens, retry without filtering, and detect provider-specific failures.
- Maintenance note: the script contains hardcoded credentials and token values and should be cleaned before sharing or committing.

### 2026-06-03 23:40 - Solution

- Implemented provider fallback in `spotdl_import.py`: `youtube-music`, `youtube`, then `piped`.
- Implemented retry with `--dont-filter-results` for filtered/no-result failures.
- Implemented credential handling through `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and optional `SPOTIFY_AUTH_TOKEN`.
- Impact: `dynamic-lyrics` handles the common local `spotdl` failure modes without requiring callers to know provider-specific CLI flags.

### 2026-06-03 23:45 - Root Cause

- Problem: `NEWJEANS - Ditto` produced no audio, but the app stopped fallback and only failed later when no output file was found.
- Root cause: `spotdl` can return exit code 0 even when a song download failed internally and no audio file was created.
- Fix direction: treat success as `exit code 0` plus presence of an audio output file, not exit code alone.

### 2026-06-03 23:50 - Solution

- Updated `spotdl_import.py` so zero-exit/no-audio attempts continue fallback instead of being treated as successful imports.
- Verification: backend tests passed, and the user confirmed the smoke test successfully downloaded audio after exporting Spotify credentials.

### 2026-06-03 23:55 - Solution

- Removed hardcoded Spotify client secret and token values from `/Users/tangyiping/Documents/source/spotdl/scripts/run_spotdl.sh`.
- The helper script now requires `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` from the environment, while `SPOTIFY_AUTH_TOKEN` remains optional.
- Verification: `bash -n` passed for the updated helper script.

### 2026-06-04 00:05 - Solution

- Added `.env.example` with placeholder `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` values.
- Updated `.gitignore` to ignore `.env` and `.env.*` while allowing `.env.example` to be tracked.
- Impact: developers can keep credentials in an untracked local dotenv file instead of relying on manual shell exports or hardcoded scripts.

### 2026-06-04 00:15 - Solution

- Added mocked backend tests for `spotdl_import.py` fallback behavior.
- Coverage includes YouTube Music block fallback, retry with `--dont-filter-results`, exit code 0 without audio output, and credential argument construction.
- Verification: backend test suite passed with `34 passed`.

### 2026-06-04 00:20 - Solution

- Added `docs/features/spotdl-integration/LOCAL_SETUP.md` as the repeatable local setup guide.
- The guide covers `uv tool install --editable`, Spotify dotenv setup, manual or `direnv` environment loading, smoke test commands, backend startup, troubleshooting, and credential safety notes.
- Impact: future setup instructions are separated from the implementation plan and session history.

### 2026-06-10 00:00 - Blocked

- Attempted to start the full app flow by running `spotdl_smoke.py` with `.env.local` loaded.
- Result: smoke test failed before download with `HTTP Error 400: Bad Request` from Spotify token exchange.
- Root cause: `.env.local` currently contains placeholder values from `.env.example`; safe env check confirmed both Spotify variables are set but still placeholder strings.
- Next step: replace `.env.local` values with real Spotify Developer credentials, rerun the smoke test, then continue the upload + LRC app flow.

### 2026-06-10 23:25 - Solution

- `.env.local` was updated with non-placeholder Spotify credentials and verified without printing secret values.
- `spotdl_smoke.py "NEWJEANS - Ditto"` succeeded, producing `NewJeans - Ditto.mp3` and `NewJeans - Ditto.lrc` under `data/raw/src_spotdl_8d4decb5_spotdl/`.
- Ran the existing app flow with the generated files: uploaded audio through `/api/sources/upload-audio`, submitted LRC through `/api/alignments/from-lrc`, waited for `lrc_import` completion, and fetched the generated song payload.
- Verification: upload returned `201`, job completed as `done`, generated song id was `song_src_f627b99d_bddd87`, fetched song had title `NewJeans - Ditto` and `41` lyric lines, and backend regression tests passed with `25 passed` in the current working tree.

### 2026-06-10 23:40 - Decision

- Confirmed `spotdl` still uses Spotify credentials for metadata lookup even when the final audio download comes from YouTube.
- Observed `NEWJEANS - Cookie` flow: YouTube Music was blocked, strict YouTube filtering removed all candidates, and `youtube --dont-filter-results` selected `https://youtube.com/watch?v=VOmIplFAGeg` and downloaded successfully.
- Added `SPOTDL_AUDIO_PROVIDERS` and `SPOTDL_PREFER_DONT_FILTER` so local environments can prefer `youtube --dont-filter-results` without changing conservative defaults for everyone.
- Verification: backend tests passed with `27 passed` after adding configurable provider/filter behavior.
