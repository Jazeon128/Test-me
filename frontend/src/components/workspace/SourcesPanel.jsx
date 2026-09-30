import { useState } from 'react'
import { FileText, Youtube, Loader2 } from 'lucide-react'
import { notebooksAPI } from '../../services/api'

export default function SourcesPanel({ notebookId, sources, selected, setSelected, refresh }) {
  const [adding, setAdding] = useState(false)
  const [files, setFiles] = useState([])
  const [youtube, setYoutube] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [duplicates, setDuplicates] = useState([])
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
      setDuplicates(data.sources.filter(source => source.duplicate).map(source => source.display_name))
      await refresh()
    } catch (err) {
      setError(err.message || 'Could not add sources')
    } finally { setBusy(false) }
  }
  return <>
    <h2 className="text-xl font-bold">Sources</h2>
    <div className="flex gap-3 my-3">
      <button onClick={() => setSelected(Object.fromEntries(sources.filter(s => s.status === 'ready').map(s => [s.id, true])))}>Select all</button>
      <button onClick={() => setSelected(Object.fromEntries(sources.map(s => [s.id, false])))}>Clear</button>
    </div>
    <ul className="space-y-4">
      {sources.map(source => {
        const Icon = source.file_type === 'youtube' ? Youtube : FileText
        return <li key={source.id}>
          <label className="flex gap-2 items-start">
            <input type="checkbox" aria-label={source.display_name} disabled={source.status !== 'ready'}
              checked={source.status === 'ready' && Boolean(selected[source.id])}
              onChange={event => setSelected(current => ({ ...current, [source.id]: event.target.checked }))} />
            <Icon size={18} aria-label={source.file_type} />
            <span>{source.display_name}</span>
          </label>
          {source.status === 'processing' ? <p className="flex gap-1 text-sm"><Loader2 size={14} className="animate-spin" />Reading...</p>
            : source.status === 'failed' ? <p className="text-red-600 text-sm">{source.error_message || 'Failed'}</p>
              : <p className="text-sm">Ready</p>}
          {source.status === 'ready' && source.preflight?.worth_generating === false &&
            <p className="text-amber-700 text-sm">May not be worth studying</p>}
        </li>
      })}
    </ul>
    <button className="mt-4" onClick={() => setAdding(value => !value)}>Add source</button>
    {adding && <form onSubmit={submit} className="space-y-3 mt-3">
      <label className="block">Files<input type="file" multiple accept=".pdf,.html,.htm,.md,.docx,.pptx"
        onChange={event => setFiles(Array.from(event.target.files))} /></label>
      <label className="block">YouTube URL<input className="input-field" type="url" value={youtube}
        onChange={event => setYoutube(event.target.value)} /></label>
      <button disabled={busy || (!files.length && !youtube.trim())}>{busy ? 'Adding...' : 'Add sources'}</button>
    </form>}
    {duplicates.map((name, index) => <p key={index}>{name}: Already in this notebook</p>)}
    {error && <p role="alert" className="text-red-600">{error}</p>}
  </>
}
