import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  BookOpenText,
  CalendarBlank,
  CheckCircle,
  Crown,
  Flag,
  Flame,
  Gear,
  Lightning,
  Medal,
  Play,
  ShieldCheck,
  SignOut,
  Sword,
  Trophy,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react'
import { useAuth } from './context/AuthContext'
import { LandingPage } from './components/landing/LandingPage'
import type { AuthUser } from './types/auth'
import { useI18n } from './i18n'
import { formatCompact } from './utils/format'
import { AccountActions } from './components/AccountActions'
import { SettingsPanel } from './components/SettingsPanel'
import { RouteMapCard } from './components/roadmap/RouteMapCard'
import { LessonPlayer } from './components/lesson/LessonPlayer'
import { useLearning } from './context/LearningContext'
import {
  ROADMAP_LAYOUT,
  STAGE_VISUALS,
  findCurrentLesson,
  findCurrentStageIndex,
  flattenLessons,
  roadmapHeight,
  stageTop,
} from './roadmap'

export type DashboardTab = 'study' | 'compete' | 'rankings' | 'profile'

interface SidebarProps {
  user: AuthUser | null
  activeTab: DashboardTab
  onSelectTab: (tab: DashboardTab) => void
  onLogout: () => void
  onViewLanding: () => void
  onOpenSettings: (anchor: HTMLElement) => void
}

