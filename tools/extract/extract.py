"""Fast deterministic GATE paper PDF extraction (PyMuPDF, no LLM).

Segments questions, A-D options, marks, and figures from a searchable
question-paper PDF and prints JSON matching the GATE Mentor
``POST /api/admin/imports`` contract::

    python extract.py PAPER.pdf --year 2024 -o questions.json

What it deliberately does NOT do: subject/topic classification and answers.
A question paper carries no answer key, so ``correctAnswer`` is always null
(the importer stores no key; AI grades the first attempt at solve time)
and subject/topic default to the quarantine bucket unless passed explicitly.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import re
import sys
from dataclasses import dataclass, field

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF is required: pip install -e '.[dev]' (see tools/extract/README.md)")

QUESTION_RE = re.compile(r"^(?:Q\.?\s*|Question\s+)(\d{1,3})(?:\s*[.\)\:\-]|[\s]+|$)", re.IGNORECASE)
OPTION_RE = re.compile(r"^[\(\[]?([A-D])[\)\.\:\]]\s*(.*)$")
NUMBER_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}


def _marks_value(token: str) -> float | None:
    """Marks tag value: digits or English number words ("TWO marks")."""
    token = token.strip().lower()
    if token in NUMBER_WORDS:
        return float(NUMBER_WORDS[token])
    try:
        return float(token)
    except ValueError:
        return None
MARKS_RE = re.compile(r"\(?\b(\d+(?:\.\d+)?|one|two|three|four|five)\s*marks?\b\)?", re.IGNORECASE)
# "Q.1 to Q.5 carry one mark each" style section preambles (digits or words).
RANGE_MARKS_RE = re.compile(
    r"Q\.?\s*(\d+)\s*(?:to|[\u2013\u2014-])\s*Q\.?\s*(\d+)[^.]*?"
    r"(\d+(?:\.\d+)?|one|two|three|four|five)\s*marks?",
    re.IGNORECASE,
)
MSQ_HINT_RE = re.compile(r"multiple\s+select|\bMSQ\b|more than one.*correct", re.IGNORECASE)
NAT_HINT_RE = re.compile(r"numerical\s+answer|\bNAT\b|enter.*number|numeric.*blank", re.IGNORECASE)
YEAR_RE = re.compile(r"\b(19\d{2}|20\d{2})\b")
PAGE_NUM_RE = re.compile(r"^\d{1,3}$")

# Bare "12." / "12)" question numbers (Q-prefix lost in extraction). Only
# trusted with the false-positive guards in _question_start.
BARE_Q_RE = re.compile(r"^\s*(\d{1,3})\s*[.\)](?:\s+(.*))?$")

# Lines that end the paper: answer keys, rough-work pages, closings.
# (Prevents answer-key tables from becoming phantom questions.)
END_OF_PAPER_RE = re.compile(
    r"^\s*(?:END\s+OF\s+(?:THE\s+)?(?:QUESTION\s+PAPER|EXAMINATION|PAPER)"
    r"|SPACE\s+FOR\s+ROUGH\s+WORK|ANSWER\s*KEY|ANSWERS?)\s*$",
    re.IGNORECASE,
)

# Section headers that legitimately restart numbering at 1
# (e.g. General Aptitude Q1-10, then technical Q1-55).
SECTION_RESET_RE = re.compile(
    r"^\s*(?:general\s+aptitude|technical\s+section|part\s+[A-B]|section\s+[A-B])\b",
    re.IGNORECASE,
)

# Printer footers that leak past boilerplate detection (position varies).
# A bare "CS" is the running-foot remnant of the "GATE <year> Computer
# Science ..." footer row — never question content on its own line.
FOOTER_RE = re.compile(
    r"^\s*(?:Page\s+\d+\s+of\s+\d+|Organi[sz]ing\s+Institute\s*:.*|CS)\s*$",
    re.IGNORECASE,
)

# First words that mark a bare-number line as prose, not a question
# (fraction fragments like "12. Therefore ..." or "3. and ...").
FALSE_POSITIVE_STARTERS = re.compile(
    r"(?:therefore|hence|thus|so|then|since|because|where|here|now|also|"
    r"and|or|but|each|every|figure|table|page|marks?)\b",
    re.IGNORECASE,
)

# Prompt-tail lines that must never be reclaimed as option text (they are
# stem prose, not a shifted first option).
_STEM_TAIL_RE = re.compile(
    r"(\?|:|following|below|above|table|figure|options?|correct|true|marks?)\s*$",
    re.IGNORECASE,
)
# Table rows: header with ranges ("0 - 2  2 - 4") or data rows with numbers.
_TABLE_HEADER_RE = re.compile(
    r"^([A-Za-z(`][A-Za-z\s()`,%.]*?)\s+((?:\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\s*){2,})"
)
_TABLE_DATA_RE = re.compile(
    r"^([A-Za-z(`][A-Za-z\s()`,%.]*?)\s+((?:(?:\d+(?:\.\d+)?|\b[A-Za-z]\b)\s*){2,})$"
)
_TABLE_VERTICAL_RE = re.compile(r"^\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s*$")
_TABLE_CONTINUATION_RE = re.compile(
    r"^(?:per\s+\w+|allowance|expenditure|households|students|days|cities|"
    r"workers|houses|children|women|boxes|marks|probability)\b",
    re.IGNORECASE,
)


@dataclass
class Figure:
    filename: str
    mime: str
    width: int
    height: int
    data_base64: str
    center_y: float
    center_x: float = 0.0
    # Placement bookkeeping (never serialized): source page + display bbox
    # for raster/vector dedupe.
    page: int = 0
    bbox: tuple[float, float, float, float] | None = None
    # CDN url when upload is enabled (replaces data_base64 in output).
    url: str | None = None


@dataclass
class Segment:
    index: int
    number: int | None
    page: int
    start_y: float
    section: str = "mcq"
    col: int = 0
    lines: list[str] = field(default_factory=list)
    figures: list[Figure] = field(default_factory=list)


def _word_rows(words: list) -> list[list]:
    rows: dict[tuple[int, int], list] = {}
    for word in words:
        rows.setdefault((word[5], word[6]), []).append(word)
    return sorted(
        [sorted(row, key=lambda w: w[0]) for row in rows.values()],
        key=lambda row: (min(w[1] for w in row), row[0][0]),
    )


def _question_gutter(page: "fitz.Page", rows: list[list]) -> float | None:
    mid = page.rect.width / 2
    marker_columns: set[int] = set()
    for row in rows:
        for index, word in enumerate(row):
            if index and not (row[index - 1][2] < mid <= word[0] and word[0] - row[index - 1][2] > 40):
                continue
            text = " ".join(w[4] for w in row[index:])
            if not RANGE_MARKS_RE.search(text) and _question_start(text, None, False) is not None:
                marker_columns.add(int(word[0] >= mid))
    return mid if marker_columns == {0, 1} else None


def _words_in_rect(words: list, bbox: tuple) -> list:
    x0, y0, x1, y1 = bbox
    return [
        w for w in words
        if x0 <= (w[0] + w[2]) / 2 < x1 and y0 <= (w[1] + w[3]) / 2 < y1
    ]


def _table_regions(page: "fitz.Page", words: list) -> list[tuple[tuple, str]]:
    regions: list[tuple[tuple, str]] = []
    for table in page.find_tables().tables:
        if table.row_count < 2 or table.col_count < 2:
            continue
        table_words = _words_in_rect(words, table.bbox)
        texts = [" ".join(w[4] for w in row) for row in _word_rows(table_words)]
        if any(QUESTION_RE.match(text) or re.match(r"^[\[(][A-D][)\]](?:\s|$)", text) for text in texts):
            continue
        rendered: list[str] = []
        for row in table.rows:
            cells: list[str] = []
            for bbox in row.cells:
                if bbox is None:
                    cells.append("")
                    continue
                cell_rows = _word_rows(_words_in_rect(table_words, bbox))
                cells.append(" <br> ".join(" ".join(w[4] for w in cell) for cell in cell_rows).replace("|", "\\|"))
            rendered.append("| " + " | ".join(cells) + " |")
            if len(rendered) == 1:
                rendered.append("|" + "|".join(["---"] * len(cells)) + "|")
        regions.append((table.bbox, "\n".join(rendered)))
    return [
        region for region in regions
        if not any(
            other[0] != region[0] and fitz.Rect(region[0]).contains(fitz.Rect(other[0]))
            for other in regions
        )
    ]


def _sorted_text_lines(page: "fitz.Page") -> list[tuple[float, int, str]]:
    words = page.get_text("words")
    if not words:
        return []
    rows = _word_rows(words)
    gutter = _question_gutter(page, rows)
    regions = _table_regions(page, words)
    consumed = {tuple(w) for bbox, _ in regions for w in _words_in_rect(words, bbox)}
    ordered: list[tuple[float, int, float, str]] = []
    for row in _word_rows([w for w in words if tuple(w) not in consumed]):
        for col in range(2 if gutter is not None else 1):
            cell = [w for w in row if gutter is None or int(w[0] >= gutter) == col]
            if cell:
                ordered.append((min(w[1] for w in cell), col, cell[0][0], " ".join(w[4] for w in cell).strip()))
    for bbox, text in regions:
        ordered.append((bbox[1], int(gutter is not None and bbox[0] >= gutter), bbox[0], text))
    ordered.sort(key=lambda item: (item[1], round(item[0], 1), item[2]))
    return [(y, col, text) for y, col, _, text in ordered if text]


def _repeated_lines(pages_lines: list[list[tuple[float, int, str]]]) -> set[str]:
    """Running heads/footers: identical lines on most pages (e.g. page numbers)."""
    if len(pages_lines) < 3:
        return set()
    counts: dict[str, int] = {}
    for lines in pages_lines:
        if not lines:
            continue
        seen = {lines[0][2], lines[-1][2]}
        for line in seen:
            counts[line] = counts.get(line, 0) + 1
    threshold = max(3, int(len(pages_lines) * 0.6))
    return {line for line, count in counts.items() if count >= threshold or PAGE_NUM_RE.match(line)}


def _downscale(raw: bytes, mime: str, width: int, height: int, max_dim: int) -> tuple[bytes, str, int, int]:
    """Bound serverless payloads: thumbnails huge figures to max_dim, PNG."""
    if max_dim <= 0 or max(width, height) <= max_dim:
        return raw, mime, width, height
    try:
        from PIL import Image as PILImage

        with PILImage.open(io.BytesIO(raw)) as image:
            image.thumbnail((max_dim, max_dim))
            buffer = io.BytesIO()
            image.save(buffer, format="PNG")
            return buffer.getvalue(), "image/png", image.width, image.height
    except (OSError, ValueError):
        return raw, mime, width, height  # keep original: text still imports


def _template_hashes(doc: "fitz.Document", max_pages: int = 2) -> frozenset[str]:
    """Content hashes of images repeated across many pages (page templates,
    borders, watermarks). Question diagrams repeat on at most ~2 pages."""
    from collections import defaultdict

    seen: dict[str, set[int]] = defaultdict(set)
    for page_no, page in enumerate(doc, start=1):
        try:
            images = page.get_images(full=True)
        except ValueError:
            continue
        for img in images:
            try:
                raw = doc.extract_image(img[0])["image"]
            except (fitz.FileDataError, ValueError, KeyError):
                continue
            seen[hashlib.sha256(raw).hexdigest()].add(page_no)
    return frozenset(h for h, pages in seen.items() if len(pages) > max_pages)


def _page_images(
    doc: "fitz.Document",
    page: "fitz.Page",
    page_no: int,
    min_size: int,
    max_dim: int = 1200,
    skip_hashes: frozenset[str] = frozenset(),
) -> list[Figure]:
    """Embedded raster images with positions; drops icons, backgrounds,
    and template graphics repeated across pages (borders, watermarks)."""
    figures: list[Figure] = []
    page_rect = page.rect
    for img in page.get_images(full=True):
        try:
            xref = img[0]
            info = doc.extract_image(xref)
            raw_image: bytes = info["image"]
            if hashlib.sha256(raw_image).hexdigest() in skip_hashes:
                continue  # template graphic, not question content
            width, height = int(info.get("width", 0)), int(info.get("height", 0))
            if width < min_size or height < min_size:
                continue  # icons, bullets, rules
            try:
                bbox = page.get_image_bbox(img)
            except ValueError:
                continue
            if bbox.width * bbox.height > 0.8 * page_rect.width * page_rect.height:
                continue  # full-page background / scanned page layer
            raw: bytes = raw_image
            ext: str = info.get("ext", "png").lower()
            mime = "image/jpeg" if ext in {"jpg", "jpeg"} else "image/png"
            raw, mime, width, height = _downscale(raw, mime, width, height, max_dim)
            figures.append(
                Figure(
                    filename="",
                    mime=mime,
                    width=width,
                    height=height,
                    data_base64=base64.b64encode(raw).decode("ascii"),
                    center_y=(bbox.y0 + bbox.y1) / 2,
                    center_x=(bbox.x0 + bbox.x1) / 2,
                    page=page_no,
                    bbox=(bbox.x0, bbox.y0, bbox.x1, bbox.y1),
                )
            )
        except (fitz.FileDataError, ValueError, KeyError):
            continue  # corrupt/unsupported image stream: text still imports
    return figures


def _owner_for_y(
    segments: list[Segment], page_no: int, center_y: float, col: int = 0
) -> Segment | None:
    """Question owning a vertical position: latest segment starting at or
    above it (spanning a continued question from the previous page),
    preferring the figure's own column in two-column layouts."""
    eligible = [
        seg for seg in segments
        if seg.page < page_no or (seg.page == page_no and seg.start_y <= center_y)
    ]
    return max(
        eligible,
        key=lambda seg: (seg.col == col, seg.page, seg.start_y, seg.index),
        default=None,
    )


