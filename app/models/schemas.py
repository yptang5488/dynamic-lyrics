from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator


SourceType = Literal["upload", "youtube"]
SourceStatus = Literal["queued", "processing", "ready", "failed"]
JobType = Literal["youtube_import", "alignment", "lrc_import"]
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


class AlignmentRequest(BaseModel):
    source_id: str = Field(alias="sourceId")
    language: str
    lyrics_text: str = Field(alias="lyricsText")
    translations: list[str] | None = None

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def validate_lyrics(self) -> "AlignmentRequest":
        if not self.lyrics_text.strip():
            raise ValueError("lyricsText must not be empty")
        return self


class LrcImportRequest(BaseModel):
    source_id: str = Field(alias="sourceId")
    language: str
    lrc_text: str = Field(alias="lrcText")

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def validate_lrc(self) -> "LrcImportRequest":
        if not self.lrc_text.strip():
            raise ValueError("lrcText must not be empty")
        return self


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
