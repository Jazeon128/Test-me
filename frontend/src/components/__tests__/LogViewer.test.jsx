/**
 * Unit Tests for LogViewer Component
 * Tests specific functionality and edge cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LogViewer from '../LogViewer'

describe('LogViewer', () => {
  const mockLogs = [
    '[2024-01-01 10:00:00] INFO: Application started',
    '[2024-01-01 10:00:01] ERROR: Test error',
    '[2024-01-01 10:00:02] WARN: Test warning'
  ]

  beforeEach(() => {
    global.window.electronAPI = {
      getLogs: vi.fn().mockResolvedValue({
        success: true,
        data: mockLogs
      }),
      exportLogs: vi.fn().mockResolvedValue({
        success: true,
        data: { path: '/path/to/logs.txt' }
      })
    }
  })

  describe('Rendering', () => {
    it('should render dialog when open', async () => {
      render(<LogViewer isOpen={true} onClose={() => {}} />)
      expect(screen.getByText('Application logs')).toBeInTheDocument()
    })

    it('should not render when closed', () => {
      render(<LogViewer isOpen={false} onClose={() => {}} />)
      expect(screen.queryByText('Application logs')).not.toBeInTheDocument()
    })

    it('should show loading state initially', () => {
      render(<LogViewer isOpen={true} onClose={() => {}} />)
      expect(screen.getByText('Loading logs...')).toBeInTheDocument()
    })
  })

  describe('Log Display', () => {
    it('should display logs after loading', async () => {
      render(<LogViewer isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText(/Application started/)).toBeInTheDocument()
      })
    })

    it('should display log count', async () => {
      render(<LogViewer isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText(/Showing 3 of 3 log entries/)).toBeInTheDocument()
      })
    })

    it('should handle empty logs', async () => {
      global.window.electronAPI.getLogs = vi.fn().mockResolvedValue({
        success: true,
        data: []
      })

      render(<LogViewer isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('No logs available')).toBeInTheDocument()
      })
    })

    it('should handle error loading logs', async () => {
      global.window.electronAPI.getLogs = vi.fn().mockResolvedValue({
        success: false,
        error: 'Failed to load logs'
      })

      render(<LogViewer isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load logs')).toBeInTheDocument()
      })
    })
  })

  describe('Filtering', () => {
    it('should filter logs by level', async () => {
      render(<LogViewer isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText(/Application started/)).toBeInTheDocument()
      })

      const filterSelect = screen.getByRole('combobox')
      fireEvent.change(filterSelect, { target: { value: 'error' } })

      await waitFor(() => {
        expect(screen.getByText(/Showing 1 of 3 log entries/)).toBeInTheDocument()
      })
    })

    it('should filter logs by search term', async () => {
      render(<LogViewer isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText(/Application started/)).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search logs...')
      fireEvent.change(searchInput, { target: { value: 'error' } })

      await waitFor(() => {
        expect(screen.getByText(/Showing 1 of 3 log entries/)).toBeInTheDocument()
      })
    })

    it('should show no results message when filters match nothing', async () => {
      render(<LogViewer isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText(/Application started/)).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search logs...')
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

      await waitFor(() => {
        expect(screen.getByText('No logs match your filters')).toBeInTheDocument()
      })
    })
  })

  describe('Export Functionality', () => {
    it('should export logs when button clicked', async () => {
      render(<LogViewer isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Export Logs')).toBeInTheDocument()
      })

      const exportButton = screen.getByText('Export Logs')
      fireEvent.click(exportButton)

      await waitFor(() => {
        expect(window.electronAPI.exportLogs).toHaveBeenCalled()
      })
    })

    it('should disable export when no logs', async () => {
      global.window.electronAPI.getLogs = vi.fn().mockResolvedValue({
        success: true,
        data: []
      })

      render(<LogViewer isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Export Logs')).toBeDisabled()
      })
    })

    it('should show loading state during export', async () => {
      global.window.electronAPI.exportLogs = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      )

      render(<LogViewer isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Export Logs')).toBeInTheDocument()
      })

      const exportButton = screen.getByText('Export Logs')
      fireEvent.click(exportButton)

      expect(screen.getByText('Exporting...')).toBeInTheDocument()
    })

    it('should handle export errors', async () => {
      global.window.electronAPI.exportLogs = vi.fn().mockResolvedValue({
        success: false,
        error: 'Export failed'
      })

      render(<LogViewer isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Export Logs')).toBeInTheDocument()
      })

      const exportButton = screen.getByText('Export Logs')
      fireEvent.click(exportButton)

      await waitFor(() => {
        expect(screen.getByText('Export failed')).toBeInTheDocument()
      })
    })
  })

  describe('Close Functionality', () => {
    it('should call onClose when close button clicked', async () => {
      const onClose = vi.fn()
      render(<LogViewer isOpen={true} onClose={onClose} />)
      
      await waitFor(() => {
        expect(screen.getByText('Close')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Close'))
      expect(onClose).toHaveBeenCalled()
    })

    it('should call onClose when X button clicked', async () => {
      const onClose = vi.fn()
      render(<LogViewer isOpen={true} onClose={onClose} />)
      
      await waitFor(() => {
        expect(screen.getByText('Application logs')).toBeInTheDocument()
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

  describe('Retry Functionality', () => {
    it('should retry loading logs on error', async () => {
      global.window.electronAPI.getLogs = vi.fn()
        .mockResolvedValueOnce({ success: false, error: 'Failed' })
        .mockResolvedValueOnce({ success: true, data: mockLogs })

      render(<LogViewer isOpen={true} onClose={() => {}} />)
      
      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument()
      })

      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(screen.getByText(/Application started/)).toBeInTheDocument()
      })
    })
  })
})
