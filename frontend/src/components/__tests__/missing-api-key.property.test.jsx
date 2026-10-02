/**
 * Property-Based Tests for Missing API Key Handling
 * Feature: standalone-desktop-app, Property 13: Missing API key handling
 * Validates: Requirements 4.5
 * 
 * Property 13: Missing API key handling
 * For any application start without configured API keys, AI-dependent features should be
 * disabled and appropriate messaging should be displayed.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from '../../App'

// The configured-app cases render the notebook page. Keep its requests local
// and settled so they cannot update React after the test environment closes.
vi.mock('../../services/api', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    notebooksAPI: { ...actual.notebooksAPI, list: vi.fn().mockResolvedValue({ data: [] }) },
    progressAPI: {
      ...actual.progressAPI,
      getStatsByNotebook: vi.fn().mockResolvedValue({ data: [] }),
      getStats: vi.fn().mockResolvedValue({ data: {} }),
    },
    activityAPI: {
      ...actual.activityAPI,
      get: vi.fn().mockResolvedValue({ data: { heatmap: [], totals: {} } }),
      awards: vi.fn().mockResolvedValue({ data: { earned: [], locked: [] } }),
    },
  }
})

/**
 * Advance the welcome wizard to the AI-provider step.
 *
 * WelcomeScreen is a multi-step wizard, so the provider guidance is not on the
 * first screen. These tests assert that guidance, and have to walk to it.
 */
const goToProviderStep = async () => {
  await waitFor(() => {
    expect(screen.getByText('Welcome to Test Me')).toBeInTheDocument()
  }, { timeout: 3000 })
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() => {
    expect(screen.getByText(/Configure your AI provider/)).toBeInTheDocument()
  })
}

describe('Property 13: Missing API key handling', () => {
  beforeEach(() => {
    // Mock the Electron API
    global.window.electronAPI = {
      getSettings: vi.fn(),
      setSetting: vi.fn().mockResolvedValue({ success: true }),
      setApiKey: vi.fn().mockResolvedValue({ success: true }),
      getLogs: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getAppInfo: vi.fn().mockResolvedValue({ 
        success: true, 
        data: { version: '1.0.0', platform: 'test' } 
      }),
      getBackendPort: vi.fn().mockResolvedValue({
        success: true,
        data: { port: 8000, baseURL: 'http://localhost:8000/api' }
      })
    }
  })

  it('should display welcome screen when no API keys are configured', async () => {
    // Property: For any application start without configured API keys,
    // appropriate messaging should be displayed
    
    // Mock settings with no API keys and no welcome completed
    global.window.electronAPI.getSettings = vi.fn().mockResolvedValue({
      success: true,
      data: {
        apiProvider: null,
        apiKeys: {},
        welcomeCompleted: false
      }
    })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )

    // Walk to the provider step and verify API key configuration is offered
    await goToProviderStep()
  })

  it('should not display welcome screen when API keys are configured', async () => {
    // Property: Application should proceed normally when API keys are present
    
    // Mock settings with API keys configured
    global.window.electronAPI.getSettings = vi.fn().mockResolvedValue({
      success: true,
      data: {
        apiProvider: 'openai',
        apiKeys: {
          openai: 'sk-test-key'
        },
        welcomeCompleted: true
      }
    })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )

    // Wait for app to load
    await waitFor(() => {
      expect(window.electronAPI.getSettings).toHaveBeenCalled()
    })

    // Verify welcome screen is NOT displayed
    expect(screen.queryByText('Welcome to Test Me')).not.toBeInTheDocument()
  })

  it('should handle case where settings check fails gracefully', async () => {
    // Property: Application should handle errors in settings retrieval
    
    global.window.electronAPI.getSettings = vi.fn().mockRejectedValue(
      new Error('Failed to load settings')
    )

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )

    // App should still render without crashing
    await waitFor(() => {
      expect(window.electronAPI.getSettings).toHaveBeenCalled()
    })

    // Should not show welcome screen on error (fail safe)
    expect(screen.queryByText('Welcome to Test Me')).not.toBeInTheDocument()
  })

  it('should provide clear guidance for obtaining API keys', async () => {
    // Property: When API keys are missing, clear instructions should be provided
    
    global.window.electronAPI.getSettings = vi.fn().mockResolvedValue({
      success: true,
      data: {
        apiProvider: null,
        apiKeys: {},
        welcomeCompleted: false
      }
    })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )

    await goToProviderStep()

    // Verify guidance for all supported providers is present
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
    expect(screen.getByText('Google')).toBeInTheDocument()

    // Verify links to get API keys are provided
    const links = screen.getAllByText(/Get .* API key/)
    expect(links.length).toBeGreaterThan(0)
  })

  it('should allow user to configure API keys from welcome screen', async () => {
    // Property: Missing API key state should provide path to configuration
    
    global.window.electronAPI.getSettings = vi.fn().mockResolvedValue({
      success: true,
      data: {
        apiProvider: null,
        apiKeys: {},
        welcomeCompleted: false
      }
    })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )

    await goToProviderStep()

    // Verify there's a button to configure API keys
    expect(screen.getByText('Configure API Key Now')).toBeInTheDocument()
  })

  it('should allow user to skip API key configuration', async () => {
    // Property: User should be able to proceed without configuring API keys
    // (though AI features will be disabled)
    
    global.window.electronAPI.getSettings = vi.fn().mockResolvedValue({
      success: true,
      data: {
        apiProvider: null,
        apiKeys: {},
        welcomeCompleted: false
      }
    })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Welcome to Test Me')).toBeInTheDocument()
    })

    // Verify there's an option to skip
    expect(screen.getByText('Skip for now')).toBeInTheDocument()
  })
})