function Sidebar({ user, activeTab, onSelectTab, onLogout, onViewLanding, onOpenSettings }: SidebarProps) {
  const { t } = useI18n()
  const initial = user?.name ? user.name.trim()[0].toUpperCase() : 'A'
  const displayName = user?.name || 'An Nguyễn'

  const tabs: { id: DashboardTab; label: string; icon: typeof BookOpenText }[] = [
    { id: 'study', label: t.navStudy, icon: BookOpenText },
    { id: 'compete', label: t.navCompete, icon: Lightning },
    { id: 'rankings', label: t.navRankings, icon: Trophy },
    { id: 'profile', label: t.navProfile, icon: UserCircle },
  ]

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <button className="brand-logo-btn" type="button" onClick={onViewLanding} aria-label={t.brandHome}>
          <img src="/logo.png" alt="Engorace Logo" className="brand-logo-img" />
        </button>
        <span className="brand-name"><span className="brand-eng">Eng</span><span className="brand-o">o</span><span className="brand-race">race</span></span>
      </div>

      <nav className="sidebar-nav" aria-label={t.navAria}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              className={`nav-item ${active ? 'nav-item-active' : ''}`}
              onClick={() => onSelectTab(tab.id)}
            >
              <Icon size={22} weight={active ? 'fill' : 'bold'} />
              <span>{tab.label}</span>
              {active && <span className="nav-dot" />}
            </button>
          )
        })}
      </nav>

      <div className="sidebar-spacer" />

      <div className="profile-container">
        <div className="profile-row" onClick={() => onSelectTab('profile')} role="button" tabIndex={0}>
          <span className="avatar">{initial}</span>
          <span className="profile-copy">
            <strong>{displayName}</strong>
            <small>{user?.email || 'Người khám phá'}</small>
          </span>
          <span className="profile-actions">
            <button
              type="button"
              className="profile-icon-btn"
              onClick={(e) => {
                e.stopPropagation()
                onOpenSettings(e.currentTarget)
              }}
              aria-haspopup="dialog"
              title={t.settings}
              aria-label={t.settings}
            >
              <Gear size={18} />
            </button>
            <button
              type="button"
              className="logout-icon-btn"
              onClick={(e) => {
                e.stopPropagation()
                onLogout()
              }}
              title={t.signOut}
              aria-label={t.signOutAria}
            >
              <SignOut size={18} />
            </button>
          </span>
        </div>
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------- */
/* TAB 1: HỌC TẬP                                                */
/* ------------------------------------------------------------- */
function StudyView({ user, onOpenLesson }: { user: AuthUser | null; onOpenLesson: (lessonId: number, lessonTitle: string) => void }) {
  const { t, lang } = useI18n()
  const { stages, loading, error, refresh } = useLearning()
  const firstName = user?.name ? user.name.trim().split(/\s+/)[0] : 'An'
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [cardAnchor, setCardAnchor] = useState<{ x: number; y: number; above: boolean } | null>(null)
  const lessons = useMemo(() => flattenLessons(stages), [stages])
  const currentLesson = useMemo(() => findCurrentLesson(stages), [stages])
  const currentLessonStageIndex = currentLesson?.stageIndex
  const currentLessonIndex = currentLesson?.lessonIndex
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedId) ?? currentLesson ?? lessons[0]
  const completedLessons = lessons.filter((lesson) => lesson.status === 'done').length
  const total = lessons.length
  const activeStageIndex = useMemo(() => findCurrentStageIndex(stages), [stages])
  const [visibleStageIndex, setVisibleStageIndex] = useState(0)
  const mapScrollRef = useRef<HTMLDivElement | null>(null)
  const didAutoScroll = useRef(false)

  useEffect(() => {
    if (didAutoScroll.current || stages.length === 0) return
    const container = mapScrollRef.current
    if (!container || container.scrollHeight <= container.clientHeight + 8) return
    const ratio = stageTop(activeStageIndex) / roadmapHeight(stages.length)
    container.scrollTop = ratio * container.scrollHeight
    didAutoScroll.current = true
  }, [stages, activeStageIndex])

  useEffect(() => {
    if (!didAutoScroll.current || currentLessonStageIndex === undefined || currentLessonIndex === undefined) return
    const container = mapScrollRef.current
    if (!container || container.scrollHeight <= container.clientHeight + 8) return
    const ratio = (
      stageTop(currentLessonStageIndex)
      + ROADMAP_LAYOUT.stageTopPad
      + currentLessonIndex * ROADMAP_LAYOUT.lessonGap
    ) / roadmapHeight(stages.length)
    container.scrollTo({
      top: Math.max(0, ratio * container.scrollHeight - container.clientHeight / 2),
      behavior: 'smooth',
    })
  }, [currentLessonStageIndex, currentLessonIndex, stages.length])

  useEffect(() => {
    const scrollContainer = mapScrollRef.current
    if (!scrollContainer || stages.length === 0) return
    const container = scrollContainer

    function syncVisibleStage() {
      const map = container.querySelector<SVGElement>('.roadmap-map')
      const scrollable = container.scrollHeight > container.clientHeight + 8
      if (!scrollable || !map) {
        setVisibleStageIndex(activeStageIndex)
        return
      }

      const stageHeightPx = map.getBoundingClientRect().height / stages.length
      if (stageHeightPx <= 0) return
      const index = Math.floor((container.scrollTop + container.clientHeight / 2) / stageHeightPx)
      setVisibleStageIndex(Math.min(stages.length - 1, Math.max(0, index)))
    }

    syncVisibleStage()
    container.addEventListener('scroll', syncVisibleStage, { passive: true })
    window.addEventListener('resize', syncVisibleStage)
    return () => {
      container.removeEventListener('scroll', syncVisibleStage)
      window.removeEventListener('resize', syncVisibleStage)
    }
  }, [stages.length, activeStageIndex])

  useEffect(() => {
    if (selectedId === null) {
      setCardAnchor(null)
      return
    }
    const container = mapScrollRef.current
    const map = container?.closest<HTMLElement>('.study-map')
    if (!container || !map) return
    const mapEl = map

    function positionCard() {
      const marker = container?.querySelector<SVGGElement>(`.roadmap-marker[data-lesson-id="${selectedId}"]`)
      if (!marker) {
        setCardAnchor(null)
        return
      }
      const markerRect = marker.getBoundingClientRect()
      const mapRect = mapEl.getBoundingClientRect()
      const cardWidth = Math.min(310, Math.max(220, mapRect.width - 48))
      const markerCenter = markerRect.left + markerRect.width / 2 - mapRect.left
      const x = Math.min(
        mapRect.width - cardWidth / 2 - 12,
        Math.max(cardWidth / 2 + 12, markerCenter),
      )
      const markerTop = markerRect.top - mapRect.top
      const above = markerTop > 230
      const y = above ? markerTop - 12 : markerRect.bottom - mapRect.top + 12
      setCardAnchor({ x, y, above })
    }

    positionCard()
    container.addEventListener('scroll', positionCard, { passive: true })
    window.addEventListener('resize', positionCard)
    return () => {
      container.removeEventListener('scroll', positionCard)
      window.removeEventListener('resize', positionCard)
    }
  }, [selectedId])

  const visibleStage = stages[visibleStageIndex] ?? stages[activeStageIndex] ?? stages[0]
  const visibleVisual = visibleStage ? STAGE_VISUALS[visibleStage.theme] : undefined
  const cardStyle = visibleVisual && visibleStage
    ? ({
        '--stage-card-bg': visibleVisual.bg,
        '--stage-card-ink': visibleVisual.ink,
        '--stage-soft': visibleVisual.soft,
        '--stage-accent': visibleStage.accent,
      } as CSSProperties)
    : undefined

  const ctaLabel =
    selectedLesson?.status === 'locked'
      ? t.stopLocked
      : selectedLesson?.status === 'done'
        ? t.stopReview
        : t.stopContinue

  return (
    <div className="tab-view-container trail-page study-screen">
      <section className="study-map" aria-label={t.mapAria} style={cardStyle}>
        <header className="trail-intro study-map-greeting">
          <span className="trail-eyebrow">{t.studyEyebrow}</span>
          <h1>{t.studyHi(firstName)}<br /><em>{t.studyTail}</em></h1>
          <p className="trail-meta">
            <span>
              <strong>{loading ? '…' : t.studyDoneCount(completedLessons, total)}</strong>{' '}
              {t.studyDoneLabel}
              {stages.length > 0 && (
                <>
                  {' · '}
                  <strong>
                    {lang === 'en' ? 'Stage' : 'Chặng'} {visibleStageIndex + 1}/{stages.length}
                  </strong>
                </>
              )}
            </span>
          </p>
        </header>

        {stages.length > 0 && selectedLesson && (
          <div className="roadmap-scroll" ref={mapScrollRef}>
            <RouteMapCard
              stages={stages}
              selectedLessonId={selectedLesson.id}
              onSelect={(lesson) => setSelectedId(lesson.id)}
              lang={lang}
              fullBleed
              markerLabel={(lesson) => {
                const stageNumber = String(lesson.stageIndex + 1).padStart(2, '0')
                const stageLessonCount = stages[lesson.stageIndex]?.totalCount ?? 0
                const prefix = `${t.stage(stageNumber)} · ${lang === 'en' ? 'lesson' : 'bài'} ${lesson.lessonIndex + 1}/${stageLessonCount}`
                return `${prefix}: ${lesson.title}${lesson.status === 'locked' ? ` (${t.statusLocked})` : ''}`
              }}
            />
          </div>
        )}

        {loading && stages.length === 0 && (
          <div className="roadmap-scroll" ref={mapScrollRef}>
            <div className="roadmap-state">
              <span className="roadmap-spinner" aria-hidden="true" />
              <p>{t.roadmapLoading}</p>
            </div>
          </div>
        )}

        {!loading && stages.length === 0 && (
          <div className="roadmap-scroll">
            <div className="roadmap-state">
              <p>{error ?? t.roadmapEmpty}</p>
              <button type="button" className="roadmap-retry" onClick={refresh}>{t.retry}</button>
            </div>
          </div>
        )}

        {selectedLesson && selectedId !== null && cardAnchor && (
          <article
            className={`roadmap-stop-card roadmap-stop-card-${selectedLesson.status}${cardAnchor.above ? ' is-above' : ''}`}
            style={{
              '--card-x': `${cardAnchor.x}px`,
              '--card-y': `${cardAnchor.y}px`,
            } as CSSProperties}
            aria-live="polite"
          >
            <div className="roadmap-stop-copy">
              <span className="roadmap-stop-index">
                {lang === 'en' ? 'Lesson details' : 'Chi tiết bài học'}
              </span>
              <h2>{selectedLesson.title}</h2>
            </div>
            <div className="roadmap-stop-footer">
              <dl className="roadmap-stop-details">
                <div>
                  <dt>{lang === 'en' ? 'Questions' : 'Số câu hỏi'}</dt>
                  <dd>{selectedLesson.totalQuestions}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="roadmap-stop-action"
                disabled={selectedLesson.status === 'locked'}
                onClick={() => onOpenLesson(selectedLesson.id, selectedLesson.title)}
              >
                {ctaLabel}
              </button>
            </div>
          </article>
        )}
      </section>
    </div>
  )
}

