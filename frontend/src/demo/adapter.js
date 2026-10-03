import { AxiosError } from 'axios'
import fixture from '../../demo/fixture.json'
import { DEMO_NOTICE } from './notice'
import { createProgress } from './progress'

const copy = value => JSON.parse(JSON.stringify(value))
const key = path => `GET ${path}`

export function createDemoAdapter(snapshot, { delay = () => 150 + Math.random() * 150 } = {}) {
  const routes = copy(snapshot.routes)
  const questions = Object.entries(routes).filter(([path]) => /^GET \/questions\/\d+$/.test(path))
    .map(([, question]) => question)
  const progress = createProgress(routes, questions)
  let replayId = 0
  const bank = (path, params) => {
    const recorded = routes[key(path)]
    if (!recorded) return null
    let items = copy(recorded.items).map(item => progress.bankItem(item))
    const search = (params.search || params.q || '').toLowerCase()
    if (search) items = items.filter(item => [item.question_text, item.explanation,
      ...(item.options || []).map(option => option.text)].some(text => text?.toLowerCase().includes(search)))
    for (const field of ['difficulty', 'card_type', 'status']) {
      if (params[field]) items = items.filter(item => item[field] === params[field])
    }
    if (params.source_id) items = items.filter(item => String(item.source?.id) === String(params.source_id))
    for (const [field, list] of [['deck_id', 'decks'], ['tag_id', 'tags']]) {
      if (params[field]) items = items.filter(item => item[list]?.some(value => String(value.id) === String(params[field])))
    }
    const limit = Math.max(1, Math.min(50, Number(params.limit || params.page_size) || 50))
    const offset = Math.max(0, Number(params.offset) || ((Number(params.page) || 1) - 1) * limit)
    return { total: items.length, offset, limit, items: items.slice(offset, offset + limit) }
  }
  const session = selected => ({ num_questions: selected.length, questions: selected.map(question => ({
    id: question.id, question_text: question.question_text, card_type: question.card_type,
    source_reference: question.source_reference, difficulty: question.difficulty,
    explanation: question.explanation,
    options: question.options.map((option, index) => ({ option: option.option || String.fromCharCode(65 + index), text: option.text })),
    correct_option: question.card_type === 'flashcard' ? null : question.options.find(option => option.is_correct)?.option,
  })) })
  return async config => {
    await new Promise(resolve => setTimeout(resolve, delay()))
    const url = new URL(config.url, 'https://demo.invalid')
    const path = url.pathname.replace(/^\/api(?=\/)/, '').replace(/\/$/, '') || '/'
    const params = { ...Object.fromEntries(url.searchParams), ...config.params }
    const method = (config.method || 'get').toUpperCase()
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {})
    let data, status = 200
    const recordedKey = Object.hasOwn(routes, key(path)) ? key(path) : key(`${path}/`)
    const notebookBank = path.match(/^\/notebooks\/(\d+)\/questions$/)
    if (/\/export(?:\/|$)/.test(path) || (method !== 'GET' && path.startsWith('/settings'))) {
      status = 403; data = { detail: DEMO_NOTICE }
    } else if (method === 'GET') {
      if (notebookBank) data = bank(path, params)
      else if (/^\/notebooks\/\d+\/mastery$/.test(path)) data = Object.hasOwn(routes, recordedKey) ? copy(routes[recordedKey]) : {
        topics: [], summary: { topic_count: 0, proficient_or_above: 0,
          levels: { not_started: 0, attempted: 0, familiar: 0, proficient: 0, mastered: 0 } },
      }
      else if (path === '/progress/stats') data = progress.stats()
      else if (path === '/progress/stats/by-notebook') data = progress.byNotebook()
      else if (/^\/progress\/question\/\d+$/.test(path)) data = questions.some(item => item.id === Number(path.split('/').pop())) ? progress.question(Number(path.split('/').pop())) : null
      else data = Object.hasOwn(routes, recordedKey) ? copy(routes[recordedKey]) : null
      if (data && /\/workspace$/.test(path)) progress.workspace(data)
      if (data === null || data === undefined) { status = 404; data = { detail: 'Not part of the demo.' } }
    } else if (method === 'POST' && path === '/progress/submit') {
      if (body.written_answer != null || body.explain) { status = 403; data = { detail: DEMO_NOTICE } }
      else ({ status, data } = progress.submit(body))
    } else if (method === 'POST' && path === '/progress/review-session') {
      let selected = questions.filter(question => !body.deck_id || routes[key(`/decks/${body.deck_id}`)]?.questions.some(item => item.id === question.id))
      selected = selected.filter(question => progress.eligible(question.id, body))
      data = session(selected.slice(0, body.num_questions ?? 10))
      data.questions.forEach(item => { item.notebooks = snapshot.notebook ? [snapshot.notebook] : [] })
    } else if (method === 'POST' && /^\/notebooks\/\d+\/questions\/practice$/.test(path)) {
      const allowed = routes[key(path.replace('/practice', ''))]?.items || []
      const ids = body.question_ids || []
      const selected = ids.map(id => questions.find(question => question.id === id && allowed.some(item => item.id === id)))
      if (selected.some(item => !item)) { status = 400; data = { detail: 'Items outside this notebook.' } }
      else data = session(selected)
    } else if (method === 'PATCH' && /^\/canvas\/\d+$/.test(path) && routes[recordedKey]) {
      const canvas = routes[recordedKey]
      for (const field of ['layout', 'edited', 'title']) {
        if (Object.hasOwn(body, field)) canvas[field] = copy(body[field])
      }
      canvas.has_edits = canvas.edited != null
      for (const [route, value] of Object.entries(routes)) {
        if (/^GET \/canvas\/(?:$|document\/)/.test(route) && Array.isArray(value)) {
          value.filter(item => item.id === canvas.id).forEach(item => Object.assign(item, { title: canvas.title, edited: canvas.edited, layout: canvas.layout, has_edits: canvas.has_edits }))
        }
        for (const list of [value?.canvases, value?.artifacts?.canvases]) {
          list?.filter(item => item.id === canvas.id).forEach(item => { item.title = canvas.title })
        }
      }
      data = copy(canvas)
    } else if (method === 'POST' && /^\/notebooks\/\d+\/chat$/.test(path)) {
      const history = routes[recordedKey] || []
      const index = history.findIndex(item => item.role === 'user' && item.content === body.message)
      if (index >= 0 && history[index + 1]?.role === 'assistant') {
        data = copy(history[index + 1])
        data.id = Math.max(...history.map(item => Number(item.id) || 0)) + ++replayId
      }
      else { status = 403; data = { detail: DEMO_NOTICE } }
    } else { status = 403; data = { detail: DEMO_NOTICE } }
    const response = { data: copy(data), status, statusText: status === 200 ? 'OK' : 'Demo request rejected', headers: {}, config, request: {} }
    if (status >= 400) throw new AxiosError(data.detail, AxiosError.ERR_BAD_REQUEST, config, {}, response)
    return response
  }
}

export default createDemoAdapter(fixture)
