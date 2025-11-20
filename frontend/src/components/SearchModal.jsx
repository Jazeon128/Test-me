import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, BookOpen, FileText, Loader2 } from 'lucide-react'
import axios from 'axios'

export default function SearchModal({ isOpen, onClose }) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef(null)
    const navigate = useNavigate()

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100)
            setQuery('')
            setResults([])
        }
    }, [isOpen])

    useEffect(() => {
        const search = async () => {
            if (query.length < 2) {
                setResults([])
                return
            }

            setLoading(true)
            try {
                const response = await axios.get(`/api/search?q=${encodeURIComponent(query)}`)
                setResults(response.data.results)
                setSelectedIndex(0)
            } catch (error) {
                console.error('Search failed:', error)
            } finally {
                setLoading(false)
            }
        }

        const debounce = setTimeout(search, 300)
        return () => clearTimeout(debounce)
    }, [query])

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(prev => (prev + 1) % results.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(prev => (prev - 1 + results.length) % results.length)
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (results[selectedIndex]) {
                handleSelect(results[selectedIndex])
            }
        } else if (e.key === 'Escape') {
            onClose()
        }
    }

    const handleSelect = (result) => {
        navigate(result.url)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/80 transition-opacity backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Panel */}
            <div className="mx-auto max-w-2xl transform divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black ring-opacity-5 transition-all">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="h-12 w-full border-0 bg-transparent pl-11 pr-4 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-0 sm:text-sm"
                        placeholder="Search decks and questions..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    {loading && (
                        <div className="absolute right-4 top-3.5">
                            <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
                        </div>
                    )}
                </div>

                {(results.length > 0 || query.length > 1) && (
                    <ul className="max-h-96 scroll-py-3 overflow-y-auto p-3">
                        {results.length === 0 && query.length > 1 && !loading ? (
                            <li className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                No results found for "{query}"
                            </li>
                        ) : (
                            results.map((result, index) => (
                                <li key={`${result.type}-${result.id}`}>
                                    <button
                                        onClick={() => handleSelect(result)}
                                        className={`group flex w-full select-none items-center rounded-md px-3 py-2 text-sm outline-none transition-colors ${index === selectedIndex
                                                ? 'bg-primary-600 text-white'
                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        {result.type === 'deck' ? (
                                            <BookOpen className={`h-5 w-5 flex-none mr-3 ${index === selectedIndex ? 'text-white' : 'text-gray-400'
                                                }`} />
                                        ) : (
                                            <FileText className={`h-5 w-5 flex-none mr-3 ${index === selectedIndex ? 'text-white' : 'text-gray-400'
                                                }`} />
                                        )}
                                        <div className="flex-auto text-left overflow-hidden">
                                            <p className={`truncate font-medium ${index === selectedIndex ? 'text-white' : 'text-gray-900 dark:text-white'
                                                }`}>
                                                {result.title}
                                            </p>
                                            {result.subtitle && (
                                                <p className={`truncate text-xs ${index === selectedIndex ? 'text-primary-100' : 'text-gray-500 dark:text-gray-400'
                                                    }`}>
                                                    {result.subtitle}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                )}

                <div className="flex flex-wrap items-center bg-gray-50 dark:bg-gray-900/50 px-4 py-2.5 text-xs text-gray-700 dark:text-gray-400">
                    Type <kbd className="mx-1 flex h-5 w-5 items-center justify-center rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 font-semibold text-gray-900 dark:text-white sm:mx-2">↵</kbd> to select
                    <span className="mx-2">·</span>
                    Type <kbd className="mx-1 flex h-5 w-5 items-center justify-center rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 font-semibold text-gray-900 dark:text-white sm:mx-2">esc</kbd> to close
                </div>
            </div>
        </div>
    )
}
