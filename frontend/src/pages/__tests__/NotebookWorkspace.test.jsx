import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import NotebookWorkspace from '../NotebookWorkspace'
import { readFileSync } from 'node:fs'
import { notebooksAPI, statusAPI, documentsAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  notebooksAPI: { workspace: vi.fn(), addSources: vi.fn(), generate: vi.fn(), chatHistory: vi.fn() },
  statusAPI: { get: vi.fn() },
  documentsAPI: { get: vi.fn(), passages: vi.fn() },
}))
vi.mock('../../canvas/CanvasView', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  return { default: forwardRef(function Canvas({ sourceIds }, ref) {
    useImperativeHandle(ref, () => ({ flush: async () => true }), [])
    return <p>Canvas sources {sourceIds.join(',')}</p>
  }) }
})
vi.mock('../../components/PracticeSession' , () => ({ default: ({ deckId, onFinished, onExit, onEmpty }) =>
  <div>Practice session {deckId}<button onClick={onFinished}>Finish session</button>
    <button onClick={onExit}>Exit session</button><button onClick={onEmpty}>Empty session</button></div> }))
vi.mock('../../components/DeckEditor', () => ({ default: ({ deckId, onPractice, onDeleted, onOpenCanvas }) =>
  <div>Deck editor {deckId}<button onClick={() => onPractice(deckId)}>Editor practise</button>
    <button onClick={onDeleted}>Deleted deck</button><button onClick={() => onOpenCanvas(1)}>Editor canvas</button></div> }))

