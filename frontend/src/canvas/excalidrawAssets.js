export function resolveAssetPath(baseUrl, pageUrl) {
  const page = new URL(pageUrl)
  const base = page.protocol === 'file:'
    ? new URL('./', page)
    : new URL(baseUrl, `${page.origin}/`)
  return new URL('excalidraw-assets/', base).href
}

window.EXCALIDRAW_ASSET_PATH = resolveAssetPath(import.meta.env.BASE_URL, location.href)
