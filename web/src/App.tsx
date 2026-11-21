import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ArrowRight,
  BookOpenText,
  Gear,
  Lightning,
  SignOut,
  Storefront,
  Translate,
  Trophy,
  UserCircle,
  YoutubeLogo,
} from '@phosphor-icons/react'
import { useAuth } from './context/AuthContext'
import type { AuthUser } from './types/auth'
import { useI18n } from './i18n'
import { SettingsPanel } from './components/SettingsPanel'
import { LoadingDots } from './components/LoadingDots'
import { RouteMapCard } from './components/roadmap/RouteMapCard'
import { nameplateSurface } from './components/cosmetics/nameplateSurface'
import { AvatarFrame } from './components/cosmetics/AvatarFrame'
import { StreakSummary } from './components/profile/StreakSummary'
import { formatCompact } from './utils/format'
import { useWallet } from './context/WalletContext'
import { isAdminRoute } from './admin/adminRoute'

const LessonPlayer = lazy(() => import('./components/lesson/LessonPlayer').then((module) => ({ default: module.LessonPlayer })))
const VideoLearningView = lazy(() => import('./components/video/VideoLearningView').then((module) => ({ default: module.VideoLearningView })))
const TranslateView = lazy(() => import('./components/translate/TranslateView').then((module) => ({ default: module.TranslateView })))
const ArenaView = lazy(() => import('./components/arena/ArenaView').then((module) => ({ default: module.ArenaView })))
const RankingsView = lazy(() => import('./components/rankings/RankingsView').then((module) => ({ default: module.RankingsView })))
const ProfileView = lazy(() => import('./components/profile/ProfileView').then((module) => ({ default: module.ProfileView })))
const GaraShop = lazy(() => import('./components/shop/GaraShop').then((module) => ({ default: module.GaraShop })))
const ReviewLauncher = lazy(() => import('./components/review/ReviewLauncher').then((module) => ({ default: module.ReviewLauncher })))
const AdminApp = lazy(() => import('./admin/AdminApp').then((module) => ({ default: module.AdminApp })))
const LandingPage = lazy(() => import('./components/landing/LandingPage').then((module) => ({ default: module.LandingPage })))
const VoiceOrb = lazy(() => import('./components/ai/VoiceOrb').then((module) => ({ default: module.VoiceOrb })))
const BuddySpotlight = lazy(() => import('./components/ai/BuddySpotlight').then((module) => ({ default: module.BuddySpotlight })))
import { useLearning } from './context/LearningContext'
import type { BuddyView } from './components/ai/VoiceOrb'
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
import type { RoadmapLesson } from './roadmap'

export type DashboardTab = 'study' | 'videos' | 'translate' | 'compete' | 'rankings' | 'shop' | 'profile'

