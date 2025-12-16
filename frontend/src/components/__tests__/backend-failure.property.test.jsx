/**
 * Property-Based Tests for Backend Failure Handling
 * Feature: standalone-desktop-app, Property 15: Backend failure handling
 * Validates: Requirements 6.1
 * 
 * Property 15: Backend failure handling
 * For any backend startup failure, the application should display an error dialog
 * with troubleshooting information.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ErrorDialog from '../ErrorDialog';
import { useBackendError } from '../../hooks/useBackendError';
import { renderHook, act } from '@testing-library/react';

describe('Property 15: Backend failure handling', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  it('should display error dialog when backend fails to start', async () => {
    // Property: For any backend startup failure, an error dialog should be displayed
    
    const mockError = {
      title: 'Backend Connection Error',
      message: 'The backend server failed to start.',
      troubleshootingSteps: [
        'Check if another instance is running',
        'Ensure ports are not blocked',
        'Try restarting the application',
      ],
    };

    render(
      <ErrorDialog
        isOpen={true}
        onClose={() => {}}
        title={mockError.title}
        message={mockError.message}
        troubleshootingSteps={mockError.troubleshootingSteps}
        onRetry={() => {}}
      />
    );

    // Verify error dialog is displayed
    expect(screen.getByText('Backend Connection Error')).toBeInTheDocument();
    expect(screen.getByText('The backend server failed to start.')).toBeInTheDocument();
  });

  it('should display troubleshooting steps in error dialog', async () => {
    // Property: For any backend failure, troubleshooting steps should be provided
    
    const troubleshootingSteps = [
      'Check if another instance of FlashLearn is already running',
      'Ensure ports 8000-8010 are not blocked by a firewall',
      'Try restarting the application',
      'If the problem persists, check the application logs for more details',
    ];

    render(
      <ErrorDialog
        isOpen={true}
        onClose={() => {}}
        title="Backend Error"
        message="Backend failed to start"
        troubleshootingSteps={troubleshootingSteps}
        onRetry={() => {}}
      />
    );

    // Verify all troubleshooting steps are displayed
    troubleshootingSteps.forEach(step => {
      expect(screen.getByText(step)).toBeInTheDocument();
    });

    // Verify troubleshooting section header
    expect(screen.getByText('Troubleshooting Steps:')).toBeInTheDocument();
  });

  it('should provide retry functionality for backend failures', async () => {
    // Property: For any backend failure, user should be able to retry
    
    const mockRetry = vi.fn();

    render(
      <ErrorDialog
        isOpen={true}
        onClose={() => {}}
        title="Backend Error"
        message="Backend failed to start"
        troubleshootingSteps={['Step 1', 'Step 2']}
        onRetry={mockRetry}
        showRetry={true}
      />
    );

    // Find and click retry button
    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);

    // Verify retry was called
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('should allow closing error dialog', async () => {
    // Property: For any error dialog, user should be able to close it
    
    const mockClose = vi.fn();

    render(
      <ErrorDialog
        isOpen={true}
        onClose={mockClose}
        title="Backend Error"
        message="Backend failed to start"
        troubleshootingSteps={['Step 1']}
        onRetry={() => {}}
      />
    );

    // Find and click close button
    const closeButton = screen.getByText('Close');
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);

    // Verify close was called
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('should not render when isOpen is false', () => {
    // Property: Error dialog should only be visible when there's an error
    
    render(
      <ErrorDialog
        isOpen={false}
        onClose={() => {}}
        title="Backend Error"
        message="Backend failed to start"
        troubleshootingSteps={['Step 1']}
        onRetry={() => {}}
      />
    );

    // Verify dialog is not rendered
    expect(screen.queryByText('Backend Error')).not.toBeInTheDocument();
  });

  it('should handle backend errors from Electron API', async () => {
    // Property: For any backend error event from Electron, the hook should update state
    
    // Mock Electron API
    let errorHandler = null;
    global.window.electronAPI = {
      onBackendError: vi.fn((handler) => {
        errorHandler = handler;
      }),
      removeBackendErrorListener: vi.fn(),
      restartBackend: vi.fn().mockResolvedValue({ success: true }),
    };

    const { result } = renderHook(() => useBackendError());

    // Initially no error
    expect(result.current.isErrorDialogOpen).toBe(false);

    // Simulate backend error event
    act(() => {
      if (errorHandler) {
        errorHandler({
          message: 'Backend crashed unexpectedly',
        });
      }
    });

    // Verify error state is updated
    await waitFor(() => {
      expect(result.current.isErrorDialogOpen).toBe(true);
      expect(result.current.error).toBeTruthy();
      expect(result.current.error.message.toLowerCase()).toContain('backend');
    });
  });

  it('should handle retry backend functionality', async () => {
    // Property: For any retry attempt, the backend should be restarted
    
    const mockRestartBackend = vi.fn().mockResolvedValue({ success: true });
    
    global.window.electronAPI = {
      onBackendError: vi.fn(),
      removeBackendErrorListener: vi.fn(),
      restartBackend: mockRestartBackend,
    };

    const { result } = renderHook(() => useBackendError());

    // Manually set error state
    act(() => {
      result.current.error = { message: 'Test error' };
    });

    // Call retry
    await act(async () => {
      await result.current.retryBackend();
    });

    // Verify restart was called
    expect(mockRestartBackend).toHaveBeenCalledTimes(1);
  });

  it('should provide link to logs in error dialog', () => {
    // Property: For any error, user should be directed to logs for more details
    
    render(
      <ErrorDialog
        isOpen={true}
        onClose={() => {}}
        title="Backend Error"
        message="Backend failed to start"
        troubleshootingSteps={['Step 1']}
        onRetry={() => {}}
      />
    );

    // Verify log access information is present
    expect(screen.getByText(/Check the application logs/i)).toBeInTheDocument();
    expect(screen.getByText(/Help menu/i)).toBeInTheDocument();
  });

  it('should handle multiple backend failure scenarios', async () => {
    // Property: For any type of backend failure, appropriate error should be shown
    
    const failureScenarios = [
      {
        message: 'Port already in use',
        expectedInDialog: true,
      },
      {
        message: 'Backend executable not found',
        expectedInDialog: true,
      },
      {
        message: 'Database initialization failed',
        expectedInDialog: true,
      },
      {
        message: 'Backend crashed unexpectedly',
        expectedInDialog: true,
      },
    ];

    for (const scenario of failureScenarios) {
      const { unmount } = render(
        <ErrorDialog
          isOpen={true}
          onClose={() => {}}
          title="Backend Error"
          message={scenario.message}
          troubleshootingSteps={['Step 1']}
          onRetry={() => {}}
        />
      );

      // Verify error message is displayed
      if (scenario.expectedInDialog) {
        expect(screen.getByText(scenario.message)).toBeInTheDocument();
      }

      unmount();
    }
  });

  it('should optionally hide retry button when showRetry is false', () => {
    // Property: Retry button visibility should be configurable
    
    render(
      <ErrorDialog
        isOpen={true}
        onClose={() => {}}
        title="Backend Error"
        message="Backend failed to start"
        troubleshootingSteps={['Step 1']}
        onRetry={() => {}}
        showRetry={false}
      />
    );

    // Verify retry button is not present
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    
    // But close button should still be present
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('should handle case where no troubleshooting steps are provided', () => {
    // Property: Error dialog should work even without troubleshooting steps
    
    render(
      <ErrorDialog
        isOpen={true}
        onClose={() => {}}
        title="Backend Error"
        message="Backend failed to start"
        troubleshootingSteps={[]}
        onRetry={() => {}}
      />
    );

    // Verify error message is still displayed
    expect(screen.getByText('Backend Error')).toBeInTheDocument();
    expect(screen.getByText('Backend failed to start')).toBeInTheDocument();
    
    // Troubleshooting section should not be rendered
    expect(screen.queryByText('Troubleshooting Steps:')).not.toBeInTheDocument();
  });
});
