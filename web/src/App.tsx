import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  BookOpenText,
  Gear,
  Lightning,
  ShieldCheck,
  SignOut,
  Translate,
  Trophy,
  UserCircle,
  YoutubeLogo,
} from '@phosphor-icons/react'
import { useAuth } from './context/AuthContext'
import { LandingPage } from './components/landing/LandingPage'
import type { AuthUser } from './types/auth'
import { useI18n } from './i18n'
import { SettingsPanel } from './components/SettingsPanel'
import { RouteMapCard } from './components/roadmap/RouteMapCard'
import { LessonPlayer } from './components/lesson/LessonPlayer'
import { VideoLearningView } from './components/video/VideoLearningView'
import { TranslateView } from './components/translate/TranslateView'
import { ArenaView } from './components/arena/ArenaView'
import { RankingsView } from './components/rankings/RankingsView'
import { ProfileView } from './components/profile/ProfileView'
import { AdminView } from './components/admin/AdminView'
import { useLearning } from './context/LearningContext'
import { StudyBuddy, type BuddyView } from './components/ai/StudyBuddy'
import { BuddySpotlight } from './components/ai/BuddySpotlight'
import { useBuddySpotlight } from './components/ai/useBuddySpotlight'
import type { BuddyTarget } from './types/buddy'
import { confirmArenaLeave } from './utils/arenaGuard'
import {
  ROADMAP_LAYOUT,
  STAGE_VISUALS,
  findCurrentLesson,
  findCurrentStageIndex,
  flattenLessons,
  roadmapHeight,
  stageTop,
} from './roadmap'

export type DashboardTab = 'study' | 'videos' | 'translate' | 'compete' | 'rankings' | 'profile' | 'admin'

const TAB_STORAGE_KEY = 'engorace_active_tab'
const DASHBOARD_TABS: DashboardTab[] = ['study', 'videos', 'translate', 'compete', 'rankings', 'profile', 'admin']

