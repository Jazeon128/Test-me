import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import TestSession from './pages/TestSession'
import Progress from './pages/Progress'
import Decks from './pages/Decks'
import Settings from './pages/Settings'
import DeckDetails from './pages/DeckDetails'
import { ThemeProvider } from './context/ThemeContext'

function App() {
  return (
    <ThemeProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/decks" element={<Decks />} />
          <Route path="/decks/:deckId" element={<DeckDetails />} />
          <Route path="/decks/:deckId/practice" element={<TestSession />} />
          <Route path="/practice" element={<TestSession />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </ThemeProvider>
  )
}

export default App
