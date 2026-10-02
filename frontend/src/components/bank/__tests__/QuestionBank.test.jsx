import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import QuestionBank from '../QuestionBank'
import NotebookWorkspace from '../../../pages/NotebookWorkspace'
import { notebooksAPI, tagsAPI } from '../../../services/api'

vi.mock('../../../services/api', () => ({
  notebooksAPI: { questions: vi.fn(), heldBack: vi.fn(), workspace: vi.fn() },
  tagsAPI: { list: vi.fn() }, statusAPI: { get: vi.fn() },
}))
vi.mock('../../workspace/SourcesPanel', () => ({ default: () => <p>Sources</p> }))
vi.mock('../../workspace/StudioPanel', () => ({ default: () => <p>Studio</p> }))
vi.mock('../../workspace/ChatPanel', () => ({ default: () => <textarea aria-label="Chat input" /> }))
vi.mock('../../DeckEditor', () => ({ default: ({ deckId }) => <p>Editor {deckId}</p> }))
const workspace = {
  notebook: { name: 'Biology' }, sources: [{ id: 2, display_name: 'Source', status: 'ready' }],
  artifacts: { decks: [{ id: 3, name: 'Deck' }], canvases: [] }, jobs: [], progress: { question_count: 51 },
}
const item = (id, card_type = 'mcq') => ({
  id, card_type, question_text: `Front ${id}`, explanation: `Back or explanation ${id}`,
  options: [{ option: 'A', text: 'Answer', is_correct: true }],
  status: 'new', decks: [{ id: 3, name: 'Deck' }], tags: [{ id: 4, name: 'Tag' }],
  source: { id: 2, name: 'Source' }, edited: true,
})
function Location() {
  const location = useLocation()
  const navigate = useNavigate()
  return <><output aria-label="URL">{location.search}</output>
    <button onClick={() => navigate(-1)}>Back history</button>
    <button onClick={() => navigate(1)}>Forward history</button></>
}
function mount({ full = false, query = '?view=questions' } = {}) {
  return render(<MemoryRouter initialEntries={[`/notebooks/7${query}`]}><Location />
    <Routes><Route path="/notebooks/:notebookId" element={full ? <NotebookWorkspace /> :
      <QuestionBank notebookId="7" workspace={workspace} open={vi.fn()} />} /></Routes>
  </MemoryRouter>)
}
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  notebooksAPI.workspace.mockResolvedValue({ data: workspace })
  notebooksAPI.questions.mockImplementation((id, params) => Promise.resolve({ data: {
    total: 51, offset: params.offset, limit: 50, items: params.offset ? [item(51)] : [item(1), item(2, 'flashcard')],
  } }))
  notebooksAPI.heldBack.mockResolvedValue({ data: [{ id: 5, question_text: 'Held stem', reasons: ['Review'], deck: { id: 3, name: 'Deck' }, source: null }] })
  tagsAPI.list.mockResolvedValue({ data: [{ id: 4, name: 'Tag', shared: true }] })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('Notebook question bank', () => {
  it('opens and closes from workspace and restores button focus', async () => {
    mount({ full: true, query: '' })
    const button = await screen.findByRole('button', { name: 'Questions (51)' })
    fireEvent.click(button)
    await screen.findByRole('list', { name: 'Questions in Biology' })
    expect(screen.getByLabelText('URL')).toHaveTextContent('view=questions')
    expect(screen.getByRole('heading', { name: 'Questions' }).closest('header')).toHaveFocus()
    click('Close')
    await waitFor(() => expect(button).toHaveFocus())
    expect(screen.getByLabelText('URL')).not.toHaveTextContent('view=questions')
  })
  it('supports a deep link and close focus, and opens first deck for editing', async () => {
    mount({ full: true })
    await screen.findByText('Front 1')
    fireEvent.click(screen.getByRole('button', { name: /Front 1/ }))
    click('Open in deck')
    await screen.findByText('Editor 3')
    expect(screen.getByLabelText('URL')).toHaveTextContent('view=edit')
    expect(screen.getByLabelText('URL')).toHaveTextContent('deck=3')
    click('Close')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Questions (51)' })).toHaveFocus())
  })
  it('expands MCQ and flashcard previews with keyboard button semantics', async () => {
    mount()
    await screen.findByText('Front 1')
    const expand = screen.getByRole('button', { name: /Front 1/ })
    expect(expand).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(expand)
    expect(expand).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('A. Answer')).toBeInTheDocument()
    expect(screen.getByText('(Correct)')).toBeInTheDocument()
    expect(screen.getByText('Edited')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Practise' })).toBeDisabled()
    fireEvent.click(expand)
    fireEvent.click(screen.getByRole('button', { name: /Front 2/ }))
    expect(screen.getByText('Back')).toBeInTheDocument()
    expect(screen.getByText('Back or explanation 2')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Answer options' })).not.toBeInTheDocument()
  })
  it('stores every filter in URL, clears filters, and restores on history navigation', async () => {
    mount()
    await screen.findByText('Front 1')
    await screen.findByRole('option', { name: 'Tag (shared)' })
    const filters = [['Deck', '3', 'deck_id'], ['Source', '2', 'source_id'], ['Tag', '4', 'tag_id'],
      ['Type', 'flashcard', 'card_type'], ['Difficulty', 'hard', 'difficulty'], ['Status', 'due', 'status']]
    for (const [label, value, key] of filters) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
      await waitFor(() => expect(screen.getByLabelText('URL')).toHaveTextContent(`${key}=${value}`))
    }
    await waitFor(() => expect(notebooksAPI.questions).toHaveBeenLastCalledWith('7', expect.objectContaining({
      deck_id: '3', source_id: '2', tag_id: '4', card_type: 'flashcard', difficulty: 'hard', status: 'due',
    })))
    click('Clear filters')
    expect(screen.getByLabelText('URL')).toHaveTextContent('?view=questions')
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
    click('Back history')
    await waitFor(() => expect(screen.getByLabelText('Status')).toHaveValue('due'))
    click('Forward history')
    await waitFor(() => expect(screen.getByLabelText('Status')).toHaveValue(''))
  })
  it('debounces search by 250 ms and loads search from a refreshed URL', async () => {
    mount({ query: '?view=questions&q=existing&deck_id=3' })
    await screen.findByText('Front 1')
    expect(screen.getByLabelText('Search')).toHaveValue('existing')
    vi.useFakeTimers()
    screen.getByLabelText('Search').focus()
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'back' } })
    await act(async () => { vi.advanceTimersByTime(249) })
    expect(screen.getByLabelText('URL')).toHaveTextContent('q=existing')
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(screen.getByLabelText('URL')).toHaveTextContent('q=back')
    expect(screen.getByLabelText('Search')).toHaveFocus()
    expect(notebooksAPI.questions).toHaveBeenLastCalledWith('7', expect.objectContaining({ search: 'back', deck_id: '3' }))
  })
  it('keeps selection across pages, selects and deselects a page, and clears selection', async () => {
    mount()
    await screen.findByText('Front 1')
    fireEvent.click(screen.getByLabelText('Select Front 1'))
    expect(screen.getByText('1 selected')).toBeInTheDocument()
    click('Next')
    await screen.findByText('Front 51')
    expect(screen.getByText('Showing 51 to 51 of 51')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Select this page'))
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    expect(screen.getByLabelText('Select Front 51')).toBeChecked()
    click('Previous')
    await screen.findByText('Front 1')
    expect(screen.getByLabelText('Select Front 1')).toBeChecked()
    expect(screen.getByLabelText('Select Front 2')).not.toBeChecked()
    fireEvent.click(screen.getByLabelText('Select this page'))
    expect(screen.getByText('3 selected')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Select this page'))
    expect(screen.getByText('1 selected')).toBeInTheDocument()
    click('Clear selection')
    expect(screen.getByText('0 selected')).toBeInTheDocument()
  })
  it.each([['', 'Nothing yet. Generate a quiz or flashcards from the Studio.'], ['&q=missing', 'No items match these filters.']])('shows empty state %s', async (query, message) => {
    notebooksAPI.questions.mockResolvedValue({ data: { items: [], total: 0, offset: 0, limit: 50 } })
    mount({ query: `?view=questions${query}` })
    await screen.findByText(message)
    if (query) expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
    expect(screen.getByLabelText('Select this page')).toBeDisabled()
  })
  it('shows held back reasons with an editor link and no selection', async () => {
    mount({ full: true })
    const tab = await screen.findByRole('tab', { name: 'Held back (1)' })
    fireEvent.click(tab)
    await screen.findByText('Held stem')
    expect(screen.getByText('Review')).toBeInTheDocument()
    expect(screen.queryByLabelText('Select this page')).not.toBeInTheDocument()
    click('Open in deck: Deck')
    await screen.findByText('Editor 3')
  })
  it('uses mobile cards and a Filters disclosure below 768 px', async () => {
    window.matchMedia.mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    mount()
    await screen.findByText('Front 1')
    expect(within(screen.getByRole('list', { name: 'Questions in Biology' })).getAllByRole('listitem')[0]).toHaveClass('bank-card')
    const details = screen.getByText('Filters').closest('details')
    expect(details).not.toHaveAttribute('open')
    fireEvent.click(screen.getByText('Filters'))
    expect(details).toHaveAttribute('open')
    const css = readFileSync('src/index.css', 'utf8')
    expect(css).toContain('@media (max-width: 767px)')
    expect(css).toContain('.bank-card { border: 1px solid var(--line)')
  })
})

