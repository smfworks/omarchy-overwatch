import { TOUR_STEPS } from './storage'
import { useOverwatch } from '../state/context'

export function FirstRunTour() {
  const { tourOpen, tourStep, nextTour, skipTour } = useOverwatch()
  if (!tourOpen) return null
  const step = TOUR_STEPS[tourStep] ?? TOUR_STEPS[0]
  const last = tourStep >= TOUR_STEPS.length - 1
  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-card">
        <div className="storm-kicker">
          First-run tour · {tourStep + 1}/{TOUR_STEPS.length}
        </div>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="actions">
          <button type="button" className="btn" onClick={nextTour}>
            {last ? 'Done' : 'Next'}
          </button>
          <button type="button" className="btn ghost" onClick={skipTour}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
