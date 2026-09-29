/**
 * UpdateNotification Component
 * Displays update notifications and handles update flow
 * Implements Requirements 5.2: Display update notification with accept/decline buttons
 * Implements Requirements 5.3: Show download progress
 */

import { useState, useEffect } from 'react';

const UpdateNotification = () => {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [error, setError] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check that electronAPI exposes the update channel. Presence of the object
    // is not enough: an older preload, or a build without the auto-updater, has
    // no onUpdateEvent, and calling it would crash the app at mount.
    if (typeof window.electronAPI?.onUpdateEvent !== 'function') {
      return;
    }

    // Listen for update available event
    const handleUpdateAvailable = (event, info) => {
      console.log('Update available:', info);
      setUpdateInfo(info);
      setIsVisible(true);
      setIsDownloading(false);
      setIsDownloaded(false);
      setError(null);
    };

    // Listen for download progress
    const handleDownloadProgress = (event, progress) => {
      console.log('Download progress:', progress);
      setDownloadProgress(progress.percent);
    };

    // Listen for update downloaded
    const handleUpdateDownloaded = (event, info) => {
      console.log('Update downloaded:', info);
      setIsDownloading(false);
      setIsDownloaded(true);
    };

    // Listen for update errors
    const handleUpdateError = (event, errorInfo) => {
      console.error('Update error:', errorInfo);
      setError(errorInfo.message);
      setIsDownloading(false);
    };

    // Register event listeners
    window.electronAPI.onUpdateEvent('available', handleUpdateAvailable);
    window.electronAPI.onUpdateEvent('download-progress', handleDownloadProgress);
    window.electronAPI.onUpdateEvent('downloaded', handleUpdateDownloaded);
    window.electronAPI.onUpdateEvent('error', handleUpdateError);

    // Cleanup
    return () => {
      if (typeof window.electronAPI?.removeUpdateListener === 'function') {
        window.electronAPI.removeUpdateListener('available', handleUpdateAvailable);
        window.electronAPI.removeUpdateListener('download-progress', handleDownloadProgress);
        window.electronAPI.removeUpdateListener('downloaded', handleUpdateDownloaded);
        window.electronAPI.removeUpdateListener('error', handleUpdateError);
      }
    };
  }, []);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      setError(null);
      const result = await window.electronAPI.downloadUpdate();
      if (!result.success) {
        setError(result.error || 'Failed to start download');
        setIsDownloading(false);
      }
    } catch (err) {
      console.error('Error downloading update:', err);
      setError(err.message || 'Failed to start download');
      setIsDownloading(false);
    }
  };

  const handleInstall = async () => {
    try {
      await window.electronAPI.installUpdate();
      // App will restart, so no need to update state
    } catch (err) {
      console.error('Error installing update:', err);
      setError(err.message || 'Failed to install update');
    }
  };

  const handleDecline = () => {
    setIsVisible(false);
    setUpdateInfo(null);
    setIsDownloading(false);
    setIsDownloaded(false);
    setDownloadProgress(0);
    setError(null);
  };

  if (!isVisible || !updateInfo) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center">
            <svg
              className="w-6 h-6 text-blue-500 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Update Available
            </h3>
          </div>
          <button
            onClick={handleDecline}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            Version {updateInfo.version} is now available!
          </p>
          {updateInfo.releaseDate && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Released: {new Date(updateInfo.releaseDate).toLocaleDateString()}
            </p>
          )}
          {updateInfo.releaseNotes && (
            <div className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-2 rounded max-h-32 overflow-y-auto">
              {updateInfo.releaseNotes}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Download Progress */}
        {isDownloading && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Downloading...
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {downloadProgress.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {!isDownloading && !isDownloaded && (
            <>
              <button
                onClick={handleDownload}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors"
              >
                Download Now
              </button>
              <button
                onClick={handleDecline}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md font-medium transition-colors"
              >
                Later
              </button>
            </>
          )}

          {isDownloaded && (
            <>
              <button
                onClick={handleInstall}
                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md font-medium transition-colors"
              >
                Restart & Install
              </button>
              <button
                onClick={handleDecline}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md font-medium transition-colors"
              >
                Later
              </button>
            </>
          )}

          {isDownloading && (
            <button
              disabled
              className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-md font-medium cursor-not-allowed"
            >
              Downloading...
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
