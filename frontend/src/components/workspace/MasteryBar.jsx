import { useEffect, useId, useState } from 'react'
import { notebooksAPI } from '../../services/api'

const levels = [
  ['mastered', 'Mastered', '--mastery-mastered'],
  ['proficient', 'Proficient', '--mastery-proficient'],
  ['familiar', 'Familiar', '--mastery-familiar'],
  ['attempted', 'Attempted', '--mastery-attempted'],
  ['not_started', 'Not started', '--mastery-none'],
]

export default function MasteryBar({ notebookId, refreshSignal, practise }) {
  const [mastery, setMastery] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data } = await notebooksAPI.mastery(notebookId)
        if (active) setMastery(data)
      } catch { if (active) setMastery(null) }
    }
    load()
    return () => { active = false }
  }, [notebookId, refreshSignal])
  if (!mastery?.summary.topic_count) return null
  const { topics, summary } = mastery
  return <div className="mastery">
    <p>Mastery: {summary.proficient_or_above} of {summary.topic_count} topics Proficient or above</p>
    <div className="mastery-bar" role="img" aria-label={levels.map(([key, label]) => `${summary.levels[key]} ${label.toLowerCase()}`).join(', ')}>
      {levels.map(([key, , token]) => <span key={key} style={{ width: `${summary.levels[key] / summary.topic_count * 100}%`, background: `var(${token})` }} />)}
    </div>
    <button className="btn-secondary mastery-disclosure" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>Show topics</button>
    {expanded && <div id={listId}>
      <ul className="mastery-topics">{topics.map(topic => {
        const [, label, token] = levels.find(([key]) => key === topic.level)
        return <li key={topic.key}>
          <div className="mastery-topic-name"><span>{topic.section}</span><span className="mastery-muted">{topic.document_name}</span></div>
          <span className="mastery-chip" style={{ borderLeftColor: `var(${token})` }}>{label}</span>
          <span className="mastery-muted">{topic.attempted_count} of {topic.question_count} tried</span>
          <button className="btn-secondary" onClick={() => practise(topic.question_ids)}>Practise</button>
        </li>
      })}</ul>
      <p className="mastery-explainer">Levels follow your latest answer to each question. Proficient means all of at least 4 questions right. Mastered means right twice, on different days.</p>
    </div>}
  </div>
}
