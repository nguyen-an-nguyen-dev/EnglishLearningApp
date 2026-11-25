import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { ArrowRight, BookOpenText, Camera, CaretRight, Checks, Coins, Lightning, Medal, SignOut } from '@phosphor-icons/react'
import { ApiError } from '../../services/apiClient'
import { AccountActions } from '../AccountActions'
import { useAuth } from '../../context/AuthContext'
import { useLearning } from '../../context/LearningContext'
import { useWallet } from '../../context/WalletContext'
import { useI18n } from '../../i18n'
import { getMyBadgesApi } from '../../services/communityService'
import { findCurrentStageIndex, flattenLessons } from '../../roadmap'
import type { EarnedBadge } from '../../types/community'
import { AvatarFrame } from '../cosmetics/AvatarFrame'
import { nameplateSurface } from '../cosmetics/nameplateSurface'
import { SocialAccounts } from './SocialAccounts'
import { BoosterStatus } from './BoosterStatus'
import { formatCompact } from '../../utils/format'
import { StreakFlame } from './StreakFlame'
import '@fontsource-variable/baloo-2'
import './profile.css'

type StageState = 'done' | 'current' | 'locked'

interface ProfileViewProps {
  onLogout: () => void
  onOpenReview: () => void
  onOpenGarage: () => void
  onOpenLesson: (lessonId: number, title: string) => void
}

