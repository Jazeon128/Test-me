import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import PassageText from '../PassageText'
import { formatPassage } from '../../utils/passage'

const table = '| Activity | Claimed average retention |\n|:---|---:|\n| Lecture | 5% |\n| Discussion | 50% |'

it('renders table headers and cells between prose paragraphs', () => {
  const { container } = render(<PassageText text={`The chart claims:\n${table}\nThese are claims.`} />)
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Activity' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Claimed average retention' })).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: 'Discussion' })).toBeInTheDocument()
  expect(screen.getByRole('cell', { name: '50%' })).toBeInTheDocument()
  expect(container.querySelectorAll('p')).toHaveLength(2)
})

it.each(['A source passage\nwith whitespace.', 'fragment at the beginning\n\nAnother line',
  '| Activity | Retention |\n| Lecture | 5% |'])('preserves existing formatting for non-table text %s', text => {
  const { container } = render(<PassageText text={text} />)
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(container.querySelectorAll('p')).toHaveLength(1)
  expect(container.querySelector('p').textContent).toBe(formatPassage(text))
})
