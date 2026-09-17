"""End-to-end tests: build a synthetic GATE-style PDF in memory and assert
the full imports-contract output (questions, options, marks, NAT/MSQ typing,
figure assignment). No network, no model."""

import base64
import io
import os
from pathlib import Path
import re
import unicodedata

import pytest
import fitz
from PIL import Image

from extract import extract_pdf_bytes

REQUIRED_KEYS = {
    "externalId", "year", "questionNumber", "subject", "topic", "type",
    "difficulty", "prompt", "options", "correctAnswer", "marks",
    "negativeMarks", "solution", "sourceLabel", "sourcePage",
    "confidence", "images",
}


def _red_square_png(size: int = 120) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (size, size), (200, 30, 30)).save(buffer, format="PNG")
    return buffer.getvalue()


def _fixture_pdf() -> bytes:
    doc = fitz.open()
    head = "GATE-CS-2024"
    # Page 1: MCQ with figure.
    page = doc.new_page()
    page.insert_text((72, 40), head, fontsize=9)
    page.insert_text((72, 560), "1", fontsize=9)
    page.insert_text((72, 80), "Q.1 What is 6 x 7?", fontsize=11)
    for offset, text in enumerate(["(A) 40", "(B) 42", "(C) 44", "(D) 46"]):
        page.insert_text((90, 110 + offset * 20), text, fontsize=11)
    page.insert_text((72, 200), "(2 marks)", fontsize=11)
    page.insert_image(fitz.Rect(300, 80, 420, 200), stream=_red_square_png())
    # Page 2: NAT section.
    page = doc.new_page()
    page.insert_text((72, 40), head, fontsize=9)
    page.insert_text((72, 560), "2", fontsize=9)
    page.insert_text((72, 80), "Numerical Answer Type", fontsize=11)
    page.insert_text((72, 110), "Q.2 How many bits in a byte? (1 mark)", fontsize=11)
    # Page 3: MSQ section.
    page = doc.new_page()
    page.insert_text((72, 40), head, fontsize=9)
    page.insert_text((72, 560), "3", fontsize=9)
    page.insert_text((72, 80), "Multiple Select Questions", fontsize=11)
    page.insert_text((72, 110), "Q.3 Which are prime?", fontsize=11)
    for offset, text in enumerate(["(A) 2", "(B) 4", "(C) 5", "(D) 6"]):
        page.insert_text((90, 140 + offset * 20), text, fontsize=11)
    out = io.BytesIO()
    doc.save(out)
    doc.close()
    return out.getvalue()


def _questions():
    return extract_pdf_bytes(
        _fixture_pdf(), stem="GATE-CS-2024", year=None,
        subject="Uncategorized", topic="Needs Review",
    )["questions"]


def test_segments_questions_options_and_marks():
    questions = _questions()
    assert len(questions) == 3
    first = questions[0]
    assert first["questionNumber"] == 1
    assert first["type"] == "mcq"
    assert [option["id"] for option in first["options"]] == ["A", "B", "C", "D"]
    assert first["options"][1]["text"] == "42"
    assert first["marks"] == 2
    assert first["year"] == 2024  # inferred from running head
    assert first["correctAnswer"] is None
    assert first["confidence"] == 0.4


def test_nat_and_msq_sections():
    questions = _questions()
    assert questions[1]["type"] == "nat"
    assert questions[1]["options"] is None
    assert "bits in a byte" in questions[1]["prompt"]
    assert questions[2]["type"] == "msq"
    assert len(questions[2]["options"]) == 4


def test_figure_assigned_to_owning_question():
    questions = _questions()
    images = questions[0]["images"]
    assert len(images) == 1
    figure = images[0]
    assert figure["mime"] == "image/png"
    assert figure["width"] == 120 and figure["height"] == 120
    assert figure["filename"].startswith(questions[0]["externalId"])
    assert "[Figure 1]" in questions[0]["prompt"]
    assert base64.b64decode(figure["data"])[:8] == b"\x89PNG\r\n\x1a\n"
    assert questions[1]["images"] == []
    assert questions[2]["images"] == []


