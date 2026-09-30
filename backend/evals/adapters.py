"""Application parsers plus notebook and CSV adapters."""

import csv
import json
from dataclasses import dataclass

from app.services.parsers import (
    DOCXParser, HTMLParser, MarkdownParser, PDFParser, PowerPointParser,
    ParsedSection,
)

PARSERS = {'.pdf': PDFParser, '.html': HTMLParser, '.htm': HTMLParser,
           '.md': MarkdownParser, '.markdown': MarkdownParser,
           '.docx': DOCXParser, '.pptx': PowerPointParser}
EXTENSIONS = set(PARSERS) | {'.csv', '.ipynb'}


@dataclass
class Source:
    sections: list
    kinds: list
    parser: str
    metadata: dict
    reference_items: list


def joined(value):
    return ''.join(value) if isinstance(value, list) else str(value)


def notebook(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    sections, kinds = [], []
    for index, cell in enumerate(data.get('cells', [])):
        kind = cell.get('cell_type')
        if kind not in {'markdown', 'code'}:
            continue
        text = joined(cell.get('source', ''))
        if kind == 'code':
            outputs = [joined(o.get('text', o.get('data', {}).get('text/plain', '')))
                       for o in cell.get('outputs', [])]
            text += '\n' + '\n'.join(outputs)[:1000]
        sections.append(ParsedSection(text=text, paragraph=index, section=f'Cell {index}',
                                      end_char=len(text)))
        kinds.append('code' if kind == 'code' else 'prose')
    metadata = data.get('metadata', {})
    return Source(sections, kinds, 'NotebookAdapter', {
        'language': metadata.get('kernelspec', {}).get('language'),
        'version': metadata.get('language_info', {}).get('version'),
    }, [])


def csv_source(path):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        data = list(csv.reader(stream))
    header = [column.strip().lower() for column in data[0]] if data else []
    practice_header = 'question' in header and 'answer' in header
    has_header = practice_header or header[:2] == ['front', 'back']
    data = data[1:] if has_header else data
    practice = practice_header or 'practice' in path.stem.lower()
    sections, references = [], []
    for index, row in enumerate(data):
        if not row:
            continue
        if len(row) < 2:
            raise ValueError(f'CSV row {index + 1} has fewer than two columns')
        text = f'Q: {row[0]}\nA: {row[1]}'
        if len(row) > 2:
            text += '\n' + '\n'.join(row[2:])
        if practice:
            references.append({'row': index + 1, 'columns': row, 'text': text})
        else:
            sections.append(ParsedSection(text=text, paragraph=index + 1, end_char=len(text)))
    return Source(sections, ['prose'] * len(sections), 'CSVAdapter', {}, references)


def parse(path):
    if path.suffix.lower() == '.ipynb':
        return notebook(path)
    if path.suffix.lower() == '.csv':
        return csv_source(path)
    parser = PARSERS[path.suffix.lower()]()
    document = parser.parse(str(path))
    return Source(document.sections, ['prose'] * len(document.sections),
                  type(parser).__name__, document.metadata, [])
