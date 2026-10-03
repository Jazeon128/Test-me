import Spinner from './components/Spinner'
import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import Layout from './components/Layout'
import Notebooks from './pages/Notebooks'
import Review from './pages/Review'
import RedirectDeck from './components/RedirectDeck'
import NotebookWorkspace from './pages/NotebookWorkspace'
import Settings from './pages/Settings'
import { dynamicEnabled } from './dynamic/flag'

// The canvas pulls in React Flow and elkjs, roughly 1.6 MB. Loading it lazily
// keeps that off every other page in the app.
const DynamicStress = import.meta.env.DEV && import.meta.env.VITE_DEMO !== 'true' && dynamicEnabled()
  ? lazy(() => import('./dynamic/DynamicStress')) : null
const Canvas = lazy(() => import('./pages/Canvas'))
const DemoHome = import.meta.env.VITE_DEMO === 'true' ? lazy(() => import('./demo/DemoHome')) : null
const DemoNotice = import.meta.env.VITE_DEMO === 'true' ? lazy(() => import('./demo/DemoNotice')) : null
import WelcomeScreen from './components/WelcomeScreen'
import UpdateNotification from './components/UpdateNotification'
import { ThemeProvider } from './context/ThemeContext'

function App() {
  const [showWelcome, setShowWelcome] = useState(false)
  const [isCheckingWelcome, setIsCheckingWelcome] = useState(true)

  useEffect(() => {
    // Browser completion stores no credentials, only the welcome preference.
    const checkFirstRun = async () => {
      if (import.meta.env.VITE_DEMO === 'true') { setIsCheckingWelcome(false); return }
      if (window.electronAPI) {
        try {
          const response = await window.electronAPI.getSettings()
          if (response.success) {
            const welcomeCompleted = response.data.welcomeCompleted
            setShowWelcome(!welcomeCompleted)
          }
        } catch (error) {
          console.error('Failed to check welcome status:', error)
        }
      } else {
        try {
          setShowWelcome(localStorage.getItem('test-me.welcomeCompleted') !== 'true')
        } catch {
          setShowWelcome(true)
        }
      }
      setIsCheckingWelcome(false)
    }

    checkFirstRun()
  }, [])

  const handleWelcomeComplete = () => {
    setShowWelcome(false)
  }

  if (isCheckingWelcome) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <Spinner aria-label="Loading application" className="h-12 w-12" />
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      {showWelcome && <WelcomeScreen onComplete={handleWelcomeComplete} />}
      <UpdateNotification />
      <Layout>
        <Routes>
          {import.meta.env.DEV && import.meta.env.VITE_DEMO !== 'true' && dynamicEnabled() && <Route path="/dev/dynamic-stress"
            element={<Suspense fallback={<CanvasLoading />}><DynamicStress /></Suspense>} />}
          <Route path="/" element={DemoHome ? <Suspense fallback={<CanvasLoading />}><DemoHome /></Suspense> : <Notebooks />} />
          <Route path="/notebooks" element={DemoHome ? <Notebooks /> : <Navigate to="/" replace />} />
          <Route path="/notebooks/:notebookId" element={<NotebookWorkspace />} />
          <Route path="/upload" element={<RedirectUpload />} />
          <Route path="/decks" element={<Navigate to="/" replace />} />
          <Route path="/decks/:deckId" element={<RedirectDeck view="edit" />} />
          <Route path="/decks/:deckId/practice" element={<RedirectDeck view="practice" />} />
          <Route path="/practice" element={<Navigate to="/review" replace />} />
          <Route path="/review" element={<Review />} />
          <Route
            path="/canvas"
            element={
              <Suspense fallback={<CanvasLoading />}>
                <Canvas />
              </Suspense>
            }
          />
          <Route
            path="/canvas/:canvasId"
            element={
              <Suspense fallback={<CanvasLoading />}>
                <Canvas />
              </Suspense>
            }
          />
          <Route path="/progress" element={<Navigate to="/#progress" replace />} />
          <Route path="/settings" element={DemoNotice ? <Suspense fallback={<CanvasLoading />}><DemoNotice /></Suspense> : <Settings />} />

          {/* Unknown paths land on the notebook list rather than an empty
              shell. Covers /dashboard, which used to be a second home
              screen and may still be bookmarked. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </ThemeProvider>
  )
}

function RedirectUpload() {
  const [params] = useSearchParams()
  const notebook = params.get('notebook')
  return <Navigate to={notebook ? `/notebooks/${encodeURIComponent(notebook)}` : '/'} replace />
}

function CanvasLoading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner aria-label="Loading canvas" className="h-8 w-8" />
    </div>
  )
}

export default App
