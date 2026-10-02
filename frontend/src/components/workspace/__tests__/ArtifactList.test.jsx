import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import ArtifactList from '../ArtifactList'

const deck = (id, kind) => ({ id, kind, name: `Deck ${id}`, question_count: 10, due_count: 2, held_back_count: 1 })
function mount(artifacts, progress = { answered_count: 0, due_count: 0 }) {
  const open = vi.fn()
  const view = render(<MemoryRouter><ArtifactList artifacts={artifacts} progress={progress} open={open} /></MemoryRouter>)
  return { ...view, open }
}
it('groups decks and canvases with counts and preserves row actions and details', () => {
  const { open } = mount({ decks: [deck(1, 'quiz'), deck(2, 'flashcards'), deck(3, 'quiz')], canvases: [{ id: 4, title: 'Connections' }] })
  for (const name of ['Quizzes (2)', 'Flashcards (1)', 'Canvases (1)']) {
    expect(screen.getByRole('heading', { level: 3, name })).toBeInTheDocument()
  }
  const quizzes = screen.getByRole('heading', { name: 'Quizzes (2)' }).parentElement
  expect(within(quizzes).getByText('Deck 1')).toBeInTheDocument()
  expect(within(quizzes).getByText('Deck 3')).toBeInTheDocument()
  expect(within(quizzes).queryByText('Deck 2')).not.toBeInTheDocument()
  expect(screen.getAllByText('10 questions · 2 due')).toHaveLength(2)
  expect(screen.getByText('10 cards \u00b7 2 due')).toBeInTheDocument()
  expect(screen.getAllByText('1 held back')).toHaveLength(3)
  expect(screen.queryByText('Quiz', { selector: 'span' })).not.toBeInTheDocument()
  expect(screen.queryByText('Flashcards', { selector: 'span' })).not.toBeInTheDocument()
  const row = screen.getByText('Deck 1').closest('li')
  const practise = within(row).getByRole('button', { name: 'Practise' })
  fireEvent.click(practise)
  expect(open).toHaveBeenLastCalledWith(1, 'practice', practise)
  const edit = within(row).getByRole('button', { name: 'Open' })
  fireEvent.click(edit)
  expect(open).toHaveBeenLastCalledWith(1, 'edit', edit)
  expect(screen.getByRole('link', { name: 'Open Connections' })).toHaveAttribute('href', '/canvas/4')
  expect(screen.getByText('Open', { selector: 'span' })).toHaveClass('sr-only')
})
it.each(['quiz', 'flashcards', 'canvas'])('hides empty groups when only %s exists', kind => {
  mount({ decks: kind === 'canvas' ? [] : [deck(1, kind)], canvases: kind === 'canvas' ? [{ id: 1, title: 'Map' }] : [] })
  const title = { quiz: 'Quizzes', flashcards: 'Flashcards', canvas: 'Canvases' }[kind]
  expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(['Notebook progress', `${title} (1)`])
  expect(screen.queryByText(/Nothing made yet/)).not.toBeInTheDocument()
})
it('shows the all-empty message and progress definition list with no correct percentage', () => {
  const { container } = mount({ decks: [], canvases: [] })
  expect(screen.getByText('Nothing made yet. Tick sources and choose Quiz, Flashcards or Canvas.')).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1)
  const progress = screen.getByRole('region', { name: 'Notebook progress' })
  expect(progress.querySelector('dl')).toBeInTheDocument()
  expect([...progress.querySelectorAll('dt')].map(term => term.textContent)).toEqual(['Answered', 'Correct', 'Due'])
  expect([...progress.querySelectorAll('dd')].map(value => value.textContent)).toEqual(['0', '–', '0'])
  expect(container.querySelector('h3').textContent).toBe('Notebook progress')
})
it('shows answered, rounded correct percentage and due above the artifact groups', () => {
  const { container } = mount({ decks: [deck(1, 'quiz')], canvases: [] }, { answered_count: 7, correct_rate: 0.714, due_count: 3 })
  expect([...container.querySelectorAll('dd')].map(value => value.textContent)).toEqual(['7', '71%', '3'])
  expect([...container.querySelectorAll('h3')].map(heading => heading.textContent)).toEqual(['Notebook progress', 'Quizzes (1)'])
})
