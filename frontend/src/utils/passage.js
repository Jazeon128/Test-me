export function formatPassage(text) {
  let display = (text || '').replace(/\s+/g, ' ').trim()
  display = display.replace(/[.…](?: *[.…])*/g, run => {
    const dots = [...run].reduce((count, character) => count + (character === '…' ? 3 : character === '.' ? 1 : 0), 0)
    return dots >= 4 ? ' … ' : run
  }).replace(/ +/g, ' ').trim()
  if (/^[a-z]/.test(display)) {
    const space = display.indexOf(' ')
    display = `…${space < 0 ? '' : display.slice(space)}`
  }
  if (display && !/[.!?:…\])}”’"']$/.test(display)) display += '…'
  return display
}
const tableRow = line => /^\|.*\|$/.test(line.trim())
const rowCells = line => line.trim().slice(1, -1).split('|').map(cell => cell.trim())

function flattenedTable(text) {
  const first = text.indexOf('|')
  const last = text.lastIndexOf('|')
  if (first < 0 || last <= first) return null
  const tokens = text.slice(first, last + 1).split('|').map(cell => cell.trim())
  tokens.shift()
  tokens.pop()
  const headerEnd = tokens.indexOf('')
  if (headerEnd < 1) return null
  const separatorEnd = tokens.indexOf('', headerEnd + 1)
  if (separatorEnd === tokens.length - 1) return null
  const end = separatorEnd < 0 ? tokens.length : separatorEnd
  const separator = tokens.slice(headerEnd + 1, end)
  const columns = separator.length
  if (columns !== headerEnd || !separator.every(cell => /^(?=.*-)[-:]+$/.test(cell))) return null
  const rows = []
  for (let index = end + 1; index < tokens.length; index += columns + 1) {
    if (index + columns > tokens.length) return null
    rows.push(tokens.slice(index, index + columns))
    if (index + columns < tokens.length && (tokens[index + columns] !== '' || index + columns + 1 === tokens.length)) return null
  }
  return [
    ...(text.slice(0, first).trim() ? [{ type: 'paragraph', text: text.slice(0, first) }] : []),
    { type: 'table', header: tokens.slice(0, headerEnd), rows },
    ...(text.slice(last + 1).trim() ? [{ type: 'paragraph', text: text.slice(last + 1) }] : []),
  ]
}

export function passageBlocks(text) {
  const lines = (text || '').split(/\r?\n/)
  const blocks = []
  let prose = []
  for (let index = 0; index < lines.length;) {
    const flattened = flattenedTable(lines[index])
    if (flattened) {
      if (prose.join('\n').trim()) blocks.push({ type: 'paragraph', text: prose.join('\n') })
      prose = []
      blocks.push(...flattened)
      index++
      continue
    }
    if (!tableRow(lines[index])) {
      prose.push(lines[index++])
      continue
    }
    const rows = []
    while (index < lines.length && tableRow(lines[index])) rows.push(lines[index++])
    const separator = rows.length >= 2 && rowCells(rows[1]).every(cell => /^:?-{3,}:?$/.test(cell))
    if (!separator) {
      prose.push(...rows)
      continue
    }
    if (prose.join('\n').trim()) blocks.push({ type: 'paragraph', text: prose.join('\n') })
    prose = []
    blocks.push({ type: 'table', header: rowCells(rows[0]), rows: rows.slice(2).map(rowCells) })
  }
  if (!blocks.length || prose.join('\n').trim()) blocks.push({ type: 'paragraph', text: prose.join('\n') })
  return blocks
}
