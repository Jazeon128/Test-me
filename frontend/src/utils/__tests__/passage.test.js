import { expect, it } from 'vitest'
import { formatPassage } from '../passage'

it.each([
  ['ol, custom dependencies, or GPU acceleration AWS Lambda Category Details...', '… custom dependencies, or GPU acceleration AWS Lambda Category Details...'],
  ['Exam results.............. 3 Content outline ......', 'Exam results … 3 Content outline …'],
  ['  A\n\t B    C.  ', 'A B C.'],
  ['Contents . . . . 4', 'Contents … 4…'],
  ['Start...', 'Start...'],
  ['Fragment', 'Fragment…'],
  ['', ''],
  [null, ''],
  ...['.', '!', '?', ':', ')', ']', '}', '"', "'", '”', '’'].map(end => [`End${end}`, `End${end}`]),
])('formats %s', (input, output) => expect(formatPassage(input)).toBe(output))

it('collapses the long mixed table-of-contents sample', () => {
  const text = `Table of Contents AWS Analytics ${'\u2026'.repeat(48)}\u2026.3 AWS Application Integration.....\u2026\u2026\u2026.\u2026\u2026\u2026\u2026.9 AWS Compute`
  expect(formatPassage(text)).toBe('Table of Contents AWS Analytics \u2026 3 AWS Application Integration \u2026 9 AWS Compute\u2026')
})

it.each([
  ['AWS Analytics \u2026\u2026\u2026.3 AWS Application Integration.....\u2026.9 AWS', 'AWS Analytics \u2026 3 AWS Application Integration \u2026 9 AWS\u2026'],
  ['Wait \u2026 then continue.', 'Wait \u2026 then continue.'],
  ['Wait ... then continue.', 'Wait ... then continue.'],
  ['A sentence ending...', 'A sentence ending...'],
  ['Contents . \u2026 3', 'Contents \u2026 3\u2026'],
  ['Contents \u2026 . 3', 'Contents \u2026 3\u2026'],
  ['Contents \u2026 \u2026', 'Contents \u2026'],
  ['Contents ....   ', 'Contents \u2026'],
])('formats mixed leaders and preserves sentence ellipses: %s', (input, output) => {
  expect(formatPassage(input)).toBe(output)
})
