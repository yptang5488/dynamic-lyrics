from __future__ import annotations

import argparse

import syncedlyrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch synced LRC lyrics for a query.")
    parser.add_argument("query", help="Search query, for example: 'NewJeans Ditto'")
    parser.add_argument(
        "--lang",
        default=None,
        help="Optional translation language code, for example: zh, en, ja",
    )
    parser.add_argument(
        "--provider",
        action="append",
        dest="providers",
        help="Provider to use. Can be passed multiple times, for example: --provider Lrclib",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional path to save the fetched LRC text.",
    )
    args = parser.parse_args()

    search_options: dict[str, object] = {"synced_only": True}
    if args.lang:
        search_options["lang"] = args.lang
    if args.providers:
        search_options["providers"] = args.providers

    lrc = syncedlyrics.search(args.query, **search_options)
    if not lrc:
        raise SystemExit("No synced LRC found.")

    if args.output:
        with open(args.output, "w", encoding="utf-8") as file:
            file.write(lrc)
            if not lrc.endswith("\n"):
                file.write("\n")

    lines = lrc.splitlines()
    print(f"Fetched {len(lines)} LRC lines.")
    print("\n".join(lines[:20]))


if __name__ == "__main__":
    main()
