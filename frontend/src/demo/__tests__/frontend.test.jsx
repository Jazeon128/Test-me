import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { DEMO_NOTICE } from '../notice'

vi.mock('../../../demo/fixture.json', async () => ({
  default: (await import('./fixture.sample.json')).default,
}))

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

it('runs the real frontend with recorded sources, bank, chat, and blocked writes without a transport', async () => {
  vi.stubEnv('VITE_DEMO', 'true')
  vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(() => { throw new Error('Demo must not use a network transport') })
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: query === '(min-width: 1024px)', media: query,
    addEventListener: () => {}, removeEventListener: () => {},
  }))
  const { default: App } = await import('../../App')
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'The learning pyramid', exact: true })).toBeInTheDocument()
  fireEvent.click(await screen.findByRole('button', { name: 'What is active recall?' }))
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Ask about your sources' })).toHaveValue(''))
  fireEvent.click(screen.getByRole('button', { name: 'Open Learning notes' }))
  expect(await screen.findByText('Active recall means retrieving from memory.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: /Questions \(4\)/ }))
  expect(await screen.findByText('What helps learning?')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Notebooks', exact: true }))
  expect(await screen.findByRole('heading', { name: 'Notebooks', exact: true })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'New notebook' }))
  fireEvent.change(screen.getByLabelText('What is this notebook about?'), { target: { value: 'Demo attempt' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create', exact: true }))
  expect(await screen.findByRole('alert')).toHaveTextContent(DEMO_NOTICE)
  expect(XMLHttpRequest.prototype.open).not.toHaveBeenCalled()
}, 10000)
