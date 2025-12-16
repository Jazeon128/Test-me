/**
 * Property-Based Tests for SettingsDialog Component
 * Feature: standalone-desktop-app, Property 14: Settings dialog availability
 * Validates: Requirements 4.1
 * 
 * Property 14: Settings dialog availability
 * For any running application, opening settings should display a dialog with fields for configuring API keys.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import SettingsDialog from '../SettingsDialog'

describe('Property 14: Settings dialog availability', () => {
  beforeEach(() => {
    // Mock the Electron API
    global.window.electronAPI = {
      getSettings: vi.fn().mockResolvedValue({
        success: true,
        data: {
          apiProvider: 'openai',
          apiKeys: {}
        }
      }),
      setApiKey: vi.fn().mockResolvedValue({ success: true }),
      setSetting: vi.fn().mockResolvedValue({ success: true })
    }
  })

  it('should display settings dialog with API key configuration fields when opened', async () => {
    // Property: For any running application, opening settings should display a dialog
    // with fields for configuring API keys
    
    // Render the dialog in open state
    render(<SettingsDialog isOpen={true} onClose={() => {}} />)

    // Wait for the dialog to load settings
    await waitFor(() => {
      expect(window.electronAPI.getSettings).toHaveBeenCalled()
    })

    // Verify dialog is displayed
    expect(screen.getByText('API Key Configuration')).toBeInTheDocument()

    // Verify provider selection is available
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
    expect(screen.getByText('Google')).toBeInTheDocument()

    // Verify API key input field is present
    const apiKeyInput = screen.getByPlaceholderText(/Enter your .* API key/)
    expect(apiKeyInput).toBeInTheDocument()
    expect(apiKeyInput).toHaveAttribute('type', 'password')

    // Verify save and cancel buttons are present
    expect(screen.getByText('Save API Key')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('should not display dialog when isOpen is false', () => {
    // Property: Dialog should only be visible when explicitly opened
    
    render(<SettingsDialog isOpen={false} onClose={() => {}} />)

    // Verify dialog is not in the document
    expect(screen.queryByText('API Key Configuration')).not.toBeInTheDocument()
  })

  it('should display all three provider options for API key configuration', async () => {
    // Property: Settings dialog must provide options for all supported providers
    
    render(<SettingsDialog isOpen={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(window.electronAPI.getSettings).toHaveBeenCalled()
    })

    // Verify all three providers are available
    const providers = ['OpenAI', 'Anthropic', 'Google']
    providers.forEach(provider => {
      expect(screen.getByText(provider)).toBeInTheDocument()
    })
  })

  it('should have functional form controls for API key entry', async () => {
    // Property: Dialog must provide functional controls for entering and saving API keys
    
    render(<SettingsDialog isOpen={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(window.electronAPI.getSettings).toHaveBeenCalled()
    })

    // Verify input field is editable
    const apiKeyInput = screen.getByPlaceholderText(/Enter your .* API key/)
    expect(apiKeyInput).not.toBeDisabled()

    // Verify save button exists and is initially disabled (no key entered)
    const saveButton = screen.getByText('Save API Key')
    expect(saveButton).toBeDisabled()

    // Verify cancel button exists and is enabled
    const cancelButton = screen.getByText('Cancel')
    expect(cancelButton).not.toBeDisabled()
  })
})
