import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, Upload, TrendingUp, BookOpen, Layers, Settings, Sun, Moon, Search, Menu, X } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import SearchModal from './SearchModal'

export default function Layout({ children }) {
  const location = useLocation()
  const { theme, setTheme } = useTheme()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === path
        ? 'bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-200 dark:bg-primary-900/20 dark:text-primary-300 dark:ring-primary-800'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
    }
    return location.pathname.startsWith(path)
      ? 'bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-200 dark:bg-primary-900/20 dark:text-primary-300 dark:ring-primary-800'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
  }

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans selection:bg-primary-100 selection:text-primary-900 dark:selection:bg-primary-900 dark:selection:text-primary-100 transition-colors duration-200">
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/50 dark:border-gray-700/50 shadow-sm transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 flex items-center group">
                <div className="bg-primary-600 rounded-xl p-1.5 shadow-lg shadow-primary-500/30 group-hover:bg-primary-700 transition-all duration-300 group-hover:scale-105">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <span className="ml-3 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-700 to-primary-500 dark:from-primary-400 dark:to-primary-200 tracking-tight">
                  Test Me
                </span>
              </Link>
              <div className="hidden md:ml-10 md:flex md:space-x-2 items-center">
                <Link
                  to="/"
                  className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all duration-200 ${isActive('/')}`}
                >
                  <Home size={18} />
                  Dashboard
                </Link>
                <Link
                  to="/upload"
                  className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all duration-200 ${isActive('/upload')}`}
                >
                  <Upload size={18} />
                  Upload
                </Link>

                <Link
                  to="/decks"
                  className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all duration-200 ${isActive('/decks')}`}
                >
                  <Layers size={18} />
                  Decks
                </Link>

                <Link
                  to="/progress"
                  className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all duration-200 ${isActive('/progress')}`}
                >
                  <TrendingUp size={18} />
                  Progress
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Search Trigger */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all duration-200 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                title="Search (Ctrl+K)"
              >
                <Search size={20} />
              </button>

              {/* Theme Toggle - Quick Access */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all duration-200 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <Link
                to="/settings"
                className={`hidden md:block p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all duration-200 ${location.pathname.startsWith('/settings') ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white' : 'dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'}`}
                title="Settings"
              >
                <Settings size={20} />
              </Link>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all duration-200 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 animate-slide-down">
            <div className="px-4 pt-2 pb-6 space-y-1">
              <Link
                to="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base font-medium flex items-center gap-3 ${isActive('/')}`}
              >
                <Home size={20} />
                Dashboard
              </Link>
              <Link
                to="/upload"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base font-medium flex items-center gap-3 ${isActive('/upload')}`}
              >
                <Upload size={20} />
                Upload
              </Link>
              <Link
                to="/decks"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base font-medium flex items-center gap-3 ${isActive('/decks')}`}
              >
                <Layers size={20} />
                Decks
              </Link>
              <Link
                to="/progress"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base font-medium flex items-center gap-3 ${isActive('/progress')}`}
              >
                <TrendingUp size={20} />
                Progress
              </Link>
              <Link
                to="/settings"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base font-medium flex items-center gap-3 ${isActive('/settings')}`}
              >
                <Settings size={20} />
                Settings
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 animate-fade-in">
        {children}
      </main>
    </div>
  )
}
