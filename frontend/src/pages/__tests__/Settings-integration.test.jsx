/**
 * Integration Tests for Settings Page with ModelSelector
 * Tests the full integration of ModelSelector component into Settings page
 * Requirements: 1.1, 1.2, 1.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import axios from 'axios'
import Settings from '../Settings'
import { ThemeProvider } from '../../context/ThemeContext'

// Mock axios
vi.mock('axios')

// Helper to render Settings with required providers
const renderSettings = () => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <Settings />
      </ThemeProvider>
    </BrowserRouter>
  )
}

// Helper to wait for loading to complete
const waitForLoaded = async () => {
  await waitFor(() => {
    expect(screen.queryByRole('status', { name: /loading settings/i })).not.toBeInTheDocument()
  }, { timeout: 3000 })
}

describe('Settings - ModelSelector Integration', () => {
  const mockModels = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      context_window: 128000,
      input_price: 2.50,
      output_price: 10.00,
      description: 'Most capable GPT-4 model'
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      context_window: 128000,
      input_price: 10.00,
      output_price: 30.00,
      description: 'Fast GPT-4 model'
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      context_window: 200000,
      input_price: 3.00,
      output_price: 15.00,
      description: 'Most intelligent Claude model'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock responses
    axios.get.mockImplementation((url) => {
      if (url === '/api/settings/ai-config/models') {
        return Promise.resolve({ data: mockModels })
      }
      if (url === '/api/settings/ai-config') {
        return Promise.resolve({
          data: {
            provider: 'openai',
            model: 'gpt-4o',
            api_key_configured: false
          }
        })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })
  })

  describe('Basic Integration - Requirement 1.1', () => {
    it('should render ModelSelector component in Settings page', async () => {
      renderSettings()
      await waitForLoaded()

      // Should show the toggle button
      expect(screen.getByRole('button', { name: /Use Custom/i })).toBeInTheDocument()
      
      // Should show predefined dropdown initially
      expect(screen.getByLabelText(/AI Model/i)).toBeInTheDocument()
    })

    it('should display predefined models in dropdown', async () => {
      renderSettings()
      await waitForLoaded()

      const modelSelect = screen.getByLabelText(/AI Model/i)
      expect(modelSelect).toHaveValue('gpt-4o')
      
      // Check that options are present
      const options = within(modelSelect).getAllByRole('option')
      expect(options.length).toBeGreaterThan(0)
    })
  })

  describe('Switching to custom mode - Requirement 1.2', () => {
    it('should switch from predefined to custom input', async () => {
      renderSettings()
      await waitForLoaded()

      // Initially should show predefined dropdown
      expect(screen.getByLabelText(/AI Model/i)).toBeInTheDocument()

      // Click toggle to custom
      const toggleButton = screen.getByRole('button', { name: /Use Custom/i })
      fireEvent.click(toggleButton)

      // Should now show custom input
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Enter custom openai model name/i)).toBeInTheDocument()
      })

      // Button text should change
      expect(screen.getByRole('button', { name: /Use Predefined/i })).toBeInTheDocument()
    })

    it('should show format examples in custom mode', async () => {
      renderSettings()
      await waitForLoaded()

      // Toggle to custom
      const toggleButton = screen.getByRole('button', { name: /Use Custom/i })
      fireEvent.click(toggleButton)

      // Should show format examples
      await waitFor(() => {
        expect(screen.getByText(/Format Examples/i)).toBeInTheDocument()
      })
    })
  })

  describe('Switching back to predefined - Requirement 1.2', () => {
    it('should switch from custom back to predefined', async () => {
      renderSettings()
      await waitForLoaded()

      // Toggle to custom
      const toggleButton = screen.getByRole('button', { name: /Use Custom/i })
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Enter custom openai model name/i)).toBeInTheDocument()
      })

      // Toggle back to predefined
      const toggleBackButton = screen.getByRole('button', { name: /Use Predefined/i })
      fireEvent.click(toggleBackButton)

      // Should show dropdown again
      await waitFor(() => {
        expect(screen.getByLabelText(/AI Model/i)).toBeInTheDocument()
      })
    })
  })

  describe('Loading existing custom model - Requirement 1.5', () => {
    it('should detect and display custom model on load', async () => {
      // Mock config with custom model
      axios.get.mockImplementation((url) => {
        if (url === '/api/settings/ai-config/models') {
          return Promise.resolve({ data: mockModels })
        }
        if (url === '/api/settings/ai-config') {
          return Promise.resolve({
            data: {
              provider: 'openai',
              model: 'gpt-5-custom',
              api_key_configured: true,
              api_key_preview: 'sk-...1234'
            }
          })
        }
        return Promise.reject(new Error('Unknown endpoint'))
      })

      renderSettings()
      await waitForLoaded()

      // Give extra time for the custom model detection useEffect to run
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should automatically show custom input mode
      await waitFor(() => {
        const customInput = screen.getByPlaceholderText(/Enter custom openai model name/i)
        expect(customInput).toBeInTheDocument()
        expect(customInput).toHaveValue('gpt-5-custom')
      }, { timeout: 5000 })

      // Should show "Use Predefined" button
      expect(screen.getByRole('button', { name: /Use Predefined/i })).toBeInTheDocument()
    })

    it('should display predefined model normally when loaded', async () => {
      renderSettings()
      await waitForLoaded()

      // Should show predefined dropdown
      const modelSelect = screen.getByLabelText(/AI Model/i)
      expect(modelSelect).toBeInTheDocument()
      expect(modelSelect).toHaveValue('gpt-4o')

      // Should show "Use Custom" button
      expect(screen.getByRole('button', { name: /Use Custom/i })).toBeInTheDocument()
    })
  })

  describe('Save functionality with custom models', () => {
    it('should save custom model successfully', async () => {
      axios.post.mockResolvedValueOnce({
        data: { message: 'Configuration saved successfully' }
      })

      renderSettings()
      await waitForLoaded()

      // Toggle to custom mode
      const toggleButton = screen.getByRole('button', { name: /Use Custom/i })
      fireEvent.click(toggleButton)

      // Enter custom model
      await waitFor(() => {
        const customInput = screen.getByPlaceholderText(/Enter custom openai model name/i)
        fireEvent.change(customInput, { target: { value: 'gpt-5-preview' } })
      })

      // Enter API key
      const apiKeyInput = screen.getByPlaceholderText(/Enter your API key/i)
      fireEvent.change(apiKeyInput, { target: { value: 'sk-test-key' } })

      // Save
      const saveButton = screen.getByRole('button', { name: /Save Configuration/i })
      fireEvent.click(saveButton)

      // Should call API with custom model
      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith('/api/settings/ai-config', {
          provider: 'openai',
          api_key: 'sk-test-key',
          model: 'gpt-5-preview'
        })
      })
    })

    it('should prevent save with empty custom model', async () => {
      renderSettings()
      await waitForLoaded()

      // Toggle to custom mode
      const toggleButton = screen.getByRole('button', { name: /Use Custom/i })
      fireEvent.click(toggleButton)

      // Clear the input
      await waitFor(() => {
        const customInput = screen.getByPlaceholderText(/Enter custom openai model name/i)
        fireEvent.change(customInput, { target: { value: '' } })
        fireEvent.blur(customInput)
      })

      // Enter API key
      const apiKeyInput = screen.getByPlaceholderText(/Enter your API key/i)
      fireEvent.change(apiKeyInput, { target: { value: 'sk-test-key' } })

      // Try to save
      const saveButton = screen.getByRole('button', { name: /Save Configuration/i })
      fireEvent.click(saveButton)

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid model name/i)).toBeInTheDocument()
      })

      // Should not call API
      expect(axios.post).not.toHaveBeenCalled()
    })
  })

  describe('Model details display', () => {
    it('should show model details for predefined models', async () => {
      renderSettings()
      await waitForLoaded()

      // Should show model details
      expect(screen.getByText(/Context Window/i)).toBeInTheDocument()
      expect(screen.getByText(/128,000 tokens/i)).toBeInTheDocument()
    })

    it('should hide model details for custom models', async () => {
      renderSettings()
      await waitForLoaded()

      // Toggle to custom mode
      const toggleButton = screen.getByRole('button', { name: /Use Custom/i })
      fireEvent.click(toggleButton)

      // Model details should not be visible
      await waitFor(() => {
        expect(screen.queryByText(/Context Window/i)).not.toBeInTheDocument()
      })
    })
  })
})