/* ------------------------------------------------------------- */
/* TAB 2: THI ĐUA                                                */
/* ------------------------------------------------------------- */
function CompeteView() {
  const { t } = useI18n()

  const supportingChallenges = [
    {
      title: t.challengeSpeedTitle,
      category: t.challengeSpeedCategory,
      reward: '+30 XP',
      players: t.challengeSpeedPlayers,
      icon: Lightning,
    },
    {
      title: t.challengeDuelTitle,
      category: t.challengeDuelCategory,
      reward: '+50 XP',
      players: t.challengeDuelPlayers,
      icon: Sword,
    },
  ]

  return (
    <div className="tab-view-container">
      <div className="page-heading page-heading-row">
        <div>
          <span className="page-eyebrow">{t.competeEyebrow}</span>
          <h1>{t.competeTitle}</h1>
          <p>{t.competeDesc}</p>
        </div>
        <span className="page-note"><CalendarBlank size={15} /> {t.seasonNote(2)}</span>
      </div>

      <div className="compete-layout">
        <section className="featured-challenge" aria-labelledby="featured-challenge-title">
          <div className="featured-challenge-top">
            <span className="featured-label"><Flag size={14} weight="fill" /> {t.featuredLabel}</span>
            <span className="featured-reward">+100 XP</span>
          </div>
          <div className="featured-challenge-body">
            <span className="featured-icon"><Trophy size={30} weight="fill" /></span>
            <h2 id="featured-challenge-title">{t.featuredTitle}</h2>
            <p>{t.featuredDesc}</p>
            <div className="featured-meta">
              <span><UsersThree size={16} /> {t.featuredPlayers}</span>
              <span><CalendarBlank size={16} /> {t.featuredStarts(2)}</span>
            </div>
            <button type="button" className="featured-action">
              <Play size={16} weight="fill" />
              <span>{t.featuredJoin}</span>
            </button>
          </div>
        </section>

        <div className="challenge-side">
          {supportingChallenges.map((item) => {
            const Icon = item.icon
            return (
              <article className="challenge-row" key={item.title}>
                <span className="challenge-row-icon"><Icon size={22} weight="fill" /></span>
                <div className="challenge-row-copy">
                  <span className="challenge-row-category">{item.category}</span>
                  <h3>{item.title}</h3>
                  <span className="challenge-row-players">{item.players}</span>
                </div>
                <div className="challenge-row-aside">
                  <span className="challenge-row-reward">{item.reward}</span>
                  <button type="button" className="challenge-row-action" aria-label={t.startAria(item.title)}>
                    <Play size={15} weight="fill" />
                  </button>
                </div>
              </article>
            )
          })}

          <aside className="season-card">
            <div className="season-card-head">
              <span>{t.seasonCardTitle}</span>
              <strong>04</strong>
            </div>
            <div className="season-progress" aria-label={t.seasonProgressAria(68)}>
              <span style={{ width: '68%' }} />
            </div>
            <p>{t.seasonCardBody}</p>
          </aside>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- */
/* TAB 3: BẢNG XẾP HẠNG                                          */
/* ------------------------------------------------------------- */
function RankingsView({ user }: { user: AuthUser | null }) {
  const { t } = useI18n()
  const currentName = user?.name || 'An Nguyễn'

  const leaderboard = [
    { rank: 1, name: 'Minh Triết', streak: 42, xp: 1250 },
    { rank: 2, name: 'Thu Thảo', streak: 31, xp: 980 },
    { rank: 3, name: 'Hoàng Nam', streak: 28, xp: 840 },
    { rank: 4, name: currentName, streak: user?.streak ?? 4, xp: user?.xp ?? 240, isMe: true },
    { rank: 5, name: 'Hải Đăng', streak: 12, xp: 210 },
    { rank: 6, name: 'Bảo Ngọc', streak: 9, xp: 190 },
    { rank: 7, name: 'Thanh Hằng', streak: 7, xp: 160 },
  ]

  const podium = [leaderboard[1], leaderboard[0], leaderboard[2]]
  const rest = leaderboard.slice(3)

  return (
    <div className="tab-view-container">
      <div className="page-heading page-heading-row">
        <div>
          <span className="page-eyebrow">{t.rankEyebrow}</span>
          <h1>{t.rankTitle}</h1>
          <p>{t.rankDesc}</p>
        </div>
        <span className="page-note"><CalendarBlank size={15} /> {t.rankUpdated}</span>
      </div>

      <div className="ranking-layout">
        <section className="ranking-podium-card" aria-label={t.podiumAria}>
          <div className="ranking-podium-head">
            <div>
              <span className="section-kicker">{t.topThree}</span>
              <h2>{t.leaders}</h2>
            </div>
            <span className="ranking-podium-caption">{t.podiumCaption}</span>
          </div>
          <div className="podium">
            {podium.map((item) => (
              <article className={`podium-place podium-place-${item.rank}`} key={item.rank}>
                <span className="podium-crown" aria-hidden="true">
                  {item.rank === 1 ? <Crown size={22} weight="fill" /> : <Medal size={20} weight="fill" />}
                </span>
                <span className="podium-avatar">{item.name[0]}</span>
                <span className="podium-name">{item.name}</span>
                <span className="podium-xp" title={`${item.xp} XP`}>{formatCompact(item.xp)} XP</span>
                <span className="podium-streak"><Flame size={13} weight="fill" /> {t.days(item.streak)}</span>
                <span className="podium-step">{item.rank}</span>
              </article>
            ))}
          </div>
        </section>

        <aside className="ranking-season-card">
          <span className="section-kicker">{t.seasonKicker}</span>
          <h2>{t.seasonLeft}</h2>
          <p>{t.seasonBody}</p>
          <div className="ranking-season-row"><span>{t.yourPosition}</span><strong>#4</strong></div>
          <div className="ranking-season-row"><span>{t.gapTop3}</span><strong>600 XP</strong></div>
          <div className="ranking-season-row"><span>{t.promotion}</span><strong>Top 10</strong></div>
          <div className="season-progress" aria-label={t.seasonProgressAria(58)}>
            <span style={{ width: '58%' }} />
          </div>
        </aside>
      </div>

      <div className="leaderboard-card">
        <div className="leaderboard-table-header">
          <span className="col-rank">{t.tableRank}</span>
          <span className="col-user">{t.tableUser}</span>
          <span className="col-streak">{t.tableStreak}</span>
          <span className="col-xp">{t.tableXp}</span>
        </div>

        <div className="leaderboard-rows">
          {rest.map((item) => (
            <div
              key={item.rank}
              className={`leaderboard-row ${item.isMe ? 'leaderboard-row-me' : ''}`}
            >
              <div className="col-rank">
                <span className="rank-num">#{item.rank}</span>
              </div>
              <div className="col-user">
                <span className="table-avatar">{item.name[0]}</span>
                <div>
                  <strong>{item.name}</strong>
                  {item.isMe && <span className="me-badge">{t.you}</span>}
                </div>
              </div>
              <div className="col-streak">
                <Flame size={15} weight="fill" />
                <span>{t.days(item.streak)}</span>
              </div>
              <div className="col-xp" title={`${item.xp} XP`}>
                <strong>{formatCompact(item.xp)} XP</strong>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- */
/* TAB 4: PROFILE                                                */
/* ------------------------------------------------------------- */
function ProfileView({ user, onLogout }: { user: AuthUser | null; onLogout: () => void }) {
  const { t } = useI18n()
  const { stages, loading } = useLearning()
  const initial = user?.name ? user.name.trim()[0].toUpperCase() : 'A'
  const displayName = user?.name || 'An Nguyễn'
  const email = user?.email || 'an.nguyen@example.com'
  const streak = user?.streak ?? 4
  const xp = user?.xp ?? 240
  const lessons = useMemo(() => flattenLessons(stages), [stages])
  const completedStops = lessons.filter((lesson) => lesson.status === 'done').length
  const progressPercent = Math.round((completedStops / Math.max(1, lessons.length)) * 100)
  const currentStage = stages.find((stage) => stage.lessons.some((lesson) => lesson.status === 'current'))
    ?? stages.find((stage) => stage.completedCount < stage.totalCount)
    ?? stages[0]
  const currentStageNumber = currentStage?.sortOrder ?? 1
  const stageStatus = (index: number): 'done' | 'current' | 'locked' => {
    const stage = stages[index]
    if (!stage) return 'locked'
    if (stage.totalCount > 0 && stage.completedCount === stage.totalCount) return 'done'
    if (stage.lessons.some((lesson) => lesson.status === 'current')) return 'current'
    return 'locked'
  }

  return (
    <div className="tab-view-container">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">{t.profileEyebrow}</span>
          <h1>{t.profileTitle}</h1>
          <p>{t.profileDesc}</p>
        </div>
      </div>

      <div className="profile-dashboard-grid">
        <div className="profile-main-card">
          <div className="profile-hero-banner">
            <span className="profile-large-avatar">{initial}</span>
            <div className="profile-hero-info">
              <h2>{displayName}</h2>
              <p>{email}</p>
              <span className="role-tag">
                <ShieldCheck size={16} weight="fill" /> {t.activeLearner}
              </span>
            </div>
            <span className="profile-rank">{t.rankTag}</span>
          </div>

          <div className="profile-stats-grid">
            <div className="p-stat-box">
              <span className="p-stat-icon"><Flame size={22} weight="fill" /></span>
              <strong>{t.days(streak)}</strong>
              <small>{t.statStreakLabel}</small>
            </div>
            <div className="p-stat-box">
              <span className="p-stat-icon"><Lightning size={22} weight="fill" /></span>
              <strong title={`${xp} XP`}>{formatCompact(xp)} XP</strong>
              <small>{t.statXpLabel}</small>
            </div>
            <div className="p-stat-box">
              <span className="p-stat-icon"><CheckCircle size={22} weight="fill" /></span>
              <strong>{loading ? '…' : t.studyDoneCount(completedStops, lessons.length)}</strong>
              <small>{t.statLessonsLabel}</small>
            </div>
          </div>

          <section className="profile-progress-section" aria-labelledby="profile-progress-title">
            <div className="profile-progress-head">
              <div>
                <span className="section-kicker">{t.pathKicker}</span>
                <h3 id="profile-progress-title">{t.pathTitle(currentStageNumber)}</h3>
              </div>
              <span>{progressPercent}%</span>
            </div>
            <div className="profile-progress-track" role="img" aria-label={t.pathAria(progressPercent)}>
              {stages.map((stage, index) => (
                <span
                  key={stage.id}
                  className={`profile-progress-step profile-progress-step-${stageStatus(index)}`}
                />
              ))}
            </div>
            <div className="profile-milestones">
              {(currentStage?.lessons ?? []).map((lesson) => (
                <div className={`profile-milestone profile-milestone-${lesson.status}`} key={lesson.id}>
                  <span className="profile-milestone-num">{String(lesson.lessonIndex + 1).padStart(2, '0')}</span>
                  <span className="profile-milestone-title">{lesson.title}</span>
                  <span className="profile-milestone-status">
                    {lesson.status === 'done' ? t.statusDone : lesson.status === 'current' ? t.statusCurrent : t.statusLocked}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className="profile-badges">
            <span className="profile-badge"><Flag size={15} weight="fill" /> {t.badgeStart}</span>
            <span className="profile-badge"><Flame size={15} weight="fill" /> {t.badgeStreak}</span>
            <span className="profile-badge is-muted"><Sword size={15} weight="fill" /> {t.badgeSprint}</span>
          </div>
        </div>

        <div className="profile-settings-card">
          <h3>{t.accountOptions}</h3>

          <AccountActions user={user} />

          <div className="settings-divider" />

          <div className="profile-side-note">
            <strong>{t.tipTitle}</strong>
            <p>{t.tipBody(streak)}</p>
          </div>

          <button type="button" className="profile-logout-btn" onClick={onLogout}>
            <SignOut size={18} />
            <span>{t.logoutLong}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- */
/* MAIN APP COMPONENT                                            */
/* ------------------------------------------------------------- */
function App() {
  const { t } = useI18n()
  const { user, isAuthenticated, logout } = useAuth()
  const { refresh } = useLearning()
  const [userNavigatedToLanding, setUserNavigatedToLanding] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('study')
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null)
  const [activeLesson, setActiveLesson] = useState<{ id: number; title: string } | null>(null)

  const currentView = (() => {
    if (userNavigatedToLanding) {
      return 'landing'
    }
    return isAuthenticated ? 'dashboard' : 'landing'
  })()

  function handleLogout() {
    logout()
    setUserNavigatedToLanding(true)
  }

  if (currentView === 'landing') {
    return (
      <LandingPage
        onEnterDashboard={() => setUserNavigatedToLanding(false)}
      />
    )
  }

  const mobileTabs: { id: DashboardTab; label: string; icon: typeof BookOpenText }[] = [
    { id: 'study', label: t.navStudy, icon: BookOpenText },
    { id: 'compete', label: t.navCompete, icon: Lightning },
    { id: 'rankings', label: t.navRankingsShort, icon: Trophy },
    { id: 'profile', label: t.navProfile, icon: UserCircle },
  ]

  return (
    <div className="app-shell" id="home">
      <Sidebar
        user={user}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onLogout={handleLogout}
        onViewLanding={() => setUserNavigatedToLanding(true)}
        onOpenSettings={(anchor) => setSettingsAnchor((prev) => (prev === anchor ? null : anchor))}
      />
      <div className="app-main">
        <main className={`learning-page${activeTab === 'study' ? ' learning-page-map' : ''}`}>
          <div className="mobile-brand-row">
            <div className="brand-block">
              <img src="/logo.png" alt="" className="brand-logo-img" />
              <span className="brand-name"><span className="brand-eng">Eng</span><span className="brand-o">o</span><span className="brand-race">race</span></span>
            </div>
            <button
              type="button"
              className="mobile-settings-btn"
              onClick={(e) => setSettingsAnchor((prev) => (prev === e.currentTarget ? null : e.currentTarget))}
              aria-label={t.settings}
              title={t.settings}
            >
              <Gear size={20} />
            </button>
          </div>

          {activeTab === 'study' && (
            <StudyView
              user={user}
              onOpenLesson={(lessonId, lessonTitle) => setActiveLesson({ id: lessonId, title: lessonTitle })}
            />
          )}
          {activeTab === 'compete' && <CompeteView />}
          {activeTab === 'rankings' && <RankingsView user={user} />}
          {activeTab === 'profile' && <ProfileView user={user} onLogout={handleLogout} />}

          <footer className="page-footer">
            <span>{t.footerLeft}</span>
            <span>{t.footerRight}</span>
          </footer>
        </main>
      </div>

      <nav className="mobile-nav" aria-label={t.mobileNavAria}>
        {mobileTabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              className={active ? 'mobile-nav-active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={22} weight={active ? 'fill' : 'bold'} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      <SettingsPanel anchor={settingsAnchor} onClose={() => setSettingsAnchor(null)} />

      {activeLesson && (
        <LessonPlayer
          lessonId={activeLesson.id}
          lessonTitle={activeLesson.title}
          onClose={() => setActiveLesson(null)}
          onCompleted={() => {
            setActiveLesson(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

export default App
