import Spinner from './components/Spinner'
import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Notebooks from './pages/Notebooks'
import NotebookDetail from './pages/NotebookDetail'
import Upload from './pages/Upload'
import TestSession from './pages/TestSession'
import Progress from './pages/Progress'
import Decks from './pages/Decks'
import Settings from './pages/Settings'
import DeckDetails from './pages/DeckDetails'

// The canvas pulls in React Flow and elkjs, roughly 1.6 MB. Loading it lazily
// keeps that off every other page in the app.
const Canvas = lazy(() => import('./pages/Canvas'))
import WelcomeScreen from './components/WelcomeScreen'
import UpdateNotification from './components/UpdateNotification'
import { ThemeProvider } from './context/ThemeContext'

function App() {
  const [showWelcome, setShowWelcome] = useState(false)
  const [isCheckingWelcome, setIsCheckingWelcome] = useState(true)

  useEffect(() => {
    // Browser completion stores no credentials, only the welcome preference.
    const checkFirstRun = async () => {
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
          <Route path="/" element={<Notebooks />} />
          <Route path="/notebooks/:notebookId" element={<NotebookDetail />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/decks" element={<Decks />} />
          <Route path="/decks/:deckId" element={<DeckDetails />} />
          <Route path="/decks/:deckId/practice" element={<TestSession />} />
          <Route path="/practice" element={<TestSession />} />
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
          <Route path="/progress" element={<Progress />} />
          <Route path="/settings" element={<Settings />} />

          {/* Unknown paths land on the notebook list rather than an empty
              shell. Covers /dashboard, which used to be a second home
              screen and may still be bookmarked. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </ThemeProvider>
  )
}

function CanvasLoading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner aria-label="Loading canvas" className="h-8 w-8" />
    </div>
  )
}

export default App