function readStoredTab(): DashboardTab {
  try {
    const stored = sessionStorage.getItem(TAB_STORAGE_KEY)
    if (stored && DASHBOARD_TABS.includes(stored as DashboardTab)) return stored as DashboardTab
  } catch {
    /* storage can be unavailable in private mode */
  }
  return 'study'
}

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

  const tabs: { id: DashboardTab; label: string; icon: typeof BookOpenText; activeIcon?: typeof BookOpenText }[] = [
    { id: 'study', label: t.navStudy, icon: BookOpenText },
    { id: 'videos', label: t.navVideos, icon: YoutubeLogo },
    { id: 'translate', label: t.navTranslate, icon: Translate },
    { id: 'compete', label: t.navCompete, icon: Lightning },
    { id: 'rankings', label: t.navRankings, icon: Trophy },
    { id: 'profile', label: t.navProfile, icon: UserCircle },
  ]

  // The content console is for administrators only.
  if (user?.role === 'admin') {
    tabs.push({ id: 'admin', label: t.navAdmin, icon: ShieldCheck })
  }

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
          const active = activeTab === tab.id
          const Icon = active && tab.activeIcon ? tab.activeIcon : tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              className={`nav-item ${active ? 'nav-item-active' : ''}`}
              onClick={() => onSelectTab(tab.id)}
            >
              <Icon size={24} weight={tab.id === 'translate' ? 'regular' : active ? 'fill' : 'regular'} />
              <span>{tab.label}</span>
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
function StudyView({ user, onOpenLesson }: {
  user: AuthUser | null
  onOpenLesson: (lessonId: number, lessonTitle: string) => void
}) {
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
    if (selectedId === null) return
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
/* MAIN APP COMPONENT                                            */
/* ------------------------------------------------------------- */
function App() {
  const { t } = useI18n()
  const { user, isAuthenticated, logout } = useAuth()
  const { stages, refresh } = useLearning()
  const [userNavigatedToLanding, setUserNavigatedToLanding] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>(readStoredTab)
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null)
  const [activeLesson, setActiveLesson] = useState<{ id: number; title: string } | null>(null)
  const [buddyView, setBuddyView] = useState<BuddyView>(null)
  // A deep-link request coming from the buddy (open one video or the notebook).
  const [videoRequest, setVideoRequest] = useState<
    { kind: 'video' | 'notebook'; videoId?: number; nonce: number } | null
  >(null)
  const clearVideoRequest = useCallback(() => setVideoRequest(null), [])

  // A tab stored by a previous admin session must never open for a learner.
  const effectiveTab: DashboardTab = activeTab === 'admin' && user?.role !== 'admin' ? 'study' : activeTab
  /** Element the buddy asked us to circle on the destination screen. */
  const [buddyHighlight, setBuddyHighlight] = useState<string | null>(null)
  const spotlight = useBuddySpotlight(buddyHighlight, Boolean(buddyHighlight))

  const videoRequestNonce = useRef(0)
  const nextVideoNonce = () => {
    videoRequestNonce.current += 1
    return videoRequestNonce.current
  }

  /**
   * The buddy now navigates by target, not by action kind: every nudge and answer
   * carries `{ tab, lessonId?, videoId?, highlight? }`, so one handler covers
   * "open this lesson", "open this video", "open the notebook" and "circle this".
   */
  function handleBuddyNavigate(target: BuddyTarget) {
    const tab = (target.tab ?? effectiveTab) as DashboardTab
    if (tab === 'admin' && user?.role !== 'admin') return
    if (!confirmArenaLeave()) return

    if (target.videoId) {
      if (effectiveTab !== 'videos') setActiveTab('videos')
      setVideoRequest({ kind: 'video', videoId: target.videoId, nonce: nextVideoNonce() })
    } else if (target.highlight === 'control:notebook' || target.highlight === 'control:notebook-open') {
      if (effectiveTab !== 'videos') setActiveTab('videos')
      setVideoRequest({ kind: 'notebook', nonce: nextVideoNonce() })
    } else if (target.lessonId) {
      if (effectiveTab !== 'study') setActiveTab('study')
      // A target that asks for a highlight means "show me where it is", so the
      // map is circled instead of yanking the learner straight into the player.
      if (!target.highlight) {
        setActiveLesson({
          id: target.lessonId,
          title: lessonTitleFor(target.lessonId) ?? 'Bài học',
        })
      }
    } else if (tab !== effectiveTab) {
      setActiveTab(tab)
    }

    setBuddyView(null)
    if (target.highlight) {
      // Let the destination render before looking for the element.
      setBuddyHighlight(null)
      window.setTimeout(() => setBuddyHighlight(target.highlight ?? null), 220)
    }
  }

  function lessonTitleFor(lessonId: number): string | null {
    for (const stage of stages) {
      const found = stage.lessons.find((lesson) => lesson.id === lessonId)
      if (found) return found.title
    }
    return null
  }

  useEffect(() => {
    try {
      sessionStorage.setItem(TAB_STORAGE_KEY, effectiveTab)
    } catch {
      /* storage can be unavailable in private mode */
    }
  }, [effectiveTab])

  const currentView = (() => {
    if (userNavigatedToLanding) {
      return 'landing'
    }
    return isAuthenticated ? 'dashboard' : 'landing'
  })()

  function selectTab(tab: DashboardTab) {
    if (tab === effectiveTab) return
    if (!confirmArenaLeave()) return
    setActiveTab(tab)
  }

  function viewLanding() {
    if (!confirmArenaLeave()) return
    setUserNavigatedToLanding(true)
  }

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

  const mobileTabs: { id: DashboardTab; label: string; icon: typeof BookOpenText; activeIcon?: typeof BookOpenText }[] = [
    { id: 'study', label: t.navStudy, icon: BookOpenText },
    { id: 'videos', label: t.navVideos, icon: YoutubeLogo },
    { id: 'translate', label: t.navTranslateShort, icon: Translate },
    { id: 'compete', label: t.navCompete, icon: Lightning },
    { id: 'rankings', label: t.navRankingsShort, icon: Trophy },
    { id: 'profile', label: t.navProfile, icon: UserCircle },
  ]
  if (user?.role === 'admin') {
    mobileTabs.push({ id: 'admin', label: t.navAdmin, icon: ShieldCheck })
  }

  return (
    <div className="app-shell" id="home">
      <Sidebar
        user={user}
        activeTab={effectiveTab}
        onSelectTab={selectTab}
        onLogout={handleLogout}
        onViewLanding={viewLanding}
        onOpenSettings={(anchor) => setSettingsAnchor((prev) => (prev === anchor ? null : anchor))}
      />
      <div className="app-main">
        <main
          className={`learning-page${effectiveTab === 'study' ? ' learning-page-map' : ''}${effectiveTab === 'translate' ? ' learning-page-translate' : ''}`}
          data-current-lesson={findCurrentLesson(stages)?.title ?? ''}
          data-total-lessons={stages.reduce((acc, s) => acc + s.totalCount, 0)}
          data-completed-lessons={stages.reduce((acc, s) => acc + s.completedCount, 0)}
          data-current-stage={stages[findCurrentStageIndex(stages)]?.title ?? ''}
        >
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

          {effectiveTab === 'study' && (
            <StudyView
              user={user}
              onOpenLesson={(lessonId, lessonTitle) => setActiveLesson({ id: lessonId, title: lessonTitle })}
            />
          )}
          {effectiveTab === 'videos' && (
            <VideoLearningView videoRequest={videoRequest} onVideoRequestHandled={clearVideoRequest} />
          )}
          {effectiveTab === 'translate' && <TranslateView />}
          {effectiveTab === 'compete' && <ArenaView />}
          {effectiveTab === 'rankings' && <RankingsView />}
          {effectiveTab === 'profile' && <ProfileView onLogout={handleLogout} />}
          {effectiveTab === 'admin' && <AdminView />}
        </main>
      </div>

      <nav className={`mobile-nav${user?.role === 'admin' ? ' is-admin' : ''}`} aria-label={t.mobileNavAria}>
        {mobileTabs.map((tab) => {
          const active = effectiveTab === tab.id
          const Icon = active && tab.activeIcon ? tab.activeIcon : tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              className={active ? 'mobile-nav-active' : ''}
              onClick={() => selectTab(tab.id)}
            >
              <Icon size={24} weight={tab.id === 'translate' ? 'regular' : active ? 'fill' : 'regular'} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      <SettingsPanel anchor={settingsAnchor} onClose={() => setSettingsAnchor(null)} />

      <StudyBuddy
        activeTab={effectiveTab}
        view={buddyView}
        onViewChange={setBuddyView}
        onNavigate={handleBuddyNavigate}
      />

      <BuddySpotlight spot={spotlight} />

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
