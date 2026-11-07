import { useCallback, useEffect, useState } from 'react'
import { ArrowClockwise, Headphones, WarningCircle } from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import { getDemoVideoApi } from '../../services/videoService'
import { PracticeView } from '../video/PracticeView'
import type { DemoVideo, VideoLessonDetail } from '../../types/video'
import { formatClock } from '../../utils/videoPlayback'

/**
 * The public demo runs the same practice screen the signed-in app uses, fed by
 * one real lesson from the library (`GET /api/demo/video`). Only the first few
 * segments come down the wire; finishing them opens the sign-up dialog.
 */
export function DemoVideoPanel({ onRequireAuth }: { onRequireAuth: () => void }) {
  const { t } = useI18n()
  const [reloadKey, setReloadKey] = useState(0)
  const [loaded, setLoaded] = useState<{ key: number; video: DemoVideo | null } | null>(null)
  const [failedKey, setFailedKey] = useState<number | null>(null)

  // State is only written from the callbacks, so a retry never triggers a
  // synchronous re-render cascade.
  useEffect(() => {
    let cancelled = false
    getDemoVideoApi()
      .then((video) => {
        if (cancelled) return
        setLoaded({ key: reloadKey, video })
      })
      .catch(() => {
        if (cancelled) return
        setFailedKey(reloadKey)
      })
    return () => { cancelled = true }
  }, [reloadKey])

  const retry = useCallback(() => setReloadKey((key) => key + 1), [])

  // Derived, not stored: a bump of reloadKey makes both checks false again.
  const failed = failedKey === reloadKey
  const video = loaded?.key === reloadKey ? loaded.video : null
  const loading = !failed && loaded?.key !== reloadKey

  if (loading) {
    return (
      <div className="lp-demo-state" role="status">
        <span className="lp-demo-spinner" aria-hidden="true" />
        <p>{t.demoLoading}</p>
      </div>
    )
  }

  if (failed) {
    return (
      <div className="lp-demo-state">
        <WarningCircle size={22} weight="regular" />
        <p>{t.demoLoadError}</p>
        <button type="button" className="lp-demo-retry" onClick={retry}>
          <ArrowClockwise size={15} weight="bold" />
          <span>{t.retry}</span>
        </button>
      </div>
    )
  }

  if (!video) {
    return (
      <div className="lp-demo-state">
        <Headphones size={22} weight="regular" />
        <p>{t.demoUnavailable}</p>
      </div>
    )
  }

  // PracticeView expects the signed-in detail shape; the preview simply omits
  // what the gate withholds (translations, saved words, progress).
  const lesson: VideoLessonDetail = {
    id: video.id,
    code: video.code,
    title: video.title,
    description: null,
    topic: video.topic,
    cefr_level: video.cefr_level,
    provider: video.provider,
    video_url: video.video_url,
    thumbnail_url: video.thumbnail_url,
    duration_seconds: video.duration_seconds,
    xp_reward: 0,
    sort_order: 0,
    is_owned: false,
    progress: null,
    subtitle_en: null,
    subtitle_vi: null,
    vocabulary: video.vocabulary.map((entry, index) => ({
      id: index + 1,
      word: entry.word,
      ipa: entry.ipa,
      meaning_vi: entry.meaning_vi,
      detail_vi: entry.detail_vi,
    })),
    segments: video.segments.map((segment) => ({
      id: segment.id,
      start_ms: segment.start_ms,
      end_ms: segment.end_ms,
      text_en: segment.text_en,
      text_vi: null,
    })),
  }

  return (
    <div className="lp-demo" data-demo-video={video.id}>
      <div className="lp-demo-strip">
        <span className="lp-demo-badge">{t.demoFreeBadge(video.segments.length, video.total_segments)}</span>
        <span className="lp-demo-strip-meta">
          {video.cefr_level} · {video.topic} · {formatClock(video.duration_seconds)}
        </span>
      </div>

      <PracticeView
        video={lesson}
        savedWords={[]}
        onSavedWord={() => { /* the gate never lets a save through */ }}
        onBack={onRequireAuth}
        demo={{
          segmentLimit: video.demo_segment_limit,
          totalSegments: video.total_segments,
          onRequireAuth,
        }}
      />
    </div>
  )
}
