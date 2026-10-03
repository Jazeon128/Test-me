let context

export function measureText(text, size, weight) {
  if (typeof CanvasRenderingContext2D === 'undefined') return text.length * 0.55 * size
  if (context === undefined) context = document.createElement('canvas').getContext('2d')
  if (!context) return text.length * 0.55 * size
  context.font = `${weight} ${size}px Inter`
  return context.measureText(text).width
}

export function nodeText(node) {
  const value = node.value !== undefined && node.value !== null && node.value !== ''
    && (node.kind === 'tier' || node.value !== node.label) ? String(node.value) : ''
  return [value, node.label].filter(part => part !== '' && part != null).join('\n')
}

export function wrapLines(text, { maxWidth, size, weight }, measure = measureText) {
  const lines = []
  for (const paragraph of String(text).split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && measure(`${line} ${word}`, size, weight) <= maxWidth) {
        line += ` ${word}`
        continue
      }
      if (line) { lines.push(line); line = '' }
      for (const character of word) {
        if (line && measure(line + character, size, weight) > maxWidth) {
          lines.push(line)
          line = ''
        }
        line += character
      }
    }
    lines.push(line)
  }
  return lines
}
