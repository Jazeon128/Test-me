import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { flows } from './flows.js'
import { buildManifest, isBlocked, isProviderRead, modelCatalogue, stubModelCatalogue, stepFileName } from './guard.js'

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.dirname(frontend)
const backend = path.join(repo, 'backend')
const python = path.join(backend, '.venv', 'Scripts', 'python.exe')
const baseUrl = 'http://localhost:5174'
const apiUrl = 'http://localhost:8001'
const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
const runFolder = path.join(repo, 'tmp', 'flow-atlas', timestamp)
const work = path.join(runFolder, 'work')
const children = []
const logs = []
let browser
let currentStep = 'seed'
let interrupted = false
const manifest = buildManifest(null, viewports)
let exitCode = 0
let catalogue

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function command(executable, args, options = {}) {
  const child = spawn(executable, args, { windowsHide: true, ...options })
  let output = ''
  child.stdout?.on('data', chunk => { output += chunk })
  child.stderr?.on('data', chunk => { output += chunk })
  const [code] = await once(child, 'close')
  if (code !== 0) throw new Error(`${path.basename(executable)} exited ${code}: ${output.trim()}`)
  return output.trim()
}

async function requireFreePort(port) {
  // Binding catches listeners even when they do not answer HTTP.
  const server = net.createServer()
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen({ port, host: '::', exclusive: true }, resolve)
    })
  } catch (error) {
    const failure = new Error(`Refusing to start: port ${port} is unavailable (${error.code}).`)
    failure.exitCode = 2
    throw failure
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve))
  }
}

function startServer(executable, args, cwd, env, logName) {
  const logPath = path.join(runFolder, logName)
  const log = createWriteStream(logPath)
  logs.push(log)
  const child = spawn(executable, args, { cwd, env, windowsHide: true })
  children.push(child)
  child.stdout.pipe(log, { end: false })
  child.stderr.pipe(log, { end: false })
  child.on('error', error => {
    child.startError = error
    log.write(`${error.message}\n`)
  })
  return { child, logPath }
}

async function waitForServer(url, server) {
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    if (interrupted) throw new Error('Capture interrupted')
    if (server.child.startError || server.child.exitCode !== null) break
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (response.ok) return
    } catch { /* Startup may still be in progress. */ }
    await delay(300)
  }
  throw new Error(`Server did not answer within 60 s. Read ${server.logPath}`)
}

function unsafeRequest(method, url, body) {
  if (isBlocked(method, url) || isProviderRead(url)) return true
  // Multiple choice and manual ratings are local. Written grading is remote.
  if (method === 'POST' && new URL(url).pathname === '/api/progress/submit') {
    try {
      const payload = JSON.parse(body || '{}')
      return payload.written_answer != null || payload.explain === true
    } catch { return true }
  }
  return false
}

