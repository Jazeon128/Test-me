/**
 * Property-Based Tests for LogViewer Component
 * Feature: standalone-desktop-app, Property 25: Log viewer availability
 * Feature: standalone-desktop-app, Property 27: Log export
 * Validates: Requirements 9.1, 9.2, 9.4
 * 
 * Property 25: Log viewer availability
 * For any running application, the help menu should contain an option to view logs,
 * and selecting it should display a log viewer dialog.
 * 
 * Property 27: Log export
 * For any log export operation, a log file should be created at the user-selected location.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import LogViewer from '../LogViewer'

describe('Property 25: Log viewer availability', () => {
  const mockLogs = [
    '[2024-01-01 10:00:00] INFO: Application started',
    '[2024-01-01 10:00:01] INFO: Backend connected',
    '[2024-01-01 10:00:02] ERROR: Failed to load document',
    '[2024-01-01 10:00:03] WARN: API rate limit approaching'
  ]

  beforeEach(() => {
    // Mock the Electron API
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

  it('should display log viewer dialog when opened', async () => {
    // Property: Opening the log viewer should display a dialog with log entries
    
    render(<LogViewer isOpen={true} onClose={() => {}} />)

    // Verify dialog title is displayed
    expect(screen.getByText('Application logs')).toBeInTheDocument()

    // Wait for logs to load
    await waitFor(() => {
      expect(window.electronAPI.getLogs).toHaveBeenCalled()
    })

    // Verify log entries are displayed
    await waitFor(() => {
      expect(screen.getByText(/Application started/)).toBeInTheDocument()
    })
  })

  it('should not display dialog when isOpen is false', () => {
    // Property: Dialog should only be visible when explicitly opened
    
    render(<LogViewer isOpen={false} onClose={() => {}} />)

    // Verify dialog is not in the document
    expect(screen.queryByText('Application logs')).not.toBeInTheDocument()
  })

  it('should display all log entries from the application', async () => {
    // Property: For any set of logs, all entries should be displayed in the viewer
    
    render(<LogViewer isOpen={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(window.electronAPI.getLogs).toHaveBeenCalled()
    })

    // Verify all log entries are displayed
    await waitFor(() => {
      mockLogs.forEach(log => {
        // Check for partial text since the full log might be split across elements
        const logText = log.split('] ')[1] // Get the message part
        expect(screen.getByText(new RegExp(logText))).toBeInTheDocument()
      })
    })
  })

  it('should provide filtering options for log levels', async () => {
    // Property: Log viewer must provide filtering capabilities
    
    render(<LogViewer isOpen={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(window.electronAPI.getLogs).toHaveBeenCalled()
    })

    // Verify filter dropdown exists
    const filterSelect = screen.getByRole('combobox')
    expect(filterSelect).toBeInTheDocument()

    // Verify filter options are available
    expect(screen.getByText('All Levels')).toBeInTheDocument()
    expect(screen.getByText('Errors')).toBeInTheDocument()
    expect(screen.getByText('Warnings')).toBeInTheDocument()
    expect(screen.getByText('Info')).toBeInTheDocument()
  })

  it('should provide search functionality for logs', async () => {
    // Property: Log viewer must provide search capabilities
    
    render(<LogViewer isOpen={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(window.electronAPI.getLogs).toHaveBeenCalled()
    })

    // Verify search input exists
    const searchInput = screen.getByPlaceholderText('Search logs...')
    expect(searchInput).toBeInTheDocument()
    expect(searchInput).not.toBeDisabled()
  })

  it('should display log count information', async () => {
    // Property: Log viewer should show the number of displayed vs total logs
    
    render(<LogViewer isOpen={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(window.electronAPI.getLogs).toHaveBeenCalled()
    })

    // Verify log count is displayed
    await waitFor(() => {
      expect(screen.getByText(/Showing \d+ of \d+ log entries/)).toBeInTheDocument()
    })
  })
})

describe('Property 27: Log export', () => {
  const mockLogs = [
    '[2024-01-01 10:00:00] INFO: Application started',
    '[2024-01-01 10:00:01] ERROR: Test error'
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

  it('should provide export functionality for logs', async () => {
    // Property: For any log export operation, the export function should be called
    
    render(<LogViewer isOpen={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(window.electronAPI.getLogs).toHaveBeenCalled()
    })

    // The logs arrive after getLogs resolves, so wait for the button to enable
    // rather than assuming it already has.
    const exportButton = screen.getByText('Export Logs')
    expect(exportButton).toBeInTheDocument()
    await waitFor(() => expect(exportButton).not.toBeDisabled())

    fireEvent.click(exportButton)

    // Verify export was called
    await waitFor(() => {
      expect(window.electronAPI.exportLogs).toHaveBeenCalled()
    })
  })

  it('should disable export when no logs are available', async () => {
    // Property: Export should only be available when logs exist
    
    global.window.electronAPI.getLogs = vi.fn().mockResolvedValue({
      success: true,
      data: []
    })

    render(<LogViewer isOpen={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(window.electronAPI.getLogs).toHaveBeenCalled()
    })

    // Verify export button is disabled when no logs
    const exportButton = screen.getByText('Export Logs')
    expect(exportButton).toBeDisabled()
  })

  it('should handle export operation for any set of logs', async () => {
    // Property: Export should work regardless of log content or quantity
    
    const largeMockLogs = Array.from({ length: 100 }, (_, i) => 
      `[2024-01-01 10:00:${i}] INFO: Log entry ${i}`
    )

    global.window.electronAPI.getLogs = vi.fn().mockResolvedValue({
      success: true,
      data: largeMockLogs
    })

    render(<LogViewer isOpen={true} onClose={() => {}} />)

    await waitFor(() => {
      expect(window.electronAPI.getLogs).toHaveBeenCalled()
    })

    const exportButton = screen.getByText('Export Logs')
    fireEvent.click(exportButton)

    // Verify export was called even with large log set
    await waitFor(() => {
      expect(window.electronAPI.exportLogs).toHaveBeenCalled()
    })
  })
})
