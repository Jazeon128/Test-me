export function canvasTitle(raw) {
  const title = String(raw ?? '').trim()
    .replace(/^(please\s+)?(draw|show|make|create|give|build)(\s+me)?\s+/i, '')
    .replace(/[?!.]+$/, '').trim()
  return title ? title[0].toUpperCase() + title.slice(1) : 'Untitled canvas'
}
