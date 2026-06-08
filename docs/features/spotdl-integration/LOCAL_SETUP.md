# spotdl Local Setup

This guide configures `dynamic-lyrics` to use a locally cloned `spotdl` repo through an isolated `uv tool` environment.

## Prerequisites

- Local `spotdl` clone exists at `/Users/tangyiping/Documents/source/spotdl`.
- `uv` is installed.
- Spotify developer app credentials are available.
- `ffmpeg` is available on `PATH` for audio conversion.

## Install Local spotdl As A uv Tool

Install the local clone in editable mode:

```bash
uv tool install --editable /Users/tangyiping/Documents/source/spotdl
```

Verify the CLI resolves from the tool environment:

```bash
uv run python -c "import shutil; print(shutil.which('spotdl'))"
uv run spotdl --version
```

Expected version for the current integration:

```text
4.4.3
```

## Configure Spotify Credentials

Create a local dotenv file from the tracked example:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in real values:

```bash
SPOTIFY_CLIENT_ID="your-real-client-id"
SPOTIFY_CLIENT_SECRET="your-real-client-secret"
```

Do not commit `.env.local`. It is ignored by `.gitignore`.

## Load Local Environment Variables

Option 1: source the file manually in each shell before running the backend or smoke tests.

```bash
set -a
source .env.local
set +a
```

Option 2: use `direnv` for automatic per-project loading.

Create `.envrc`:

```bash
dotenv .env.local
```

Allow it once:

```bash
direnv allow
```

## Smoke Test

Run the project smoke test from the `dynamic-lyrics` repo root:

```bash
uv run python spotdl_smoke.py "NEWJEANS - Ditto"
```

Successful output should include:

```text
status=done
audio_exists=True
```

Downloaded files are written under:

```text
data/raw/<source-id>_spotdl/
```

## Backend Usage

Start the backend from a shell where the Spotify environment variables are loaded:

```bash
uv run python main.py
```

`app/services/spotdl_import.py` will find `spotdl` on `PATH`, call it as a subprocess, and handle provider fallback.

## Troubleshooting

- `spotdl: error: unrecognized arguments: --output-format`: the app is calling an old CLI flag; current integration should use `--format`.
- `The access token expired`: confirm `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are loaded in the current shell.
- `You are blocked by YouTube Music`: current integration should fallback to `youtube` and then `piped`.
- `Filtered to 0 results`: current integration should retry with `--dont-filter-results`.
- No audio file after a zero exit code: current integration treats this as a failed attempt and continues fallback.

## Maintenance Notes

- Keep `spotdl` isolated from the main project environment because its dependency constraints conflict with the app's FastAPI/Uvicorn stack.
- Do not hardcode Spotify credentials in scripts or source code.
- If credentials were committed or shared previously, rotate them in the Spotify Developer Dashboard.
