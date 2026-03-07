SOURCE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    source_url TEXT,
    original_path TEXT,
    normalized_path TEXT,
    title TEXT,
    artist TEXT,
    duration REAL,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""

JOB_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    source_id TEXT,
    status TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    payload_json TEXT NOT NULL,
    result_json TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(source_id) REFERENCES sources(id)
);
"""

SONG_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    language TEXT NOT NULL,
    lyrics_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(source_id) REFERENCES sources(id)
);
"""