const fixture = () => ({
  notebook: { id: 7, name: 'Biology', description: 'Study cells' },
  sources: [
    { id: 1, display_name: 'Cells.pdf', file_type: 'pdf', status: 'ready' },
    { id: 2, display_name: 'Notes.md', file_type: 'md', status: 'ready' },
    { id: 3, display_name: 'Broken.pdf', file_type: 'pdf', status: 'failed', error_message: 'Unreadable file' },
  ],
  artifacts: { decks: [{ id: 9, name: 'Cell quiz', kind: 'quiz', question_count: 10, due_count: 2, held_back_count: 1 }],
    canvases: [{ id: 5, title: 'Cell diagram' }] },
  jobs: [], progress: { answered_count: 4, correct_rate: 0.75, due_count: 2 },
})
function Location() {
  const location = useLocation()
  const navigate = useNavigate()
  return <><output aria-label="Location">{location.pathname}{location.search}</output><button onClick={() => navigate(-1)}>Browser back</button></>
}
function mount(search = '') {
  return render(<MemoryRouter initialEntries={[`/notebooks/7${search}`]}><Location /><Routes>
    <Route path="/notebooks/:notebookId" element={<NotebookWorkspace />} />
    <Route path="/canvas" element={<p>Canvas page</p>} />
  </Routes></MemoryRouter>)
}
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
const loaded = () => screen.findByText('Biology')
beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  localStorage.clear()
  notebooksAPI.workspace.mockResolvedValue({ data: fixture() })
  notebooksAPI.chatHistory.mockResolvedValue({ data: [] })
  notebooksAPI.generate.mockResolvedValue({ data: { job_id: 'job-1', deck_id: 10 } })
  statusAPI.get.mockResolvedValue({ data: { status: 'processing', current_step: 'Reading sources', current_question: 1, total_questions: 10 } })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('Notebook workspace', () => {
  it('opens a canvas with all selected sources in tick order and notebook context', async () => {
    mount()
    await loaded()
    fireEvent.click(screen.getByLabelText('Cells.pdf'))
    fireEvent.click(screen.getByLabelText('Cells.pdf'))
    click('Canvas')
    expect(await screen.findByText('Canvas sources 1,2')).toBeInTheDocument()
    expect(screen.getByLabelText('Location')).toHaveTextContent('/notebooks/7?view=canvas')
  })
  it('renders sources, artifacts, progress and chat centre', async () => {
    mount(); await loaded()
    expect(notebooksAPI.workspace).toHaveBeenCalledWith('7')
    expect(screen.getByText('Study cells')).toBeInTheDocument()
    expect(screen.getByLabelText('Ask about your sources')).toBeInTheDocument()
    expect(screen.getByLabelText('Cells.pdf')).toBeChecked()
    expect(screen.getByLabelText('Notes.md')).toBeChecked()
    expect(screen.getByLabelText('Broken.pdf')).toBeDisabled()
    expect(screen.getByLabelText('Broken.pdf')).not.toBeChecked()
    expect(screen.getByText('Unreadable file')).toBeInTheDocument()
    expect(screen.getByText('Cell quiz')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Quizzes (1)' })).toBeInTheDocument()
    expect(screen.getByText('10 questions \u00b7 2 due')).toBeInTheDocument()
    expect(screen.getByText('1 held back')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Cell diagram' })).toHaveAttribute('href', '/notebooks/7?view=canvas&canvas=5')
    expect(within(screen.getByRole('region', { name: 'Notebook progress' })).getByText('4', { selector: 'dd' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Notebook progress' })).getByText('75%', { selector: 'dd' })).toBeInTheDocument()
  })
  it('posts exactly ticked ready ids and form values, and disables generation after Clear', async () => {
    mount(); await loaded()
    fireEvent.click(screen.getByLabelText('Notes.md')); click('Quiz')
    fireEvent.change(screen.getByLabelText('Number of questions'), { target: { value: '15' } })
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'hard' } })
    click('Generate quiz')
    await waitFor(() => expect(notebooksAPI.generate).toHaveBeenCalledWith('7', {
      source_ids: [1], kind: 'quiz', num_questions: 15, difficulty: 'hard', custom_prompt: '', deck_name: '',
    }))
    await screen.findByText('Reading sources')
    expect(screen.getByLabelText('Notes.md')).not.toBeChecked()
    click('Clear')
    expect(screen.getByRole('button', { name: 'Generate quiz' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Canvas' })).toBeDisabled()
    click('Select all'); expect(screen.getByLabelText('Notes.md')).toBeChecked()
  })
  it('shows processing conflicts and error envelope messages', async () => {
    notebooksAPI.generate.mockRejectedValueOnce({ status: 409, originalError: { response: { data: { processing: [1] } } } })
      .mockRejectedValueOnce({ status: 422, message: 'Question count invalid', originalError: { response: { data: { error: { message: 'Question count invalid' } } } } })
    mount(); await loaded(); click('Quiz'); click('Generate quiz')
    expect(await screen.findByRole('alert')).toHaveTextContent('Wait for these sources to finish reading')
    click('Generate quiz'); await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Question count invalid'))
  })
  it('adds files and YouTube URL as FormData, shows duplicates and inline 400', async () => {
    notebooksAPI.addSources.mockResolvedValueOnce({ data: { sources: [{ id: 1, display_name: 'Cells.pdf', duplicate: true }] } })
      .mockRejectedValueOnce({ status: 400, message: 'Bad YouTube URL' })
    mount(); await loaded(); click('Add source')
    const files = [new File(['cells'], 'cells.pdf'), new File(['notes'], 'notes.md')]
    fireEvent.change(screen.getByLabelText('Files'), { target: { files } })
    fireEvent.change(screen.getByLabelText('YouTube URL'), { target: { value: 'https://youtube.com/watch?v=abc' } })
    click('Add sources')
    expect(await screen.findByText('Cells.pdf: Already in this notebook')).toBeInTheDocument()
    const [id, body] = notebooksAPI.addSources.mock.calls[0]
    expect(id).toBe('7'); expect(body).toBeInstanceOf(FormData)
    expect(body.getAll('files')).toEqual(files)
    expect(body.get('youtube_url')).toBe('https://youtube.com/watch?v=abc')
    expect(screen.queryByLabelText('YouTube URL')).not.toBeInTheDocument()
    click('Add source')
    fireEvent.change(screen.getByLabelText('YouTube URL'), { target: { value: 'https://youtube.com/watch?v=bad' } })
    click('Add sources'); expect(await screen.findByRole('alert')).toHaveTextContent('Bad YouTube URL')
  })
  it('opens embedded practice and editing, supports back, close and reload', async () => {
    mount(); await loaded(); click('Practise')
    expect(screen.getByText('Practice session 9')).toBeInTheDocument()
    expect(screen.getByLabelText('Location')).toHaveTextContent('?deck=9&view=practice')
    click('Open'); expect(screen.getByText('Deck editor 9')).toBeInTheDocument()
    click('Browser back'); await screen.findByText('Practice session 9')
    click('Close'); await loaded()
    expect(screen.getByLabelText('Location')).not.toHaveTextContent('?deck=')
    expect(notebooksAPI.workspace.mock.calls.length).toBeGreaterThan(1)
    click('Open'); click('Editor practise'); click('Finish session'); await loaded()
  })
  it('loads a deck from URL and closes on deletion', async () => {
    mount('?deck=9&view=edit')
    await screen.findByText('Deck editor 9'); click('Deleted deck'); await loaded()
    expect(notebooksAPI.workspace).toHaveBeenCalledTimes(2)
  })
  it('opens canvas from the remaining ticked source', async () => {
    mount(); await loaded(); fireEvent.click(screen.getByLabelText('Cells.pdf')); click('Canvas')
    expect(await screen.findByText('Canvas sources 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Location')).toHaveTextContent('/notebooks/7?view=canvas')
  })
  it('collapses to rails with persisted aria-expanded state', async () => {
    const rendered = mount(); await loaded(); click('Collapse sources'); click('Collapse studio')
    expect(screen.getByRole('button', { name: 'Expand sources' })).toHaveAttribute('aria-expanded', 'false')
    expect(within(screen.getByLabelText('Sources')).getAllByRole('button')).toHaveLength(1)
    expect(screen.getByLabelText('Sources')).toHaveClass('workspace-rail')
    expect(JSON.parse(localStorage.getItem('testme.workspace.collapsed'))).toEqual({ sources: true, studio: true })
    rendered.unmount(); mount(); await loaded()
    expect(screen.getByRole('button', { name: 'Expand studio' })).toHaveAttribute('aria-expanded', 'false')
    click('Expand sources'); expect(screen.getByRole('button', { name: 'Collapse sources' })).toHaveAttribute('aria-expanded', 'true')
    click('Expand studio'); expect(screen.getByText('Cell quiz')).toBeInTheDocument()
  })
  it('survives unavailable localStorage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('blocked') })
    mount(); await loaded(); click('Collapse sources'); click('Expand sources')
    expect(screen.getByLabelText('Cells.pdf')).toBeChecked()
  })
  it('polls processing sources, ticks newly ready sources and then stops', async () => {
    vi.useFakeTimers()
    const data = fixture(); data.sources[0].status = 'processing'
    notebooksAPI.workspace.mockResolvedValueOnce({ data }).mockResolvedValue({ data: fixture() })
    mount(); await act(async () => {})
    expect(screen.getByText('Reading...')).toBeInTheDocument()
    expect(screen.getByLabelText('Cells.pdf')).not.toBeChecked()
    fireEvent.click(screen.getByLabelText('Notes.md'))
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(notebooksAPI.workspace).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('Cells.pdf')).toBeChecked()
    expect(screen.getByLabelText('Notes.md')).not.toBeChecked()
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(notebooksAPI.workspace).toHaveBeenCalledTimes(2)
  })
  it('keeps job progress mounted across polls and refreshes artifacts on completion', async () => {
    vi.useFakeTimers()
    const data = fixture(); data.jobs = [{ job_id: 'job-1', status: 'processing', current_step: 'Reading sources', total_questions: 10 }]
    notebooksAPI.workspace.mockResolvedValue({ data })
    const rendered = mount(); await act(async () => {})
    const spinner = rendered.container.querySelector('.generation-spinner')
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(rendered.container.querySelector('.generation-spinner')).toBe(spinner)
    statusAPI.get.mockResolvedValue({ data: { status: 'completed' } })
    const completed = fixture(); completed.artifacts.decks.push({ id: 10, name: 'New flashcards', kind: 'flashcards', question_count: 10 })
    notebooksAPI.workspace.mockResolvedValue({ data: completed })
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(screen.getByText('New flashcards')).toBeInTheDocument()
    expect(rendered.container.querySelector('.generation-spinner')).toBeNull()
    const calls = notebooksAPI.workspace.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(notebooksAPI.workspace).toHaveBeenCalledTimes(calls)
  })
  it('stops polling once generation fails', async () => {
    vi.useFakeTimers()
    const data = fixture()
    data.jobs = [{ job_id: 'failed-job', status: 'processing', current_step: 'Reading' }]
    notebooksAPI.workspace.mockResolvedValue({ data })
    statusAPI.get.mockResolvedValue({ data: { status: 'failed', error_message: 'No provider' } })
    mount()
    await act(async () => {})
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(screen.getByRole('alert')).toHaveTextContent('No provider')
    const callsAfterFailure = statusAPI.get.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(statusAPI.get).toHaveBeenCalledTimes(callsAfterFailure)
  })
  it('retains completed warnings and held-back results after polling stops', async () => {
    vi.useFakeTimers()
    const data = fixture()
    data.jobs = [{ job_id: 'held-job', status: 'processing', current_step: 'Reading' }]
    notebooksAPI.workspace.mockResolvedValueOnce({ data }).mockResolvedValue({ data: fixture() })
    statusAPI.get.mockResolvedValue({ data: { status: 'completed', deck_id: 9,
      warnings: ['Some sections failed.'], total_questions_flagged: 1 } })
    mount()
    await act(async () => {})
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(screen.getByRole('alert')).toHaveTextContent('Some sections failed.')
    expect(screen.getByText(/1 question\(s\) held back by the quality check/)).toBeInTheDocument()
    const calls = statusAPI.get.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(statusAPI.get).toHaveBeenCalledTimes(calls)
    expect(screen.getByRole('alert')).toHaveTextContent('Some sections failed.')
    click('Continue')
    expect(screen.queryByText('Some sections failed.')).not.toBeInTheDocument()
    expect(screen.queryByText(/held back by the quality check/)).not.toBeInTheDocument()
  })

  it('shows failed job messages and no-answer progress', async () => {
    const data = fixture(); data.progress.answered_count = 0
    data.jobs = [{ job_id: 'failed', status: 'failed', error_message: 'Generation exhausted' }]
    notebooksAPI.workspace.mockResolvedValue({ data }); mount(); await loaded()
    expect(screen.getByRole('alert')).toHaveTextContent('Generation exhausted')
    expect(within(screen.getByRole('region', { name: 'Notebook progress' })).getByText('–', { selector: 'dd' })).toBeInTheDocument()
  })
})


describe('Workspace accessibility', () => {
  it('names landmarks and moves focus for both collapse controls', async () => {
    mount(); await loaded()
    expect(screen.getByRole('complementary', { name: 'Sources' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Chat' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Studio' })).toBeInTheDocument()
    for (const side of ['sources', 'studio']) {
      click(`Collapse ${side}`)
      expect(screen.getByRole('button', { name: `Expand ${side}` })).toHaveFocus()
      click(`Expand ${side}`)
      expect(screen.getByRole('button', { name: `Collapse ${side}` })).toHaveFocus()
    }
  })
  it('focuses each deck header and returns to its opening button', async () => {
    mount(); await loaded()
    for (const [button, title] of [['Practise', 'Practising Cell quiz'], ['Open', 'Editing Cell quiz']]) {
      const opener = screen.getByRole('button', { name: button })
      fireEvent.click(opener)
      expect(screen.getByRole('heading', { name: title }).parentElement).toHaveFocus()
      expect(screen.getByRole('region', { name: title })).toBeInTheDocument()
      await act(async () => click('Close'))
      expect(opener).toHaveFocus()
    }
  })
  it('focuses a deck opened through URL parameters', async () => {
    mount('?deck=9&view=edit'); await screen.findByText('Editing Cell quiz')
    expect(screen.getByRole('heading', { name: 'Editing Cell quiz' }).parentElement).toHaveFocus()
    await act(async () => click('Close'))
    expect(screen.getByLabelText('Ask about your sources')).toHaveFocus()
  })
  it('uses drawers regardless of stored collapse state, traps focus and returns it on both close paths', async () => {
    window.matchMedia.mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    localStorage.setItem('testme.workspace.collapsed', JSON.stringify({ sources: true, studio: true }))
    mount(); await loaded()
    expect(screen.queryByRole('button', { name: 'Expand sources' })).not.toBeInTheDocument()
    for (const side of ['Sources', 'Studio']) {
      const trigger = screen.getByRole('button', { name: new RegExp(`^${side} `) })
      trigger.focus(); fireEvent.click(trigger)
      const dialog = screen.getByRole('dialog', { name: side })
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
      const close = within(dialog).getByRole('button', { name: `Close ${side.toLowerCase()}` })
      expect(close).toHaveFocus()
      const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')]
      fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
      expect(controls.at(-1)).toHaveFocus()
      fireEvent.keyDown(document.activeElement, { key: 'Tab' })
      expect(close).toHaveFocus()
      fireEvent.keyDown(close, { key: 'Escape' })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() => expect(trigger).toHaveFocus())
      fireEvent.click(trigger)
      fireEvent.click(screen.getByRole('dialog').parentElement)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() => expect(trigger).toHaveFocus())
    }
    expect(JSON.parse(localStorage.getItem('testme.workspace.collapsed'))).toEqual({ sources: true, studio: true })
  })
  it('closes a drawer with its Close button and falls back to chat after a mobile deck closes', async () => {
    window.matchMedia.mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    mount(); await loaded()
    const sources = screen.getByRole('button', { name: 'Sources 3' })
    sources.focus(); fireEvent.click(sources)
    click('Close sources')
    await waitFor(() => expect(sources).toHaveFocus())
    const studio = screen.getByRole('button', { name: 'Studio 2' })
    studio.focus(); fireEvent.click(studio)
    expect(screen.queryByRole('dialog', { name: 'Sources' })).not.toBeInTheDocument()
    click('Practise')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Practising Cell quiz' }).parentElement).toHaveFocus()
    await act(async () => click('Close'))
    expect(screen.getByLabelText('Ask about your sources')).toHaveFocus()
  })
  it('responds to media changes and removes its listener', async () => {
    let listener
    const media = { matches: true, addEventListener: vi.fn((event, callback) => { listener = callback }), removeEventListener: vi.fn() }
    window.matchMedia.mockReturnValue(media)
    const rendered = mount(); await loaded()
    act(() => { media.matches = false; listener() })
    const trigger = screen.getByRole('button', { name: 'Sources 3' })
    trigger.focus(); fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Sources' })).toBeInTheDocument()
    act(() => { media.matches = true; listener() })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collapse sources' })).toBeInTheDocument()
    rendered.unmount()
    expect(media.removeEventListener).toHaveBeenCalledWith('change', listener)
  })
  it('works without matchMedia and disables workspace motion through its media rule', async () => {
    window.matchMedia.mockRestore()
    const original = window.matchMedia
    window.matchMedia = undefined
    try { mount(); await loaded(); expect(screen.getByRole('button', { name: 'Collapse sources' })).toBeInTheDocument() }
    finally { window.matchMedia = original }
    const css = readFileSync('src/index.css', 'utf8')
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.notebook-workspace/)
    expect(css).toContain('animation: none !important; transition: none !important;')
  })
})