def _iou(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    x0, y0 = max(a[0], b[0]), max(a[1], b[1])
    x1, y1 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x1 - x0) * max(0.0, y1 - y0)
    if inter <= 0:
        return 0.0
    area = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / area if area > 0 else 0.0


def _cluster_rects(rects: list, gap: float = 12.0) -> list:
    """Merge overlapping/nearby drawing rects into figure clusters."""
    clusters: list[list] = [[r] for r in rects]
    merged = True
    while merged:
        merged = False
        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                touching = any(
                    fitz.Rect(a.x0 - gap, a.y0 - gap, a.x1 + gap, a.y1 + gap).intersects(b)
                    for a in clusters[i]
                    for b in clusters[j]
                )
                if touching:
                    clusters[i].extend(clusters[j])
                    del clusters[j]
                    merged = True
                    break
            if merged:
                break
    unions = []
    for cluster in clusters:
        union = fitz.Rect(cluster[0])
        for rect in cluster[1:]:
            union.include_rect(rect)
        unions.append(union)
    return unions


def _vector_figures(
    doc: "fitz.Document",
    page: "fitz.Page",
    page_no: int,
    segments: list[Segment],
    raster_bboxes: list[tuple[float, float, float, float]],
    min_pt: float = 30.0,
    max_dim: int = 1200,
    max_clusters: int = 16,
) -> list[tuple[Figure, Segment]]:
    """Render vector-diagram clusters (missed by raster extraction) as PNGs.

    GATE diagrams are usually vector drawings, not embedded images. Drawing
    rects are clustered, tiny rules/borders and page backgrounds dropped,
    same-figure raster duplicates skipped by overlap, and each cluster is
    rendered at 200 DPI, clipped tight with a small pad.
    """
    found: list[tuple[Figure, Segment]] = []
    try:
        drawings = page.get_drawings()
    except ValueError:
        return found
    if len(drawings) > 1500:
        return found  # dense vector page: skip for speed
    rects = []
    for drawing in drawings:
        rect = drawing["rect"]
        if rect.width > 220 or (rect.height < 3 and rect.width > 80):
            continue  # divider rules / page borders
        if rect.width < 6 or rect.height < 6:
            continue  # specks
        rects.append(rect)
    page_area = page.rect.width * page.rect.height
    try:
        page_words = page.get_text("words")
    except ValueError:
        page_words = []
    for cluster in _cluster_rects(rects)[:max_clusters]:
        if cluster.width < min_pt or cluster.height < min_pt:
            continue
        if cluster.width * cluster.height > 0.6 * page_area:
            continue  # background panel
        if (cluster.width * cluster.height) / page_area > 0.15:
            # Page-text render, not a diagram: a real figure this large
            # carries a few labels, not paragraphs. Count words with at
            # least two characters whose center falls inside the cluster.
            inside = sum(
                1
                for word in page_words
                if len(word[4]) >= 2
                and cluster.x0 <= (word[0] + word[2]) / 2 <= cluster.x1
                and cluster.y0 <= (word[1] + word[3]) / 2 <= cluster.y1
            )
            if inside >= 12:
                continue
        box = (cluster.x0, cluster.y0, cluster.x1, cluster.y1)
        if any(_iou(box, other) > 0.25 for other in raster_bboxes):
            continue  # already captured as an embedded raster image
        center_y = (cluster.y0 + cluster.y1) / 2
        owner = _owner_for_y(
            segments, page_no, center_y,
            0 if (cluster.x0 + cluster.x1) / 2 < page.rect.width / 2 else 1,
        )
        if owner is None:
            continue
        clip = fitz.Rect(
            max(0, cluster.x0 - 4),
            max(0, cluster.y0 - 4),
            min(page.rect.width, cluster.x1 + 4),
            min(page.rect.height, cluster.y1 + 4),
        )
        try:
            pix = page.get_pixmap(dpi=200, clip=clip)
        except ValueError:
            continue
        raw = pix.tobytes("png")
        width, height = pix.width, pix.height
        raw, mime, width, height = _downscale(raw, "image/png", width, height, max_dim)
        found.append((
            Figure(
                filename="",
                mime=mime,
                width=width,
                height=height,
                data_base64=base64.b64encode(raw).decode("ascii"),
                center_y=center_y,
                center_x=(cluster.x0 + cluster.x1) / 2,
                page=page_no,
                bbox=box,
            ),
            owner,
        ))
    return found