const TAB_STORAGE_KEY = 'engorace_active_tab'
const DASHBOARD_TABS: DashboardTab[] = ['study', 'videos', 'translate', 'compete', 'rankings', 'shop', 'profile']

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
  const { wallet } = useWallet()
  const displayName = user?.name || 'An Nguyễn'
  // The equipped plate is a block background here, not a band around the
  // name, so the sidebar strip shows the cosmetic the learner paid for.
  const plate = nameplateSurface(wallet?.equipment.nameplate?.visual_key, wallet?.equipment.nameplate?.style)
  const totalXp = wallet?.xp ?? 0
  const level = wallet?.level ?? 1
  const xpRatio = wallet?.level_progress.progress_ratio ?? 0
  const xpToNext = wallet?.level_progress.xp_to_next_level ?? null
  const xpPercent = Math.min(100, Math.max(0, Math.round(xpRatio * 100)))

  const tabs: { id: DashboardTab; label: string; icon: typeof BookOpenText; activeIcon?: typeof BookOpenText }[] = [
    { id: 'study', label: t.navStudy, icon: BookOpenText },
    { id: 'videos', label: t.navVideos, icon: YoutubeLogo },
    { id: 'translate', label: t.navTranslate, icon: Translate },
    { id: 'compete', label: t.navCompete, icon: Lightning },
    { id: 'rankings', label: t.navRankings, icon: Trophy },
    { id: 'shop', label: t.navShop, icon: Storefront },
    { id: 'profile', label: t.navProfile, icon: UserCircle },
  ]

  // The admin console is a fully separate shell at /admin — never a learner tab,
  // and the learner shell never links to it. Admins only manage; learners only learn.

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <button className="brand-logo-btn" type="button" onClick={onViewLanding} aria-label={t.brandHome}>
          <img src="/logo.png" alt="Engorace Logo" className="brand-logo-img" />
        </button>
        <span className="brand-name"><span className="brand-eng">Eng</span><span className="brand-o">o</span><span className="brand-race">race</span></span>
        {/* The streak mascot lives beside the wordmark now; the old strip at
            the foot of the sidebar was taking a whole line from the card. */}
        <StreakSummary compact />
      </div>

      {/* The full wallet card still lives on Profile; the strip at the foot of
          the sidebar carries a compact balance + XP readout next to the user. */}
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
        {/* No admin entry here: the console lives only at /admin (direct URL). */}
      </nav>

      <div className="sidebar-spacer" />

      <div className="profile-container">
        <div
          className={`profile-row${plate.className}`}
          style={plate.style}
          onClick={() => onSelectTab('profile')}
          role="button"
          tabIndex={0}
        >
          <div className="profile-banner" aria-hidden="true">
            <svg viewBox="0 0 300 64" preserveAspectRatio="xMidYMid slice">
              <rect className="banner-sky" width="300" height="64" />
              <circle className="banner-sun" cx="250" cy="22" r="11" />
              <g fill="#fff">
                <circle cx="30" cy="14" r="1.8" />
                <circle cx="78" cy="30" r="1.4" />
                <circle cx="130" cy="12" r="1.8" />
                <circle cx="190" cy="24" r="1.4" />
              </g>
              <ellipse className="banner-hill" cx="60" cy="74" rx="120" ry="24" />
              <path className="banner-castle" d="M200 64V40h8v-6h4v6h6v-12l4-7 4 7v12h6v-6h4v6h8v24z" />
            </svg>
          </div>
          <div className="profile-main-row">
            <div className="profile-avatar-wrap">
              <AvatarFrame
                name={displayName}
                visualKey={wallet?.equipment.frame?.visual_key ?? null}
                style={wallet?.equipment.frame?.style ?? null}
                size={82}
              />
              {/* The level lives here only: the copy line used to repeat it. */}
              <b className="profile-level-badge" aria-label={`${t.walletLevel} ${level}`}>{level}</b>
            </div>
            <span className="profile-copy">
              <strong title={displayName}>{displayName}</strong>
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

          {/* One wide meter carries the totals: the XP number rides inside the
              track, so the card drops the extra line that repeated balance. */}
          <span
            className="profile-xp"
            title={xpToNext !== null
              ? `${formatCompact(xpToNext)} XP ${t.walletLevelNext}`
              : t.walletLevelMax}
          >
            <span
              className="profile-xp-meter"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={xpPercent}
              aria-label={`${formatCompact(totalXp)} XP · ${t.walletLevel} ${level}`}
            >
              <span className="profile-xp-fill" style={{ width: `${xpPercent}%` }} />
              <b className="profile-xp-value">{formatCompact(totalXp)} XP</b>
            </span>
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
  const { wallet } = useWallet()
  const firstName = user?.name ? user.name.trim().split(/\s+/)[0] : 'An'
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [cardAbove, setCardAbove] = useState(false)
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
  const cardRef = useRef<HTMLElement | null>(null)
  const cardAboveRef = useRef(false)
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
    const map = container.querySelector<SVGElement>('.roadmap-map')
    let frame = 0

    function syncVisibleStage() {
      const scrollable = container.scrollHeight > container.clientHeight + 8
      if (!scrollable || !map) {
        setVisibleStageIndex(activeStageIndex)
        return
      }

      const stageHeightPx = map.getBoundingClientRect().height / stages.length
      if (stageHeightPx <= 0) return
      const index = Math.floor((container.scrollTop + container.clientHeight / 2) / stageHeightPx)
      const next = Math.min(stages.length - 1, Math.max(0, index))
      setVisibleStageIndex((previous) => (previous === next ? previous : next))
    }

    function scheduleSync() {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        syncVisibleStage()
      })
    }

    syncVisibleStage()
    container.addEventListener('scroll', scheduleSync, { passive: true })
    window.addEventListener('resize', scheduleSync)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      container.removeEventListener('scroll', scheduleSync)
      window.removeEventListener('resize', scheduleSync)
    }
  }, [stages.length, activeStageIndex])

  /**
   * The lesson card floats over the map, so it has to follow its marker while
   * the trail scrolls. Writing the CSS variables straight onto the node keeps
   * the 6-stage SVG out of React's render path: previously every scroll event
   * re-rendered the whole map, which cost more than half of the frame budget.
   */
  useLayoutEffect(() => {
    if (selectedId === null) return
    const container = mapScrollRef.current
    const map = container?.closest<HTMLElement>('.study-map')
    if (!container || !map) return

    const marker = container.querySelector<SVGGElement>(
      `.roadmap-marker[data-lesson-id="${selectedId}"]`,
    )
    // The marker group's box also contains the animated pulse ring and the
    // lesson caption, so its edge moves with the animation. The hit circle is
    // the stable geometry that actually represents the pin.
    const markerAnchor = marker?.querySelector<SVGCircleElement>('.roadmap-marker-hit') ?? marker
    const mapEl = map
    const desktopMap = window.matchMedia('(min-width: 961px)')
    let frame = 0

    function positionCard() {
      // Below the desktop breakpoint the card sits inline in the page flow.
      if (!desktopMap.matches) return
      const card = cardRef.current
      if (!markerAnchor || !card) return
      const markerRect = markerAnchor.getBoundingClientRect()
      const mapRect = mapEl.getBoundingClientRect()
      const cardWidth = Math.min(320, Math.max(220, mapRect.width - 48))
      const markerCenter = markerRect.left + markerRect.width / 2 - mapRect.left
      const x = Math.min(
        mapRect.width - cardWidth / 2 - 12,
        Math.max(cardWidth / 2 + 12, markerCenter),
      )
      const markerTop = markerRect.top - mapRect.top
      const above = markerTop > card.offsetHeight + 24
      const y = above ? markerTop - 12 : markerRect.bottom - mapRect.top + 12
      const notchX = Math.min(
        cardWidth - 24,
        Math.max(24, markerCenter - (x - cardWidth / 2)),
      )

      card.style.setProperty('--card-x', `${x}px`)
      card.style.setProperty('--card-y', `${y}px`)
      card.style.setProperty('--notch-x', `${notchX}px`)
      if (above !== cardAboveRef.current) {
        cardAboveRef.current = above
        setCardAbove(above)
      }
    }

    function schedulePosition() {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        positionCard()
      })
    }

    positionCard()
    container.addEventListener('scroll', schedulePosition, { passive: true })
    window.addEventListener('resize', schedulePosition)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      container.removeEventListener('scroll', schedulePosition)
      window.removeEventListener('resize', schedulePosition)
    }
  }, [selectedId])

  const handleSelectLesson = useCallback((lesson: RoadmapLesson) => {
    setSelectedId(lesson.id)
  }, [])

  const markerLabel = useCallback((lesson: RoadmapLesson) => {
    const stageNumber = String(lesson.stageIndex + 1).padStart(2, '0')
    const stageLessonCount = stages[lesson.stageIndex]?.totalCount ?? 0
    const prefix = `${t.stage(stageNumber)} · ${lang === 'en' ? 'lesson' : 'bài'} ${lesson.lessonIndex + 1}/${stageLessonCount}`
    return `${prefix}: ${lesson.title}${lesson.status === 'locked' ? ` (${t.statusLocked})` : ''}`
  }, [stages, t, lang])

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

  const statusLabel =
    selectedLesson?.status === 'done'
      ? t.statusDone
      : selectedLesson?.status === 'locked'
        ? t.statusLocked
        : t.statusCurrent

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
              onSelect={handleSelectLesson}
              lang={lang}
              fullBleed
              markerLabel={markerLabel}
              carKey={wallet?.equipment.car?.visual_key ?? null}
              carStyle={wallet?.equipment.car?.style ?? null}
            />
          </div>
        )}

        {loading && stages.length === 0 && (
          <div className="roadmap-scroll" ref={mapScrollRef}>
            <div className="roadmap-state">
              <LoadingDots label={t.roadmapLoading} />
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

        {selectedLesson && selectedId !== null && (
          <article
            ref={cardRef}
            className={`roadmap-stop-card roadmap-stop-card-${selectedLesson.status}${cardAbove ? ' is-above' : ''}`}
            aria-live="polite"
          >
            <div className="roadmap-stop-top">
              <span className="roadmap-stop-index">
                {t.stage(String(selectedLesson.stageIndex + 1).padStart(2, '0'))}
                <span className="roadmap-stop-sep" aria-hidden="true" />
                {t.stopLessonLabel} {String(selectedLesson.lessonIndex + 1).padStart(2, '0')}
              </span>
              <span className={`roadmap-stop-status is-${selectedLesson.status}`}>
                <span className="roadmap-stop-status-dot" aria-hidden="true" />
                {statusLabel}
              </span>
            </div>
            <div className="roadmap-stop-copy">
              <h2>{selectedLesson.title}</h2>
            </div>
            <div className="roadmap-stop-footer">
              <p className="roadmap-stop-stat">
                <strong>{selectedLesson.totalQuestions}</strong>
                <span>{t.stopQuestionLabel}</span>
              </p>
              <button
                type="button"
                className="roadmap-stop-action"
                disabled={selectedLesson.status === 'locked'}
                onClick={() => onOpenLesson(selectedLesson.id, selectedLesson.title)}
              >
                {ctaLabel}
                {selectedLesson.status !== 'locked' && (
                  <ArrowRight size={14} weight="bold" aria-hidden="true" />
                )}
              </button>
            </div>
          </article>
        )}
      </section>
    </div>
  )
}

