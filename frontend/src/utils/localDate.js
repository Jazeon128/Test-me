/** Parse a YYYY-MM-DD string as a local calendar date. */
export function parseLocalDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}
