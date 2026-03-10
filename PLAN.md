# Dynamic Lyrics App Plan

## Product Goal

Build a web app for foreign music learning and guided singing practice.

The app should let a user:

- play music while lyrics are highlighted dynamically
- show original lyrics and optional translation
- toggle translation visibility for focus mode
- click a lyric line to jump playback to that timestamp
- attach learning notes to a whole line or a smaller phrase
- support guided singing or cheering cues for selected words or segments

## Current Project Status

The repository already includes a working local prototype.

Implemented today:

- FastAPI backend with SQLite metadata storage
- React + Vite frontend with import, job, and player pages
- audio upload flow
- YouTube import job flow
- in-process background job runner
- mock line-level lyric alignment
- player-ready song JSON export
- synchronized lyric playback with translation toggle, auto-scroll, and click-to-seek

Next planned primary workflow:

- `mp3 + lrc` import as the main timing source
- paired bilingual LRC parsing where the original line carries the sentence start time and the following translation line carries the sentence end time

Implemented in backend now:

- paired bilingual LRC parsing and block building
- `POST /api/alignments/from-lrc`
- `lrc_import` job execution and song JSON export

Implemented in frontend now:

- upload flow support for audio plus paired bilingual `.lrc`
- fallback to pasted-lyrics alignment when no `.lrc` file is provided
- `lrc_import` job monitoring and player redirection
- `lrc_import` warning display on the job page

Not implemented yet:

- real audio-to-lyrics alignment
- WhisperX-assisted LRC offset correction
- segment or word timing
- manual timing correction tools
- timed learning notes editor
- guided singing / cheering authoring tools
- durable worker infrastructure
- frontend automated test coverage

Testing already completed:

- backend pytest coverage for lyrics parsing
- backend workflow coverage for upload -> alignment -> song JSON
- backend workflow coverage for upload -> `from-lrc` -> song JSON
- backend API edge coverage for source, job, and song endpoints
- backend failure coverage for translation mismatch and YouTube import failures
- backend parser coverage for paired bilingual LRC rules

## Core Product Scope

### Playback and Sync

- audio player with play, pause, seek, and current time tracking
- active lyric line highlighting based on audio playback time
- auto-scroll to the current lyric line
- click lyric line to replay from that line start time

### Learning UX

- original lyric display
- translation display with show / hide toggle
- focus mode for original-only learning
- timed notes attached to a full line or part of a line
- word-focused notes for vocabulary, cheering, follow-singing, or phrase practice

### Data Model Direction

Use JSON as the main timed lyric format so the project can support:

- line-level timing
- future segment / word timing
- translation per line
- timed notes and cheering cues

Recommended song shape:

```json
{
  "id": "song_001",
  "title": "Song Name",
  "artist": "Artist Name",
  "audio": {
    "sourceId": "src_001",
    "playbackUrl": "/media/raw/song.mp3",
    "duration": 213.4
  },
  "lyrics": [
    {
      "id": "l1",
      "start": 12.4,
      "end": 16.8,
      "text": "original lyric line",
      "translation": "translated line",
      "confidence": 0.91,
      "segments": [],
      "notes": []
    }
  ]
}
```

## Input Strategy

### Supported Inputs

- manual audio upload
- YouTube URL import for personal-use workflow
- pasted raw lyrics text
- optional pasted translations
- planned primary path: uploaded audio plus paired bilingual `.lrc`

### Timing Strategy

- `audio only`: not reliable for full lyric alignment
- `audio + lyrics`: recommended and supported direction
- `audio + paired bilingual lrc`: planned primary direction for reliable timing import
- planned refinement layer: WhisperX-assisted correction of LRC timing drift
- current prototype supports line-level timing only
- future versions can add segment / word alignment and manual correction tools

### Paired Bilingual LRC Rule

The first importer target is the format shown in `BANG BANG-MusicEnc.lrc:1`.

Interpret each lyric unit as:

- `{sentence start}` original lyric
- `{sentence end}` translated lyric

So the importer should build line payloads with:

