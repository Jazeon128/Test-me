import { measureText, nodeText, wrapLines } from './text'

export function innerBox(node) {
  if (node.kind === 'ellipse') return { w: node.w * 0.70, h: node.h * 0.70 }
  if (node.kind === 'diamond') return { w: node.w * 0.50, h: node.h * 0.50 }
  if (node.kind === 'tier') return { w: node.topWidth * 0.80, h: node.h - 16 }
  return { w: node.w - 24, h: node.h - 24 }
}

export function fitNode(node, measure = measureText) {
  const fitted = { ...node, textSize: 16 }
  const wrap = () => wrapLines(nodeText(fitted), {
    maxWidth: innerBox(fitted).w, size: fitted.textSize, weight: 500,
  }, measure)
  if (node.kind === 'tier' || node.imported || node.keepSize) {
    fitted.lines = wrap()
    while (fitted.textSize > 11 && (fitted.lines.length * 1.3 * fitted.textSize > innerBox(fitted).h
      || fitted.lines.some(line => measure(line, fitted.textSize, 500) > innerBox(fitted).w))) {
      fitted.textSize--
      fitted.lines = wrap()
    }
  } else {
    for (const width of [180, 220, 260, 300]) {
      fitted.w = width
      fitted.lines = wrap()
      if (fitted.lines.length <= 3) break
    }
    const factor = node.kind === 'ellipse' ? 0.70 : node.kind === 'diamond' ? 0.50 : 1
    fitted.h = Math.max(62, (fitted.lines.length * 1.3 * fitted.textSize + 24) / factor)
  }
  return fitted
}
