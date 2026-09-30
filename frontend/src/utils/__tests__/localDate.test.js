import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { it, expect } from 'vitest'
import { parseLocalDate } from '../localDate'
import HeatMap from '../../components/HeatMap'

it('parses Monday at local midnight in America/Barbados', () => {
  // Apply TZ before date code runs in a separate process, including on Windows.
  const helperUrl = pathToFileURL(resolve('src/utils/localDate.js')).href
  const script = `
    import { parseLocalDate } from ${JSON.stringify(helperUrl)};
    const date = parseLocalDate('2026-09-28');
    console.log(JSON.stringify([date.getDay(), date.getDate(), date.getHours(), date.getTimezoneOffset()]));
  `
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, TZ: 'America/Barbados' },
    encoding: 'utf8',
  })
  expect(JSON.parse(result)).toEqual([1, 28, 0, 240])
})

it('places Monday in the first heat-map row without padding', () => {
  expect(parseLocalDate('2026-09-28').getDay()).toBe(1)
  render(createElement(HeatMap, { days: [
    { date: '2026-09-28', questions_answered: 3, questions_correct: 2 },
  ] }))
  const cell = screen.getByTitle('2026-09-28: 3 answered, 2 correct')
  expect(cell.parentElement.children).toHaveLength(1)
  expect(cell.parentElement.firstElementChild).toBe(cell)
})