describe('Consistent panel counts', () => {
  it.each([true, false])('counts all sources and artifacts with desktop=%s', async desktop => {
    window.matchMedia.mockReturnValue({ matches: desktop, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    const data = fixture()
    data.sources = [data.sources[0], data.sources[2]]
    data.artifacts.decks = Array.from({ length: 4 }, (_, index) => ({ ...data.artifacts.decks[0], id: index + 9, name: `Deck ${index}` }))
    notebooksAPI.workspace.mockResolvedValue({ data })
    mount(); await loaded()
    const assertPanel = (side, count) => {
      const panel = screen.getByRole('complementary', { name: side })
      expect(panel.querySelector('.workspace-count')).toHaveTextContent(String(count))
      expect(within(panel).queryByText('1 running')).not.toBeInTheDocument()
    }
    if (desktop) { assertPanel('Sources', 2); assertPanel('Studio', 5) }
    else {
      expect(screen.getByRole('button', { name: 'Sources 2' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Studio 5' })).toBeInTheDocument()
      expect(screen.queryByText('1 running')).not.toBeInTheDocument()
      click('Sources 2'); assertPanel('Sources', 2); click('Close sources')
      click('Studio 5'); assertPanel('Studio', 5)
    }
  })
  it.each([true, false])('separates running jobs with desktop=%s', async desktop => {
    window.matchMedia.mockReturnValue({ matches: desktop, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    const data = fixture()
    data.jobs = [{ job_id: 'job-1', status: 'processing', current_step: 'Reading', total_questions: 10 }]
    notebooksAPI.workspace.mockResolvedValue({ data })
    mount(); await loaded()
    const label = screen.getByText('1 running')
    expect(label.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(label.querySelector('svg')).toHaveClass('animate-spin')
    if (desktop) expect(screen.getByRole('complementary', { name: 'Studio' }).querySelector('.workspace-count')).toHaveTextContent('2')
    else expect(screen.getByRole('button', { name: 'Studio 2 1 running' })).toBeInTheDocument()
  })
})

it('opens a source, groups passages and restores the previous editing view', async () => {
  documentsAPI.get.mockResolvedValue({ data: { file_type: 'pdf', num_pages: 8, status: 'ready' } })
  documentsAPI.passages.mockResolvedValue({ data: { document_id: 1, passages: [
    { ordinal: 1, heading: 'Cells', page: 2, text: 'ol, custom dependencies' },
    { ordinal: 2, heading: 'Cells', page: 3, text: 'Second passage.' },
    { ordinal: 3, heading: 'Membranes', page: 4, text: 'Third passage.' },
  ] } })
  mount('?deck=9&view=edit')
  await screen.findByText('Deck editor 9')
  const button = screen.getByRole('button', { name: 'Open Cells.pdf' })
  expect(button).toHaveAttribute('title', 'Cells.pdf')
  click('Open Cells.pdf')
  expect(screen.getByLabelText('Location')).toHaveTextContent('?view=source&source=1')
  expect(screen.getByRole('heading', { name: 'Source: Cells.pdf' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Source: Cells.pdf' }).parentElement).toHaveFocus()
  expect(await screen.findByText('pdf · 8 pages · 3 passages')).toBeInTheDocument()
  const group = screen.getByRole('region', { name: 'Cells' })
  expect(within(group).getByRole('heading', { name: 'Cells' })).toBeInTheDocument()
  expect(within(group).getAllByRole('article')).toHaveLength(2)
  expect(within(group).getByText('Page 2')).toBeInTheDocument()
  expect(within(group).getByText('… custom dependencies…')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Membranes' })).toBeInTheDocument()
  expect(documentsAPI.passages).toHaveBeenCalledWith('1')
  click('Close')
  expect(await screen.findByText('Deck editor 9')).toBeInTheDocument()
  expect(screen.getByLabelText('Location')).toHaveTextContent('?deck=9&view=edit')
})

it('closes a source back to chat and returns focus to its name', async () => {
  mount()
  await loaded()
  click('Open Broken.pdf')
  expect(screen.getByRole('heading', { name: 'Source: Broken.pdf' })).toBeInTheDocument()
  expect(within(screen.getByLabelText('Source: Broken.pdf')).getByRole('alert')).toHaveTextContent('Unreadable file')
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(documentsAPI.passages).not.toHaveBeenCalled()
  click('Close')
  expect(screen.getByLabelText('Ask about your sources')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Open Broken.pdf' })).toHaveFocus()
})

it('shows processing sources without passages', async () => {
  const data = fixture()
  data.sources[0].status = 'processing'
  notebooksAPI.workspace.mockResolvedValue({ data })
  mount()
  await loaded()
  click('Open Cells.pdf')
  expect(screen.getByText('Still reading this source.')).toBeInTheDocument()
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(documentsAPI.passages).not.toHaveBeenCalled()
})
