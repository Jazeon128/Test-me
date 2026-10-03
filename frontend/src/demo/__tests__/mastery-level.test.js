import { expect, it } from 'vitest'
import { topicMastery } from '../mastery'

const attempt = (correct = true, date = '2026-10-01T12:00:00Z', hinted = false) => ({ correct, date, hinted })
const once = [attempt()]
const twice = [attempt(), attempt(true, '2026-10-02T12:00:00Z')]

it.each([
  ['not started', [[], []], 'not_started'],
  ['half correct', [[attempt(false)], once], 'attempted'],
  ['0.70 boundary', [...Array(7).fill(once), ...Array(3).fill([attempt(false)])], 'familiar'],
  ['below 0.70', [...Array(6).fill(once), ...Array(4).fill([attempt(false)])], 'attempted'],
  ['three of five', [once, once, once, [], []], 'familiar'],
  ['one of two', [once, []], 'familiar'],
  ['four of five', [once, once, once, once, []], 'proficient'],
  ['two of two', [once, once], 'proficient'],
  ['same day twice', Array(4).fill([attempt(), attempt(true, '2026-10-01T20:00:00Z')]), 'proficient'],
  ['different days twice', [...Array(4).fill(twice), []], 'mastered'],
  ['one question only once', [...Array(3).fill(twice), once], 'proficient'],
  ['same UTC day across offsets', [[attempt(true, '2026-10-02T00:30:00+02:00'), attempt(true, '2026-10-01T23:30:00Z')]], 'proficient'],
  ['different UTC days', [[attempt(true, '2026-10-01T23:30:00Z'), attempt(true, '2026-10-02T00:30:00Z')]], 'mastered'],
  ['sort by date', [[attempt(false, '2026-10-02T12:00:00Z'), attempt()]], 'attempted'],
  ['latest hinted correct', [...Array(3).fill(twice), [attempt(), attempt(true, '2026-10-02T12:00:00Z', true)]], 'familiar'],
  ['previous hinted correct', [...Array(3).fill(twice), [attempt(true, undefined, true), attempt(true, '2026-10-02T12:00:00Z')]], 'proficient'],
])('%s yields %s', (_name, histories, level) => {
  const result = topicMastery(histories)
  expect(result.level).toBe(level)
  expect(result.attempted_count).toBe(histories.filter(history => history.length).length)
})

it('excludes hinted latest answers from correct_count', () => {
  expect(topicMastery([once, [attempt(true, undefined, true)]])).toEqual({
    attempted_count: 2, correct_count: 1, level: 'attempted',
  })
})
