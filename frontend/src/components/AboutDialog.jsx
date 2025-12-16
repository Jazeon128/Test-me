import { useState, useEffect } from 'react'
import { X, Info, ExternalLink, Monitor, Cpu, HardDrive } from 'lucide-react'

/**
 * AboutDialog Component
 * Displays application version, system information, and helpful links
 * Implements Requirements 9.3: Display version and system information
 */
export default function AboutDialog({ isOpen, onClose }) {
  const [appInfo, setAppInfo] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  // Load app info when dialog opens
  useEffect(() => {
    if (isOpen && window.electronAPI) {
      loadAppInfo()
    }
  }, [isOpen])

  const loadAppInfo = async () => {
    setIsLoading(true)
    
    try {
      const response = await window.electronAPI.getAppInfo()
      
      if (response.success) {
        setAppInfo(response.data)
      }
    } catch (error) {
      console.error('Failed to load app info:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const openLink = (url) => {
    // In Electron, we should use shell.openExternal, but for now we'll use window.open
    // This will be handled by the main process
    window.open(url, '_blank')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 dark:bg-primary-900/30 p-2 rounded-lg">
              <Info className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              About Test Me
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <>
              {/* App Info */}
              <div className="text-center">
                <div className="bg-primary-600 rounded-2xl p-4 w-20 h-20 mx-auto mb-4 shadow-lg shadow-primary-500/30">
                  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-white">
                    <path
                      d="M12 2L2 7L12 12L22 7L12 2Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 17L12 22L22 17"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 12L12 17L22 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Test Me
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-1">
                  AI-Powered Flashcard Generator
                </p>
                {appInfo?.version && (
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Version {appInfo.version}
                  </p>
                )}
              </div>

              {/* System Information */}
              {appInfo && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    System Information
                  </h4>
                  
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <Monitor className="h-5 w-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Platform
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {appInfo.platform || 'Unknown'}
                      </p>
                    </div>
                  </div>

                  {appInfo.arch && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <Cpu className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Architecture
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {appInfo.arch}
                        </p>
                      </div>
                    </div>
                  )}

                  {appInfo.electronVersion && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <HardDrive className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Electron Version
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {appInfo.electronVersion}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Links */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Resources
                </h4>
                
                <button
                  onClick={() => openLink('https://github.com/yourusername/test-me')}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Documentation
                  </span>
                  <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                </button>

                <button
                  onClick={() => openLink('https://github.com/yourusername/test-me/issues')}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Report an Issue
                  </span>
                  <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                </button>

                <button
                  onClick={() => openLink('https://github.com/yourusername/test-me/releases')}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Release Notes
                  </span>
                  <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                </button>
              </div>

              {/* Copyright */}
              <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  © {new Date().getFullYear()} Test Me. All rights reserved.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
