import { useEffect, useMemo, useState } from 'react'
import { Medal, ShieldCheck, SignOut } from '@phosphor-icons/react'
import { AccountActions } from '../AccountActions'
import { useAuth } from '../../context/AuthContext'
import { useLearning } from '../../context/LearningContext'
import { useI18n } from '../../i18n'
import { getMyBadgesApi } from '../../services/communityService'
import { flattenLessons } from '../../roadmap'
import type { EarnedBadge } from '../../types/community'
import { initialOf } from '../../utils/avatar'
import { formatCompact } from '../../utils/format'

type StageState = 'done' | 'current' | 'locked'

export function ProfileView({ onLogout }: { onLogout: () => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { stages, loading } = useLearning()
  const [badges, setBadges] = useState<EarnedBadge[]>([])

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
  const initial = initialOf(user?.name)
  const displayName = user?.name || 'An Nguyễn'
  const streak = user?.streak ?? 0
  const xp = user?.xp ?? 0

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

  return (
    <div className="tab-view-container profile-view">
      <header className="page-heading">
        <span className="page-eyebrow">{t.profileEyebrow}</span>
        <h1>{t.profileTitle}</h1>
        <p>{t.profileDesc}</p>
      </header>

      <div className="profile-grid">
        <section className="profile-identity">
          <div className="profile-identity-head">
            <span className="profile-avatar">{initial}</span>
            <div className="profile-identity-copy">
              <h2>{displayName}</h2>
              <p>{user?.email}</p>
              <span className="profile-role">
                <ShieldCheck size={15} weight="regular" />
                {t.activeLearner}
              </span>
            </div>
          </div>

          <dl className="profile-numbers">
            <div>
              <dd>{streak}</dd>
              <dt>{t.statStreakLabel}</dt>
            </div>
            <div>
              <dd>{formatCompact(xp)}</dd>
              <dt>{t.statXpLabel}</dt>
            </div>
            <div>
              <dd>{loading ? '…' : `${done}/${lessons.length}`}</dd>
              <dt>{t.statLessonsLabel}</dt>
            </div>
          </dl>

          <section className="profile-path">
            <header>
              <div>
                <span className="arena-label">{t.pathKicker}</span>
                <h3>{t.pathTitle(currentStage?.sortOrder ?? 1)}</h3>
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
          <p className="profile-tip">
            <strong>{t.tipTitle}</strong>
            {t.tipBody(streak)}
          </p>
          <button type="button" className="profile-logout" onClick={onLogout}>
            <SignOut size={17} weight="regular" />
            <span>{t.logoutLong}</span>
          </button>
        </aside>
      </div>
    </div>
  )
}
