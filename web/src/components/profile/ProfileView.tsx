import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { ArrowRight, Brain, Camera, Medal, SignOut } from '@phosphor-icons/react'
import { ApiError } from '../../services/apiClient'
import { AccountActions } from '../AccountActions'
import { useAuth } from '../../context/AuthContext'
import { useLearning } from '../../context/LearningContext'
import { useWallet } from '../../context/WalletContext'
import { useI18n } from '../../i18n'
import { getMyBadgesApi } from '../../services/communityService'
import { flattenLessons } from '../../roadmap'
import type { EarnedBadge } from '../../types/community'
import { AvatarFrame } from '../cosmetics/AvatarFrame'
import { nameplateSurface } from '../cosmetics/nameplateSurface'
import { SocialAccounts } from './SocialAccounts'
import { BoosterStatus } from './BoosterStatus'
import { formatCompact } from '../../utils/format'

type StageState = 'done' | 'current' | 'locked'

export function ProfileView({ onLogout, onOpenReview }: { onLogout: () => void; onOpenReview: () => void }) {
  const { t } = useI18n()
  const { user, uploadAvatar } = useAuth()
  const { stages, loading } = useLearning()
  const { wallet, refresh } = useWallet()
  const [badges, setBadges] = useState<EarnedBadge[]>([])
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarProgress, setAvatarProgress] = useState<number | null>(null)
  const [avatarMessage, setAvatarMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [avatarInputKey, setAvatarInputKey] = useState(0)

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
  }, [avatarPreview])

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    setAvatarMessage(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarMessage({ text: t.avatarUploadInvalid, error: true })
      setAvatarInputKey((key) => key + 1)
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarMessage({ text: t.avatarUploadTooLarge, error: true })
      setAvatarInputKey((key) => key + 1)
      return
    }

    setAvatarPreview(URL.createObjectURL(file))
    setAvatarProgress(0)
    try {
      await uploadAvatar(file, setAvatarProgress)
      setAvatarPreview(null)
      setAvatarMessage({ text: t.avatarUploadSuccess, error: false })
    } catch (error) {
      const codes = error instanceof ApiError ? error.errors : []
      const message = codes.includes('CLOUDINARY_NOT_CONFIGURED')
        ? t.avatarUploadNotConfigured
        : codes.includes('AVATAR_TOO_LARGE')
          ? t.avatarUploadTooLarge
          : codes.includes('AVATAR_INVALID_TYPE') || codes.includes('AVATAR_REQUIRED')
            ? t.avatarUploadInvalid
            : t.avatarUploadFailed
      setAvatarMessage({ text: message, error: true })
    } finally {
      setAvatarProgress(null)
      setAvatarInputKey((key) => key + 1)
    }
  }

  // The wallet is loaded once app-wide, so equipping a nameplate elsewhere leaves this view stale; re-pull it when the profile opens.
  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    getMyBadgesApi()
      .then((earned) => {
        if (!cancelled) setBadges(earned)
      })
      .catch(() => {
        /* badges are decorative — a failed request must not break the profile */
      })
    return () => { cancelled = true }
  }, [])

  const lessons = useMemo(() => flattenLessons(stages), [stages])
  const done = lessons.filter((lesson) => lesson.status === 'done').length
  const percent = lessons.length > 0 ? Math.round((done / lessons.length) * 100) : 0
  const currentStage = stages.find((stage) => stage.lessons.some((lesson) => lesson.status === 'current'))
    ?? stages.find((stage) => stage.completedCount < stage.totalCount)
    ?? stages[0]
  const displayName = user?.name || 'An Nguyễn'
  const streak = wallet?.streak ?? user?.streak ?? 0
  const xp = user?.xp ?? 0
  const coins = wallet?.coins ?? user?.coins ?? 0
  const level = wallet?.level ?? user?.level ?? 1
  const frameKey = wallet?.equipment.frame?.visual_key ?? null
  const frameStyle = wallet?.equipment.frame?.style ?? null
  // The nameplate is the head's surface now: the band around the name is gone,
  // and the equipped plate paints the block instead.
  const plate = nameplateSurface(
    wallet?.equipment.nameplate?.visual_key ?? null,
    wallet?.equipment.nameplate?.style ?? null,
  )

  function stageState(index: number): StageState {
    const stage = stages[index]
    if (!stage) return 'locked'
    if (stage.totalCount > 0 && stage.completedCount === stage.totalCount) return 'done'
    if (stage.lessons.some((lesson) => lesson.status === 'current')) return 'current'
    return 'locked'
  }

  const stateLabel: Record<StageState, string> = {
    done: t.statusDone,
    current: t.statusCurrent,
    locked: t.statusLocked,
  }
  const avatarInputId = `profile-avatar-upload-${avatarInputKey}`

  return (
    <div
      className="tab-view-container profile-view"
      data-user-name={displayName}
      data-user-email={user?.email || ''}
      data-user-xp={xp}
      data-user-streak={streak}
      data-lessons-done={done}
      data-lessons-total={lessons.length}
      data-progress-percent={percent}
      data-current-stage={currentStage?.title || ''}
      data-badges-count={badges.length}
      data-user-coins={coins}
      data-user-level={level}
    >
      <header className="page-heading">
        <span className="page-eyebrow">{t.profileEyebrow}</span>
        <h1>{t.profileTitle}</h1>
        <p>{t.profileDesc}</p>
      </header>

      <section className={`profile-identity-head${plate.className}`} style={plate.style}>
        <label className="profile-avatar-edit" htmlFor={avatarInputId} title={t.avatarUpload} aria-label={t.avatarUpload}>
          <AvatarFrame name={displayName} avatarUrl={avatarPreview ?? user?.avatar_url} visualKey={frameKey} style={frameStyle} size={160} />
        </label>
        <div className="profile-identity-copy">
          <h2>{displayName}</h2>
          <p>{user?.email}</p>
          <label className={`avatar-upload-button${avatarProgress !== null ? ' is-uploading' : ''}`} htmlFor={avatarInputId}>
            <Camera size={16} weight="bold" />
            {avatarProgress !== null ? t.avatarUploading(avatarProgress) : t.avatarUpload}
          </label>
          <input
            key={avatarInputKey}
            id={avatarInputId}
            className="avatar-upload-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange}
            disabled={avatarProgress !== null}
          />
          {avatarProgress !== null && <progress className="avatar-upload-progress" max="100" value={avatarProgress} aria-label={t.avatarUploading(avatarProgress)} />}
          {avatarMessage && <p className={`avatar-upload-message${avatarMessage.error ? ' is-error' : ''}`} role="status">{avatarMessage.text}</p>}
        </div>
      </section>

      <div className="profile-grid">
        <section className="profile-identity">
          <dl className="profile-numbers">
            <div>
              <dd>{formatCompact(xp)}</dd>
              <dt>{t.statXpLabel}</dt>
            </div>
            <div>
              <dd>{loading ? '...' : `${done}/${lessons.length}`}</dd>
              <dt>{t.statLessonsLabel}</dt>
            </div>
          </dl>

          <BoosterStatus boosters={wallet?.boosters} />

          <button type="button" className="profile-review" onClick={onOpenReview} data-open-review="true">
            <span className="profile-review-icon"><Brain size={18} weight="fill" /></span>
            <span className="profile-review-copy">
              <strong>{t.navReview}</strong>
              <small>{t.profileReviewHint}</small>
            </span>
            <ArrowRight size={16} weight="bold" />
          </button>

          <section className="profile-path">
            <header>
              <div>
                <span className="arena-label">{t.pathKicker}</span>
                <h3>{t.pathTitle(currentStage?.sortOrder ?? 1, percent)}</h3>
              </div>
              <strong>{percent}%</strong>
            </header>

            <div className="profile-meter" role="img" aria-label={t.pathAria(percent)}>
              <span style={{ width: `${percent}%` }} />
            </div>

            <ol className="profile-stages">
              {stages.map((stage, index) => {
                const state = stageState(index)
                return (
                  <li className={`profile-stage is-${state}`} key={stage.id}>
                    <span className="profile-stage-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="profile-stage-name">{stage.title}</span>
                    <span className="profile-stage-count">
                      {t.pathTotal(stage.completedCount, stage.totalCount)}
                    </span>
                    <span className="profile-stage-state">{stateLabel[state]}</span>
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="profile-badges">
            <span className="arena-label">{t.badgesTitle}</span>
            {badges.length > 0 ? (
              <ul>
                {badges.map((badge) => (
                  <li key={badge.code}>
                    <Medal size={15} weight="regular" />
                    <span>{badge.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t.badgesEmpty}</p>
            )}
          </section>
        </section>

        <aside className="profile-account">
          <h3>{t.accountOptions}</h3>
          <AccountActions user={user} />
          <SocialAccounts />
          <button type="button" className="profile-logout" onClick={onLogout}>
            <SignOut size={16} weight="bold" />
            <span>{t.logoutShort}</span>
          </button>
        </aside>
      </div>
    </div>
  )
}
