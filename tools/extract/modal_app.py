"""Hosted extraction endpoint for GATE Mentor.

Deploys the deterministic extractor as a pay-per-use HTTPS endpoint so the
Vercel app (which cannot run Python) can use it in production::

    pip install "modal>=1.0"
    modal setup
    modal secret create extraction-secret EXTRACTION_SECRET=$(openssl rand -hex 32)
    modal deploy modal_app.py

Then set EXTRACTION_FUNCTION_URL to the printed web-endpoint URL and
EXTRACTION_FUNCTION_SECRET to the same secret value.
"""

import os
import sys

import modal

app = modal.App("gate-mentor-extract")

_here = os.path.dirname(os.path.abspath(__file__))

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("pymupdf>=1.24", "pillow>=10", "fastapi>=0.115")
    .add_local_file(os.path.join(_here, "extract.py"), "/root/extract.py")
    .add_local_file(os.path.join(_here, "imagekit_uploader.py"), "/root/imagekit_uploader.py")
)

MAX_BODY_BYTES = 20 * 1024 * 1024


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("extraction-secret-v2")],
    timeout=300,
    memory=512,
)
@modal.asgi_app()
def extract():
    from fastapi import FastAPI, Request, Response
    import json

    web_app = FastAPI()

    @web_app.post("/")
    async def handle(request: Request):
        expected = os.environ.get("EXTRACTION_SECRET", "")
        if expected and request.headers.get("authorization") != f"Bearer {expected}":
            return Response(
                content=json.dumps({"ok": False, "error": {"message": "Unauthorized."}}),
                media_type="application/json",
                status_code=401,
            )

        body = await request.body()
        if not body:
            return Response(
                content=json.dumps({"ok": False, "error": {"message": "Empty request body."}}),
                media_type="application/json",
                status_code=400,
            )
        if len(body) > MAX_BODY_BYTES:
            return Response(
                content=json.dumps({"ok": False, "error": {"message": "PDF files must be 20 MB or smaller."}}),
                media_type="application/json",
                status_code=413,
            )

        params = request.query_params
        try:
            year = int(params.get("year", "")) if params.get("year") else None
        except ValueError:
            year = None

        def _int(name: str, default: int) -> int:
            try:
                return int(params.get(name, default))
            except (TypeError, ValueError):
                return default

        sys.path.insert(0, "/root")
        import extract as extractor

        try:
            upload_cdn = os.environ.get("UPLOAD_TO_IMAGEKIT", "false").strip().lower() == "true"
            result = extractor.extract_pdf_bytes(
                body,
                stem=params.get("stem", "upload"),
                year=year,
                subject=params.get("subject", "Uncategorized"),
                topic=params.get("topic", "Needs Review"),
                max_images=_int("max_images", 4),
                min_image=_int("min_image", 80),
                max_dim=_int("max_dim", 1200),
                upload_cdn=upload_cdn,
            )
        except Exception as error:
            return Response(
                content=json.dumps({"ok": False, "error": {"message": f"Extraction failed: {error}"}}),
                media_type="application/json",
                status_code=500,
            )
        return Response(
            content=json.dumps({"ok": True, "questions": result["questions"]}),
            media_type="application/json",
        )

    return web_app
