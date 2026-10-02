import { useEffect, useState } from 'react'
import { documentsAPI } from '../../services/api'
import { formatPassage } from '../../utils/passage'

export default function SourceView({ sourceId, source }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setResult(null)
    setError('')
    if (source?.status === 'failed' || source?.status === 'processing') return
    Promise.all([documentsAPI.get(sourceId), documentsAPI.passages(sourceId)]).then(([details, passages]) => {
      if (active) setResult({ ...details.data, passages: passages.data.passages })
    }).catch(err => {
      if (active) setError(err.message || 'Could not load this source.')
    })
    return () => { active = false }
  }, [sourceId, source?.status])
  const details = result || source
  const groups = []
  for (const passage of result?.passages || []) {
    const previous = groups[groups.length - 1]
    if (previous && previous.heading === passage.heading) previous.passages.push(passage)
    else groups.push({ heading: passage.heading, passages: [passage] })
  }
  return <div className="workspace-source-view">
    {details && <p className="workspace-source-meta">{details.file_type} · {details.num_pages ?? 0} pages · {result?.passages.length ?? details.passage_count ?? 0} passages</p>}
    {details?.status === 'failed' ? <p role="alert" className="workspace-error">{details.error_message || 'Failed'}</p>
      : details?.status === 'processing' ? <p>Still reading this source.</p>
        : error ? <p role="alert" className="workspace-error">{error}</p>
          : !result ? <p role="status">Loading source...</p>
            : groups.map((group, index) => <section key={index} aria-label={group.heading || 'Source passages'}>
              {group.heading && <h2>{group.heading}</h2>}
              {group.passages.map(passage => <article key={passage.ordinal}>
                {passage.page != null && <p className="workspace-source-page">Page {passage.page}</p>}
                <p>{formatPassage(passage.text)}</p>
              </article>)}
            </section>)}
  </div>
}
