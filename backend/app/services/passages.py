"""Split parser sections into bounded passages with section-local offsets."""


def _chunks(text):
    start = 0
    while start < len(text):
        end = min(start + 1500, len(text))
        if end < len(text):
            whitespace = [i for i in range(end - 300, end) if text[i].isspace()]
            if whitespace:
                end = whitespace[-1]
        raw = text[start:end]
        stripped = raw.strip()
        if stripped:
            char_start = start + len(raw) - len(raw.lstrip())
            yield stripped, char_start, char_start + len(stripped)
        if end == len(text):
            break
        start = end - 200


def split_passages(sections):
    passages = []
    for index, section in enumerate(sections):
        for text, start, end in _chunks(section.text):
            ordinal = len(passages)
            locator = f"Part {ordinal + 1}"
            if section.page is not None:
                locator = f"Page {section.page}"
            elif section.section:
                locator = f"Section: {section.section}"
            passages.append(dict(
                ordinal=ordinal, section_index=index, page=section.page,
                heading=section.section, locator=locator[:255], text=text,
                char_start=start, char_end=end,
            ))
    return passages
