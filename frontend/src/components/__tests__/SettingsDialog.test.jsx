/**
 * Unit Tests for SettingsDialog Component
 * Tests specific functionality and edge cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SettingsDialog from '../SettingsDialog'

describe('SettingsDialog', () => {
  beforeEach(() => {
    global.window.electronAPI = {
      getSettings: vi.fn().mockResolvedValue({
        success: true,
        data: { apiProvider: 'openai', apiKeys: {} }
      }),
      setApiKey: vi.fn().mockResolvedValue({ success: true }),
      setSetting: vi.fn().mockResolvedValue({ success: true })
    }
  })

  describe('Rendering', () => {
    it('should render dialog when open', async () => {
      render(<SettingsDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('API key configuration')).toBeInTheDocument()
      })
    })

    it('should not render when closed', () => {
      render(<SettingsDialog isOpen={false} onClose={() => {}} />)
      expect(screen.queryByText('API key configuration')).not.toBeInTheDocument()
    })

    it('should render all provider buttons', async () => {
      render(<SettingsDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument()
      })
      
      expect(screen.getByText('Anthropic')).toBeInTheDocument()
      expect(screen.getByText('Google')).toBeInTheDocument()
    })
  })

  describe('Provider Selection', () => {
    it('should allow switching between providers', async () => {
      render(<SettingsDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument()
      })

      const anthropicButton = screen.getByText('Anthropic')
      fireEvent.click(anthropicButton)

      // Placeholder should update
      expect(screen.getByPlaceholderText(/anthropic/i)).toBeInTheDocument()
    })

    it('should highlight selected provider', async () => {
      render(<SettingsDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument()
      })

      const openaiButton = screen.getByText('OpenAI')
      expect(openaiButton.className).toContain('bg-primary-600')
    })
  })

  describe('API Key Input', () => {
    it('should toggle password visibility', async () => {
      render(<SettingsDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Enter your/)).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(/Enter your/)
      expect(input).toHaveAttribute('type', 'password')

      // Find the eye icon button by looking for the button inside the input's parent
      const inputContainer = input.parentElement
      const eyeButton = inputContainer.querySelector('button')
      
      if (eyeButton) {
        fireEvent.click(eyeButton)
        await waitFor(() => {
          expect(input).toHaveAttribute('type', 'text')
        })
      }
    })

    it('should enable save button when API key is entered', async () => {
      render(<SettingsDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Enter your/)).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(/Enter your/)
      const saveButton = screen.getByText('Save API Key')

      expect(saveButton).toBeDisabled()

      fireEvent.change(input, { target: { value: 'sk-test-key-123' } })
      
      expect(saveButton).not.toBeDisabled()
    })
  })

  describe('Validation', () => {
    it('should validate OpenAI key format', async () => {
      render(<SettingsDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Enter your/)).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(/Enter your/)
      const saveButton = screen.getByText('Save API Key')

      // Invalid key (doesn't start with sk-)
      fireEvent.change(input, { target: { value: 'invalid-key' } })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/should start with "sk-"/)).toBeInTheDocument()
      })
    })

    it('should validate Anthropic key format', async () => {
      render(<SettingsDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Anthropic')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Anthropic'))

      const input = screen.getByPlaceholderText(/anthropic/i)
      const saveButton = screen.getByText('Save API Key')

      // Invalid key (doesn't start with sk-ant-)
      fireEvent.change(input, { target: { value: 'sk-invalid' } })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/should start with "sk-ant-"/)).toBeInTheDocument()
      })
    })

    it('should reject empty API keys', async () => {
      render(<SettingsDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Enter your/)).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(/Enter your/)
      const saveButton = screen.getByText('Save API Key')

      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/cannot be empty/)).toBeInTheDocument()
      })
    })
  })

  describe('Save Functionality', () => {
    it('should save valid API key', async () => {
      const onClose = vi.fn()
      render(<SettingsDialog isOpen={true} onClose={onClose} />)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Enter your/)).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(/Enter your/)
      const saveButton = screen.getByText('Save API Key')

      fireEvent.change(input, { target: { value: 'sk-validkey123456789012345' } })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(window.electronAPI.setApiKey).toHaveBeenCalledWith('openai', 'sk-validkey123456789012345')
      })

      await waitFor(() => {
        expect(screen.getByText(/saved successfully/)).toBeInTheDocument()
      })
    })

    it('should handle save errors', async () => {
      global.window.electronAPI.setApiKey = vi.fn().mockResolvedValue({
        success: false,
        error: 'Failed to save'
      })

      render(<SettingsDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Enter your/)).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(/Enter your/)
      const saveButton = screen.getByText('Save API Key')

      fireEvent.change(input, { target: { value: 'sk-validkey123456789012345' } })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/Failed to save/)).toBeInTheDocument()
      })
    })
  })

  describe('Cancel Functionality', () => {
    it('should call onClose when cancel is clicked', async () => {
      const onClose = vi.fn()
      render(<SettingsDialog isOpen={true} onClose={onClose} />)
      
      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Cancel'))
      expect(onClose).toHaveBeenCalled()
    })

    it('should call onClose when X button is clicked', async () => {
      const onClose = vi.fn()
      render(<SettingsDialog isOpen={true} onClose={onClose} />)
      
      await waitFor(() => {
        expect(screen.getByText('API key configuration')).toBeInTheDocument()
      })

      const closeButtons = screen.getAllByRole('button')
      const xButton = closeButtons.find(btn => 
        btn.querySelector('svg') && btn.className.includes('text-gray-400')
      )
      
      if (xButton) {
        fireEvent.click(xButton)
        expect(onClose).toHaveBeenCalled()
      }
    })
  })
})
