import { useEffect, useState } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { AuthModal, type AuthMode } from '../auth/AuthModal'
import {
  CurriculumSection,
  HeroSection,
  LandingHeader,
  LearningModesSection,
} from './LandingSections'

interface LandingPageProps {
  onEnterDashboard: () => void
}

export function LandingPage({ onEnterDashboard }: LandingPageProps) {
  const { isAuthenticated } = useAuth()
  const [authMode, setAuthMode] = useState<AuthMode>('register')
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  function openAuth(mode: AuthMode) {
    setMenuOpen(false)
    setAuthMode(mode)
    setAuthModalOpen(true)
  }

  function handleAuthSuccess() {
    setAuthModalOpen(false)
    onEnterDashboard()
  }

  useEffect(() => {
    if (!menuOpen) return

    function handleMenuKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      document.querySelector<HTMLButtonElement>('.lp-menu-toggle')?.focus()
    }

    window.addEventListener('keydown', handleMenuKeyDown)
    return () => window.removeEventListener('keydown', handleMenuKeyDown)
  }, [menuOpen])

  // The landing has no dark mode: one bright cyan gam from header to footer.
  // Force the light token set while mounted, then restore the learner's saved
  // theme so the dashboard is unchanged when they enter the app.
  useEffect(() => {
    const root = document.documentElement
    const previousTheme = root.dataset.theme
    const previousColorScheme = root.style.colorScheme
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const previousMeta = themeMeta?.content ?? null

    root.classList.add('lp-active')
    root.dataset.theme = 'light'
    root.style.colorScheme = 'light'
    if (themeMeta) themeMeta.content = '#EAF9FF'

    return () => {
      root.classList.remove('lp-active')
      if (previousTheme === undefined) delete root.dataset.theme
      else root.dataset.theme = previousTheme
      root.style.colorScheme = previousColorScheme
      if (themeMeta && previousMeta !== null) themeMeta.content = previousMeta
    }
  }, [])

  // Reveal-on-scroll: reveal once, then stay visible.
  // Two-way reveal made sections vanish when scrolling back up, which read as jank.
  useEffect(() => {
    const page = document.querySelector('.landing-page-wrapper')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!page || reduceMotion || !('IntersectionObserver' in window)) return

    const reveals = page.querySelectorAll<HTMLElement>('[data-reveal]')
    if (reveals.length === 0) return

    page.classList.add('lp-motion-ready')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('lp-is-visible')
          entry.target.classList.remove('lp-is-hidden')
          observer.unobserve(entry.target)
        })
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      }
    )

    reveals.forEach((element) => observer.observe(element))
    return () => {
      observer.disconnect()
      page.classList.remove('lp-motion-ready')
    }
  }, [])

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const target = document.querySelector<HTMLElement>(hash)
    if (!target) return
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }))
  }, [])

  return (
    <div className="landing-page-wrapper" id="top">
      <a className="lp-skip-link" href="#main-content">Bỏ qua nội dung</a>
      <LandingHeader
        isAuthenticated={isAuthenticated}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        onCloseMenu={() => setMenuOpen(false)}
        onLogin={() => openAuth('login')}
        onRegister={() => openAuth('register')}
        onContinue={onEnterDashboard}
      />

      <main id="main-content" className="lp-main">
        <div className="lp-band lp-band-hero">
          <HeroSection onStart={() => openAuth('register')} />
        </div>

        <div className="lp-band lp-band-curriculum">
          <CurriculumSection />
        </div>

        <div className="lp-band lp-band-modes">
          <LearningModesSection onStartDuel={() => openAuth('register')} onRequireAuth={() => openAuth('register')} />
        </div>

        <div className="lp-band lp-band-conclusion" id="footer">
          <div className="lp-conclusion-content">
            <section className="lp-final-cta" aria-labelledby="final-cta-title" data-reveal>
              <div className="lp-final-cta-copy">
                <p className="lp-eyebrow">Hành trình bắt đầu ngay hôm nay</p>
                <h2 id="final-cta-title">Bắt đầu từ một câu đơn giản.</h2>
                <p>Tạo tài khoản để mở lộ trình học và tiếp tục luyện theo nhịp của riêng bạn.</p>
              </div>
              <button className="lp-button lp-button-sun lp-button-large" type="button" onClick={() => openAuth('register')}>
                Bắt đầu học <ArrowRight size={18} weight="bold" />
              </button>
            </section>
          </div>
        </div>
      </main>

      <AuthModal
        isOpen={authModalOpen}
        mode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onSwitchMode={setAuthMode}
        onSuccess={handleAuthSuccess}
      />
    </div>
  )
}
