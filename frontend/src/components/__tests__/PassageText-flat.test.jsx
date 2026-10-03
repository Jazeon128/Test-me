import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import PassageText from '../PassageText'
import { formatPassage } from '../../utils/passage'

const flat = '| Activity | Claimed average retention | |---|---| | Lecture | 5% | | Reading | 10% | | Audio-visual | 20% | | Demonstration | 30% | | Discussion | 50% | | Practice by doing | 75% | | Teaching others | 90% |'

it('renders the exact flattened real passage as two columns and seven body rows', () => {
  render(<PassageText text={flat} />)
  const table = screen.getByRole('table')
  expect(within(table).getAllByRole('columnheader').map(cell => cell.textContent))
    .toEqual(['Activity', 'Claimed average retention'])
  const rows = within(table).getAllByRole('row')
  expect(rows).toHaveLength(8)
  expect(rows.slice(1).every(row => within(row).getAllByRole('cell').length === 2)).toBe(true)
  expect(within(rows[7]).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['Teaching others', '90%'])
})

it('renders surrounding text as paragraphs and accepts colon separators', () => {
  const { container } = render(<PassageText text='The chart claims: | Activity | Retention | |:---|---:| | Lecture | 5% | These are claims.' />)
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect([...container.querySelectorAll('p')].map(p => p.textContent)).toEqual(['The chart claims:', 'These are claims.'])
})

it.each([
  '| A | B | |---|---| | One | Two | Extra |',
  '| A | B | |---|---| | One |',
  '| A | B | |---|---| One | Two |',
  '| A | B | |---|---| | One | Two | | Three |',
  '| A | B | |---|---| | One | Two | |',
  '| A | B | |---|---| |',
  'Before: | A | B | |---|---| | One | Two | Extra | After.',
])('renders malformed flattened rows entirely as text: %s', text => {
  const { container } = render(<PassageText text={text} />)
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(container.querySelector('p').textContent).toBe(formatPassage(text))
})
