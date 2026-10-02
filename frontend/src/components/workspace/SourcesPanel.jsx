import { useRef, useState } from 'react'
import { FileText, Youtube, Loader2, FileType, FileCode, Presentation, BookOpen, X } from 'lucide-react'
import { notebooksAPI } from '../../services/api'

export function PreflightMessage({ reason }) {
  return ({
    study_process: 'Looks like notes about your study process, not study material',
    low_teachability: 'Little to study',
    empty: 'No text could be read from this source',
  }[reason] || 'May not be worth studying')
}


export default function SourcesPanel({ notebookId, sources, selected, setSelected, refresh, onOpenSource }) {
  const [adding, setAdding] = useState(false)
  const [files, setFiles] = useState([])
  const [youtube, setYoutube] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [duplicates, setDuplicates] = useState([])
  const addButton = useRef(null)
  const formId = `add-sources-${notebookId}`
  const closeForm = () => {
    setAdding(false)
    setFiles([])
    setYoutube('')
    setError('')
    setDuplicates([])
    addButton.current?.focus()
  }
  const submit = async event => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setDuplicates([])
    const body = new FormData()
    files.forEach(file => body.append('files', file))
    if (youtube.trim()) body.append('youtube_url', youtube.trim())
    try {
      const { data } = await notebooksAPI.addSources(notebookId, body)
      await refresh()
      closeForm()
      setDuplicates(data.sources.filter(source => source.duplicate).map(source => source.display_name))
    } catch (err) {
      setError(err.message || 'Could not add sources')
    } finally { setBusy(false) }
  }
  return <>
    <div className="flex gap-3 my-3">
      <button onClick={() => setSelected(Object.fromEntries(sources.filter(s => s.status === 'ready').map(s => [s.id, true])))}>Select all</button>
      <button onClick={() => setSelected(Object.fromEntries(sources.map(s => [s.id, false])))}>Clear</button>
    </div>
    <ul className="space-y-4">
      {sources.map(source => {
        const Icon = ({ youtube: Youtube, pdf: FileText, md: BookOpen, markdown: BookOpen, html: FileCode, docx: FileType, pptx: Presentation })[source.file_type] || FileText
        return <li key={source.id} className="workspace-source">
          <div className="workspace-source-label">
            <input type="checkbox" aria-label={source.display_name} disabled={source.status !== 'ready'}
              checked={source.status === 'ready' && Boolean(selected[source.id])}
              onChange={event => setSelected(current => ({ ...current, [source.id]: event.target.checked }))} />
            <Icon size={18} aria-label={source.file_type} />
            <button type="button" className="workspace-source-name" title={source.display_name}
              aria-label={`Open ${source.display_name}`} onClick={event => onOpenSource?.(source.id, event.currentTarget)}>{source.display_name}</button>
          </div>
          {source.status === 'processing' ? <p className="workspace-badge"><Loader2 size={14} className="workspace-reading" />Reading...</p>
            : source.status === 'failed' ? <div className="workspace-error"><span className="workspace-badge">Failed</span><p className="text-sm">{source.error_message || 'Failed'}</p></div>
              : <p className="workspace-badge">Ready</p>}
          {source.status === 'ready' && source.preflight?.checked === false &&
            <p>Could not check {source.display_name} before generating</p>}
          {source.status === 'ready' && source.preflight?.worth_generating === false &&
            <p className="workspace-badge workspace-warning"><PreflightMessage reason={source.preflight.reason} /></p>}
        </li>
      })}
    </ul>
    <button ref={addButton} className="btn-secondary workspace-add-source" aria-expanded={adding}
      aria-controls={formId} onClick={() => adding ? closeForm() : setAdding(true)}>
      {adding ? <><X size={16} aria-hidden="true" />Cancel</> : 'Add source'}
    </button>
    {adding && <form id={formId} onSubmit={submit} className="space-y-3 mt-3" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeForm() }
    }}>
      <label className="block">Files<input type="file" multiple accept=".pdf,.html,.htm,.md,.docx,.pptx"
        onChange={event => setFiles(Array.from(event.target.files))} /></label>
      <label className="block">YouTube URL<input className="input-field" type="url" value={youtube}
        onChange={event => setYoutube(event.target.value)} /></label>
      <button className="btn-primary" disabled={busy || (!files.length && !youtube.trim())}>{busy ? 'Adding...' : 'Add sources'}</button>
    </form>}
    {duplicates.map((name, index) => <p key={index}>{name}: Already in this notebook</p>)}
    {error && <p role="alert" className="workspace-error">{error}</p>}
  </>
}