def test_full_contract_shape():
    questions = _questions()
    assert len({question["externalId"] for question in questions}) == 3
    for question in questions:
        assert REQUIRED_KEYS <= set(question), question["externalId"]
        assert question["prompt"] and "GATE-CS-2024" not in question["prompt"]


def test_large_figures_are_downscaled():
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 80), "Q.1 Big diagram?", fontsize=11)
    page.insert_text((90, 110), "(A) yes", fontsize=11)
    page.insert_text((90, 130), "(B) no", fontsize=11)
    page.insert_image(fitz.Rect(300, 80, 500, 280), stream=_red_square_png(2000))
    out = io.BytesIO()
    doc.save(out)
    doc.close()
    (question,) = extract_pdf_bytes(
        out.getvalue(), stem="BIG", year=2024, subject="s", topic="t",
    )["questions"]
    (figure,) = question["images"]
    assert max(figure["width"], figure["height"]) <= 1200
    assert figure["mime"] == "image/png"


def _tricky_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    y = 80

    def line(text: str) -> None:
        nonlocal y
        page.insert_text((72, y), text, fontsize=11)
        y += 20

    line("General Aptitude")
    line("Q.1 What comes first?")
    line("(A) alpha")
    line("(B) beta")
    line("Q.2 What comes next?")
    line("(A) gamma")
    line("(B) delta")
    line("3. Therefore, each of them holds.")  # fraction-style prose, not Q3
    line("Q.3 Study the table")
    line("Marks 0 - 10 10 - 20 20 - 30")
    line("Students 5 8 3")
    line("Technical Section")
    line("Q.1 Restarted numbering")
    line("(A) yes")
    line("(B) no")
    line("ANSWER KEY")
    line("1. B")
    line("2. A")
    out = io.BytesIO()
    doc.save(out)
    doc.close()
    return out.getvalue()


def test_sequential_guards_section_restart_cutoff_and_tables():
    questions = extract_pdf_bytes(
        _tricky_pdf(), stem="TRICKY", year=2024, subject="s", topic="t",
    )["questions"]
    # "3. Therefore ..." rejected, key rows after ANSWER KEY ignored.
    assert [q["questionNumber"] for q in questions] == [1, 2, 3, 1]
    table_prompt = questions[2]["prompt"]
    assert "| Marks | 0 - 10 | 10 - 20 | 20 - 30 |" in table_prompt
    assert "| Students | 5 | 8 | 3 |" in table_prompt
    assert "|---|---|---|---|" in table_prompt
    assert questions[2]["type"] == "nat"  # no options
    assert "ANSWER KEY" not in "".join(q["prompt"] for q in questions)


def _vector_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 80), "Q.1 What is the area?", fontsize=11)
    page.insert_text((90, 110), "(A) 1", fontsize=11)
    page.insert_text((90, 130), "(B) 2", fontsize=11)
    shape = page.new_shape()
    shape.draw_rect(fitz.Rect(300, 100, 450, 220))
    shape.finish(width=1)
    shape.commit()
    page.insert_text((72, 300), "Q.2 Raster plus vector overlap?", fontsize=11)
    page.insert_text((90, 330), "(A) yes", fontsize=11)
    page.insert_text((90, 350), "(B) no", fontsize=11)
    page.insert_image(fitz.Rect(300, 300, 500, 440), stream=_red_square_png(200))
    shape = page.new_shape()
    shape.draw_rect(fitz.Rect(310, 310, 490, 430))
    shape.finish(width=1)
    shape.commit()
    out = io.BytesIO()
    doc.save(out)
    doc.close()
    return out.getvalue()


def test_vector_diagrams_cropped_and_deduped():
    questions = extract_pdf_bytes(
        _vector_pdf(), stem="VEC", year=2024, subject="s", topic="t",
    )["questions"]
    assert len(questions) == 2
    # Pure vector diagram rendered to PNG even with no embedded image.
    (figure,) = questions[0]["images"]
    assert figure["mime"] == "image/png"
    assert figure["width"] > 0 and figure["height"] > 0
    assert base64.b64decode(figure["data"])[:8] == b"\x89PNG\r\n\x1a\n"
    assert "[Figure 1]" in questions[0]["prompt"]
    # Overlapping vector drawing deduped against the embedded raster.
    assert len(questions[1]["images"]) == 1


