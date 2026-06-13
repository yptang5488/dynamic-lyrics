# Private Song Library Workflow

Status: Current MVP workflow
Last Updated: 2026-06-13

## Purpose

The private song library is the friend-facing entry point for prepared songs. Friends should not need Spotify, YouTube, `spotdl`, local download tools, or upload access to use the player.

Maintainers prepare songs first, then friends choose from the library and open the existing synchronized lyrics player.

## Routes

- `/`: private library for prepared songs.
- `/import`: maintainer import flow for adding songs.
- `/jobs/:jobId`: import / alignment job progress.
- `/player/:songId`: synchronized lyrics player.

## Friend Flow

1. Open `/`.
2. Choose a prepared song card.
3. Select `Open player`.
4. Study in `/player/:songId` with synchronized lyric lines and optional translations.

## Maintainer Add Flow

1. Open `/import` from the `Maintainer import` button on the library page.
2. Choose an import source.
3. Prefer uploading or generating paired bilingual `.lrc` timing when available.
4. Submit the import / alignment job.
5. Wait for the job to complete.
6. Return to `/` and confirm the song appears in the library.

## Maintainer Cleanup Flow

1. Open `/`.
2. Find a duplicate or test song.
3. Select `Remove`.
4. Confirm the removal prompt.

Removal is conservative in the current MVP. It deletes only the song JSON record, so the song disappears from the library and `GET /api/songs/{songId}` returns 404. It does not delete the related source JSON record or local media files.

## Catalog Source

The library is not built by scanning local folders.

Catalog entries come from file-based JSON storage:

- `data/songs/{songId}.json`: stores the song id, title, artist, language, and full player payload in `lyrics_json`.
- `data/sources/{sourceId}.json`: stores the import source and readiness state.

`GET /api/songs` lists songs where the related source is `ready`. Invalid song payloads are skipped so one bad test record does not break the whole library.

Local media files are still served from backend storage, usually under `data/raw/...`, through `/media` URLs referenced by the song payload.

## Current API

- `GET /api/songs`: list lightweight library entries.
- `GET /api/songs/{songId}`: load the full player payload.
- `DELETE /api/songs/{songId}`: remove a song from the library only.

## Current Limitations

- No authentication or password protection is implemented yet.
- No automatic folder scan or manifest seed flow exists yet.
- Removing a library entry does not reclaim disk space.
- Shared cheering / study notes are still payload placeholders until the player renders them.
- Cover art, tags, duration, and audio variants are deferred.
