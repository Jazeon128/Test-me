import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import NotebookWorkspace from '../NotebookWorkspace'
import { notebooksAPI, statusAPI } from '../../services/api'

vi.mock('../../services/api', () => ({
  notebooksAPI: { workspace: vi.fn(), addSources: vi.fn(), generate: vi.fn(), chatHistory: vi.fn() },
  statusAPI: { get: vi.fn() },
}))
vi.mock('../../components/PracticeSession', () => ({ default: ({ deckId, onFinished, onExit, onEmpty }) =>
  <div>Practice session {deckId}<button onClick={onFinished}>Finish session</button>
    <button onClick={onExit}>Exit session</button><button onClick={onEmpty}>Empty session</button></div> }))
vi.mock('../../components/DeckEditor', () => ({ default: ({ deckId, onPractice, onDeleted, onOpenCanvas }) =>
  <div>Deck editor {deckId}<button onClick={() => onPractice(deckId)}>Editor practise</button>
    <button onClick={onDeleted}>Deleted deck</button><button onClick={() => onOpenCanvas(1)}>Editor canvas</button></div> }))

const fixture = () => ({
  notebook: { id: 7, name: 'Biology', description: 'Study cells' },
  sources: [
    { id: 1, display_name: 'Cells.pdf', file_type: 'pdf', status: 'ready' },
    { id: 2, display_name: 'Notes.md', file_type: 'md', status: 'ready', preflight: { worth_generating: false } },
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
  localStorage.clear()
  notebooksAPI.workspace.mockResolvedValue({ data: fixture() })
  notebooksAPI.chatHistory.mockResolvedValue({ data: [] })
  notebooksAPI.generate.mockResolvedValue({ data: { job_id: 'job-1', deck_id: 10 } })
  statusAPI.get.mockResolvedValue({ data: { status: 'processing', current_step: 'Reading sources', current_question: 1, total_questions: 10 } })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('Notebook workspace', () => {
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
    expect(screen.getByText('May not be worth studying')).toBeInTheDocument()
    expect(screen.getByText('Cell quiz')).toBeInTheDocument()
    expect(screen.getByText('Quiz', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('10 questions')).toBeInTheDocument()
    expect(screen.getByText('1 held back')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cell diagram' })).toHaveAttribute('href', '/canvas/5')
    expect(screen.getByText('4 answered')).toBeInTheDocument()
    expect(screen.getByText('75% correct')).toBeInTheDocument()
  })
  it('posts exactly ticked ready ids and form values, and disables generation after Clear', async () => {
    mount(); await loaded()
    fireEvent.click(screen.getByLabelText('Notes.md')); click('Quiz')
    fireEvent.change(screen.getByLabelText('Number of questions'), { target: { value: '15' } })
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'hard' } })
    click('Generate')
    await waitFor(() => expect(notebooksAPI.generate).toHaveBeenCalledWith('7', {
      source_ids: [1], kind: 'quiz', num_questions: 15, difficulty: 'hard', custom_prompt: '', deck_name: '', allow_unteachable: false,
    }))
    await screen.findByText('Reading sources')
    expect(screen.getByLabelText('Notes.md')).not.toBeChecked()
    click('Clear')
    expect(screen.getByRole('button', { name: 'Tick at least one source' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Canvas' })).toBeDisabled()
    click('Select all'); expect(screen.getByLabelText('Notes.md')).toBeChecked()
  })
  it('reads wrapped 409 unteachable body and resends with explicit consent', async () => {
    notebooksAPI.generate.mockRejectedValueOnce({ status: 409, message: 'Low teachability', originalError: { response: {
      status: 409, data: { detail: 'Low teachability', unteachable: [{ id: 2, display_name: 'Notes.md', is_teachable: 0.2 }] },
    } } })
    mount(); await loaded(); click('Flashcards'); click('Generate')
    expect(await screen.findByText('Notes.md: 0.2')).toBeInTheDocument()
    click('Generate anyway')
    await waitFor(() => expect(notebooksAPI.generate).toHaveBeenCalledTimes(2))
    expect(notebooksAPI.generate.mock.calls[1][1]).toEqual({ ...notebooksAPI.generate.mock.calls[0][1], allow_unteachable: true })
    expect(notebooksAPI.generate.mock.calls[1][1].kind).toBe('flashcards')
  })
  it('shows processing conflicts and error envelope messages', async () => {
    notebooksAPI.generate.mockRejectedValueOnce({ status: 409, originalError: { response: { data: { processing: [1] } } } })
      .mockRejectedValueOnce({ status: 422, message: 'Question count invalid', originalError: { response: { data: { error: { message: 'Question count invalid' } } } } })
    mount(); await loaded(); click('Quiz'); click('Generate')
    expect(await screen.findByRole('alert')).toHaveTextContent('Wait for these sources to finish reading')
    click('Generate'); await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Question count invalid'))
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
  it('opens canvas from the first ticked source and from the editor', async () => {
    mount(); await loaded(); fireEvent.click(screen.getByLabelText('Cells.pdf')); click('Canvas')
    expect(screen.getByLabelText('Location')).toHaveTextContent('/canvas?document=2')
  })
  it('collapses to rails with persisted aria-expanded state', async () => {
    const rendered = mount(); await loaded(); click('Collapse sources'); click('Collapse studio')
    expect(screen.getByRole('button', { name: 'Expand sources' })).toHaveAttribute('aria-expanded', 'false')
    expect(within(screen.getByLabelText('Sources panel')).getAllByRole('button')).toHaveLength(1)
    expect(screen.getByLabelText('Sources panel')).toHaveClass('workspace-rail')
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
  it('shows failed job messages and no-answer progress', async () => {
    const data = fixture(); data.progress.answered_count = 0
    data.jobs = [{ job_id: 'failed', status: 'failed', error_message: 'Generation exhausted' }]
    notebooksAPI.workspace.mockResolvedValue({ data }); mount(); await loaded()
    expect(screen.getByRole('alert')).toHaveTextContent('Generation exhausted')
    expect(screen.getByText('No answers yet')).toBeInTheDocument()
  })
})
