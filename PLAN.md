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

Not implemented yet:

- real audio-to-lyrics alignment
- segment or word timing
- manual timing correction tools
- timed learning notes editor
- guided singing / cheering authoring tools
- durable worker infrastructure
- automated test coverage

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

### Timing Strategy

- `audio only`: not reliable for full lyric alignment
- `audio + lyrics`: recommended and supported direction
- current prototype supports line-level timing only
- future versions can add segment / word alignment and manual correction tools

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
3. Submit an alignment job with lyrics and language.
4. Generate timed JSON for the player.
5. Open the player and study with synchronized lines.

## Current API Shape

- `GET /api/health`
- `POST /api/sources/upload-audio`
- `POST /api/sources/import-youtube`
- `GET /api/sources/{sourceId}`
- `POST /api/alignments`
- `GET /api/jobs/{jobId}`
- `GET /api/songs/{songId}`

## Frontend Scope

### Implemented UI

- import page for source selection and lyric input
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

- replace mock aligner with a real alignment engine
- improve job progress reporting and failure visibility
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
- automated backend and frontend tests
- cleaner deployment and environment setup
