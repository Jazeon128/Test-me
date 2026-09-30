import { useState } from 'react'
import { notebooksAPI } from '../../services/api'
import GenerationProgress from '../GenerationProgress'
import ArtifactList from './ArtifactList'

export default function StudioPanel({ notebookId, sourceIds, jobs, artifacts, progress, refresh, onJob, open, onCanvas }) {
  const [kind, setKind] = useState(null)
  const [count, setCount] = useState(10)
  const [difficulty, setDifficulty] = useState('mixed')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null)
  const [unteachable, setUnteachable] = useState([])
  const generate = async body => {
    setBusy(true)
    setError('')
    setPending(null)
    setUnteachable([])
    try {
      const { data } = await notebooksAPI.generate(notebookId, body)
      onJob({ job_id: data.job_id, status: 'pending', kind: body.kind, total_questions: body.num_questions })
      await refresh()
    } catch (err) {
      const response = err.originalError?.response || err.response
      const data = response?.data
      if ((err.status || response?.status) === 409 && data?.unteachable) {
        setPending(body)
        setUnteachable(data.unteachable)
      } else if ((err.status || response?.status) === 409 && data?.processing) {
        setError('Wait for these sources to finish reading')
      } else setError(err.message || data?.error?.message || 'Generation failed')
    } finally { setBusy(false) }
  }
  return <>
    <h2 className="text-xl font-bold">Studio</h2>
    <div className="flex flex-wrap gap-3 my-3">
      <button onClick={() => { setKind('quiz'); setPending(null); setError('') }}>Quiz</button>
      <button onClick={() => { setKind('flashcards'); setPending(null); setError('') }}>Flashcards</button>
      <button disabled={!sourceIds.length} onClick={() => onCanvas(sourceIds[0])}>Canvas</button>
    </div>
    {kind && <form className="space-y-3" onSubmit={event => {
      event.preventDefault()
      generate({ source_ids: sourceIds, kind, num_questions: Number(count), difficulty, custom_prompt: '', deck_name: name, allow_unteachable: false })
    }}>
      <label className="block">Number of questions<input className="input-field" type="number" min="1" max="100" required
        value={count} onChange={event => { setCount(event.target.value); setPending(null) }} /></label>
      <label className="block">Difficulty<select className="input-field" value={difficulty}
        onChange={event => { setDifficulty(event.target.value); setPending(null) }}>
        {['easy', 'medium', 'hard', 'mixed'].map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      <label className="block">Deck name (optional)<input className="input-field" value={name}
        onChange={event => { setName(event.target.value); setPending(null) }} /></label>
      <button disabled={busy || !sourceIds.length}>{!sourceIds.length ? 'Tick at least one source' : busy ? 'Generating...' : 'Generate'}</button>
    </form>}
    {pending && <div role="alert" className="text-amber-700 mt-3">
      {unteachable.map(source => <p key={source.id}>{source.display_name}: {source.is_teachable}</p>)}
      <button disabled={busy || !sourceIds.length} onClick={() => generate({ ...pending, allow_unteachable: true })}>Generate anyway</button>
    </div>}
    {error && <p role="alert" className="text-red-600 mt-3">{error}</p>}
    <div className="mt-4">
      {jobs.map(job => <div key={job.job_id || job.id}>
        {job.status === 'failed' ? <p role="alert" className="text-red-600">{job.error_message || 'Generation failed'}</p>
          : <GenerationProgress status={job} />}
        {job.warnings?.map((warning, index) => <p key={index}>{warning}</p>)}
      </div>)}
    </div>
    <ArtifactList artifacts={artifacts} progress={progress} open={open} />
  </>
}
