import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import Notebooks from '../../pages/Notebooks'
import TaskModelCard from '../settings/TaskModelCard'
import BankActions from '../bank/BankActions'
import CitationChip from '../workspace/CitationChip'
import PracticeSession from '../PracticeSession'
import { notebooksAPI, progressAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  default: { post: vi.fn(), delete: vi.fn() },
  notebooksAPI: { list: vi.fn(), questions: vi.fn() },
  progressAPI: { getStatsByNotebook: vi.fn(), getReviewSession: vi.fn(), submit: vi.fn() },
}))
vi.mock('../ProgressOverview', () => ({ default: () => null }))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

it('keeps an empty home card complete with singular counts', async () => {
  notebooksAPI.list.mockResolvedValue({ data: [{ id: 1, name: 'Biology', sources: 1, canvases: 1, decks: 1 }] })
  progressAPI.getStatsByNotebook.mockResolvedValue({ data: [] })
  render(<MemoryRouter><Notebooks /></MemoryRouter>)
  const card = await screen.findByRole('button', { name: /Biology/ })
  for (const text of ['1 source', '1 canvas', '1 deck', 'No description yet', 'No questions yet']) {
    expect(within(card).getByText(text)).toBeInTheDocument()
  }
  expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  fireEvent.click(screen.getByRole('button', { name: 'New notebook' }))
  expect(screen.getByLabelText('What is this notebook about?')).toHaveAttribute('placeholder', 'e.g. Organic chemistry')
})

it('styles settings actions and pushes Delete to the end', () => {
  render(<TaskModelCard task="generation" value={{ provider: 'openai', model: 'example' }}
    availableModels={[]} keyConfigured onChange={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Save Configuration' })).toHaveClass('btn-primary')
  expect(screen.getByRole('button', { name: 'Test Connection' })).toHaveClass('btn-secondary')
  expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('btn-danger')
  expect(screen.getByRole('button', { name: 'Delete' })).toHaveStyle({ marginLeft: 'auto' })
})

it('uses the primary Practise button and singular deck deletion with danger styling', async () => {
  notebooksAPI.questions.mockResolvedValue({ data: { total: 1, items: [{ id: 1, decks: [{ id: 2, name: 'Deck' }] }] } })
  render(<BankActions notebookId="1" selected={new Set([1])} decks={[]} tags={[]} desktop practise={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Practise' })).toHaveClass('btn-primary')
  expect(screen.getByRole('button', { name: 'Practise' })).not.toHaveAttribute('style')
  expect(readFileSync('src/index.css', 'utf8')).not.toContain('.question-bank .bank-action-bar .btn-primary')
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(await screen.findByText(/removes them from 1 deck\./)).toBeInTheDocument()
  expect(within(screen.getByLabelText('delete')).getByRole('button', { name: 'Delete' })).toHaveClass('btn-danger')
})

it.each([false, true])('anchors citation outside its own line, flips above: %s', above => {
  const top = above ? window.innerHeight - 30 : 100
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 50, top, bottom: top + 18, right: 70, width: 20, height: 18 })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(120)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(280)
  render(<CitationChip citation={{ n: 1, display_name: 'Source', locator: 'Section', excerpt: 'Passage' }} />)
  fireEvent.click(screen.getByRole('button', { name: /Citation 1:/ }))
  const popup = screen.getByRole('dialog')
  expect(popup).toHaveStyle({ left: '50px', top: `${above ? top - 120 - 6 : top + 18 + 6}px` })
  if (above) expect(parseFloat(popup.style.top) + 120).toBeLessThan(top)
  else expect(parseFloat(popup.style.top)).toBeGreaterThan(top + 18)
})

it('excludes radios and chips from the workspace minimum and uses 20 px radios', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const rule = css.match(/\.notebook-workspace :is\([^{}]+\{[^}]+\}/)[0]
  expect(rule).toContain(':not([type="radio"])')
  expect(rule).toContain(':not(.chat-chip)')
  expect(css).toMatch(/\.deck-option-radio[^}]*width: 20px;[^}]*height: 20px;[^}]*accent-color: var\(--accent\)/)
})

it('lets the chat box grow around its composer and bounds the history height', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const chatRules = [...css.matchAll(/\.workspace-chat\s*\{([^}]*)\}/g)]
  expect(chatRules.length).toBeGreaterThan(0)
  for (const [, declarations] of chatRules) {
    expect(declarations).not.toMatch(/(?:^|;)\s*(?:min-)?height\s*:/)
  }
  const historyRule = css.match(/\.chat-history\s*\{([^}]*)\}/)[1]
  expect(historyRule).toMatch(/(?:^|;)\s*height:\s*max\(12rem, calc\(100dvh - 480px\)\);/)
})

it.each([
  ['flashcard', true, 'Recalled', 'To review'],
  ['flashcard', false, 'Recalled', 'To review'],
  ['mcq', true, 'Correct', 'Incorrect'],
  ['mcq', false, 'Correct', 'Incorrect'],
])('shows summary tiles for %s, successful: %s', async (card_type, success, correctLabel, missedLabel) => {
  progressAPI.getReviewSession.mockResolvedValue({ data: { questions: [{ id: 1, card_type, question_text: 'Front?', explanation: 'Back.', correct_option: 'A', options: [{ option: 'A', text: 'Answer' }] }] } })
  progressAPI.submit.mockResolvedValue({ data: { correct: success, gamification: { points_earned: success ? 10 : 0, streak_bonus: 0 } } })
  render(<MemoryRouter><PracticeSession onExit={vi.fn()} onEmpty={vi.fn()} onFinished={vi.fn()} /></MemoryRouter>)
  if (card_type === 'flashcard') {
    fireEvent.click(await screen.findByRole('button', { name: 'Show answer' }))
    fireEvent.click(screen.getByRole('button', { name: success ? 'Good, key 3' : 'Again, key 1' }))
  } else {
    fireEvent.click(await screen.findByRole('button', { name: /A\. Answer/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Show Answer' }))
    fireEvent.click(screen.getByRole('button', { name: /^Good/ }))
  }
  expect(await screen.findByRole('heading', { name: 'Session complete' })).toHaveFocus()
  const value = label => within(screen.getByText(label).closest('.glass-panel')).getByText(/^\d+(?:\/\d+)?$/)
  expect(value('Progress')).toHaveTextContent('1/1')
  expect(value('Streak')).toHaveTextContent(success ? '1' : '0')
  expect(value(correctLabel)).toHaveTextContent(success ? '1' : '0')
  expect(value(missedLabel)).toHaveTextContent(success ? '0' : '1')
  if (card_type === 'flashcard') expect(screen.queryByText('Points')).not.toBeInTheDocument()
  else expect(value('Points')).toHaveTextContent(success ? '10' : '0')
  expect(screen.getByText(success ? 'Nice work.' : 'Missed items come back sooner in Review.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Finish' })).toHaveClass('btn-primary')
})

it('excludes shared button classes from bank appearance and sizing rules', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const rules = [...css.matchAll(/\.question-bank button([^{}]*)\{([^}]*)\}/g)]
  expect(rules).toHaveLength(2)
  for (const [, selector] of rules) {
    for (const buttonClass of ['btn-primary', 'btn-secondary', 'btn-danger']) {
      expect(selector).toContain(`:not(.${buttonClass})`)
    }
  }
  expect(rules[0][2]).toContain('padding: 10px 12px')
  expect(rules[0][2]).toContain('border-radius: 8px')
  expect(rules[1][2]).toContain('background: var(--field)')
})
