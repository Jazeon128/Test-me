export function displayIcon(icon) {
  return icon && [...icon].some((character) => character.codePointAt(0) > 127) ? icon : '📘'
}