def _question_start(
    line: str, last_number: int | None, restart_allowed: bool
) -> int | None:
    """Question number starting this line, or None.

    Q-prefixed markers ("Q.12") are trusted structurally; bare numbers
    ("12.") additionally need prose guards. Sequential validation rejects
    denominator fragments ("12." mid-question) and wild jumps, while still
    allowing a new section to restart at 1.
    """
    stripped = line.strip()
    if not stripped:
        return None
    match = QUESTION_RE.match(stripped)
    rest = ""
    if match:
        number = int(match.group(1))
        rest = QUESTION_RE.sub("", stripped).strip()
    else:
        bare = BARE_Q_RE.match(stripped)
        if not bare:
            return None
        number = int(bare.group(1))
        rest = (bare.group(2) or "").strip()
        if not rest or re.match(r"^\d+(\.\d+)?$", rest):
            return None  # fraction fragment, not a question
        first_word = rest.split()[0] if rest.split() else ""
        if FALSE_POSITIVE_STARTERS.match(first_word):
            return None
    if last_number is not None:
        if number == last_number + 1:
            pass
        elif number <= last_number:
            # Backwards: only a genuine section boundary (range preamble,
            # "General Aptitude", ...) restarts numbering. In-question
            # numbered lists ("1. Element ...") must not split.
            if not restart_allowed:
                return None
        elif number > last_number + 5:
            return None  # wild forward jump: noise, not a question
    return number