it('closes all bank URL keys and reopens unfiltered', async () => {
  mount({ full: true, query: '?view=questions&q=front&deck_id=3&source_id=2&tag_id=4&card_type=mcq&difficulty=easy&status=new&offset=50&bank_tab=held-back&keep=yes' })
  await screen.findByText('Held stem')
  click('Close')
  expect(screen.getByLabelText('URL').textContent).toBe('?keep=yes')
  click('Questions (51)')
  await screen.findByText('Front 1')
  expect(screen.getByLabelText('Search')).toHaveValue('')
  for (const label of ['Deck', 'Source', 'Tag', 'Type', 'Difficulty', 'Status']) {
    expect(screen.getByRole('combobox', { name: label, exact: true })).toHaveValue('')
  }
  expect(screen.getByLabelText('URL').textContent).toBe('?keep=yes&view=questions')
})

it('keeps the notebook page heading outside the slim deck header', async () => {
  mount({ full: true, query: '' })
  const title = await screen.findByRole('heading', { name: 'Biology', level: 1 })
  expect(title.closest('.workspace-deck-header')).toBeNull()
  expect(title.parentElement).toHaveClass('workspace-title-row')
  expect(screen.getByRole('button', { name: 'Questions (51)' })).toHaveClass('workspace-questions-button')
})

