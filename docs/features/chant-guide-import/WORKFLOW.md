# Chant Guide Import Workflow

## Purpose

Use a separate chant guide file to add fanchant notes to an existing timed song without editing LRC timing or lyric text.

## Files

- Raw marked source: `data/chant-sources/{songId}.md`
- Source guide: `data/chant-guides/{songId}.json`
- Song payload: `data/songs/{songId}.json`
- Automatic backups: `data/backups/songs/`

## Prepare From Marked Lyrics

If the source is a markdown/text file using this notation:

- `**phrase**` for lyric text the audience sings with;
- `(callout)` for a chant after the lyric;
- `~~lyric~~(chant)` for a replacement/synchronized chant;

generate a guide with:

```bash
uv run python scripts/prepare_chant_source.py data/chant-sources/{songId}.md --song-id {songId} --dry-run --report /tmp/chant-report.json
```

Use `--apply` instead of `--dry-run` only when you want to generate the guide and apply safe notes in one command.

## Guide Shape

```json
{
  "schemaVersion": "chant-guide.v1",
  "songId": "song_src_example_123456",
  "song": {
    "title": "Example Song",
    "artist": "Example Artist"
  },
  "guideLines": [
    {
      "lineId": "l1",
      "lineMatchText": "lyric text",
      "notes": [
        {
          "type": "chant",
          "mode": "inline",
          "label": "sing-along",
          "text": "lyric",
          "placement": "inline",
          "anchor": {
            "matchText": "lyric",
            "occurrence": 1,
            "charStart": 0,
            "charEnd": 5
          }
        }
      ]
    }
  ],
  "needsReview": []
}
```

`lineId` is preferred. `lineMatchText`-only entries are allowed, but they apply only when exactly one lyric line matches.

## Dry Run

```bash
uv run python scripts/import_chant_guide.py data/chant-guides/{songId}.json --report /tmp/chant-report.json
```

Review `appliedChanges` and `needsReview` in the report. Dry run does not edit the song payload.

## Apply

```bash
uv run python scripts/import_chant_guide.py data/chant-guides/{songId}.json --apply --report /tmp/chant-report.json
```

Apply mode:

- backs up the original song JSON before writing;
- replaces existing `type: "chant"` notes on matched lines;
- preserves non-chant notes;
- normalizes chant romanization;
- skips unsafe entries and writes them to `guide.needsReview`.

Backups are not deleted automatically.