def _fake_imagekit_module(url="https://ik.imagekit.io/test/gate-mentor/diagrams/x.png"):
    from types import ModuleType, SimpleNamespace

    module = ModuleType("imagekitio")

    class _Files:
        def upload(self, **kwargs):
            return SimpleNamespace(url=url, file_path="/gate-mentor/diagrams/x.png")

    class _Client:
        def __init__(self, private_key=None):
            self.files = _Files()

    module.ImageKit = _Client
    return module


def test_uploader_disabled_without_env(monkeypatch):
    from imagekit_uploader import upload_image_bytes

    monkeypatch.delenv("UPLOAD_TO_IMAGEKIT", raising=False)
    assert upload_image_bytes(b"bytes", "q.png") is None


def test_uploader_returns_url_with_fake_client(monkeypatch):
    import sys

    from imagekit_uploader import upload_image_bytes

    monkeypatch.setitem(sys.modules, "imagekitio", _fake_imagekit_module())
    monkeypatch.setenv("UPLOAD_TO_IMAGEKIT", "true")
    monkeypatch.setenv("IMAGEKIT_PRIVATE_KEY", "pk")
    monkeypatch.setenv("IMAGEKIT_PUBLIC_KEY", "pub")
    monkeypatch.setenv("IMAGEKIT_URL_ENDPOINT", "https://ik.imagekit.io/test")
    assert (
        upload_image_bytes(b"bytes", "q.png")
        == "https://ik.imagekit.io/test/gate-mentor/diagrams/x.png"
    )


def test_extract_emits_urls_when_upload_enabled(monkeypatch):
    import sys

    monkeypatch.setitem(sys.modules, "imagekitio", _fake_imagekit_module("https://cdn.test/f.png"))
    monkeypatch.setenv("UPLOAD_TO_IMAGEKIT", "true")
    monkeypatch.setenv("IMAGEKIT_PRIVATE_KEY", "pk")
    monkeypatch.setenv("IMAGEKIT_PUBLIC_KEY", "pub")
    monkeypatch.setenv("IMAGEKIT_URL_ENDPOINT", "https://cdn.test")
    questions = extract_pdf_bytes(
        _fixture_pdf(), stem="CDN", year=2024, subject="s", topic="t", upload_cdn=True,
    )["questions"]
    (figure,) = questions[0]["images"]
    assert figure["url"] == "https://cdn.test/f.png"
    assert "data" not in figure


def _ranges_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    y = 80

    def line(text: str) -> None:
        nonlocal y
        page.insert_text((72, y), text, fontsize=11)
        y += 20

    line("Q.1 - Q.2 carry ONE mark Each")
    line("Q.1")
    line("First one?")
    line("(A) a")
    line("(B) b")
    line("Q.2")
    line("Second one?")
    line("(A) c")
    line("(B) d")
    line("Q.3 - Q.4 carry TWO marks Each")
    line("Q.3")
    line("Third one?")
    line("(A) e")
    line("(B) f")
    line("Q.4")
    line("Figure options?")
    line("(A)")
    line("(B)")
    page.insert_image(fitz.Rect(300, 400, 420, 500), stream=_red_square_png())
    line("Page 1 of 1")
    line("Organizing Institute: TEST")
    out = io.BytesIO()
    doc.save(out)
    doc.close()
    return out.getvalue()


def test_range_marks_bare_markers_footers_and_figure_options():
    questions = extract_pdf_bytes(
        _ranges_pdf(), stem="RNG", year=2024, subject="s", topic="t",
    )["questions"]
    assert [q["questionNumber"] for q in questions] == [1, 2, 3, 4]
    assert [q["marks"] for q in questions] == [1, 1, 2, 2]
    assert all(q["type"] == "mcq" for q in questions)
    fourth = questions[3]
    assert [o["text"] for o in fourth["options"]] == ["[See figure]", "[See figure]"]
    assert len(fourth["images"]) == 1
    for q in questions:
        assert "Page 1 of 1" not in q["prompt"]
        assert "Organizing Institute" not in q["prompt"]