def _is_table_row(line: str) -> bool:
    # Structure first: ASCII hyphens belong to range headers ("0 - 10"),
    # so the math guard below must not reject them (it excludes "-").
    if not (
        _TABLE_HEADER_RE.search(line)
        or _TABLE_DATA_RE.match(line)
        or _TABLE_VERTICAL_RE.match(line)
    ):
        return False
    if re.search(r"[+=\u00B0\u2212]|sin|cos|tan|sec|cosec|cot", line, re.IGNORECASE):
        return False  # equations and trig, not tables
    return True


def _format_table_row(line: str, prev_row: str | None = None) -> str:
    """Format one table row with | pipes (GFM), repairing squished digits."""
    line = line.strip()
    range_match = _TABLE_HEADER_RE.search(line)
    if range_match:
        label = range_match.group(1).strip()
        ranges = re.findall(r"\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?", range_match.group(2))
        if ranges:
            return "| " + label + " | " + " | ".join(r.strip() for r in ranges) + " |"
    parts = re.split(r"\s{2,}", line)
    if len(parts) >= 3:
        return "| " + " | ".join(p.strip() for p in parts if p.strip()) + " |"
    data_match = _TABLE_DATA_RE.match(line)
    if data_match:
        label = data_match.group(1).strip()
        data_str = data_match.group(2).strip()
        expected_cols = (prev_row.count("|") - 2) if prev_row and "|" in prev_row else 0
        clean_digits = data_str.replace(" ", "")
        if expected_cols > 0 and len(clean_digits) == expected_cols:
            data_parts = list(clean_digits)  # repair "1215623" style squishing
        else:
            data_parts = re.split(r"\s+", data_str)
        return "| " + label + " | " + " | ".join(data_parts) + " |"
    return "| " + line + " |"


