/**
 * Property-Based Tests for API Error Messaging
 * Feature: standalone-desktop-app, Property 16: API error messaging
 * Validates: Requirements 6.3
 * 
 * Property 16: API error messaging
 * For any AI API error response, the application should display a user-friendly
 * error message with suggested actions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useApiError } from '../useApiError';

describe('Property 16: API error messaging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide user-friendly message for network errors', () => {
    // Property: For any network error, a user-friendly message should be displayed
    
    const { result } = renderHook(() => useApiError());

    const networkError = {
      originalError: new Error('Network Error'),
      code: 'ERR_NETWORK',
      userMessage: 'Unable to connect to the backend server. The server may not be running.',
      suggestedActions: [
        'Check if the application is fully started',
        'Try restarting the application',
        'Check the application logs for backend errors',
      ],
    };

    act(() => {
      result.current.handleApiError(networkError);
    });

    expect(result.current.isErrorDialogOpen).toBe(true);
    expect(result.current.error.message).toContain('backend server');
    expect(result.current.error.troubleshootingSteps.length).toBeGreaterThan(0);
  });

  it('should provide user-friendly message for 400 Bad Request errors', () => {
    // Property: For any 400 error, appropriate guidance should be provided
    
    const { result } = renderHook(() => useApiError());

    const badRequestError = {
      status: 400,
      userMessage: 'Invalid request. Please check your input and try again.',
      suggestedActions: [
        'Verify that all required fields are filled correctly',
        'Check that file formats are supported',
        'Ensure data is in the correct format',
      ],
    };

    act(() => {
      result.current.handleApiError(badRequestError);
    });

    expect(result.current.isErrorDialogOpen).toBe(true);
    expect(result.current.error.message).toContain('Invalid request');
    expect(result.current.error.troubleshootingSteps).toContain('Verify that all required fields are filled correctly');
  });

  it('should provide user-friendly message for 401 Unauthorized errors', () => {
    // Property: For any authentication error, API key guidance should be provided
    
    const { result } = renderHook(() => useApiError());

    const authError = {
      status: 401,
      userMessage: 'Authentication failed. Please check your API key configuration.',
      suggestedActions: [
        'Verify your API key is correct',
        'Check that your API key has not expired',
        'Try reconfiguring your API key in settings',
      ],
    };

    act(() => {
      result.current.handleApiError(authError);
    });

    expect(result.current.isErrorDialogOpen).toBe(true);
    expect(result.current.error.message).toContain('API key');
    expect(result.current.error.troubleshootingSteps).toContain('Verify your API key is correct');
  });

  it('should provide user-friendly message for 429 Rate Limit errors', () => {
    // Property: For any rate limit error, appropriate wait guidance should be provided
    
    const { result } = renderHook(() => useApiError());

    const rateLimitError = {
      status: 429,
      userMessage: 'Too many requests. Please slow down and try again later.',
      suggestedActions: [
        'Wait a few minutes before trying again',
        'Check your API rate limits',
        'Consider upgrading your API plan if needed',
      ],
    };

    act(() => {
      result.current.handleApiError(rateLimitError);
    });

    expect(result.current.isErrorDialogOpen).toBe(true);
    expect(result.current.error.message).toContain('Too many requests');
    expect(result.current.error.troubleshootingSteps).toContain('Wait a few minutes before trying again');
  });

  it('should provide user-friendly message for 500 Internal Server errors', () => {
    // Property: For any server error, reassuring message should be provided
    
    const { result } = renderHook(() => useApiError());

    const serverError = {
      status: 500,
      userMessage: 'An internal server error occurred. This is not your fault.',
      suggestedActions: [
        'Try again in a few moments',
        'Check the application logs for details',
        'Report this issue if it persists',
      ],
    };

    act(() => {
      result.current.handleApiError(serverError);
    });

    expect(result.current.isErrorDialogOpen).toBe(true);
    expect(result.current.error.message).toContain('server error');
    expect(result.current.error.troubleshootingSteps).toContain('Try again in a few moments');
  });

  it('should provide user-friendly message for timeout errors', () => {
    // Property: For any timeout error, appropriate guidance should be provided
    
    const { result } = renderHook(() => useApiError());

    const timeoutError = {
      code: 'ETIMEDOUT',
      userMessage: 'The request timed out. The operation took too long to complete.',
      suggestedActions: [
        'Try again with a smaller file or fewer questions',
        'Check your internet connection',
        'Increase the timeout in settings if available',
      ],
    };

    act(() => {
      result.current.handleApiError(timeoutError);
    });

    expect(result.current.isErrorDialogOpen).toBe(true);
    expect(result.current.error.message).toContain('timed out');
    expect(result.current.error.troubleshootingSteps.length).toBeGreaterThan(0);
  });

  it('should allow closing error dialog', () => {
    // Property: For any error dialog, user should be able to close it
    
    const { result } = renderHook(() => useApiError());

    act(() => {
      result.current.handleApiError({
        userMessage: 'Test error',
        suggestedActions: ['Action 1'],
      });
    });

    expect(result.current.isErrorDialogOpen).toBe(true);

    act(() => {
      result.current.closeErrorDialog();
    });

    expect(result.current.isErrorDialogOpen).toBe(false);
  });

  it('should allow clearing error state', () => {
    // Property: Error state should be clearable
    
    const { result } = renderHook(() => useApiError());

    act(() => {
      result.current.handleApiError({
        userMessage: 'Test error',
        suggestedActions: ['Action 1'],
      });
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.isErrorDialogOpen).toBe(true);

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isErrorDialogOpen).toBe(false);
  });

  it('should support retry functionality', async () => {
    // Property: For any error, retry functionality should be available
    
    const { result } = renderHook(() => useApiError());
    const mockRetryFn = vi.fn().mockResolvedValue({ success: true });

    act(() => {
      result.current.handleApiError({
        userMessage: 'Test error',
        suggestedActions: ['Action 1'],
      });
    });

    expect(result.current.isErrorDialogOpen).toBe(true);

    await act(async () => {
      await result.current.retryOperation(mockRetryFn);
    });

    expect(mockRetryFn).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.isErrorDialogOpen).toBe(false);
  });

  it('should handle retry failures gracefully', async () => {
    // Property: For any failed retry, new error should be displayed
    
    const { result } = renderHook(() => useApiError());
    const newError = {
      userMessage: 'Retry failed',
      suggestedActions: ['Try again later'],
    };
    const mockRetryFn = vi.fn().mockRejectedValue(newError);

    act(() => {
      result.current.handleApiError({
        userMessage: 'Initial error',
        suggestedActions: ['Action 1'],
      });
    });

    await act(async () => {
      await result.current.retryOperation(mockRetryFn);
    });

    expect(mockRetryFn).toHaveBeenCalledTimes(1);
    expect(result.current.isErrorDialogOpen).toBe(true);
    expect(result.current.error.message).toBe('Retry failed');
  });

  it('should provide suggested actions for all error types', () => {
    // Property: For any error, at least one suggested action should be provided
    
    const { result } = renderHook(() => useApiError());

    const errorTypes = [
      { status: 400, userMessage: 'Bad request', suggestedActions: ['Check input'] },
      { status: 401, userMessage: 'Unauthorized', suggestedActions: ['Check API key'] },
      { status: 403, userMessage: 'Forbidden', suggestedActions: ['Check permissions'] },
      { status: 404, userMessage: 'Not found', suggestedActions: ['Verify resource'] },
      { status: 429, userMessage: 'Rate limit', suggestedActions: ['Wait'] },
      { status: 500, userMessage: 'Server error', suggestedActions: ['Try again'] },
      { status: 503, userMessage: 'Service unavailable', suggestedActions: ['Wait'] },
      { code: 'ERR_NETWORK', userMessage: 'Network error', suggestedActions: ['Check connection'] },
      { code: 'ETIMEDOUT', userMessage: 'Timeout', suggestedActions: ['Try again'] },
    ];

    errorTypes.forEach((errorType) => {
      act(() => {
        result.current.handleApiError(errorType);
      });

      expect(result.current.error.troubleshootingSteps.length).toBeGreaterThan(0);
      
      act(() => {
        result.current.clearError();
      });
    });
  });

  it('should preserve original error for debugging', () => {
    // Property: For any error, original error should be preserved
    
    const { result } = renderHook(() => useApiError());
    const originalError = new Error('Original error message');

    act(() => {
      result.current.handleApiError({
        originalError,
        userMessage: 'User-friendly message',
        suggestedActions: ['Action 1'],
      });
    });

    expect(result.current.error.originalError).toBe(originalError);
  });

  it('should handle errors without suggested actions gracefully', () => {
    // Property: Error handling should work even without suggested actions
    
    const { result } = renderHook(() => useApiError());

    act(() => {
      result.current.handleApiError({
        userMessage: 'Error without actions',
      });
    });

    expect(result.current.isErrorDialogOpen).toBe(true);
    expect(result.current.error.message).toBe('Error without actions');
    expect(result.current.error.troubleshootingSteps).toEqual([]);
  });
});
