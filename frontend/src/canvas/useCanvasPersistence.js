import { useEffect, useMemo, useState } from 'react'
import { canvasAPI } from '../services/api'

// Each canvas owns its queue, including after navigation unmounts the page.
export default function useCanvasPersistence(canvasId) {
  const [status, setStatus] = useState('Saved')
  const queue = useMemo(() => {
    let pending = null
    let running = null
    let timer = null
    const notify = value => {
      if (state.active) setStatus(value)
    }
    const state = { active: true, dirty: () => Boolean(pending || running) }
    const flush = () => {
      clearTimeout(timer)
      if (running) return running
      if (!pending) return Promise.resolve(true)
      const payload = pending
      pending = null
      notify('Saving...')
      running = canvasAPI
        .update(canvasId, payload)
        .then(() => {
          running = null
          if (pending) return flush()
          notify('Saved')
          return true
        })
        .catch(() => {
          clearTimeout(timer)
          running = null
          pending = pending || payload
          notify('Save failed')
          return false
        })
      return running
    }
    state.flush = flush
    state.save = payload => {
      pending = payload
      notify('Saving...')
      clearTimeout(timer)
      timer = setTimeout(flush, 800)
    }
    return state
  }, [canvasId])

  useEffect(() => {
    queue.active = true
    setStatus('Saved')
    const warn = event => {
      if (queue.dirty()) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      queue.active = false
      window.removeEventListener('beforeunload', warn)
      queue.flush()
    }
  }, [queue])

  return { status, save: queue.save, flush: queue.flush, retry: queue.flush }
}