it('names filters, expansion and page selection and uses the requested option wording', async () => {
  mount()
  await screen.findByText('Front 1')
  const filters = [
    ['Deck', 'All decks'], ['Source', 'All sources'], ['Tag', 'All tags'],
    ['Type', 'All types'], ['Difficulty', 'Any difficulty'], ['Status', 'Any status'],
  ]
  for (const [label, placeholder] of filters) {
    const select = screen.getByRole('combobox', { name: label, exact: true })
    expect(within(select).getByRole('option', { name: placeholder })).toHaveValue('')
  }
  for (const [label, values] of [['Difficulty', ['Easy', 'Medium', 'Hard']], ['Status', ['Due', 'New', 'Learning', 'Mastered']]]) {
    const select = screen.getByRole('combobox', { name: label, exact: true })
    for (const value of values) {
      expect(within(select).getByRole('option', { name: value, exact: true })).toHaveValue(value.toLowerCase())
    }
  }
  expect(screen.getByRole('checkbox', { name: 'Select this page', exact: true })).toBeInTheDocument()
  const expand = screen.getByRole('button', { name: 'Show details: Front 1', exact: true })
  expect(expand).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getAllByText('New', { selector: '.bank-status' })).toHaveLength(2)
  fireEvent.click(expand)
  const correct = screen.getByText('(Correct)').closest('li')
  expect(correct).toHaveClass('bank-option-correct')
  expect(correct.querySelector('svg.lucide-check')).toHaveAttribute('aria-hidden', 'true')
})