async function api(route, method = 'GET', payload) {
  const url = new URL(route, apiUrl)
  if (url.origin !== apiUrl || !url.pathname.startsWith('/api/')) throw new Error(`Non-isolated API URL refused: ${url}`)
  if (unsafeRequest(method, url.href, JSON.stringify(payload))) throw new Error(`Paid API refused: ${method} ${url.pathname}`)
  const response = await fetch(url, {
    method,
    headers: payload === undefined ? {} : { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`${method} ${url.pathname}: HTTP ${response.status}`)
  return response.json()
}

async function seed() {
  const notebooks = await api('/api/notebooks/')
  const notebook = notebooks.find(item => item.name === 'AWS GenAI certification')
  if (!notebook) throw new Error('Required notebook "AWS GenAI certification" is missing from the database copy.')
  const deck = await api('/api/decks/', 'POST', { name: 'Atlas sample flashcards', notebook_id: notebook.id })
  const cards = [
    ['What does Amazon Bedrock provide?', 'Managed access to foundation models from several providers through one API.'],
    ['What is retrieval-augmented generation (RAG)?', 'Adding retrieved passages from your own data to the prompt so the model answers from them.'],
    ['What do Bedrock Guardrails do?', 'Filter harmful content, deny topics and redact personal data in model inputs and outputs.'],
    ['What is a vector embedding?', 'A list of numbers that represents the meaning of text, so similar text sits close together.'],
  ]
  for (const [front, back] of cards) {
    await api('/api/questions/', 'POST', { deck_id: deck.id, card_type: 'flashcard', question_text: front, explanation: back })
  }
  const kindScript = [
    'import sqlite3, sys',
    'from pathlib import Path',
    'database = Path(sys.argv[1]).resolve()',
    'assert database.parent == Path(sys.argv[2]).resolve()',
    'connection = sqlite3.connect(database)',
    'with connection: connection.execute("UPDATE decks SET kind = ? WHERE id = ?", ("flashcards", int(sys.argv[3])))',
    'connection.close()',
  ].join('\n')
  await command(python, ['-c', kindScript, path.join(work, 'test_me.db'), work, String(deck.id)])
  const workspace = await api(`/api/notebooks/${notebook.id}/workspace`)
  const quiz = workspace.artifacts.decks.find(item => item.name === 'OpenRouter check')
  if (!quiz) throw new Error('Required quiz deck "OpenRouter check" is missing from the notebook.')
  return {
    baseUrl, notebookId: notebook.id, deckId: deck.id, quizDeckId: quiz.id,
    canvasId: workspace.artifacts.canvases[0]?.id, sources: workspace.sources, api,
  }
}

async function makeContext(viewport) {
  const context = await browser.newContext({
    viewport: viewports[viewport], deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce',
    ...(viewport === 'mobile' ? { isMobile: true, hasTouch: true } : {}),
    serviceWorkers: 'block',
  })
  context.setDefaultTimeout(15000)
  await context.addInitScript(() => {
    localStorage.setItem('theme', 'dark')
    localStorage.setItem('test-me.welcomeCompleted', 'true')
  })
  await context.route('**/api/**', async route => {
    if (await stubModelCatalogue(route, catalogue, manifest, currentStep)) return
    const request = route.request()
    if (unsafeRequest(request.method(), request.url(), request.postData())) {
      manifest.blocked.push({ method: request.method(), url: request.url(), step: currentStep })
      await route.abort('blockedbyclient')
    } else await route.continue()
  })
  // Only the isolated frontend may receive browser traffic. This also refuses
  // redirects to the owner's ports and any external browser request.
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).origin !== baseUrl) await route.abort('blockedbyclient')
    else await route.fallback()
  })
  return context
}

async function screenshot(page, file) {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(runFolder, file), type: 'jpeg', quality: 80, fullPage: false, caret: 'hide' })
}

async function captureFlows(ctx) {
  browser = await chromium.launch({ channel: 'msedge' })
  const contexts = { desktop: await makeContext('desktop'), mobile: await makeContext('mobile') }
  for (const [flowIndex, flow] of flows.entries()) {
    const record = { id: flow.id, title: flow.title, steps: [] }
    manifest.flows.push(record)
    const page = await contexts[flow.steps[0].viewport].newPage()
    try {
      for (const [stepIndex, step] of flow.steps.entries()) {
        currentStep = `${flow.id}/${step.id}`
        let file = stepFileName(flowIndex, stepIndex, `${flow.id}-${step.id}`, step.viewport)
        let failed = false
        try {
          if (interrupted) throw new Error('Capture interrupted')
          await step.run(page, ctx)
        } catch (error) {
          manifest.errors.push({ flow: flow.id, step: step.id, message: error.message })
          file = file.replace(/\.jpg$/, '-error.jpg')
          failed = true
        }
        try {
          await screenshot(page, file)
          const url = new URL(page.url())
          record.steps.push({ id: step.id, title: step.title, action: step.action, viewport: step.viewport, url: `${url.pathname}${url.search}`, file })
        } catch (error) {
          manifest.errors.push({ flow: flow.id, step: step.id, message: `Screenshot failed: ${error.message}` })
          failed = true
        }
        if (failed) break
      }
    } finally { await page.close() }
    if (interrupted) break
  }
}

async function stopTree(child) {
  if (!child.pid) return
  if (process.platform === 'win32') {
    await command('taskkill', ['/T', '/F', '/PID', String(child.pid)]).catch(error => {
      if (child.exitCode === null) throw error
    })
  } else if (child.exitCode === null) child.kill('SIGTERM')
  if (child.exitCode === null && child.signalCode === null) await once(child, 'close')
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interrupted = true
    // Break pending browser waits so the main finally can clean up promptly.
    browser?.close().catch(() => {})
  })
}

