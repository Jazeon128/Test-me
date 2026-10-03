import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { markTourSeen, startTour } from './tour'

export default function DemoTour() {
  const navigate = useNavigate()
  const location = useLocation()
  const closeTour = useRef(null)
  const [offer, setOffer] = useState(() => {
    try { return !localStorage.getItem('test-me.tourSeen') } catch { return true }
  })
  useEffect(() => () => closeTour.current?.(), [])
  const dismiss = () => { markTourSeen(); setOffer(false) }
  const start = event => {
    const trigger = event.currentTarget
    closeTour.current?.()
    dismiss()
    closeTour.current = startTour(navigate, trigger, () => { closeTour.current = null })
  }
  return <>
    <aside className="demo-banner">
      <span>Demo notebook: the learning pyramid. Nothing you do here is saved.</span>
      <button data-tour="start" className="btn-secondary" onClick={start}>Take the tour</button>
      <a data-tour="get-test-me" href="https://github.com/Jazeon128/Test-me" target="_blank" rel="noopener noreferrer">Get Test Me</a>
    </aside>
    {offer && location.pathname === '/notebooks/1' && <aside className="tour-offer" aria-label="Demo tour">
      <p>New here? Take a 2-minute tour of Test Me.</p>
      <div><button className="btn-primary" onClick={start}>Start tour</button>
        <button className="btn-secondary" onClick={dismiss}>Not now</button></div>
    </aside>}
  </>
}
