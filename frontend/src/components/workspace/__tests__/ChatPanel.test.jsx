import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ChatPanel from '../ChatPanel'
import NotebookWorkspace from '../../../pages/NotebookWorkspace'
import { notebooksAPI } from '../../../services/api'

vi.mock('../../../services/api', () => ({
  notebooksAPI: { chat: vi.fn(), chatHistory: vi.fn(), clearChat: vi.fn(), workspace: vi.fn() },
  statusAPI: { get: vi.fn() },
}))
vi.mock('../../PracticeSession', () => ({ default: () => <p>Practice session</p> }))
vi.mock('../../DeckEditor', () => ({ default: () => <p>Deck editor</p> }))

const sources = [
  { id: 1, status: 'ready', display_name: 'Cells.pdf' },
  { id: 2, status: 'ready', display_name: 'Notes.md' },
  { id: 3, status: 'processing', display_name: 'Reading.pdf' },
]
const citation = { n: 1, display_name: 'Cells.pdf', locator: 'Page 4', excerpt: 'Cells have membranes.', removed: false }
const answer = (extra = {}) => ({ id: 2, role: 'assistant', content: 'Cells have membranes [1].', citations: [citation], ...extra })
const input = () => screen.getByLabelText('Ask about your sources')
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
const fill = value => fireEvent.change(input(), { target: { value } })
async function mount(props = {}) {
  const rendered = render(<ChatPanel notebookId="7" sourceIds={[1, 2]} sources={sources} {...props} />)
  await waitFor(() => expect(screen.queryByText('Loading chat...')).not.toBeInTheDocument())
  return rendered
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  localStorage.clear()
  notebooksAPI.chatHistory.mockResolvedValue({ data: [] })
  notebooksAPI.chat.mockResolvedValue({ data: answer() })
  notebooksAPI.clearChat.mockResolvedValue({ data: null })
})

