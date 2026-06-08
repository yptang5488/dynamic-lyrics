from __future__ import annotations

import argparse
from pathlib import Path
from uuid import uuid4

from app.services.spotdl_import import import_spotify_audio


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run a local smoke test for spotdl import output."
    )
    parser.add_argument(
        "query",
        help="Spotify URL or search query such as 'artist - title'",
    )
    parser.add_argument(
        "--source-id",
        default=f"src_spotdl_{uuid4().hex[:8]}",
        help="Optional source id used for the output folder name",
    )
    args = parser.parse_args()

    print(f"starting spotdl smoke test for query={args.query!r}")
    print(f"source_id={args.source_id}")

    try:
        result = import_spotify_audio(
            source_id=args.source_id,
            query=args.query,
            show_output=True,
        )
    except Exception as exc:  # noqa: BLE001
        output_dir = Path("data/raw") / f"{args.source_id}_spotdl"
        print(f"status=failed")
        print(f"error={exc}")
        print(f"output_dir={output_dir.resolve()}")
        if output_dir.exists():
            print("output_files=")
            for path in sorted(output_dir.iterdir()):
                print(f"- {path.name}")
        raise

    print("status=done")
    print(f"output_dir={result.output_dir}")
    print(f"audio_path={result.audio_path}")
    print(f"audio_exists={result.audio_path.exists()}")
    print(f"lyrics_path={result.lyrics_path}")
    print(f"lyrics_exists={result.lyrics_path.exists() if result.lyrics_path else False}")
    print("output_files=")
    for path in sorted(result.output_dir.iterdir()):
        print(f"- {path.name}")


if __name__ == "__main__":
    main()
