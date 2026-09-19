# Import runbook — PDF question paper → Practice

How to add a GATE paper without creating quarantined rows, lost diagrams,
or partial imports. Every rule below exists because violating it once
caused exactly that.

## One-time setup

Redeploy the hosted extractor so it runs the current code:

```powershell
pip install "modal>=1.0"
modal setup
cd tools/extract
modal deploy modal_app.py
```

Until this is done, **never use the "Extract questions" PDF button** in
`/admin`. It calls the stale deployment (drops option diagrams past a
4-figure cap, renders page-text blobs as figures) or, when unreachable,
a lossy AI fallback (~37 of 65 questions). The JSON path below is
deterministic and complete.

## Per paper

All commands run from the repo root. Never commit `gate-cs-*-import.json`
files — delete them after importing.

### 1. Extract locally

```powershell
python tools/extract/extract.py <PAPER>.pdf --year <YYYY> -o gate-cs-<YYYY>-import.json
```

- `--year` sets the year. Leave `--subject/--topic` at defaults:
  `POST /api/admin/imports` auto-classifies unmapped rows with one
  batched model call (`lib/imports/classify.ts`, validated through the
  normal taxonomy matchers, quarantine kept as fallback).
- Figure cap is 8 per question (4 stem + 4 option diagrams max). Vector
  clusters that are large *and* text-heavy are skipped as page renders;
  tiny (<80 px) and template graphics are dropped.

### 2. Audit the JSON before touching the app

- 65 questions, numbers Q1–Q65, unique `externalId`s.
- Figure audit per question: every `[See figure]` option must have
  diagrams behind it. Placeholders with zero figures import with a
  warning and render as empty FIGURE tags — fix or re-extract first.
- Contract shape the importer enforces: `mcq|msq` need ≥2 options with
  dense A–D ids, `nat` needs `options: null`, figures must be
  `image/png|jpeg` within per-image and per-question caps.

### 3. Import through the JSON button

`/admin` → *Or import a fixed JSON file* → select the file →
**Import JSON**. Imports dedupe by `externalId` and prompt text, so
re-importing an existing paper silently skips — import into an empty
bank, or expect skips for rows already present.

### 4. Read the result notice as a checklist

- `Published 65`, `auto-classified` covering every unmapped row,
  needs-attention at zero, skipped at zero.
- `negativeMarks` sent as `-0.33` is stored as magnitude `0.33`
  (`normalizePenalty`); anything still skipped is listed by id with a
  reason. Fix named rows the same day — warnings rot into
  student-facing bugs.
- `[See figure]` options with no usable diagrams warn per question.

### 5. Spot-verify in Practice

- `/practice?year=<YYYY>`: real subject/topic headers — never
  `UNCATEGORIZED /// NEEDS REVIEW`. Strays are reassigned from the
  question bank (`PATCH /api/admin/questions/[questionId]`).
- Open 2–3 diagram questions: figures render below the stem with the
  match-to-A–D notice; no `DIAGRAMS MISSING` unless the import warned.

## Troubleshooting

- **Placeholders with no figures**: extraction dropped them (thresholds,
  owner assignment) or the AI fallback path emitted them imageless.
  Re-extract with adjusted `--max-images`/`--min-image`, or attach
  figures before re-importing.
- **Full-page renders stored as figures**: text-heavy vector clusters;
  fixed by the overlap skip — if one slips through, delete the row's
  images from the question bank and re-extract.
- **Options merged with the next question / stem split across its
  marker**: marginal-label layouts; the extractor reclaims same-row
  orphans and first-option grid text. Residual single-question tangles
  are repaired in the JSON with byte-exact checks before import, never
  silently.
