import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
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
    // Check if this is the first run (only in Electron)
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
          <Route path="/" element={<Dashboard />} />
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
        </Routes>
      </Layout>
    </ThemeProvider>
  )
}

function CanvasLoading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" />
    </div>
  )
}

export default App