def _join_prompt_lines(raw_lines: list[str]) -> str:
    """Join stem lines: prose flows, table rows keep GFM formatting."""
    if not raw_lines:
        return ""
    lines: list[str] = [raw_lines[0].strip()]
    for line in raw_lines[1:]:
        stripped = line.strip()
        if stripped.startswith("|") or lines[-1].startswith("|"):
            lines.append(stripped)
        elif _is_table_row(stripped) or _TABLE_VERTICAL_RE.match(stripped):
            lines.append(stripped)
        elif _TABLE_CONTINUATION_RE.match(stripped):
            lines[-1] = lines[-1] + " " + stripped
        elif _is_table_row(lines[-1]) or _TABLE_VERTICAL_RE.match(lines[-1]):
            lines.append(stripped)
        else:
            lines[-1] = lines[-1] + " " + stripped
    final_lines: list[str] = []
    for index, text in enumerate(lines):
        is_table = _is_table_row(text) or bool(_TABLE_VERTICAL_RE.match(text))
        prev_table = index > 0 and (
            _is_table_row(lines[index - 1]) or bool(_TABLE_VERTICAL_RE.match(lines[index - 1]))
        )
        if is_table:
            prev_row = final_lines[-1] if final_lines and prev_table else None
            formatted = _format_table_row(text, prev_row)
            final_lines.append(formatted)
            if not prev_table:
                cols = max(1, formatted.count("|") - 1)
                final_lines.append("|" + "|".join(["---"] * cols) + "|")
        elif text.startswith("|"):
            final_lines.extend(["", text, ""])
        else:
            final_lines.append(text)
    return "\n".join(final_lines).strip()