describe('Chat panel', () => {
  it('loads history with accessible citation chips and opens the exact passage', async () => {
    notebooksAPI.chatHistory.mockResolvedValue({ data: [{ id: 1, role: 'user', content: 'Explain cells' }, answer()] })
    await mount()
    expect(notebooksAPI.chatHistory).toHaveBeenCalledWith('7', { limit: 50 })
    expect(screen.getByText('Explain cells', { selector: 'p' })).toBeInTheDocument()
    const chip = screen.getByRole('button', { name: 'Citation 1: Cells.pdf, Page 4' })
    fireEvent.click(chip)
    const popover = screen.getByRole('dialog', { name: 'Citation 1' })
    expect(within(popover).getByText('Cells.pdf')).toBeInTheDocument()
    expect(within(popover).getByText('Page 4')).toBeInTheDocument()
    expect(within(popover).getByText('Cells have membranes.')).toBeInTheDocument()
    expect(within(popover).getByRole('button', { name: 'Close citation' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(chip).toHaveFocus()
    fireEvent.click(chip); click('Close citation')
    expect(chip).toHaveFocus()
  })
  it('fills the input from each example using ready source names', async () => {
    await mount()
    for (const prompt of ['Summarise Cells.pdf', 'What are the key terms in Cells.pdf?', 'Quiz me on Notes.md']) {
      click(prompt); expect(input()).toHaveValue(prompt)
    }
    expect(screen.queryByText('Quiz me on Reading.pdf')).not.toBeInTheDocument()
  })
  it('uses the first source as the quiz fallback', async () => {
    await mount({ sources: [sources[0], sources[2]] })
    click('Quiz me on Cells.pdf'); expect(input()).toHaveValue('Quiz me on Cells.pdf')
  })
  it('sends on Enter with current ticked ids but allows Shift+Enter', async () => {
    const rendered = await mount()
    fill('Explain cells')
    fireEvent.keyDown(input(), { key: 'Enter', shiftKey: true })
    expect(notebooksAPI.chat).not.toHaveBeenCalled()
    rendered.rerender(<ChatPanel notebookId="7" sourceIds={[2]} sources={sources} />)
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(notebooksAPI.chat).toHaveBeenCalledWith('7', { message: 'Explain cells', source_ids: [2] })
    await screen.findByRole('button', { name: 'Citation 1: Cells.pdf, Page 4' })
    expect(input()).toHaveValue('')
  })
  it('disables input and sending without ticked ready sources', async () => {
    await mount({ sourceIds: [] })
    expect(input()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByText('Tick at least one source to chat.')).toBeInTheDocument()
  })
  it('shows an immediate user turn and pending indicator followed by the reply', async () => {
    let resolve
    notebooksAPI.chat.mockReturnValue(new Promise(done => { resolve = done }))
    await mount(); fill('Explain cells'); click('Send')
    expect(screen.getByText('Explain cells', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Reading your sources...')
    expect(input()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(notebooksAPI.chat).toHaveBeenCalledTimes(1)
    await act(async () => resolve({ data: answer() }))
    expect(screen.queryByText('Reading your sources...')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Citation 1: Cells.pdf, Page 4' })).toBeInTheDocument()
  })
  it('shows removed citation information with a grey chip', async () => {
    notebooksAPI.chatHistory.mockResolvedValue({ data: [answer({ citations: [{ ...citation, removed: true, display_name: 'Removed source' }] })] })
    await mount()
    const chip = screen.getByRole('button', { name: 'Citation 1: Removed source, Page 4' })
    expect(chip).toHaveClass('chat-chip-removed')
    fireEvent.click(chip)
    expect(screen.getByText('This source was removed from the notebook.')).toBeInTheDocument()
    expect(screen.queryByText('Cells have membranes.')).not.toBeInTheDocument()
  })
  it('renders refusals muted and uncited notes without exposing invalid citations', async () => {
    notebooksAPI.chatHistory.mockResolvedValue({ data: [answer({ refused: true, uncited: true,
      content: 'I could not find that in the selected sources.', citations: [], invalid_citations: ['private-invalid'] })] })
    await mount()
    expect(screen.getByRole('article')).toHaveClass('chat-refused')
    expect(screen.getByText('No citations. Check this answer against your sources.')).toBeInTheDocument()
    expect(screen.queryByText('private-invalid')).not.toBeInTheDocument()
  })
  it('renders grouped markers as two chips, paragraphs and simple lists, and treats HTML as text', async () => {
    notebooksAPI.chatHistory.mockResolvedValue({ data: [answer({ content: '<script>alert("unsafe")</script> [1, 3]\n\n- First\n- Second\n\n1. Third\n2. Fourth',
      citations: [citation, { ...citation, n: 3, display_name: 'Notes.md' }] })] })
    const rendered = await mount()
    expect(screen.getByRole('button', { name: 'Citation 1: Cells.pdf, Page 4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Citation 3: Notes.md, Page 4' })).toBeInTheDocument()
    expect(screen.getByText('<script>alert("unsafe")</script>', { exact: false })).toBeInTheDocument()
    expect(rendered.container.querySelector('script')).toBeNull()
    expect(screen.getAllByRole('list')).toHaveLength(2)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })
  it('keeps the draft on a wrapped 409 processing error', async () => {
    notebooksAPI.chat.mockRejectedValue({ status: 409, originalError: { response: { data: { processing: [1] } } } })
    await mount(); fill('  Explain cells  '); click('Send')
    expect(await screen.findByRole('alert')).toHaveTextContent('Wait for these sources to finish reading')
    expect(input()).toHaveValue('  Explain cells  ')
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })
  it('keeps a saved user turn after 502 and retries the same body without duplicating it', async () => {
    notebooksAPI.chat.mockRejectedValueOnce({ status: 502, originalError: { response: { data: { detail: 'Provider unavailable' } } } })
    const rendered = await mount(); fill('Explain cells'); click('Send')
    expect(await screen.findByRole('alert')).toHaveTextContent('Provider unavailable')
    expect(screen.getByText('Explain cells', { selector: 'p' })).toBeInTheDocument()
    rendered.rerender(<ChatPanel notebookId="7" sourceIds={[2]} sources={sources} />)
    click('Retry')
    await screen.findByRole('button', { name: 'Citation 1: Cells.pdf, Page 4' })
    expect(notebooksAPI.chat).toHaveBeenCalledTimes(2)
    expect(notebooksAPI.chat.mock.calls[1]).toEqual(notebooksAPI.chat.mock.calls[0])
    expect(screen.getAllByText('Explain cells')).toHaveLength(1)
  })
  it('shows other server errors with Retry', async () => {
    notebooksAPI.chat.mockRejectedValue({ response: { status: 400, data: { error: { message: 'Foreign source' } } } })
    await mount(); fill('Explain'); click('Send')
    expect(await screen.findByRole('alert')).toHaveTextContent('Foreign source')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
  it('keeps numbered text in user turns and shows validation error messages', async () => {
    notebooksAPI.chat.mockRejectedValue({ response: { status: 422, data: { detail: [{ msg: 'Message too long' }] } } })
    await mount(); fill('Explain [1]'); click('Send')
    expect(await screen.findByRole('alert')).toHaveTextContent('Message too long')
    expect(screen.getByRole('article', { name: 'You message' })).toHaveTextContent('Explain [1]')
  })
  it('confirms inline, supports Cancel, and clears only after confirmation', async () => {
    notebooksAPI.chatHistory.mockResolvedValue({ data: [answer()] })
    await mount(); click('Clear chat')
    expect(screen.getByText("Clear this notebook's chat? This cannot be undone.")).toBeInTheDocument()
    expect(notebooksAPI.clearChat).not.toHaveBeenCalled()
    click('Cancel')
    expect(screen.queryByText("Clear this notebook's chat? This cannot be undone.")).not.toBeInTheDocument()
    expect(screen.getByRole('article')).toBeInTheDocument()
    click('Clear chat'); click('Clear')
    await waitFor(() => expect(screen.queryByRole('article')).not.toBeInTheDocument())
    expect(notebooksAPI.clearChat).toHaveBeenCalledWith('7')
  })
  it('loads earlier messages using the oldest id and prepends them', async () => {
    notebooksAPI.chatHistory.mockResolvedValueOnce({ data: Array.from({ length: 50 }, (_, i) => ({ id: i + 51, role: 'user', content: `Turn ${i + 51}` })) })
      .mockResolvedValueOnce({ data: [{ id: 50, role: 'user', content: 'Earlier turn' }] })
    await mount(); click('Load earlier')
    await screen.findByText('Earlier turn')
    expect(notebooksAPI.chatHistory).toHaveBeenLastCalledWith('7', { limit: 50, before: 51 })
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Earlier turn')
    expect(screen.queryByRole('button', { name: 'Load earlier' })).not.toBeInTheDocument()
  })
  it('shows a counter from 1800 characters and limits the input to 2000', async () => {
    await mount(); fill('a'.repeat(1799))
    expect(screen.queryByText('1799/2000')).not.toBeInTheDocument()
    fill('a'.repeat(1800)); expect(screen.getByText('1800/2000')).toBeInTheDocument()
    expect(input()).toHaveAttribute('maxlength', '2000')
  })
  it('preserves scroll position when more than 200 pixels up and offers New reply', async () => {
    let resolve
    notebooksAPI.chat.mockReturnValue(new Promise(done => { resolve = done }))
    await mount()
    const history = screen.getByLabelText('Chat history')
    Object.defineProperties(history, { scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 300 } })
    history.scrollTop = 100; fireEvent.scroll(history)
    fill('Explain cells'); click('Send')
    await act(async () => resolve({ data: answer() }))
    expect(history.scrollTop).toBe(100)
    click('New reply'); expect(history.scrollTop).toBe(1000)
    expect(screen.queryByRole('button', { name: 'New reply' })).not.toBeInTheDocument()
  })
  it('scrolls to the latest question when already near the bottom', async () => {
    await mount()
    const history = screen.getByLabelText('Chat history')
    Object.defineProperties(history, { scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 300 } })
    history.scrollTop = 550; fireEvent.scroll(history)
    fill('Explain cells'); click('Send')
    Object.defineProperty(screen.getByRole('article', { name: 'You message' }), 'offsetTop', { value: 420 })
    await screen.findByRole('button', { name: 'Citation 1: Cells.pdf, Page 4' })
    expect(history.scrollTop).toBe(412)
  })
  it('keeps messages and draft after opening and closing practice and editing in the workspace', async () => {
    notebooksAPI.workspace.mockResolvedValue({ data: {
      notebook: { name: 'Biology' }, sources: sources.slice(0, 2), jobs: [], progress: { answered_count: 0 },
      artifacts: { decks: [{ id: 9, name: 'Cell quiz', kind: 'quiz', question_count: 2 }], canvases: [] },
    } })
    notebooksAPI.chatHistory.mockResolvedValue({ data: [answer()] })
    render(<MemoryRouter initialEntries={['/notebooks/7']}><Routes>
      <Route path="/notebooks/:notebookId" element={<NotebookWorkspace />} />
    </Routes></MemoryRouter>)
    await screen.findByRole('button', { name: 'Citation 1: Cells.pdf, Page 4' })
    fill('Keep this draft')
    for (const [button, view] of [['Practise', 'Practice session'], ['Open', 'Deck editor']]) {
      click(button); expect(screen.getByText(view)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Citation 1: Cells.pdf, Page 4' })).not.toBeInTheDocument()
      await act(async () => click('Close'))
      expect(screen.getByRole('button', { name: 'Citation 1: Cells.pdf, Page 4' })).toBeInTheDocument()
      expect(input()).toHaveValue('Keep this draft')
    }
    expect(notebooksAPI.chatHistory).toHaveBeenCalledTimes(1)
  })
})

it('opens history at the latest user message with an 8 pixel gap', async () => {
  const offset = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function () {
    return this.classList.contains('chat-user') && this.textContent === 'Latest question' ? 420 : 120
  })
  try {
    notebooksAPI.chatHistory.mockResolvedValue({ data: [
      { id: 1, role: 'user', content: 'Older question' }, answer(),
      { id: 3, role: 'user', content: 'Latest question' }, answer({ id: 4 }),
    ] })
    await mount()
    expect(screen.getByLabelText('Chat history').scrollTop).toBe(412)
  } finally { offset.mockRestore() }
})
it('positions a new reply at its question when the user has not scrolled up', async () => {
  const offset = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(320)
  try {
    await mount()
    fill('New question'); click('Send')
    await screen.findByRole('button', { name: 'Citation 1: Cells.pdf, Page 4' })
    expect(screen.getByLabelText('Chat history').scrollTop).toBe(312)
  } finally { offset.mockRestore() }
})
it('uses the bottom when history contains no user message', async () => {
  const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(600)
  try {
    notebooksAPI.chatHistory.mockResolvedValue({ data: [answer()] })
    await mount()
    expect(screen.getByLabelText('Chat history').scrollTop).toBe(600)
  } finally { height.mockRestore() }
})
