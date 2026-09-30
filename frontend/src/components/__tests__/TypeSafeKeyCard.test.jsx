import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import axios from 'axios'
import TypeSafeKeyCard from '../TypeSafeKeyCard'

vi.mock('axios')

const endpoint = '/api/settings/typesafe'
const saved = { configured: true, source: 'settings', preview: '…2345' }
const environment = { configured: true, source: 'environment', preview: '…7890' }
const empty = { configured: false, source: null, preview: null }

beforeEach(() => {
  vi.resetAllMocks()
  axios.get.mockResolvedValue({ data: empty })
})

describe('TypeSafe key card', () => {
  it.each([
    [saved, 'Saved in Settings (…2345)'],
    [environment, 'Using the key from the backend environment (…7890)'],
    [empty, 'Not configured'],
  ])('shows status for %j', async (config, status) => {
    axios.get.mockResolvedValue({ data: config })
    render(<TypeSafeKeyCard />)
    expect(await screen.findByText(status)).toBeInTheDocument()
    expect(axios.get).toHaveBeenCalledWith(endpoint)
    expect(screen.queryByRole('button', { name: 'Test TypeSafe key' }) !== null).toBe(config.configured)
  })

  it('saves the trimmed key, clears the input and shows success', async () => {
    axios.put.mockResolvedValue({ data: { ...saved, message: 'TypeSafe key saved' } })
    render(<TypeSafeKeyCard />)
    const input = screen.getByLabelText('TypeSafe API key')
    const button = screen.getByRole('button', { name: 'Save TypeSafe key' })
    expect(input).toHaveAttribute('type', 'password')
    expect(button).toBeDisabled()
    fireEvent.change(input, { target: { value: '   ' } })
    expect(button).toBeDisabled()
    fireEvent.change(input, { target: { value: '  ts-test-key-12345  ' } })
    fireEvent.click(button)
    expect(await screen.findByRole('status')).toHaveTextContent('TypeSafe key saved')
    expect(axios.put).toHaveBeenCalledWith(endpoint, { api_key: 'ts-test-key-12345' })
    expect(input).toHaveValue('')
    expect(screen.getByText('Saved in Settings (…2345)')).toBeInTheDocument()
  })

  it('shows the server error.message when testing fails', async () => {
    axios.get.mockResolvedValue({ data: saved })
    axios.post.mockRejectedValue({ response: { data: { error: { message: 'TypeSafe rejected the API key.' } } } })
    render(<TypeSafeKeyCard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Test TypeSafe key' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('TypeSafe rejected the API key.')
    expect(axios.post).toHaveBeenCalledWith(`${endpoint}/test`)
  })

  it('shows successful connection messages', async () => {
    axios.get.mockResolvedValue({ data: saved })
    axios.post.mockResolvedValue({ data: { success: true, message: 'Connected to TypeSafe (12 ms).' } })
    render(<TypeSafeKeyCard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Test TypeSafe key' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Connected to TypeSafe (12 ms).')
  })

  it('hides remove for an environment key', async () => {
    axios.get.mockResolvedValue({ data: environment })
    render(<TypeSafeKeyCard />)
    await screen.findByText('Using the key from the backend environment (…7890)')
    expect(screen.queryByRole('button', { name: 'Remove TypeSafe key' })).not.toBeInTheDocument()
  })

  it('removes a saved key and displays the environment fallback', async () => {
    axios.get.mockResolvedValue({ data: saved })
    axios.delete.mockResolvedValue({ data: { ...environment, message: 'TypeSafe key removed' } })
    render(<TypeSafeKeyCard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Remove TypeSafe key' }))
    expect(await screen.findByRole('status')).toHaveTextContent('TypeSafe key removed')
    expect(axios.delete).toHaveBeenCalledWith(endpoint)
    expect(screen.getByText('Using the key from the backend environment (…7890)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove TypeSafe key' })).not.toBeInTheDocument()
  })

  it('handles unavailable status without crashing', async () => {
    axios.get.mockRejectedValue(new Error('Offline'))
    render(<TypeSafeKeyCard />)
    expect(await screen.findByText('Status unavailable')).toBeInTheDocument()
  })

  it.each([
    [{ response: { data: { detail: 'Invalid TypeSafe API key.' } } }, 'Invalid TypeSafe API key.'],
    [new Error('Offline'), 'TypeSafe request failed. Try again.'],
  ])('handles save failure with a server reason or fallback', async (error, message) => {
    axios.put.mockRejectedValue(error)
    render(<TypeSafeKeyCard />)
    fireEvent.change(screen.getByLabelText('TypeSafe API key'), { target: { value: 'ts-test-key-12345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save TypeSafe key' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText('TypeSafe API key')).toHaveValue('ts-test-key-12345')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save TypeSafe key' })).toBeEnabled())
  })
})
