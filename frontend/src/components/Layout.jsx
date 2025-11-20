import { Link, useLocation } from 'react-router-dom'
import { Home, Upload, TrendingUp, BookOpen, Layers, Settings, Sun, Moon } from 'lucide-react'
import { useTheme } from './ThemeContext'

export default function Layout({ children }) {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === path
        ? 'bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-200'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }
    return location.pathname.startsWith(path)
      ? 'bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-200'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans selection:bg-primary-100 selection:text-primary-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 flex items-center group">
                <div className="bg-primary-600 rounded-xl p-1.5 shadow-lg shadow-primary-500/30 group-hover:bg-primary-700 transition-all duration-300 group-hover:scale-105">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <span className="ml-3 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-700 to-primary-500 tracking-tight">
                  FlashLearn
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
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all duration-200 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
              <Link
                to="/settings"
                className={`p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all duration-200 ${location.pathname.startsWith('/settings') ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white' : 'dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'}`}
                title="Settings"
              >
                <Settings size={20} />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 animate-fade-in">
        {children}
      </main>
    </div>
  )
}