def test_template_graphics_dropped_across_pages():
    doc = fitz.open()
    blob = _red_square_png(200)
    for _ in range(3):
        page = doc.new_page()
        page.insert_text((72, 80), "Q.1 Repeated?", fontsize=11)
        page.insert_text((90, 110), "(A) x", fontsize=11)
        page.insert_text((90, 130), "(B) y", fontsize=11)
        page.insert_image(fitz.Rect(300, 80, 420, 200), stream=blob)
    out = io.BytesIO()
    doc.save(out)
    doc.close()
    questions = extract_pdf_bytes(
        out.getvalue(), stem="TPL", year=2024, subject="s", topic="t",
    )["questions"]
    assert sum(len(q["images"]) for q in questions) == 0


def test_two_columns_read_left_then_right():
    doc = fitz.open()
    page = doc.new_page(width=600, height=800)
    page.insert_text((60, 80), "Q.1 Left one?", fontsize=11)
    page.insert_text((340, 80), "Q.2 Right one?", fontsize=11)
    page.insert_text((70, 110), "(A) la", fontsize=11)
    page.insert_text((350, 110), "(A) ra", fontsize=11)
    page.insert_text((70, 130), "(B) lb", fontsize=11)
    page.insert_text((350, 130), "(B) rb", fontsize=11)
    out = io.BytesIO()
    doc.save(out)
    doc.close()
    questions = extract_pdf_bytes(
        out.getvalue(), stem="COL", year=2024, subject="s", topic="t",
    )["questions"]
    assert [q["questionNumber"] for q in questions] == [1, 2]
    assert questions[0]["prompt"] == "Left one?"
    assert [o["text"] for o in questions[0]["options"]] == ["la", "lb"]
    assert questions[1]["prompt"] == "Right one?"
    assert [o["text"] for o in questions[1]["options"]] == ["ra", "rb"]


def test_marker_after_text_gives_last_line_to_empty_option():
    doc = fitz.open()
    page = doc.new_page()
    y = 80

    def line(text: str) -> None:
        nonlocal y
        page.insert_text((72, y), text, fontsize=11)
        y += 20

    line("Q.1 Pick one")
    line("(A) first choice")
    line("continued first choice")
    line("(B)")
    out = io.BytesIO()
    doc.save(out)
    doc.close()
    (question,) = extract_pdf_bytes(
        out.getvalue(), stem="SWAP", year=2024, subject="s", topic="t",
    )["questions"]
    assert [o["text"] for o in question["options"]] == ["first choice", "continued first choice"]


def test_marker_after_text_cascades_left():
    doc = fitz.open()
    page = doc.new_page()
    y = 80

    def line(text: str) -> None:
        nonlocal y
        page.insert_text((72, y), text, fontsize=11)
        y += 20

    line("Q.1 Pick")
    line("(A) alpha")
    line("(B) beta")
    line("gamma")
    line("(C)")
    line("delta")
    line("(D)")
    out = io.BytesIO()
    doc.save(out)
    doc.close()
    (question,) = extract_pdf_bytes(
        out.getvalue(), stem="CAS", year=2024, subject="s", topic="t",
    )["questions"]
    assert [o["text"] for o in question["options"]] == ["alpha", "beta", "gamma", "delta"]


def _extract_document(doc, stem="LAYOUT"):
    return extract_pdf_bytes(
        doc.tobytes(), stem=stem, year=2026, subject="s", topic="t",
    )["questions"]


def _definition_table(page, x, title, rows):
    boundaries = [150, 170, 190]
    for _, rules in rows:
        boundaries.append(boundaries[-1] + 18 * len(rules))
    page.draw_rect(fitz.Rect(x, 150, x + 190, boundaries[-1]))
    for y in boundaries[1:-1]:
        page.draw_line((x, y), (x + 190, y))
    page.draw_line((x + 65, 170), (x + 65, boundaries[-1]))
    page.insert_text((x + 70, 163), title, fontsize=9)
    page.insert_text((x + 5, 183), "Grammar", fontsize=9)
    page.insert_text((x + 70, 183), "Semantic Rules", fontsize=9)
    for index, (production, rules) in enumerate(rows):
        y = boundaries[index + 2] + 13
        page.insert_text((x + 5, y), production, fontsize=9)
        for offset, rule in enumerate(rules):
            page.insert_text((x + 70, y + offset * 18), rule, fontsize=9)


