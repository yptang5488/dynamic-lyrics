from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator


SourceType = Literal["upload", "youtube", "spotify"]
SourceStatus = Literal["queued", "processing", "ready", "failed"]
JobType = Literal["youtube_import", "spotify_import", "lrc_import"]
JobStatus = Literal["queued", "processing", "done", "failed"]


class SourceResponse(BaseModel):
    source_id: str = Field(alias="sourceId")
    status: SourceStatus
    type: SourceType

    model_config = {"populate_by_name": True}


class SourceDetailResponse(BaseModel):
    id: str
    type: SourceType
    status: SourceStatus
    title: str | None = None
    artist: str | None = None
    duration: float | None = None
    error_message: str | None = Field(default=None, alias="errorMessage")

    model_config = {"populate_by_name": True}


class YoutubeImportRequest(BaseModel):
    url: HttpUrl


class YoutubeImportResponse(BaseModel):
    source_id: str = Field(alias="sourceId")
    job_id: str = Field(alias="jobId")
    status: JobStatus

    model_config = {"populate_by_name": True}


class SpotifyImportRequest(BaseModel):
    query: str

    @model_validator(mode="after")
    def validate_query(self) -> "SpotifyImportRequest":
        if not self.query.strip():
            raise ValueError("query must not be empty")
        return self


class SpotifyImportResponse(BaseModel):
    source_id: str = Field(alias="sourceId")
    job_id: str = Field(alias="jobId")
    status: JobStatus

    model_config = {"populate_by_name": True}


class LrcImportRequest(BaseModel):
    source_id: str = Field(alias="sourceId")
    lrc_text: str = Field(alias="lrcText")

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def validate_lrc(self) -> "LrcImportRequest":
        if not self.lrc_text.strip():
            raise ValueError("lrcText must not be empty")
        return self


class SyncedLrcSearchRequest(BaseModel):
    query: str
    providers: list[str] | None = None

    @model_validator(mode="after")
    def validate_query(self) -> "SyncedLrcSearchRequest":
        if not self.query.strip():
            raise ValueError("query must not be empty")
        if self.providers is not None:
            self.providers = [provider.strip() for provider in self.providers if provider.strip()]
            if not self.providers:
                self.providers = None
        return self


class SyncedLrcSearchResponse(BaseModel):
    lrc_text: str = Field(alias="lrcText")
    warnings: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class JobCreatedResponse(BaseModel):
    job_id: str = Field(alias="jobId")
    status: JobStatus

    model_config = {"populate_by_name": True}


class JobStatusResponse(BaseModel):
    id: str
    type: JobType
    status: JobStatus
    progress: int
    message: str | None = None
    result: dict[str, Any] | None = None
    error_message: str | None = Field(default=None, alias="errorMessage")

    model_config = {"populate_by_name": True}


class AudioPayload(BaseModel):
    source_id: str = Field(alias="sourceId")
    playback_url: str = Field(alias="playbackUrl")
    duration: float | None = None

    model_config = {"populate_by_name": True}


class LyricLine(BaseModel):
    id: str
    start: float
    end: float
    text: str
    translation: str | None = None
    confidence: float
    segments: list[dict[str, Any]] = Field(default_factory=list)
    notes: list[dict[str, Any]] = Field(default_factory=list)


class SongResponse(BaseModel):
    id: str
    title: str
    artist: str
    audio: AudioPayload
    lyrics: list[LyricLine]
    lyric_offset: float = Field(default=0, alias="lyricOffset")

    model_config = {"populate_by_name": True}


class SongLyricOffsetUpdateRequest(BaseModel):
    lyric_offset: float = Field(alias="lyricOffset")

    model_config = {"populate_by_name": True}


class SongLyricNotesUpdate(BaseModel):
    line_id: str = Field(alias="lineId")
    notes: list[dict[str, Any]] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class SongLyricNotesUpdateRequest(BaseModel):
    lyric_notes: list[SongLyricNotesUpdate] = Field(alias="lyricNotes")

    model_config = {"populate_by_name": True}


class SongCatalogEntry(BaseModel):
    id: str
    title: str
    artist: str
    has_lyrics: bool = Field(alias="hasLyrics")
    has_translation: bool = Field(alias="hasTranslation")
    has_notes: bool = Field(alias="hasNotes")
    player_path: str = Field(alias="playerPath")

    model_config = {"populate_by_name": True}