export function ProfileView({ onLogout, onOpenReview, onOpenGarage, onOpenLesson }: ProfileViewProps) {
  const { t, lang } = useI18n()
  const { user, uploadAvatar } = useAuth()
  const { stages, loading } = useLearning()
  const { wallet, refresh } = useWallet()
  const [badges, setBadges] = useState<EarnedBadge[]>([])
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarProgress, setAvatarProgress] = useState<number | null>(null)
  const [avatarMessage, setAvatarMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [avatarInputKey, setAvatarInputKey] = useState(0)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const logoutDialogRef = useRef<HTMLDialogElement>(null)

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
  const currentStageIndex = findCurrentStageIndex(stages)
  const currentStage = stages[currentStageIndex] ?? stages[0]
  const displayName = user?.name ?? ''
  const streak = wallet?.streak ?? user?.streak ?? 0
  const xp = wallet?.xp ?? user?.xp ?? 0
  const coins = wallet?.coins ?? user?.coins ?? 0
  const balance = `${coins.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')} RC`
  const level = wallet?.level ?? user?.level ?? 1
  const frameKey = wallet?.equipment.frame?.visual_key ?? null
  const frameStyle = wallet?.equipment.frame?.style ?? null
  const plate = nameplateSurface(
    wallet?.equipment.nameplate?.visual_key ?? null,
    wallet?.equipment.nameplate?.style ?? null,
  )

  function stageState(index: number): StageState {
    const stage = stages[index]
    if (!stage) return 'locked'
    if (stage.completedCount > 0 && stage.lessons.every((lesson) => lesson.status === 'done' || lesson.status === 'new')) return 'done'
    if (stage.lessons.some((lesson) => lesson.status === 'current' || lesson.status === 'new')) return 'current'
    return 'locked'
  }

  const stateLabel: Record<StageState, string> = {
    done: t.statusDone,
    current: t.statusCurrent,
    locked: t.statusLocked,
  }
  const flameState = streak > 0
    ? (wallet?.boosters.streak_shields ? 'ice' : 'happy')
    : (wallet?.streak_lost_recent ? 'sad' : 'grey')

  return (
    <div
      className="tab-view-container profile-view"
      lang={lang}
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
      <header className="profile-page-intro">
        <h1>{t.profileTitle}</h1>
        <p>{t.profileDesc}</p>
      </header>

      <div className="profile-grid">
        <section className="profile-identity">
          <section className="profile-hero" data-buddy-target="profile:stats" aria-label={t.profileTitle}>
            <div className={`profile-hero-banner${plate.className}`} style={plate.style} aria-hidden="true">
              {!plate.className && (
                <svg viewBox="0 0 600 160" preserveAspectRatio="xMidYMid slice">
                  <rect className="profile-scene-sky" width="600" height="160" />
                  <circle className="profile-scene-sun" cx="500" cy="48" r="26" />
                  <g className="profile-scene-cloud">
                    <ellipse cx="90" cy="48" rx="46" ry="14" /><ellipse cx="124" cy="40" rx="30" ry="14" />
                    <ellipse cx="320" cy="34" rx="40" ry="12" /><ellipse cx="350" cy="28" rx="24" ry="11" />
                  </g>
                  <path className="profile-scene-hill" d="M0 140Q120 80 240 128T480 118T600 100V160H0Z" />
                </svg>
              )}
            </div>
            <div className="profile-hero-body">
              <button type="button" className="profile-avatar-edit" aria-label={t.avatarUpload}
                onClick={() => avatarInputRef.current?.click()} disabled={avatarProgress !== null}>
                <AvatarFrame name={displayName} avatarUrl={avatarPreview ?? user?.avatar_url} visualKey={frameKey} style={frameStyle} size={120} />
                <span className="profile-hero-level" aria-label={`${t.walletLevel} ${level}`}>{level}</span>
              </button>
              <div className="profile-identity-copy">
                <h2>{displayName}</h2>
                <p>{user?.email}</p>
              </div>
              <div className="profile-hero-actions">
                <button
                  type="button"
                  className="profile-hero-balance"
                  data-buddy-target="wallet:summary"
                  aria-label={t.profileOpenGarage(balance)}
                  onClick={onOpenGarage}
                >
                  <Coins size={17} weight="fill" aria-hidden="true" />
                  {balance}
                  <CaretRight size={12} weight="bold" aria-hidden="true" />
                </button>
                <button type="button" className="avatar-upload-button" onClick={() => avatarInputRef.current?.click()} disabled={avatarProgress !== null}>
                  <Camera size={17} weight="bold" aria-hidden="true" />
                  {avatarProgress !== null ? t.avatarUploading(avatarProgress) : t.avatarUpload}
                </button>
              </div>
              <input key={avatarInputKey} ref={avatarInputRef} type="file" hidden accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange} disabled={avatarProgress !== null} />
              {avatarProgress !== null && <progress className="avatar-upload-progress" max={100} value={avatarProgress} aria-label={t.avatarUploading(avatarProgress)} />}
              {avatarMessage && <p className={`avatar-upload-message${avatarMessage.error ? ' is-error' : ''}`} role="status">{avatarMessage.text}</p>}
            </div>
          </section>

          <ul className="profile-numbers">
            <li>
              <Lightning className="profile-stat-icon is-xp" size={32} weight="fill" aria-hidden="true" />
              <span className="profile-stat-copy"><strong>{formatCompact(xp)}</strong><small>{t.statXpLabel}</small></span>
            </li>
            <li>
              <Checks className="profile-stat-icon is-done" size={33} weight="bold" aria-hidden="true" />
              <span className="profile-stat-copy"><strong>{loading && !lessons.length ? '…' : `${done}/${lessons.length}`}</strong><small>{t.statLessonsLabel}</small></span>
            </li>
            <li>
              <StreakFlame size={25} state={flameState} />
              <span className="profile-stat-copy"><strong>{streak}</strong><small>{t.statStreakLabel}</small></span>
            </li>
          </ul>

          <BoosterStatus boosters={wallet?.boosters} />

          <button type="button" className="profile-review" onClick={onOpenReview} data-open-review="true">
            <BookOpenText className="profile-review-symbol" size={32} weight="duotone" aria-hidden="true" />
            <span className="profile-review-copy">
              <strong>{t.navReview}</strong>
              <small>{t.profileReviewHint}</small>
            </span>
            <ArrowRight size={16} weight="bold" />
          </button>

          <section className="profile-path" data-buddy-target="profile:path">
            <header>
              <div>
                <p className="profile-path-label">{t.pathKicker}</p>
                <h3>{t.pathTitle(currentStage?.sortOrder ?? 1, percent)}</h3>
              </div>
              <strong>{percent}%</strong>
            </header>

            <div className="profile-meter" role="progressbar" aria-label={t.pathKicker} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${percent}%` }} />
            </div>

            <ol className="profile-stages">
              {stages.map((stage, index) => {
                const state = stageState(index)
                const active = index === currentStageIndex && state === 'current'
                const fresh = stage.lessons.filter((lesson) => lesson.status === 'new')
                const nextLesson = stage.lessons.find((lesson) => lesson.status === 'current') ?? fresh[0]
                const stagePercent = stage.totalCount ? stage.completedCount / stage.totalCount * 100 : 0
                return (
                  <li className={`profile-stage is-${state}${active ? ' is-active' : ''}`} key={stage.id}>
                    <span className="profile-stage-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="profile-stage-info">
                      <strong className="profile-stage-name">{stage.title}</strong>
                      <span className="profile-stage-count">
                        <span className="profile-stage-meter" aria-hidden="true"><i style={{ width: `${stagePercent}%` }} /></span>
                        {t.pathTotal(stage.completedCount, stage.totalCount)}
                      </span>
                    </span>
                    <span className="profile-stage-tags">
                      {fresh.length > 0 && <span className="profile-stage-state is-new">{t.profileNewCount(fresh.length)}</span>}
                      <span className="profile-stage-state">{stateLabel[state]}</span>
                    </span>
                    {nextLesson && (
                      <button type="button" className={`profile-stage-action${active ? ' is-primary' : ''}`}
                        onClick={() => onOpenLesson(nextLesson.id, nextLesson.title)}>
                        {active ? t.profileContinue : t.profileOpenNew}
                      </button>
                    )}
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="profile-badges" data-buddy-target="profile:badges">
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
          <button type="button" className="profile-logout" onClick={() => logoutDialogRef.current?.showModal()}>
            <SignOut size={16} weight="bold" />
            <span>{t.logoutShort}</span>
          </button>
        </aside>
      </div>
      <dialog className="profile-logout-dialog" ref={logoutDialogRef} aria-labelledby="profile-logout-title">
        <h2 id="profile-logout-title">{t.profileLogoutTitle}</h2>
        <p>{t.profileLogoutHint}</p>
        <form method="dialog">
          <button type="submit" className="profile-stage-action is-primary" autoFocus>{t.cancel}</button>
          <button type="button" className="profile-stage-action" onClick={onLogout}>{t.logoutShort}</button>
        </form>
      </dialog>
    </div>
  )
}