def _build_question(
    segment: Segment,
    *,
    stem: str,
    index: int,
    year: int | None,
    subject: str,
    topic: str,
    section: str,
    mark_ranges: list[tuple[int, int, float]],
    upload_cdn: bool = False,
) -> dict:
    prompt_lines: list[str] = []
    options: list[dict] = []
    current_option: dict | None = None
    marks: float | None = None

    def flush_option() -> None:
        nonlocal current_option
        if current_option:
            options.append({"id": current_option["id"], "lines": current_option["lines"]})
        current_option = None

    def resolve_options() -> list[dict[str, str]]:
        """Join option lines; fix marker-after-text layouts; fill image options."""
        texts = [" ".join(option["lines"]).strip() for option in options]
        # Pull-back cascade: in "text (A) text (B) ..." grids each option
        # holds its SUCCESSOR's text. Walk from the end so interior gaps
        # (empty middle options) recover too — not just a trailing one.
        for index in range(len(texts) - 1, 0, -1):
            if texts[index] or not options[index - 1]["lines"]:
                continue
            # Marker-after-text grid ("...text... (D)"): the text landed on
            # the previous option; pull its last line back, cascading left.
            # Single-line steals need a short line so spilled stem prose
            # (next page/column) is never grabbed.
            prev = options[index - 1]["lines"]
            if len(prev) >= 2 or (len(prev) == 1 and len(prev[0]) < 80):
                texts[index] = prev.pop()
                texts[index - 1] = " ".join(prev).strip()
        # Text-before-marker option grids ("textA (A) textB (B) ..."): every
        # option stole its predecessor's text, so the first option's text is
        # still sitting as the prompt's last line. Reclaim it — unless that
        # line looks like stem prose (mixed image/text options), in which
        # case leave the placeholder so the import flags the row.
        if len(texts) > 1 and not texts[0] and all(texts[1:]):
            tail = prompt_lines[-1].strip() if prompt_lines else ""
            if tail and not _STEM_TAIL_RE.search(tail):
                texts[0] = tail
                del prompt_lines[-1]
        resolved: list[dict[str, str]] = []
        for position, option in enumerate(options):
            text = texts[position]
            if not text and segment.figures:
                # Image-only options (diagrams as choices): keep the marker
                # so the question still types as MCQ; figures render below.
                text = "[See figure]"
            if text:
                resolved.append({"id": option["id"], "text": text})
        return resolved

    for line in segment.lines:
        marks_match = MARKS_RE.search(line)
        if marks_match:
            # First marks tag wins; usually the stem tag, sometimes trailing
            # the options ("(2 marks)" on its own closing line).
            if marks is None:
                marks = _marks_value(marks_match.group(1))
            line = MARKS_RE.sub("", line).strip(" ()")
            if not line:
                continue
        option_match = OPTION_RE.match(line)
        if option_match:
            flush_option()
            first = option_match.group(2).strip()
            current_option = {"id": option_match.group(1).upper(), "lines": [first] if first else []}
            continue
        if current_option is not None:
            current_option["lines"].append(line)
        else:
            prompt_lines.append(line)
    flush_option()

    # Keep option ids dense A.. in encounter order.
    fixed_options = [
        {"id": chr(ord("A") + position), "text": option["text"]}
        for position, option in enumerate(resolve_options()[:8])
    ]
    has_options = len(fixed_options) >= 2
    if has_options:
        question_type = "msq" if section == "msq" else "mcq"
    else:
        question_type = "nat"
        fixed_options = []

    resolved_marks = marks
    if resolved_marks is None and segment.number is not None:
        for start, end, value in mark_ranges:
            if start <= segment.number <= end:
                resolved_marks = value
                break
    if resolved_marks is None:
        resolved_marks = 1
    prompt = _join_prompt_lines(prompt_lines)
    figure_markers = " ".join(f"[Figure {n}]" for n in range(1, len(segment.figures) + 1))
    if figure_markers:
        prompt = f"{prompt}\n\n{figure_markers}".strip()

    external_id = f"{stem}-Q{index:02d}"
    for position, figure in enumerate(segment.figures, start=1):
        figure.filename = f"{external_id}-fig{position}.{figure.mime.split('/')[1]}"
    if upload_cdn:
        # Lazy import: imagekit_uploader is stdlib-only at import time, and
        # Modal mounts it alongside extract.py (see modal_app.py).
        from imagekit_uploader import upload_image_bytes

        for figure in segment.figures:
            try:
                url = upload_image_bytes(base64.b64decode(figure.data_base64), figure.filename)
            except (ValueError, base64.binascii.Error):
                url = None
            if url:
                figure.url = url

    return {
        "externalId": external_id,
        "year": year,
        "questionNumber": segment.number,
        "subject": subject,
        "topic": topic,
        "type": question_type,
        "difficulty": "medium",
        "prompt": prompt,
        "options": fixed_options or None,
        "correctAnswer": None,
        "marks": resolved_marks,
        "negativeMarks": 0,
        "solution": "",
        "sourceLabel": stem,
        "sourcePage": segment.page,
        "confidence": 0.4,
        "images": [
            {
                "filename": figure.filename,
                "mime": figure.mime,
                "width": figure.width,
                "height": figure.height,
                # Exactly one of url (CDN upload enabled) or data (base64).
                **({"url": figure.url} if figure.url else {"data": figure.data_base64}),
            }
            for figure in segment.figures
        ],
    }


