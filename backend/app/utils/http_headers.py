from urllib.parse import quote


def content_disposition(filename: str) -> str:
    """Build an attachment header with ASCII and UTF-8 filenames."""
    fallback = "".join(
        char if char.isascii() and char not in '\\"' else "_"
        for char in filename
    )
    stem, dot, extension = fallback.rpartition(".")
    if not fallback or (dot and not stem):
        fallback = "export" + (dot + extension if dot else "")
    return f'attachment; filename="{fallback}"; filename*=UTF-8\'\'{quote(filename, safe="")}'