@pytest.mark.parametrize("footer", ["Organising", "Organizing"])
def test_side_by_side_definitions_remain_complete_and_separate(footer):
    with fitz.open() as doc:
        page = doc.new_page(width=600, height=800)
        page.insert_text((60, 60), "Q.1 Before definitions", fontsize=11)
        page.insert_text((70, 80), "(A) previous yes", fontsize=11)
        page.insert_text((70, 100), "(B) previous no", fontsize=11)
        page.insert_text((60, 130), "Q.2 Compare the two definitions", fontsize=11)
        _definition_table(page, 120, "Definition Left", [
            ("D -> T V", ["D.type = T.type", "V.type = T.type"]),
            ("V -> id", ["put(id, V.type)"]),
        ])
        _definition_table(page, 325, "Definition Right", [
            ("D -> D1 id", ["D.type = D1.type", "put(id, D1.type)"]),
            ("D -> T id", ["D.type = T.type", "put(id, T.type)"]),
            ("T -> int", ["T.type = int"]),
        ])
        page.insert_text((70, 330), "(A) same language", fontsize=11)
        page.insert_text((70, 350), "(B) different attributes", fontsize=11)
        page.insert_text((60, 390), "Q.3 After definitions", fontsize=11)
        page.insert_text((70, 410), "(A) next yes", fontsize=11)
        page.insert_text((70, 430), "(B) next no", fontsize=11)
        page.insert_text((70, 760), f"{footer} Institute: TEST", fontsize=9)
        questions = _extract_document(doc)
    assert [q["questionNumber"] for q in questions] == [1, 2, 3]
    prompt = questions[1]["prompt"]
    assert "| D -> T V | D.type = T.type <br> V.type = T.type |" in prompt
    assert "| D -> D1 id | D.type = D1.type <br> put(id, D1.type) |" in prompt
    assert "| D -> T id | D.type = T.type <br> put(id, T.type) |" in prompt
    assert "| T -> int | T.type = int |" in prompt
    assert prompt.index("put(id, V.type)") < prompt.index("Definition Right")
    assert [o["text"] for o in questions[1]["options"]] == [
        "same language", "different attributes",
    ]
    assert questions[0]["prompt"] == "Before definitions"
    assert questions[2]["prompt"] == "After definitions"
    assert [o["text"] for o in questions[0]["options"]] == ["previous yes", "previous no"]
    assert [o["text"] for o in questions[2]["options"]] == ["next yes", "next no"]


@pytest.mark.parametrize("right_y", [65, 80, 155])
def test_staggered_independent_columns_follow_column_order(right_y):
    with fitz.open() as doc:
        page = doc.new_page(width=600, height=800)
        for x, y, number in [(60, 80, 1), (60, 230, 2), (340, right_y, 3), (340, 300, 4)]:
            page.insert_text((x, y), f"Q.{number} Stem {number}", fontsize=11)
            page.insert_text((x + 10, y + 25), f"(A) choice {number} a", fontsize=11)
            page.insert_text((x + 10, y + 45), f"(B) choice {number} b", fontsize=11)
        page.insert_image(
            fitz.Rect(450, right_y + 55, 550, right_y + 155), stream=_red_square_png(),
        )
        questions = _extract_document(doc)
    assert [q["questionNumber"] for q in questions] == [1, 2, 3, 4]
    assert [len(q["images"]) for q in questions] == [0, 0, 1, 0]
    for number, question in enumerate(questions, 1):
        assert question["prompt"] == f"Stem {number}" + ("\n\n[Figure 1]" if number == 3 else "")
        assert [o["text"] for o in question["options"]] == [f"choice {number} a", f"choice {number} b"]


