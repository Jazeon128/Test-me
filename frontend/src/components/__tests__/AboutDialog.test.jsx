/**
 * Unit Tests for AboutDialog Component
 * Tests specific functionality and edge cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AboutDialog from '../AboutDialog'

describe('AboutDialog', () => {
  const mockAppInfo = {
    version: '1.0.0',
    platform: 'darwin',
    arch: 'x64',
    electronVersion: '28.0.0'
  }

  beforeEach(() => {
    global.window.electronAPI = {
      getAppInfo: vi.fn().mockResolvedValue({
        success: true,
        data: mockAppInfo
      })
    }

    // Mock window.open
    global.window.open = vi.fn()
  })

  describe('Rendering', () => {
    it('should render dialog when open', async () => {
      render(<AboutDialog isOpen={true} onClose={() => {}} />)
      expect(screen.getByText('About Test Me')).toBeInTheDocument()
    })

    it('should not render when closed', () => {
      render(<AboutDialog isOpen={false} onClose={() => {}} />)
      expect(screen.queryByText('About Test Me')).not.toBeInTheDocument()
    })

    it('should show loading state initially', () => {
      render(<AboutDialog isOpen={true} onClose={() => {}} />)
      const loadingSpinner = document.querySelector('.animate-spin')
      expect(loadingSpinner).toBeInTheDocument()
    })
  })

  describe('App Information Display', () => {
    it('should display app name and tagline', async () => {
      render(<AboutDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Test Me')).toBeInTheDocument()
      })
      
      expect(screen.getByText('AI-Powered Flashcard Generator')).toBeInTheDocument()
    })

    it('should display version number', async () => {
      render(<AboutDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Version 1.0.0')).toBeInTheDocument()
      })
    })

    it('should display platform information', async () => {
      render(<AboutDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Platform')).toBeInTheDocument()
      })
      
      expect(screen.getByText('darwin')).toBeInTheDocument()
    })

    it('should display architecture', async () => {
      render(<AboutDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Architecture')).toBeInTheDocument()
      })
      
      expect(screen.getByText('x64')).toBeInTheDocument()
    })

    it('should display Electron version', async () => {
      render(<AboutDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Electron Version')).toBeInTheDocument()
      })
      
      expect(screen.getByText('28.0.0')).toBeInTheDocument()
    })

    it('should handle missing optional fields gracefully', async () => {
      global.window.electronAPI.getAppInfo = vi.fn().mockResolvedValue({
        success: true,
        data: {
          version: '1.0.0',
          platform: 'darwin'
          // arch and electronVersion missing
        }
      })

      render(<AboutDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Version 1.0.0')).toBeInTheDocument()
      })
      
      // Should not crash, just not display missing fields
      expect(screen.queryByText('Architecture')).not.toBeInTheDocument()
    })
  })

  describe('Resource Links', () => {
    it('should display documentation link', async () => {
      render(<AboutDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Documentation')).toBeInTheDocument()
      })
    })

    it('should display issue reporting link', async () => {
      render(<AboutDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Report an Issue')).toBeInTheDocument()
      })
    })

    it('should display release notes link', async () => {
      render(<AboutDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Release Notes')).toBeInTheDocument()
      })
    })

    it('should open external links when clicked', async () => {
      render(<AboutDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Documentation')).toBeInTheDocument()
      })

      const docLink = screen.getByText('Documentation')
      fireEvent.click(docLink)

      expect(window.open).toHaveBeenCalled()
    })
  })

  describe('Copyright Information', () => {
    it('should display copyright notice', async () => {
      render(<AboutDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        const currentYear = new Date().getFullYear()
        expect(screen.getByText(new RegExp(`© ${currentYear}`))).toBeInTheDocument()
      })
    })
  })

  describe('Close Functionality', () => {
    it('should call onClose when close button clicked', async () => {
      const onClose = vi.fn()
      render(<AboutDialog isOpen={true} onClose={onClose} />)
      
      await waitFor(() => {
        expect(screen.getByText('Close')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Close'))
      expect(onClose).toHaveBeenCalled()
    })

    it('should call onClose when X button clicked', async () => {
      const onClose = vi.fn()
      render(<AboutDialog isOpen={true} onClose={onClose} />)
      
      await waitFor(() => {
        expect(screen.getByText('About Test Me')).toBeInTheDocument()
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

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      global.window.electronAPI.getAppInfo = vi.fn().mockRejectedValue(
        new Error('Failed to load app info')
      )

      render(<AboutDialog isOpen={true} onClose={() => {}} />)
      
      // Should not crash, just not display app info
      await waitFor(() => {
        expect(window.electronAPI.getAppInfo).toHaveBeenCalled()
      })

      // Basic UI should still be present
      expect(screen.getByText('About Test Me')).toBeInTheDocument()
    })

    it('should handle unsuccessful API response', async () => {
      global.window.electronAPI.getAppInfo = vi.fn().mockResolvedValue({
        success: false,
        error: 'Failed to get info'
      })

      render(<AboutDialog isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(window.electronAPI.getAppInfo).toHaveBeenCalled()
      })

      // Should still render basic UI
      expect(screen.getByText('About Test Me')).toBeInTheDocument()
    })
  })
})
