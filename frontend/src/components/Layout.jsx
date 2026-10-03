import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Settings, Sun, Moon, Search, Menu, X, RotateCcw } from 'lucide-react'
import { useTheme } from '../context/useTheme'
import SearchModal from './SearchModal'
import { progressAPI } from '../services/api'

const links = [
  { to: import.meta.env.VITE_DEMO === 'true' ? '/notebooks' : '/', label: 'Notebooks', icon: BookOpen },
  { to: '/review', label: 'Review', icon: RotateCcw },
]

export default function Layout({ children }) {
  const location = useLocation()
  const [dueCount, setDueCount] = useState(0)
  useEffect(() => {
    let cancelled = false
    progressAPI.getStats().then(({ data }) => {
      if (!cancelled) setDueCount(data.questions_due || 0)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  const { theme, setTheme } = useTheme()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const isDark = theme === 'dark' || (theme === 'system' && systemDark)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = (event) => setSystemDark(event.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setIsSearchOpen(true)
      }
      if (event.key === 'Escape') setIsMobileMenuOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => { setIsMobileMenuOpen(false) }, [location.pathname])

  const active = (path) => path === '/'
    ? location.pathname === '/' || location.pathname.startsWith('/notebooks/')
    : location.pathname.startsWith(path)

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="ambient-light" aria-hidden="true" />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <header className="app-header">
        <nav className="glass-nav" aria-label="Main navigation">
          <Link to="/" className="brand" aria-label="Test Me home">
            <span className="brand-symbol"><BookOpen size={22} strokeWidth={1.8} /></span>
            <span>Test Me<span className="brand-caption">A little more, every day.</span></span>
          </Link>
          <div className="hidden lg:flex nav-links">
            {links.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className={`nav-link ${active(to) ? 'is-active' : ''}`}
                aria-current={active(to) ? 'page' : undefined}
                aria-label={to === '/review' && dueCount > 0 ? `Review, ${dueCount} due` : undefined}>
                <Icon size={17} />{label}
                {to === '/review' && dueCount > 0 && <span className="nav-due-badge" aria-hidden="true">{dueCount}</span>}
              </Link>
            ))}
          </div>
          <div className="nav-actions">
            <button className="icon-button" onClick={() => setIsSearchOpen(true)}
              aria-label="Search" title="Search (Ctrl+K)"><Search size={19} /></button>
            <button className="icon-button" onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {isDark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            {import.meta.env.VITE_DEMO !== 'true' && <Link to="/settings" className="icon-button nav-settings" aria-label="Settings"
              aria-current={active('/settings') ? 'page' : undefined}><Settings size={19} /></Link>}
            <button className="icon-button mobile-menu-toggle" aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen} aria-controls="mobile-navigation"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
          {isMobileMenuOpen && (
            <div id="mobile-navigation" className="mobile-navigation lg:hidden">
              {[...links, ...(import.meta.env.VITE_DEMO === 'true' ? [] : [{ to: '/settings', label: 'Settings', icon: Settings }])].map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} className={`nav-link ${active(to) ? 'is-active' : ''}`}
                  aria-current={active(to) ? 'page' : undefined}
                  aria-label={to === '/review' && dueCount > 0 ? `Review, ${dueCount} due` : undefined}>
                  <Icon size={18} />{label}
                  {to === '/review' && dueCount > 0 && <span className="nav-due-badge" aria-hidden="true">{dueCount}</span>}
                </Link>
              ))}
            </div>
          )}
        </nav>
      </header>
      {import.meta.env.VITE_DEMO === 'true' && <aside className="demo-banner">
        <span>Demo notebook: the learning pyramid. Nothing you do here is saved.</span>
        <a href="https://github.com/Jazeon128/Test-me" target="_blank" rel="noopener noreferrer">Get Test Me</a>
      </aside>}
      <main id="main-content" tabIndex={-1} className="app-content">{children}</main>
      <footer className="app-footer"><span>Test Me</span><span>Make room for what you’ll learn next.</span></footer>
    </div>
  )
}