def test_question_continues_across_columns_and_pages():
    with fitz.open() as doc:
        page = doc.new_page(width=600, height=800)
        page.insert_text((60, 80), "Q.1 First stem", fontsize=11)
        page.insert_text((70, 110), "(A) first a", fontsize=11)
        page.insert_text((70, 130), "(B) first b", fontsize=11)
        page.insert_text((60, 230), "Q.2 Continued stem", fontsize=11)
        page.insert_text((340, 60), "from the left column", fontsize=11)
        page.insert_text((350, 90), "(A) second a", fontsize=11)
        page.insert_text((350, 110), "(B) second b", fontsize=11)
        page.insert_text((340, 230), "Q.3 Last stem", fontsize=11)
        page = doc.new_page(width=600, height=800)
        page.insert_text((60, 60), "from the previous page", fontsize=11)
        page.insert_text((70, 90), "(A) third a", fontsize=11)
        page.insert_text((70, 110), "(B) third b", fontsize=11)
        page.insert_text((60, 150), "Q.4 New page stem", fontsize=11)
        questions = _extract_document(doc)
    assert [q["questionNumber"] for q in questions] == [1, 2, 3, 4]
    assert [q["prompt"] for q in questions] == [
        "First stem", "Continued stem from the left column",
        "Last stem from the previous page", "New page stem",
    ]
    for question, label in zip(questions, ["first", "second", "third"]):
        assert [o["text"] for o in question["options"]] == [f"{label} a", f"{label} b"]


def test_cs1_original_q53_definition_rows_and_full_paper():
    source = Path(os.environ.get("CS1_PDF", Path(__file__).resolve().parents[2] / "CS1.pdf"))
    if not source.is_file():
        pytest.skip("Original CS1.pdf unavailable; set CS1_PDF to run this regression")
    questions = extract_pdf_bytes(
        source.read_bytes(), stem="CS1", year=2026, subject="s", topic="t",
    )["questions"]
    assert len(questions) == 65
    assert [q["questionNumber"] for q in questions] == list(range(1, 66))
    question = questions[52]
    assert question["externalId"] == "CS1-Q53"
    assert question["sourcePage"] == 41
    prompt = unicodedata.normalize("NFKC", question["prompt"])
    compact = re.sub(r"\s+", "", prompt)
    expected_left = [
        "|D→TV|D.type=T.type<br>V.type=T.type|",
        "|T→int|T.type=int|",
        "|T→float|T.type=float|",
        "|V→V1id|V1.type=V.type<br>put(id.entry,V.type)|",
        "|V→id|put(id.entry,V.type)|",
    ]
    expected_right = [
        "|D→D1id|D.type=D1.type<br>put(id.entry,D1.type)|",
        "|D→Tid|D.type=T.type<br>put(id.entry,T.type)|",
        "|T→int|T.type=int|",
        "|T→float|T.type=float|",
    ]
    left_start = compact.index("|SDD1|")
    right_start = compact.index("|SDD2|")
    prose_start = compact.index("Disthestartsymbol")
    left, right = compact[left_start:right_start], compact[right_start:prose_start]
    for rows, table in [(expected_left, left), (expected_right, right)]:
        positions = [table.index(row) for row in rows]
        assert positions == sorted(positions)
        assert table.count("→") == len(rows)
    assert question["options"] == [
        {"id": "A", "text": "The languages P and Q are the same"},
        {"id": "B", "text": "SDD2 is S-attributed and contains only synthesized attributes"},
        {"id": "C", "text": "SDD1 is L-attributed and contains only inherited attributes"},
        {"id": "D", "text": "The specifications of SDD1 and SDD2 are such that the same entries get added to the symbol table"},
    ]
    assert "cache memory" not in prompt
    for other in questions[:52] + questions[53:]:
        assert "SDD1" not in other["prompt"]
        assert "SDD2" not in other["prompt"]
    for item in questions:
        text = item["prompt"] + " ".join(o["text"] for o in item["options"] or [])
        assert not re.search(r"Organi[sz]ing Institute|Page \d+ of \d+", text)

