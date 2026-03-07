## Dynamic Lyrics Backend Prototype

This project now contains a FastAPI backend prototype for a lyrics-learning web app.

Implemented in this phase:

- audio upload source flow
- YouTube import job entrypoint
- local SQLite metadata store
- local background job runner
- mock line-level lyric alignment
- song JSON export for the future player UI

Run locally:

```bash
uv run python main.py
```

Optional local tools:

- `ffmpeg` / `ffprobe` for audio normalization and duration detection
- `yt-dlp` for YouTube URL imports

YouTube import notes:

- watch URLs are normalized to a plain `https://www.youtube.com/watch?v=...` form
- playlist and radio parameters are ignored during import

Main endpoints:

- `POST /api/sources/upload-audio`
- `POST /api/sources/import-youtube`
- `POST /api/alignments`
- `GET /api/jobs/{jobId}`
- `GET /api/songs/{songId}`
