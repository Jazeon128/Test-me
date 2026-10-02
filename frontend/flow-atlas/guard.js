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

export function slugify(value) {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'step'
}

export function stepFileName(flowIndex, stepIndex, slug, viewport) {
  return `shots/${String(flowIndex + 1).padStart(2, '0')}-${String(stepIndex + 1).padStart(2, '0')}-${slugify(slug)}-${viewport}.jpg`
}

export function buildManifest(gitSha, viewports, generatedAt = new Date().toISOString()) {
  return { generated_at: generatedAt, git_sha: gitSha, viewports, flows: [], blocked: [], errors: [] }
}
