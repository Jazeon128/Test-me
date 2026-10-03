import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('resolves every icon and manifest link from Vite BASE_URL on deep routes', () => {
  const html = readFileSync('index.html', 'utf8')
  const document = new DOMParser().parseFromString(html, 'text/html')
  const links = [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')]
  expect(links).toHaveLength(4)
  for (const link of links) expect(link.getAttribute('href')).toMatch(/^%BASE_URL%/)
  expect(links.map(link => link.getAttribute('href'))).toEqual([
    '%BASE_URL%icons/icon-32.png',
    '%BASE_URL%icons/icon-16.png',
    '%BASE_URL%icons/icon-180.png',
    '%BASE_URL%manifest.webmanifest',
  ])
})