- `start = original timestamp`
- `end = following translation timestamp`
- `text = original lyric`
- `translation = following translated lyric`

Credits and empty spacer rows should be ignored when producing player lyrics.

### Planned WhisperX Correction Layer

WhisperX is planned as a correction layer for paired bilingual LRC imports, not as the primary lyric source.

First planned version:

- keep LRC text and coarse timing as the base data
- run WhisperX on normalized audio to extract transcript anchors
- match LRC original lines against WhisperX transcript segments
- estimate a global offset from reliable anchor matches
- shift the imported lyric blocks by that offset when confidence is high enough
- emit warnings instead of forcing correction when anchors are too sparse or unsafe

Implementation checklist:

1. define correction metadata for `applied`, `offsetSeconds`, `anchorCount`, `method`, and warnings
2. add a WhisperX adapter for transcript anchor extraction
3. normalize LRC original lines and transcript segments for matching
4. implement monotonic fuzzy matching to collect anchors
5. estimate a robust global offset from anchor deltas
6. shift imported lyric blocks when the estimated offset is safe
7. attach correction metadata to `lrc_import` job results
8. add tests for stable offset, low-anchor skip, and unsafe-offset skip cases

Later planned versions:

- piecewise drift correction for songs that move over time
- finer local timing refinement within each line block
- beat-aware chunking after offset correction is stable

## Current Architecture

### Backend

- FastAPI API app
- SQLite for metadata and exported song payloads
- local file storage under `data/`
- in-process threaded jobs for YouTube import and alignment

### Frontend

- React + TypeScript + Vite
- React Router for page flow
- TanStack Query for API polling and state fetching
- session storage for temporary workflow persistence

### Current Project Structure

```txt
dynamic-lyrics/
  app/
    api/
    db/
    models/
    services/
    workers/
    config.py
    main.py
  data/
    raw/
    normalized/
    export/
  frontend/
    src/
  PLAN.md
  PROCESSING.md
  README.md
  main.py
  pyproject.toml
  uv.lock
```

## Current Flow

1. Create a source from upload or YouTube URL.
2. Normalize or prepare audio.
3. Preferred path: submit a paired bilingual LRC file to the `from-lrc` import flow.
4. Fallback path: submit an alignment job with pasted lyrics and language.
5. Generate timed JSON for the player.
6. Open the player and study with synchronized lines.

## Current API Shape

- `GET /api/health`
- `POST /api/sources/upload-audio`
- `POST /api/sources/import-youtube`
- `GET /api/sources/{sourceId}`
- `POST /api/alignments`
- `POST /api/alignments/from-lrc`
- `GET /api/jobs/{jobId}`
- `GET /api/songs/{songId}`

## Frontend Scope

### Implemented UI

- import page for source selection and lyric input
- import page support for audio plus `.lrc` upload as the primary timing path
- job status page for import and alignment progress
- player page using timed JSON from backend

### Implemented Player Behaviors

- synchronized lyric highlighting
- translation show / hide toggle
- click-to-seek on lyric lines
- active line auto-scroll

### Future UX Expansion

- word note mode
- cheering guide mode
- replay current line / cue
- A-B repeat
- manual timing editor

## Delivery Phases

### Phase 1 - Prototype Foundation

Status: mostly complete

- backend skeleton
- local jobs
- source import pipeline
- mock line-level aligner
- timed JSON contract
- initial frontend import, job monitor, and player

### Phase 2 - Real Alignment

Status: next major milestone

- refine `.lrc` upload UX and warning handling in the frontend
- keep raw-lyrics alignment as a fallback path
- improve job progress reporting, warnings, and failure visibility
- add WhisperX-assisted global offset correction for LRC imports
- add validation and workflow hardening across backend and frontend

### Phase 3 - Learning Tools

Status: planned

- segment / word timing
- manual correction tools
- timed notes editor
- guided singing / cheering features

### Phase 4 - Production Readiness

Status: planned

- durable worker infrastructure
- frontend automated tests and broader integration coverage
- cleaner deployment and environment setup