/* ------------------------------------------------------------- */
/* LEARNER APP (separate from the admin console at /admin)       */
/* ------------------------------------------------------------- */
function LearnerApp() {
  const { t } = useI18n()
  const { user, isAuthenticated, logout } = useAuth()
  const { stages, refresh } = useLearning()
  const { wallet, refresh: refreshWallet } = useWallet()
  const [userNavigatedToLanding, setUserNavigatedToLanding] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>(readStoredTab)
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null)
  const [activeLesson, setActiveLesson] = useState<{ id: number; title: string } | null>(null)
  // Review is no longer a tab: the profile button opens one short session.
  const [reviewOpen, setReviewOpen] = useState(false)
  const [buddyView, setBuddyView] = useState<BuddyView>(null)
  // A deep-link request coming from the buddy (open one video or the notebook).
  const [videoRequest, setVideoRequest] = useState<
    { kind: 'video' | 'notebook'; videoId?: number; nonce: number } | null
  >(null)
  const clearVideoRequest = useCallback(() => setVideoRequest(null), [])

  // The admin console is a separate shell — the learner shell has no admin tab.
  const effectiveTab: DashboardTab = activeTab
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
    if (!DASHBOARD_TABS.includes(tab)) return
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

  const mobileTabs: { id: DashboardTab; label: string; icon: typeof BookOpenText; activeIcon?: typeof BookOpenText }[] = [
    { id: 'study', label: t.navStudy, icon: BookOpenText },
    { id: 'videos', label: t.navVideos, icon: YoutubeLogo },
    { id: 'translate', label: t.navTranslateShort, icon: Translate },
    { id: 'compete', label: t.navCompete, icon: Lightning },
    { id: 'rankings', label: t.navRankingsShort, icon: Trophy },
    { id: 'shop', label: t.navShopShort, icon: Storefront },
    { id: 'profile', label: t.navProfile, icon: UserCircle },
  ]

  if (currentView === 'landing') {
    return (
      <Suspense fallback={<div className="page-loading"><LoadingDots label={t.consoleLoading} /></div>}>
        <LandingPage onEnterDashboard={() => setUserNavigatedToLanding(false)} />
      </Suspense>
    )
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
            {/* The sidebar carries the level on desktop, but it is hidden below
                960px, so the same fact rides here on mobile. Both right-hand
                items share a group so `space-between` keeps them together. */}
            <span className="mobile-brand-actions">
              <StreakSummary compact />
              <span className="mobile-level-chip">{t.walletLevel} {wallet?.level ?? 1}</span>
              <button
                type="button"
                className="mobile-settings-btn"
                onClick={(e) => setSettingsAnchor((prev) => (prev === e.currentTarget ? null : e.currentTarget))}
                aria-label={t.settings}
                title={t.settings}
              >
                <Gear size={20} />
              </button>
            </span>
          </div>

          {effectiveTab === 'study' && (
            <StudyView
              user={user}
              onOpenLesson={(lessonId, lessonTitle) => setActiveLesson({ id: lessonId, title: lessonTitle })}
            />
          )}
          <Suspense fallback={<div className="page-loading"><LoadingDots label={t.consoleLoading} /></div>}>
            {effectiveTab === 'videos' && (
              <VideoLearningView videoRequest={videoRequest} onVideoRequestHandled={clearVideoRequest} />
            )}
            {effectiveTab === 'translate' && <TranslateView />}
            {effectiveTab === 'compete' && <ArenaView />}
            {effectiveTab === 'rankings' && (
              <RankingsView onStartStudying={() => setActiveTab('study')} />
            )}
            {effectiveTab === 'profile' && (
              <ProfileView onLogout={handleLogout} onOpenReview={() => setReviewOpen(true)} />
            )}
            {activeLesson && (
              <LessonPlayer
                lessonId={activeLesson.id}
                lessonTitle={activeLesson.title}
                onClose={() => setActiveLesson(null)}
                onCompleted={() => {
                  setActiveLesson(null)
                  refresh()
                  // A finished lesson pays coin/XP, so the wallet chip must follow.
                  refreshWallet()
                }}
              />
            )}
            {effectiveTab === 'shop' && <GaraShop />}
            <VoiceOrb
              activeTab={effectiveTab}
              view={buddyView}
              onViewChange={setBuddyView}
              onNavigate={handleBuddyNavigate}
              onOpenReview={() => setReviewOpen(true)}
            />
            <BuddySpotlight spot={spotlight} />
          </Suspense>
        </main>
      </div>

      <nav className="mobile-nav" aria-label={t.mobileNavAria}>
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
      {reviewOpen && (
        <Suspense fallback={null}>
          <ReviewLauncher onClose={() => setReviewOpen(false)} />
        </Suspense>
      )}

    </div>
  )
}

function App() {
  if (isAdminRoute()) {
    return (
      <Suspense fallback={<div className="page-loading"><LoadingDots label="Đang tải console…" /></div>}>
        <AdminApp />
      </Suspense>
    )
  }
  return <LearnerApp />
}

export default App
