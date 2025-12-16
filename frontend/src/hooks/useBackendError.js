import { useState, useEffect } from 'react';

/**
 * Custom hook for managing backend error states
 * Implements Requirements 6.1: Backend failure handling
 */
export const useBackendError = () => {
  const [error, setError] = useState(null);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);

  // Listen for backend errors from Electron
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleBackendError = (errorData) => {
      setError({
        title: 'Backend Connection Error',
        message: errorData.message || 'The backend server failed to start or has stopped responding.',
        troubleshootingSteps: [
          'Check if another instance of FlashLearn is already running',
          'Ensure ports 8000-8010 are not blocked by a firewall',
          'Try restarting the application',
          'If the problem persists, check the application logs for more details',
        ],
      });
      setIsErrorDialogOpen(true);
    };

    // Register listener if available
    if (window.electronAPI.onBackendError) {
      window.electronAPI.onBackendError(handleBackendError);
    }

    return () => {
      // Cleanup listener if available
      if (window.electronAPI.removeBackendErrorListener) {
        window.electronAPI.removeBackendErrorListener(handleBackendError);
      }
    };
  }, []);

  const closeErrorDialog = () => {
    setIsErrorDialogOpen(false);
  };

  const retryBackend = async () => {
    if (window.electronAPI && window.electronAPI.restartBackend) {
      try {
        await window.electronAPI.restartBackend();
        setIsErrorDialogOpen(false);
        setError(null);
      } catch (err) {
        // Keep dialog open if retry fails
        console.error('Failed to restart backend:', err);
      }
    }
  };

  return {
    error,
    isErrorDialogOpen,
    closeErrorDialog,
    retryBackend,
  };
};

export default useBackendError;
