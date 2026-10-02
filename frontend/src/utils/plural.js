export function plural(n, singular, pluralForm = singular + 's') {
  return `${n} ${n === 1 ? singular : pluralForm}`
}
