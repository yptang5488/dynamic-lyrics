# Dynamic Lyrics App Plan

## Product Goal

Build a web app for foreign music learning and idol/music guided learning.

The app should let a user:

- play music while lyrics are highlighted dynamically
- show original lyrics and optional translation
- toggle translation visibility with a mode button
- click a lyric line to jump playback to that timestamp
- support learning-focused notes, including timed word or phrase cues
- support cheering / guided singing cues such as singing only selected words or the back half of a sentence

## Core Product Scope

### Playback and Sync

- audio player with play, pause, seek, and current time tracking
- active lyric line highlighting based on audio playback time
- auto-scroll to the current lyric line
- click lyric line to replay from that line start time

### Learning UX

- original lyric display
- translation display with show / hide mode toggle
- focus mode for original-only learning
- timed notes attached to a full line or only part of a line
- word-focused notes for vocabulary, cheering, follow-singing, or phrase practice

### Data Model Direction

Use JSON as the main format instead of plain LRC so the project can support:

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

### Auto Timing Strategy

- `audio only`: not reliable for full lyric alignment
- `audio + lyrics`: recommended and supported direction
- backend should first support line-level timing output
- future versions can add segment / word alignment and manual correction tools

## Backend Plan

### Current Project Structure

```txt
dynamic-lyrics/
  app/
    api/
      routes_alignments.py
      routes_health.py
      routes_jobs.py
      routes_songs.py
      routes_sources.py
    db/
      session.py
      tables.py
    models/
      schemas.py
    services/
      aligner_base.py
      aligner_mock.py
      audio_normalize.py
      lyrics_parser.py
      song_builder.py
      source_service.py
      youtube_import.py
    workers/
      job_runner.py
    config.py
    main.py
  data/
    raw/
    normalized/
    export/
  PLAN.md
  PROCESSING.md
  README.md
  main.py
  pyproject.toml
  uv.lock
```

This structure reflects the current backend-first implementation phase and leaves room for a future frontend app to be added alongside the API.

### Stack

- FastAPI
- SQLite
- local file storage
- local background jobs

### Main Responsibilities

- import audio from upload or YouTube URL
- normalize audio into a backend-friendly format
- accept raw lyrics and optional translations
- run lyric alignment jobs
- export frontend-ready timed song JSON

### Planned API Shape

- `POST /api/sources/upload-audio`
- `POST /api/sources/import-youtube`
- `GET /api/sources/{sourceId}`
- `POST /api/alignments`
- `GET /api/jobs/{jobId}`
- `GET /api/songs/{songId}`

### Job Flow

1. create source from upload or YouTube URL
2. normalize audio
3. submit alignment job with lyrics and language
4. produce timed JSON
5. later support manual correction and note editing

## Frontend Plan

Frontend work starts after backend timing flow is stable.

### Initial UI Scope

- import page for audio / YouTube URL and lyrics input
- job status page for import and alignment progress
- player page using timed JSON from backend

### Player Behaviors

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

### Phase 1

- backend skeleton
- local jobs
- source import pipeline
- mock line-level aligner
- timed JSON contract

### Phase 2

- real alignment engine
- frontend player and import UI

### Phase 3

- segment / word timing
- timed notes editor
- cheering-focused learning tools
