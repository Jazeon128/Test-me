import { Link, useLocation } from 'react-router-dom'
import { Home, Upload, FileText, TrendingUp, BookOpen, Layers, Settings } from 'lucide-react'

export default function Layout({ children }) {
  const location = useLocation()

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === path
        ? 'bg-primary-100 text-primary-700'
        : 'text-gray-700 hover:bg-gray-100'
    }
    return location.pathname.startsWith(path)
      ? 'bg-primary-100 text-primary-700'
      : 'text-gray-700 hover:bg-gray-100'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <BookOpen className="h-8 w-8 text-primary-600" />
                <span className="ml-2 text-2xl font-bold text-gray-900">Test Me</span>
              </div>
              <div className="ml-10 flex space-x-4 items-center">
                <Link
                  to="/"
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${isActive('/')}`}
                >
                  <Home size={18} />
                  Dashboard
                </Link>
                <Link
                  to="/upload"
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${isActive('/upload')}`}
                >
                  <Upload size={18} />
                  Upload
                </Link>
                <Link
                  to="/decks"
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${isActive('/decks')}`}
                >
                  <Layers size={18} />
                  Decks
                </Link>
                <Link
                  to="/documents"
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${isActive('/documents')}`}
                >
                  <FileText size={18} />
                  Documents
                </Link>
                <Link
                  to="/progress"
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${isActive('/progress')}`}
                >
                  <TrendingUp size={18} />
                  Progress
                </Link>
                <Link
                  to="/settings"
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${isActive('/settings')}`}
                >
                  <Settings size={18} />
                  Settings
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
