import { PreflightMessage } from './SourcesPanel'
import { useState } from 'react'
import { ListChecks, Layers, Network, X } from 'lucide-react'
import { notebooksAPI } from '../../services/api'
import GenerationProgress from '../GenerationProgress'
import ArtifactList from './ArtifactList'

export default function StudioPanel({ notebookId, sourceIds, jobs, artifacts, progress, refresh, onJob, open, onCanvas }) {
  const [dismissed, setDismissed] = useState([])
  const [kind, setKind] = useState(null)
  const [count, setCount] = useState(10)
  const [difficulty, setDifficulty] = useState('mixed')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null)
  const [unteachable, setUnteachable] = useState([])
  const chooseKind = nextKind => {
    setKind(kind === nextKind ? null : nextKind)
    if (kind !== nextKind) setCount(nextKind === 'quiz' ? 10 : 20)
    setPending(null)
    setError('')
  }
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
    <div className="workspace-tiles">
      <button aria-label="Quiz" aria-pressed={kind === 'quiz'} onClick={() => chooseKind('quiz')}><ListChecks aria-hidden="true" /><strong>Quiz</strong><span>Multiple choice</span></button>
      <button aria-label="Flashcards" aria-pressed={kind === 'flashcards'} onClick={() => chooseKind('flashcards')}><Layers aria-hidden="true" /><strong>Flashcards</strong><span>Flip and recall</span></button>
      <button aria-label="Canvas" disabled={!sourceIds.length} onClick={() => onCanvas(sourceIds)}><Network aria-hidden="true" /><strong>Canvas</strong><span>Draw a diagram</span></button>
    </div>
    {kind && <form aria-labelledby="studio-generate-heading" className="card workspace-generate space-y-3" onSubmit={event => {
      event.preventDefault()
      generate({ source_ids: sourceIds, kind, num_questions: Number(count), difficulty: kind === 'flashcards' ? 'mixed' : difficulty, custom_prompt: '', deck_name: name, allow_unteachable: false })
    }}>
      <div className="workspace-generate-header">
        <h3 id="studio-generate-heading" className="font-bold">{kind === 'quiz' ? 'New quiz' : 'New flashcards'}</h3>
        <button type="button" aria-label="Close form" className="workspace-generate-close" onClick={() => { setKind(null); setPending(null); setError('') }}><X aria-hidden="true" /></button>
      </div>
      <p className="workspace-generate-help">{kind === 'quiz' ? 'Questions with four options, checked against your sources.' : 'A term or prompt on the front, the answer on the back.'}</p>
      <label className="block">{kind === 'quiz' ? 'Number of questions' : 'Number of cards'}<input className="input-field" type="number" min="1" max="100" required
        value={count} onChange={event => { setCount(event.target.value); setPending(null) }} /></label>
      {kind === 'quiz' && <label className="block">Difficulty<select className="input-field" value={difficulty}
        onChange={event => { setDifficulty(event.target.value); setPending(null) }}>
        {['easy', 'medium', 'hard', 'mixed'].map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>}
      <label className="block">Deck name (optional)<input className="input-field" value={name}
        onChange={event => { setName(event.target.value); setPending(null) }} /></label>
      <button className="btn-primary" disabled={busy || !sourceIds.length}>{busy ? 'Generating...' : kind === 'quiz' ? 'Generate quiz' : 'Generate flashcards'}</button>
      {!sourceIds.length && <p className="workspace-generate-help">Tick at least one source</p>}
    </form>}
    {pending && <div role="alert" className="workspace-warning mt-3">
      {unteachable.map(source => <p key={source.id}>{source.display_name}: {source.reason ? <PreflightMessage reason={source.reason} /> : `${Math.round((source.is_teachable || 0) * 100)}% teachable${source.is_transcript > 0.5 ? ", reads like a transcript" : ""}`}</p>)}
      <button className="btn-primary" disabled={busy || !sourceIds.length || unteachable.some(source => source.reason === 'empty')} onClick={() => generate({ ...pending, allow_unteachable: true })}>Generate anyway</button>
      <button onClick={() => { setPending(null); setUnteachable([]) }}>Cancel generation</button>
    </div>}
    {error && <p role="alert" className="workspace-error mt-3">{error}</p>}
    <div className="mt-4">
      {jobs.filter(job => !dismissed.includes(job.job_id || job.id)).map(job => <div key={job.job_id || job.id}>
        {job.status === 'failed' ? <p role="alert" className="workspace-error">{job.error_message || 'Generation failed'}</p>
          : job.status === 'completed' ? <p>Generation complete</p> : <GenerationProgress status={job} />}
        {job.warnings?.map((warning, index) => <p role="alert" className="bg-amber-50 text-amber-800 p-3 rounded-lg" key={index}>{warning}</p>)}
        {job.total_questions_flagged > 0 && <p>{job.total_questions_flagged} question(s) held back by the quality check.
          <button className="underline" onClick={() => open(job.deck_id, 'edit')}>Review them in the deck editor.</button>
        </p>}
        {job.status === 'completed' && (job.warnings?.length > 0 || job.total_questions_flagged > 0) &&
          <button onClick={() => setDismissed(current => [...current, job.job_id || job.id])}>Continue</button>}
      </div>)}
    </div>
    <ArtifactList artifacts={artifacts} progress={progress} open={open} />
  </>
}