try {
  await mkdir(path.dirname(runFolder), { recursive: true })
  await mkdir(runFolder)
  await mkdir(work)
  await mkdir(path.join(runFolder, 'shots'))
  process.stdout.write(`${runFolder}\n`)
  manifest.git_sha = await command('git', ['rev-parse', 'HEAD'], { cwd: repo })
  const copyScript = [
    'import sqlite3, sys',
    'from pathlib import Path',
    'source = sqlite3.connect(Path(sys.argv[1]).resolve().as_uri() + "?mode=ro", uri=True)',
    'destination = sqlite3.connect(sys.argv[2])',
    'with destination: source.backup(destination)',
    'destination.close()',
    'source.close()',
  ].join('\n')
  await command(python, ['-c', copyScript, path.join(backend, 'test_me.db'), path.join(work, 'test_me.db')])
  // Read only model/provider settings from the copy. Never load credentials or .env.
  const modelsScript = [
    'import json, sqlite3, sys',
    'from pathlib import Path',
    'connection = sqlite3.connect(Path(sys.argv[1]).resolve().as_uri() + "?mode=ro", uri=True)',
    'keys = ("ai_provider", "ai_model", "generation_provider", "generation_model", "chat_provider", "chat_model")',
    'settings = dict(connection.execute("SELECT key, value FROM settings WHERE key IN (?, ?, ?, ?, ?, ?)", keys))',
    'models = [settings.get(task + "_model") or settings.get("ai_model") for task in ("generation", "chat") if (settings.get(task + "_provider") or settings.get("ai_provider")) == "openrouter"]',
    'print(json.dumps(models))',
    'connection.close()',
  ].join('\n')
  catalogue = modelCatalogue(JSON.parse(await command(python, ['-c', modelsScript, path.join(work, 'test_me.db')])))
  await cp(path.join(backend, 'uploads'), path.join(work, 'uploads'), { recursive: true })
  await requireFreePort(8001)
  await requireFreePort(5174)
  const backendEnv = {
    ...process.env, DATABASE_URL: `sqlite:///${path.join(work, 'test_me.db').replaceAll('\\', '/')}`,
    HOST: '127.0.0.1', PORT: '8001', UPLOAD_DIR: path.join(work, 'uploads'),
    NO_PROXY: 'localhost,127.0.0.1', no_proxy: 'localhost,127.0.0.1',
    PYTHONDONTWRITEBYTECODE: '1',
  }
  for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) backendEnv[key] = 'http://127.0.0.1:9'
  const backendServer = startServer(python, ['main.py'], backend, backendEnv, 'backend.log')
  const viteServer = process.platform === 'win32'
    ? startServer(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npx vite --port 5174 --strictPort'], frontend, { ...process.env, TESTME_API_TARGET: apiUrl }, 'vite.log')
    : startServer('npx', ['vite', '--port', '5174', '--strictPort'], frontend, { ...process.env, TESTME_API_TARGET: apiUrl }, 'vite.log')
  await waitForServer(`${apiUrl}/api/notebooks/`, backendServer)
  await waitForServer(baseUrl, viteServer)
  await captureFlows(await seed())
} catch (error) {
  exitCode = error.exitCode || 1
  manifest.errors.push({ flow: 'setup', step: currentStep, message: error.message })
  process.stderr.write(`${error.message}\n`)
} finally {
  const cleanup = await Promise.allSettled(children.map(stopTree))
  for (const result of cleanup) {
    if (result.status === 'rejected') manifest.errors.push({ flow: 'cleanup', step: 'servers', message: result.reason.message })
  }
  // A restricted Windows session may refuse taskkill. Report that failure and
  // release pipe handles so it cannot leave the atlas command hanging forever.
  for (const child of children) {
    child.stdout?.destroy()
    child.stderr?.destroy()
    child.unref()
  }
  await browser?.close().catch(() => {})
  for (const log of logs) log.end()
  try { await rm(work, { recursive: true, force: true }) }
  catch (error) { manifest.errors.push({ flow: 'cleanup', step: 'work', message: error.message }) }
  try { await writeFile(path.join(runFolder, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`) }
  catch (error) { process.stderr.write(`Manifest could not be written: ${error.message}\n`); exitCode = 1 }
  const captured = manifest.flows.reduce((total, flow) => total + flow.steps.length, 0)
  process.stdout.write(`${captured} steps captured, ${manifest.errors.length} errors, ${manifest.blocked.length} blocked requests, ${manifest.stubbed.length} stubbed requests\n`)
  process.exitCode = exitCode || (manifest.errors.length ? 1 : 0)
}
