import { useEffect, useState } from 'react'
import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import { LoadingDots } from '../LoadingDots'
import { getReviewQueueApi } from '../../services/analyticsService'
import type { ReviewQueue } from '../../types/analytics'
import { copyFor } from './copy'
import { ReviewSession } from './ReviewSession'

// The backend already returns only the ranked shortlist; keep the same cap as
// a guard so a stale payload can never turn a short session into a chore.
const SESSION_LIMIT = 7

/**
 * The profile's review button opens this one decision: either there is work to
 * redo (go straight into the session) or there is not (say so and close).
 * No queue list, no reports — the learner asked to practise, not to read data.
 */
export function ReviewLauncher({ onClose }: { onClose: () => void }) {
  const { lang } = useI18n()
  const copy = copyFor(lang)
  const [queue, setQueue] = useState<ReviewQueue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    getReviewQueueApi()
      .then((data) => {
        if (active) setQueue(data)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : copy.error)
      })
    return () => {
      active = false
    }
  }, [reloadKey, copy.error])

  function retry() {
    setQueue(null)
    setError(null)
    setReloadKey((key) => key + 1)
  }

  // The launcher stays mounted for the whole flow (loading, dialog, session),
  // so it owns the page lock and Escape key exactly once.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (error) {
    return (
      <div className="review-launch" role="dialog" aria-modal="true" aria-label={copy.error}>
        <div className="review-launch-card">
          <span className="review-launch-icon is-error"><WarningCircle size={26} weight="fill" /></span>
          <h2>{copy.error}</h2>
          <p>{error}</p>
          <div className="review-launch-actions">
            <button type="button" className="review-cta" onClick={retry}>
              {copy.retry}
            </button>
            <button type="button" className="review-ghost" onClick={onClose}>{copy.sessionClose}</button>
          </div>
        </div>
      </div>
    )
  }

  if (!queue) {
    return (
      <div className="review-launch" role="dialog" aria-modal="true">
        <div className="review-launch-card"><LoadingDots label={copy.loading} /></div>
      </div>
    )
  }

  const due = queue.due
  if (due.length === 0) {
    return (
      <div className="review-launch" role="dialog" aria-modal="true" aria-label={copy.noItemsTitle}>
        <div className="review-launch-card">
          <span className="review-launch-icon"><CheckCircle size={26} weight="duotone" /></span>
          <h2>{copy.noItemsTitle}</h2>
          <p>{copy.noItemsBody}</p>
          <div className="review-launch-actions">
            <button type="button" className="review-cta" onClick={onClose}>{copy.sessionClose}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ReviewSession
      items={due.slice(0, SESSION_LIMIT)}
      onClose={onClose}
    />
  )
}
