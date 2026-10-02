const paidPosts = [
  /^\/api\/canvas\/generate$/,
  /^\/api\/canvas\/[^/]+\/nodes\/[^/]+\/questions$/,
  /^\/api\/notebooks\/[^/]+\/(generate|sources|chat)$/,
  /^\/api\/documents\/upload$/,
  /^\/api\/documents\/jobs\/[^/]+\/confirm$/,
  /^\/api\/questions\/[^/]+\/grade$/,
  /^\/api\/questions\/duplicates$/,
]

export function isBlocked(method, url) {
  const path = new URL(url, 'http://localhost').pathname.replace(/\/+$/, '')
  const verb = method.toUpperCase()
  if (verb !== 'GET' && /^\/api\/settings(?:\/|$)/.test(path)) return true
  return verb === 'POST' && paidPosts.some(pattern => pattern.test(path))
}

// These GETs can reach a provider. Keep the method-only guard's GET contract.
export function isProviderRead(url) {
  const path = new URL(url, 'http://localhost').pathname.replace(/\/+$/, '')
  return /^\/api\/questions\/[^/]+\/suggested-tags$/.test(path)
    || path === '/api/search'
    || /^\/api\/settings\/openrouter\/(models|key)$/.test(path)
}

export async function stubModelCatalogue(route, catalogue, manifest, step) {
  const request = route.request()
  const path = new URL(request.url()).pathname.replace(/\/+$/, '')
  if (request.method() !== 'GET' || path !== '/api/settings/openrouter/models') return false
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(catalogue) })
  manifest.stubbed.push({ method: 'GET', url: request.url(), step })
  return true
}

export function modelCatalogue(selectedIds, fetchedAt = new Date().toISOString()) {
  const ids = [...new Set(selectedIds.filter(Boolean))]
  const extras = ['openrouter/auto', 'openrouter/free', 'meta-llama/llama-3.3-70b-instruct:free']
    .filter(id => !ids.includes(id)).slice(0, 2)
  return { fetched_at: fetchedAt, models: [...ids, ...extras].map(id => ({
    id, name: id, context_length: null, max_completion_tokens: null,
    prompt_per_million: null, completion_per_million: null, request_price: null,
    free: false, supported_parameters: [], input_modalities: ['text'],
  })) }
}

export function slugify(value) {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'step'
}

export function stepFileName(flowIndex, stepIndex, slug, viewport) {
  return `shots/${String(flowIndex + 1).padStart(2, '0')}-${String(stepIndex + 1).padStart(2, '0')}-${slugify(slug)}-${viewport}.jpg`
}

export function buildManifest(gitSha, viewports, generatedAt = new Date().toISOString()) {
  return { generated_at: generatedAt, git_sha: gitSha, viewports, flows: [], blocked: [], stubbed: [], errors: [] }
}
