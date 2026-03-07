from __future__ import annotations

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.routes_alignments import router as alignments_router
from app.api.routes_health import router as health_router
from app.api.routes_jobs import router as jobs_router
from app.api.routes_songs import router as songs_router
from app.api.routes_sources import router as sources_router
from app.config import settings
from app.db.session import init_db


def create_app() -> FastAPI:
    settings.ensure_storage()
    init_db()

    app = FastAPI(title=settings.app_name)
    app.mount(
        settings.media_prefix,
        StaticFiles(directory=settings.raw_dir.parent),
        name="media",
    )
    app.include_router(health_router, prefix=settings.api_prefix)
    app.include_router(sources_router, prefix=settings.api_prefix)
    app.include_router(alignments_router, prefix=settings.api_prefix)
    app.include_router(jobs_router, prefix=settings.api_prefix)
    app.include_router(songs_router, prefix=settings.api_prefix)
    return app


app = create_app()
