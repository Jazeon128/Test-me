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
