from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any


TABLES = ("sources", "jobs", "songs")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migrate legacy SQLite records into JSON file storage."
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=Path("app.db"),
        help="Path to the legacy SQLite database. Defaults to ./app.db.",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("data"),
        help="Destination data directory. Defaults to ./data.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing JSON records with the same ids.",
    )
    args = parser.parse_args()

    if not args.db.exists():
        raise SystemExit(f"SQLite database not found: {args.db}")

    migrated: dict[str, int] = {}
    skipped: dict[str, int] = {}

    connection = sqlite3.connect(args.db)
    connection.row_factory = sqlite3.Row
    try:
        for table in TABLES:
            if not _table_exists(connection, table):
                migrated[table] = 0
                skipped[table] = 0
                continue

            table_dir = args.data_dir / table
            table_dir.mkdir(parents=True, exist_ok=True)

            migrated_count = 0
            skipped_count = 0
            rows = connection.execute(f"SELECT * FROM {table}").fetchall()
            for row in rows:
                payload = dict(row)
                record_id = payload["id"]
                destination = table_dir / f"{record_id}.json"
                if destination.exists() and not args.overwrite:
                    skipped_count += 1
                    continue

                _write_json(destination, payload)
                migrated_count += 1

            migrated[table] = migrated_count
            skipped[table] = skipped_count
    finally:
        connection.close()

    for table in TABLES:
        print(
            f"{table}: migrated {migrated.get(table, 0)}, "
            f"skipped {skipped.get(table, 0)}"
        )


def _table_exists(connection: sqlite3.Connection, table: str) -> bool:
    row = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    return row is not None


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    temp_path = path.with_suffix(f"{path.suffix}.tmp")
    temp_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    temp_path.replace(path)


if __name__ == "__main__":
    main()
