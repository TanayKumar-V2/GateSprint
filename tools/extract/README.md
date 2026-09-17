# GATE paper extractor (Python, no LLM)

Fast deterministic first pass over a GATE question-paper PDF. It segments
questions, options, marks, and figures with PyMuPDF layout parsing in seconds —
no model calls. Output matches the `POST /api/admin/imports` JSON contract, so
you can import it directly from **/admin/import → Or import a fixed JSON file**.

The Next.js app still owns the slow judgment calls (subject/topic mapping,
answers) via its tolerant normalizers, placeholder drafts, and quarantine
bucket. This tool only does what layout parsing can do reliably.

## Setup

```powershell
cd tools/extract
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

## Usage

```powershell
# Print extraction JSON to stdout
python extract.py ..\..\GATE-CS-2024.pdf --year 2024

# Write to a file, then upload it in /admin/import
python extract.py ..\..\GATE-CS-2024.pdf --year 2024 -o gate-cs-2024.json
```

Useful flags: `--subject/--topic` (defaults park rows in
Uncategorized / Needs Review), `--source-label`, `--max-images` (default 4),
`--min-image` (default 80 px), `--max-dim` (default 1200 px), `--upload-cdn`.

## ImageKit CDN (optional)

By default figures travel as base64 inside the JSON and the app stores them
in its database. With CDN upload enabled, figures are uploaded during
extraction and the JSON carries `url` instead of `data`:

```powershell
$env:UPLOAD_TO_IMAGEKIT="true"
$env:IMAGEKIT_PRIVATE_KEY="..."
$env:IMAGEKIT_PUBLIC_KEY="..."
$env:IMAGEKIT_URL_ENDPOINT="https://ik.imagekit.io/your_id"
pip install -e ".[cdn]"
python extract.py PAPER.pdf --year 2024 --upload-cdn -o questions.json
```

Any failure (missing credentials, SDK, network) silently keeps base64 bytes,
so uploads never break extraction. The same variables belong in the Modal
`extraction-secret` for hosted runs.

## Output contract

`{ "questions": [ { externalId, year, questionNumber, subject, topic, type,
difficulty, prompt, options, correctAnswer, marks, negativeMarks, solution,
sourceLabel, sourcePage, confidence, images } ] }`

- `type` is `mcq` when A–D options are found, `msq` inside a detected
  "multiple select" section, else `nat`. MCQ vs MSQ cannot be told apart from
  bare options — a reviewer confirms this before publishing.
- `correctAnswer` is always `null` (a question paper carries no key). The
  importer stores no key; AI grades the first student attempt at solve time
  and caches the answer for later attempts.
- `confidence` is `0.4`: layout parsing is reliable, answers are absent.
- `prompt` carries `[Figure 1]` markers; `images` holds base64 PNG/JPEG bytes
  in marker order. Tiny (<80 px) and full-page background images are dropped.
- Running heads/footers repeated across pages are stripped automatically.

## Tests

```powershell
pytest
```

The suite builds synthetic PDFs in memory (options, marks, NAT/MSQ sections,
embedded figures, oversized-figure downscaling) and asserts the full contract.

## Phase B — hosted endpoint for production

The Vercel app cannot run Python, so `modal_app.py` wraps the extractor as a
pay-per-use HTTPS endpoint. The Next.js pdf-import route tries it first and
falls back to its built-in AI path on any failure — a bad deploy can never
break imports, and with `EXTRACTION_FUNCTION_URL` unset the app behaves
exactly as before.

```powershell
pip install "modal>=1.0"
modal setup
modal secret create extraction-secret EXTRACTION_SECRET=$(openssl rand -hex 32)
modal deploy modal_app.py
```

Then set `EXTRACTION_FUNCTION_URL` (printed URL) and
`EXTRACTION_FUNCTION_SECRET` (same value) in Vercel. The panel notice tells
you which engine ran each upload, including fallback reasons.
