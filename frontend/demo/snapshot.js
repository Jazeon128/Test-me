import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const privacyPatterns = [
  /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{8,}/,
  /AIza[0-9A-Za-z_-]{10,}/,
  /api_key/i,
  /[A-Za-z]:\\/,
]
const containsSensitiveData = value => privacyPatterns.some(pattern => pattern.test(value))

export function checkPrivacy(value, path = '$') {
  if (typeof value === 'string' && containsSensitiveData(value)) {
    throw new Error(`Snapshot privacy check failed at ${path}`)
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (containsSensitiveData(key)) throw new Error(`Snapshot privacy check failed at ${path}.${key}`)
      checkPrivacy(child, `${path}.${key}`)
    }
  }
}

export function sortedJSON(value) {
  const sort = item => Array.isArray(item) ? item.map(sort)
    : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])])) : item
  return JSON.stringify(sort(value), null, 2) + '\n'
}

function canvasNodes(payload) {
  if (Array.isArray(payload)) return payload.flatMap(canvasNodes)
  if (!payload || typeof payload !== 'object') return []
  const nodes = payload.id && payload.label ? [payload] : []
  if (Array.isArray(payload.cells)) nodes.push(...payload.cells.map((cell, index) => ({ ...cell, id: `cell-${index}` })))
  return [...nodes, ...Object.values(payload).flatMap(canvasNodes)]
}

export async function snapshot({ api, notebook, fetcher = fetch }) {
  const base = api.replace(/\/$/, '').replace(/\/api$/, '') + '/api'
  const routes = {}
  const get = async (path, query = '', record = true) => {
    const response = await fetcher(`${base}${path}${query}`, { method: 'GET' })
    if (!response.ok) throw new Error(`GET ${path}: ${response.status}`)
    const data = await response.json()
    if (record) routes[`GET ${path}`] = data
    return data
  }
  const notebooks = await get('/notebooks/', '', false)
  const matches = notebooks.filter(item => item.name === notebook)
  if (matches.length !== 1) throw new Error(`Expected 1 notebook named ${notebook}, found ${matches.length}`)
  const chosen = matches[0]
  routes['GET /notebooks/'] = [chosen]
  const prefix = `/notebooks/${chosen.id}`
  await get(prefix)
  const workspace = await get(`${prefix}/workspace`)
  await get(`${prefix}/mastery`)
  const items = []
  let offset = 0
  for (;;) {
    const page = await get(`${prefix}/questions`, `?offset=${offset}&limit=50`, false)
    items.push(...page.items)
    offset += page.items.length
    if (offset >= page.total) break
    if (!page.items.length) throw new Error('Question pagination made no progress')
  }
  routes[`GET ${prefix}/questions`] = { total: items.length, offset: 0, limit: 50, items }
  await get(`${prefix}/held-back`)
  const history = []
  let before = ''
  for (;;) {
    const page = await get(`${prefix}/chat`, `?limit=200${before}`, false)
    history.unshift(...page)
    if (page.length < 200) break
    before = `&before=${page[0].id}`
  }
  routes[`GET ${prefix}/chat`] = history
  await get('/tags/', `?notebook_id=${chosen.id}`)
  for (const tag of routes['GET /tags/']) await get(`/tags/${tag.id}`)
  const documents = []
  for (const source of workspace.sources) {
    documents.push(await get(`/documents/${source.id}`))
    await get(`/documents/${source.id}/passages`)
    const documentQuestions = []
    let skip = 0
    for (;;) {
      const page = await get(`/questions/document/${source.id}`, `?skip=${skip}&limit=100`, false)
      documentQuestions.push(...page)
      if (page.length < 100) break
      skip += page.length
    }
    routes[`GET /questions/document/${source.id}`] = documentQuestions
    await get(`/canvas/document/${source.id}`)
  }
  routes['GET /documents/'] = documents
  const decks = []
  const flagged = []
  const questionIds = new Set(items.map(item => item.id))
  for (const deck of workspace.artifacts.decks) {
    const recorded = await get(`/decks/${deck.id}`)
    const held = await get('/flagged', `?deck_id=${deck.id}`, false)
    flagged.push(...held)
    decks.push({ id: recorded.id, notebook_id: chosen.id, name: recorded.name,
      description: recorded.description, num_questions: recorded.num_questions, created_at: recorded.created_at })
    recorded.questions.forEach(item => questionIds.add(item.id))
  }
  routes['GET /decks/'] = decks
  routes['GET /flagged'] = flagged
  for (const id of questionIds) {
    await get(`/questions/${id}`)
    await get(`/questions/${id}/suggested-tags`)
    await get(`/progress/question/${id}`)
  }
  const canvases = []
  for (const canvas of workspace.artifacts.canvases) {
    const recorded = await get(`/canvas/${canvas.id}`)
    const nodes = [...canvasNodes(recorded.payload), ...(recorded.edited?.nodes || [])]
    const ids = new Set(nodes.map(node => node.id))
    for (const id of ids) {
      await get(`/canvas/${canvas.id}/nodes/${encodeURIComponent(id)}/source`)
      await get(`/canvas/${canvas.id}/nodes/${encodeURIComponent(id)}/questions`)
    }
    const summary = { ...recorded }
    delete summary.payload
    canvases.push({ ...summary, node_count: ids.size })
  }
  routes['GET /canvas/'] = canvases
  await get('/canvas/templates')
  await get('/progress/stats')
  const stats = await get('/progress/stats/by-notebook', '', false)
  routes['GET /progress/stats/by-notebook'] = stats.filter(item => item.notebook_id === chosen.id)
  for (const path of ['/activity/', '/activity/mood', '/activity/awards']) await get(path)
  for (const job of workspace.jobs) {
    await get(`/status/${job.job_id || job.id}`)
    if (job.deck_id) await get(`/status/deck/${job.deck_id}`)
    if (job.status === 'needs_choice') await get(`/canvas/candidates/${job.job_id || job.id}`)
  }
  const result = { notebook: chosen, routes }
  checkPrivacy(result)
  return result
}

async function main() {
  const args = process.argv.slice(2)
  const api = args[args.indexOf('--api') + 1]
  const notebook = args[args.indexOf('--notebook') + 1]
  if (!args.includes('--api') || !args.includes('--notebook') || !api || !notebook) {
    throw new Error('Usage: npm run demo:snapshot -- --api http://127.0.0.1:8002 --notebook "The learning pyramid"')
  }
  const result = await snapshot({ api, notebook })
  await writeFile(new URL('./fixture.json', import.meta.url), sortedJSON(result))
  const workspace = result.routes[`GET /notebooks/${result.notebook.id}/workspace`]
  process.stdout.write(`Recorded ${Object.keys(result.routes).length} GET routes, ${workspace.sources.length} sources, ${workspace.artifacts.decks.length} decks, ${result.routes[`GET /notebooks/${result.notebook.id}/questions`].total} questions, ${workspace.artifacts.canvases.length} canvases.\n`)
  process.stdout.write(Object.keys(result.routes).sort().join('\n') + '\n')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1 })
}
