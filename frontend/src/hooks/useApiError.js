import { useState, useCallback } from 'react';

/**
 * Custom hook for managing API error states
 * Implements Requirements 6.3: API error handling with user-friendly messages
 */
export const useApiError = () => {
  const [error, setError] = useState(null);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);

  /**
   * Handle an API error
   * @param {Object} apiError - Enhanced error object from API interceptor
   */
  const handleApiError = useCallback((apiError) => {
    setError({
      title: `Error ${apiError.status || 'Unknown'}`,
      message: apiError.userMessage || 'An unexpected error occurred.',
      troubleshootingSteps: apiError.suggestedActions || [],
      originalError: apiError.originalError,
    });
    setIsErrorDialogOpen(true);
  }, []);

  /**
   * Close the error dialog
   */
  const closeErrorDialog = useCallback(() => {
    setIsErrorDialogOpen(false);
  }, []);

  /**
   * Clear the error state
   */
  const clearError = useCallback(() => {
    setError(null);
    setIsErrorDialogOpen(false);
  }, []);

  /**
   * Retry the failed operation
   * @param {Function} retryFn - Function to retry the operation
   */
  const retryOperation = useCallback(async (retryFn) => {
    if (!retryFn) {
      closeErrorDialog();
      return;
    }

    try {
      await retryFn();
      clearError();
    } catch (err) {
      // If retry fails, show the new error
      handleApiError(err);
    }
  }, [closeErrorDialog, clearError, handleApiError]);

  return {
    error,
    isErrorDialogOpen,
    handleApiError,
    closeErrorDialog,
    clearError,
    retryOperation,
  };
};

export default useApiError;
