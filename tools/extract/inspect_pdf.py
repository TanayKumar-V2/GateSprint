import argparse
import json
from pathlib import Path
import sys

import fitz

from extract import _sorted_text_lines, extract_pdf_bytes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf")
    parser.add_argument("--page", type=int)
    parser.add_argument("--questions", type=int, nargs="+")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    if args.questions:
        source = Path(args.pdf)
        questions = extract_pdf_bytes(
            source.read_bytes(), stem=source.stem, year=None,
            subject="Uncategorized", topic="Needs Review",
        )["questions"]
        print("QUESTION COUNT", len(questions))
        for question in questions:
            if question["questionNumber"] in args.questions:
                print(json.dumps(
                    {key: question[key] for key in ("externalId", "sourcePage", "prompt", "options")},
                    ensure_ascii=False, indent=2,
                ))
    if args.page is None:
        return
    with fitz.open(args.pdf) as doc:
        if not 1 <= args.page <= len(doc):
            parser.error(f"page must be between 1 and {len(doc)}")
        page = doc[args.page - 1]
        for table in page.find_tables().tables:
            print("TABLE", table.bbox)
            print("CELLS", table.cells)
        for y, col, text in _sorted_text_lines(page):
            print(f"y={y:.1f} col={col}: {text}")


if __name__ == "__main__":
    main()
