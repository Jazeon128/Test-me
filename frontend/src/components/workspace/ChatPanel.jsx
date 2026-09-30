import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { notebooksAPI } from '../../services/api'
import { serverMessage } from '../../utils/serverMessage'
import ChatMessage from './ChatMessage'

const errorMessage = error => {
  const message = serverMessage(error.originalError || error) || error.message
  if (typeof message === 'string') return message
  if (Array.isArray(message)) return message.map(item => item.msg || 'Invalid chat request.').join(' ')
  return 'Chat could not be completed.'
}

export default function ChatPanel({ notebookId, sourceIds, sources }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [paging, setPaging] = useState(false)
  const [hasEarlier, setHasEarlier] = useState(false)
  const [busy, setBusy] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(null)
  const [newReply, setNewReply] = useState(false)
  const scroll = useRef(null)
  const scrolledUp = useRef(false)
  const scrollNeeded = useRef(false)
  const sending = useRef(false)
  const localId = useRef(0)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    let cancelled = false
    notebooksAPI.chatHistory(notebookId, { limit: 50 }).then(({ data }) => {
      if (cancelled) return
      setMessages(data)
      setHasEarlier(data.length === 50)
      scrollNeeded.current = true
    }).catch(err => { if (!cancelled) setError(errorMessage(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; alive.current = false }
  }, [notebookId])
  const scrollDown = () => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight
    scrolledUp.current = false
    setNewReply(false)
  }
  useLayoutEffect(() => {
    if (!scrollNeeded.current) return
    scrollNeeded.current = false
    if (scrolledUp.current) setNewReply(true)
    else scrollDown()
  }, [messages, busy])
  const earlier = async () => {
    setPaging(true)
    setError('')
    const height = scroll.current?.scrollHeight || 0
    const top = scroll.current?.scrollTop || 0
    try {
      const { data } = await notebooksAPI.chatHistory(notebookId, { limit: 50, before: messages[0].id })
      if (!alive.current) return
      setMessages(current => [...data.filter(item => !current.some(existing => existing.id === item.id)), ...current])
      setHasEarlier(data.length === 50)
      requestAnimationFrame(() => {
        if (scroll.current) scroll.current.scrollTop = top + scroll.current.scrollHeight - height
      })
    } catch (err) { if (alive.current) setError(errorMessage(err)) }
    finally { if (alive.current) setPaging(false) }
  }
  const send = async (attempt = null) => {
    if (sending.current || loading || clearing || !sourceIds.length) return
    const body = attempt?.body || { message: draft.trim(), source_ids: [...sourceIds] }
    if (!body.message || body.message.length > 2000) return
    sending.current = true
    setBusy(true)
    setError('')
    setRetry(null)
    const id = attempt?.id || `local-${++localId.current}`
    if (!attempt) setMessages(current => [...current, { id, role: 'user', content: body.message }])
    scrollNeeded.current = true
    try {
      const { data } = await notebooksAPI.chat(notebookId, body)
      if (!alive.current) return
      scrollNeeded.current = true
      setMessages(current => [...current, data])
      setDraft('')
    } catch (err) {
      if (!alive.current) return
      const response = err.originalError?.response || err.response
      if ((err.status || response?.status) === 409 && response?.data?.processing) {
        setError('Wait for these sources to finish reading')
        setMessages(current => current.filter(item => item.id !== id))
      } else {
        setError(errorMessage(err))
        setRetry({ body, id })
      }
    } finally {
      sending.current = false
      if (alive.current) setBusy(false)
    }
  }
  const clear = async () => {
    setClearing(true)
    setError('')
    try {
      await notebooksAPI.clearChat(notebookId)
      if (!alive.current) return
      setMessages([])
      setHasEarlier(false)
      setRetry(null)
      setConfirmClear(false)
      setNewReply(false)
    } catch (err) { if (alive.current) setError(errorMessage(err)) }
    finally { if (alive.current) setClearing(false) }
  }
  const ready = sources.filter(source => source.status === 'ready')
  const prompts = ready.length ? [`Summarise ${ready[0].display_name}`,
    `What are the key terms in ${ready[0].display_name}?`,
    `Quiz me on ${(ready[1] || ready[0]).display_name}`] : []
  const disabled = !sourceIds.length || busy || loading || clearing
  return <div className="chat-panel">
    <header className="chat-header">
      <h2 className="text-xl font-bold">Chat</h2>
      <button type="button" disabled={busy || loading || paging || clearing} onClick={() => setConfirmClear(true)}>Clear chat</button>
    </header>
    {confirmClear && <div className="chat-confirm">
      <p>Clear this notebook&apos;s chat? This cannot be undone.</p>
      <button type="button" disabled={busy || loading || paging || clearing} onClick={clear}>Clear</button>
      <button type="button" disabled={clearing} onClick={() => setConfirmClear(false)}>Cancel</button>
    </div>}
    <div ref={scroll} className="chat-history" aria-label="Chat history" onScroll={() => {
      const element = scroll.current
      scrolledUp.current = element.scrollHeight - element.scrollTop - element.clientHeight > 200
      if (!scrolledUp.current) setNewReply(false)
    }}>
      {loading && <p role="status">Loading chat...</p>}
      {hasEarlier && <button type="button" disabled={paging || busy || clearing} onClick={earlier}>{paging ? 'Loading earlier...' : 'Load earlier'}</button>}
      {!loading && !messages.length && <div className="chat-prompts">{prompts.map(prompt =>
        <button key={prompt} type="button" disabled={disabled} onClick={() => setDraft(prompt)}>{prompt}</button>)}</div>}
      {messages.map(message => <ChatMessage key={message.id} message={message} />)}
      {busy && <div className="chat-message chat-assistant" role="status">
        <span className="chat-reading-dot" aria-hidden="true" /> Reading your sources...
      </div>}
    </div>
    {newReply && <button type="button" onClick={scrollDown}>New reply</button>}
    <form className="chat-composer" onSubmit={event => { event.preventDefault(); send() }}>
      <label htmlFor={`chat-input-${notebookId}`}>Ask about your sources</label>
      <textarea id={`chat-input-${notebookId}`} value={draft} disabled={disabled} maxLength={2000}
        aria-describedby={`chat-feedback-${notebookId}`} onChange={event => { setDraft(event.target.value); setRetry(null) }}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send() }
        }} />
      {draft.length >= 1800 && <span className="chat-note">{draft.length}/2000</span>}
      <button type="submit" disabled={disabled || !draft.trim()}>Send</button>
      <div id={`chat-feedback-${notebookId}`}>
        {!sourceIds.length && <p>Tick at least one source to chat.</p>}
        {error && <p role="alert">{error}</p>}
        {retry && <button type="button" disabled={disabled} onClick={() => send(retry)}>Retry</button>}
      </div>
    </form>
  </div>
}
