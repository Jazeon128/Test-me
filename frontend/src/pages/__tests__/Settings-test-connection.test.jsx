import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import axios from 'axios'
import Settings from '../Settings'
import { ThemeProvider } from '../../context/ThemeContext'

vi.mock('axios')

const renderSettings = () => render(
  <BrowserRouter>
    <ThemeProvider>
      <Settings />
    </ThemeProvider>
  </BrowserRouter>
)

beforeEach(() => {
  vi.clearAllMocks()
  axios.get.mockImplementation((url) => {
    if (url === '/api/settings/ai-config/models') {
      return Promise.resolve({ data: [{ id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', provider: 'gemini', context_window: 1000000, input_price: 0.1, output_price: 0.4 }] })
    }
    if (url === '/api/settings/ai-config') {
      return Promise.resolve({ data: { provider: 'gemini', model: 'gemini-3.5-flash-lite', api_key_configured: true } })
    }
    return Promise.reject(new Error('Unknown endpoint'))
  })
})

describe('Settings - Test Connection', () => {
  it('shows the server reason when the provider rejects the key', async () => {
    // The backend error handler nests the reason under error.message.
    axios.post.mockRejectedValue({
      response: { status: 400, data: { error: { code: 'BAD_REQUEST', message: 'gemini rejected the API key. Check it was copied in full and is still active.' } } },
    })
    renderSettings()

    fireEvent.click(await screen.findByRole('button', { name: 'Test Connection' }))

    expect(await screen.findByText(/gemini rejected the API key/)).toBeInTheDocument()
    expect(axios.post).toHaveBeenCalledWith('/api/settings/ai-config/test')
  })

  it('shows the measured latency on success', async () => {
    axios.post.mockResolvedValue({ data: { success: true, message: 'Connected to gemini using gemini-3.5-flash-lite (812 ms).' } })
    renderSettings()

    fireEvent.click(await screen.findByRole('button', { name: 'Test Connection' }))

    expect(await screen.findByText(/812 ms/)).toBeInTheDocument()
  })
})
