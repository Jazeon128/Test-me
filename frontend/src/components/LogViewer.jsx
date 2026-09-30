import Spinner from './Spinner'
import { useState, useEffect, useRef } from 'react'
import { X, Download, Filter, Search, AlertCircle, Info, AlertTriangle, XCircle } from 'lucide-react'

/**
 * LogViewer Component
 * Displays application logs with filtering and export functionality
 * Implements Requirements 9.2, 9.4: Log viewing and export
 */
export default function LogViewer({ isOpen, onClose }) {
  const [logs, setLogs] = useState([])
  const [filteredLogs, setFilteredLogs] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [isExporting, setIsExporting] = useState(false)
  const logContainerRef = useRef(null)

  // Load logs when dialog opens
  useEffect(() => {
    if (isOpen && window.electronAPI) {
      loadLogs()
    }
  }, [isOpen])

  // Filter logs when search term or level filter changes
  useEffect(() => {
    let filtered = [...logs]

    // Apply level filter
    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => {
        const logStr = typeof log === 'string' ? log : JSON.stringify(log)
        return logStr.toLowerCase().includes(levelFilter.toLowerCase())
      })
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(log => {
        const logStr = typeof log === 'string' ? log : JSON.stringify(log)
        return logStr.toLowerCase().includes(searchTerm.toLowerCase())
      })
    }

    setFilteredLogs(filtered)
  }, [logs, searchTerm, levelFilter])

  const loadLogs = async () => {
    setIsLoading(true)
    setError('')
    
    try {
      const response = await window.electronAPI.getLogs()
      
      if (response.success) {
        // Parse log entries if they're strings
        const logEntries = Array.isArray(response.data) 
          ? response.data 
          : response.data.split('\n').filter(line => line.trim())
        
        setLogs(logEntries)
      } else {
        setError(response.error || 'Failed to load logs')
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    setError('')

    try {
      const response = await window.electronAPI.exportLogs()
      
      if (response.success) {
        // Show success message briefly
        const originalError = error
        setError('')
        setTimeout(() => {
          setError(originalError)
        }, 3000)
      } else {
        setError(response.error || 'Failed to export logs')
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setIsExporting(false)
    }
  }

  const getLogIcon = (logEntry) => {
    const logStr = typeof logEntry === 'string' ? logEntry.toLowerCase() : ''
    
    if (logStr.includes('error')) {
      return <XCircle className="h-4 w-4 text-red-500" />
    } else if (logStr.includes('warn')) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    } else if (logStr.includes('info')) {
      return <Info className="h-4 w-4 text-blue-500" />
    }
    return <AlertCircle className="h-4 w-4 text-gray-400" />
  }

  const getLogColor = (logEntry) => {
    const logStr = typeof logEntry === 'string' ? logEntry.toLowerCase() : ''
    
    if (logStr.includes('error')) {
      return 'text-red-600 dark:text-red-400'
    } else if (logStr.includes('warn')) {
      return 'text-yellow-600 dark:text-yellow-400'
    } else if (logStr.includes('info')) {
      return 'text-blue-600 dark:text-blue-400'
    }
    return 'text-gray-600 dark:text-gray-400'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl mx-4 h-[80vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-primary-100 dark:bg-primary-900/30 p-2 rounded-lg">
              <AlertCircle className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Application logs
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search logs..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm"
            />
          </div>

          {/* Level Filter and Export */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              >
                <option value="all">All Levels</option>
                <option value="error">Errors</option>
                <option value="warn">Warnings</option>
                <option value="info">Info</option>
              </select>
            </div>

            <button
              onClick={handleExport}
              disabled={isExporting || logs.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Download size={16} />
              {isExporting ? 'Exporting...' : 'Export Logs'}
            </button>
          </div>
        </div>

        {/* Log Content */}
        <div className="flex-1 overflow-hidden p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Spinner aria-label="Loading logs" className="h-12 w-12 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Loading logs...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                <button
                  onClick={loadLogs}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  {logs.length === 0 ? 'No logs available' : 'No logs match your filters'}
                </p>
              </div>
            </div>
          ) : (
            <div
              ref={logContainerRef}
              className="h-full overflow-y-auto space-y-1 font-mono text-xs bg-gray-50 dark:bg-gray-900 rounded-lg p-4"
            >
              {filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-2 hover:bg-white dark:hover:bg-gray-800 rounded transition-colors"
                >
                  {getLogIcon(log)}
                  <span className={`flex-1 ${getLogColor(log)}`}>
                    {typeof log === 'string' ? log : JSON.stringify(log, null, 2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredLogs.length} of {logs.length} log entries
          </p>
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
