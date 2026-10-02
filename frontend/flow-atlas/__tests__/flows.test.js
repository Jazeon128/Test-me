import { expect, it, vi } from 'vitest'
import { flows } from '../flows'

it('waits for a visible passage and hidden loading message before capturing a ready source', async () => {
  let showPassage
  const passageWait = vi.fn(() => new Promise(resolve => { showPassage = resolve }))
  const loadingWait = vi.fn().mockResolvedValue(undefined)
  const headingWait = vi.fn().mockResolvedValue(undefined)
  const open = vi.fn().mockResolvedValue(undefined)
  const first = vi.fn(() => ({ waitFor: passageWait }))
  const page = {
    getByRole: vi.fn(role => role === 'button' ? { click: open } : { waitFor: headingWait }),
    locator: vi.fn(() => ({ first })),
    getByText: vi.fn(() => ({ waitFor: loadingWait })),
  }
  const step = flows.find(flow => flow.id === 'workspace').steps.find(step => step.id === 'ready-source')
  let finished = false
  const run = step.run(page, { sources: [{ display_name: 'Ready.pdf', status: 'ready' }] })
    .then(() => { finished = true })
  await vi.waitFor(() => expect(passageWait).toHaveBeenCalledWith({ state: 'visible' }))
  expect(page.locator).toHaveBeenCalledWith('.workspace-source-view article')
  expect(first).toHaveBeenCalledOnce()
  expect(headingWait).toHaveBeenCalledOnce()
  expect(loadingWait).not.toHaveBeenCalled()
  expect(finished).toBe(false)
  showPassage()
  await run
  expect(page.getByText).toHaveBeenCalledWith('Loading source...', { exact: true })
  expect(loadingWait).toHaveBeenCalledWith({ state: 'hidden' })
  expect(finished).toBe(true)
})