def extract_pdf_bytes(
    data: bytes,
    *,
    stem: str,
    year: int | None,
    subject: str,
    topic: str,
    max_images: int = 8,
    min_image: int = 80,
    max_dim: int = 1200,
    upload_cdn: bool = False,
) -> dict:
    """Core extraction: deterministic, no network, no model."""
    doc = fitz.open(stream=data, filetype="pdf")
    try:
        if year is None:
            head = "\n".join(
                line for page in doc for line in page.get_text().splitlines()[:40]
            )
            match = YEAR_RE.search(stem + "\n" + head[:20_000])
            year = int(match.group(1)) if match else None

        pages_lines = [_sorted_text_lines(page) for page in doc]
        boilerplate = _repeated_lines(pages_lines)
        templates = _template_hashes(doc)

        segments: list[Segment] = []
        current: Segment | None = None
        section = "mcq"
        mark_ranges: list[tuple[int, int, float]] = []
        counter = 0
        last_number: int | None = None
        restart_allowed = False
        finished = False
        # (page, y, col) of the last line appended to the current segment —
        # lets a new Q-marker reclaim a same-row stem line sorted above it.
        prev_append: tuple[int, float, int] | None = None

        for page_no, (page, lines) in enumerate(zip(doc, pages_lines), start=1):
            if finished:
                break
            for _y, col, line in lines:
                if line in boilerplate:
                    continue
                if FOOTER_RE.match(line):
                    continue
                if END_OF_PAPER_RE.match(line):
                    finished = True  # answer keys / rough work: stop, don't import
                    break
                range_match = RANGE_MARKS_RE.search(line)
                if range_match:
                    # Section preamble ("Q.1 - Q.5 carry ONE mark each"):
                    # records per-range marks, allows a numbering restart,
                    # never a question itself.
                    section_marks = _marks_value(range_match.group(3))
                    if section_marks is not None:
                        try:
                            mark_ranges.append(
                                (int(range_match.group(1)), int(range_match.group(2)), section_marks)
                            )
                        except ValueError:
                            pass
                    restart_allowed = True
                    continue
                if SECTION_RESET_RE.match(line):
                    restart_allowed = True  # new section may restart at Q1
                    continue
                if MSQ_HINT_RE.search(line):
                    section = "msq"
                    continue
                if NAT_HINT_RE.search(line):
                    section = "nat"
                    continue
                number = _question_start(line, last_number, restart_allowed)
                if number is not None:
                    counter += 1
                    last_number = number
                    restart_allowed = False
                    # Same-row marginal-label inversion: a stem line sorted a
                    # hair above its Q-marker (same page/column, <1.5pt) belongs
                    # to the NEW question, not the previous segment's tail.
                    # Genuine spill sits a full line or more above and is kept.
                    orphan: str | None = None
                    if (
                        current is not None
                        and prev_append is not None
                        and prev_append[0] == page_no
                        and prev_append[2] == col
                        and 0 < _y - prev_append[1] < 1.5
                        and current.lines
                    ):
                        tail = current.lines[-1]
                        if (
                            tail.strip()
                            and not OPTION_RE.match(tail)
                            and not QUESTION_RE.match(tail)
                            and not tail.lstrip().startswith("|")
                        ):
                            orphan = current.lines.pop()  # type: ignore[union-attr]
                    current = Segment(
                        index=counter,
                        number=number,
                        page=page_no,
                        start_y=_y,
                        section=section,
                        col=col,
                    )
                    segments.append(current)
                    if orphan is not None:
                        current.lines.append(orphan)  # type: ignore[union-attr]
                    rest = QUESTION_RE.sub("", line).strip()
                    if not rest:
                        bare = BARE_Q_RE.match(line.strip())
                        rest = ((bare.group(2) if bare else "") or "").strip()
                    if rest:
                        current.lines.append(rest)  # type: ignore[union-attr]
                    prev_append = (page_no, _y, col) if (orphan is not None or rest) else None
                    continue
                if current is None:
                    prev_append = None
                    continue  # preamble before the first question
                current.lines.append(line)  # type: ignore[union-attr]
                prev_append = (page_no, _y, col)

            # Assign this page's figures to the question spanning their position.
            page_mid = page.rect.width / 2
            page_figs = _page_images(doc, page, page_no, min_image, max_dim, templates)
            for figure in page_figs:
                fig_col = 0 if figure.center_x < page_mid else 1
                owner = _owner_for_y(segments, page_no, figure.center_y, fig_col)
                if owner is not None and len(owner.figures) < max_images:
                    owner.figures.append(figure)
            # Vector diagrams (missed by raster extraction) fill spare slots.
            for figure, owner in _vector_figures(
                doc,
                page,
                page_no,
                segments,
                [f.bbox for f in page_figs if f.bbox is not None],
                max_dim=max_dim,
            ):
                if len(owner.figures) < max_images:
                    owner.figures.append(figure)

        questions = [
            _build_question(
                segment,
                stem=stem,
                index=position,
                year=year,
                subject=subject,
                topic=topic,
                section=segment.section,
                mark_ranges=mark_ranges,
                upload_cdn=upload_cdn,
            )
            for position, segment in enumerate(
                [seg for seg in segments if seg.lines or seg.figures], start=1
            )
        ]
        return {"questions": questions}
    finally:
        doc.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Extract GATE questions/options/figures from a searchable PDF "
        "into the GATE Mentor imports JSON contract (no LLM).",
    )
    parser.add_argument("pdf", help="Path to the question-paper PDF.")
    parser.add_argument("--year", type=int, default=None, help="Exam year (default: inferred).")
    parser.add_argument("--subject", default="Uncategorized", help="Subject for every row (default parks rows for review).")
    parser.add_argument("--topic", default="Needs Review", help="Topic for every row (default parks rows for review).")
    parser.add_argument("--source-label", default=None, help="Defaults to the PDF filename stem.")
    parser.add_argument("-o", "--out", default=None, help="Write JSON here instead of stdout.")
    parser.add_argument("--max-images", type=int, default=8, help="Max figures kept per question.")
    parser.add_argument("--min-image", type=int, default=80, help="Min figure width/height in px.")
    parser.add_argument("--max-dim", type=int, default=1200, help="Figures larger than this (px) are thumbnailed to bound payloads; 0 disables.")
    parser.add_argument("--upload-cdn", action="store_true", help="Upload figures to ImageKit CDN (needs IMAGEKIT_* env vars); JSON then carries urls instead of base64.")
    args = parser.parse_args(argv)

    with open(args.pdf, "rb") as handle:
        data = handle.read()
    if len(data) > 20 * 1024 * 1024:
        print("error: PDF files must be 20 MB or smaller.", file=sys.stderr)
        return 2

    import os

    stem = os.path.splitext(os.path.basename(args.pdf))[0]
    result = extract_pdf_bytes(
        data,
        stem=args.source_label or stem,
        year=args.year,
        subject=args.subject,
        topic=args.topic,
        max_images=args.max_images,
        min_image=args.min_image,
        max_dim=args.max_dim,
        upload_cdn=args.upload_cdn,
    )
    payload = json.dumps(result, ensure_ascii=False)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as handle:
            handle.write(payload)
    else:
        print(payload)
    print(f"extracted {len(result['questions'])} questions", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
