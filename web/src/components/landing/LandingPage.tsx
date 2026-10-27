import { useEffect, useState } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { AuthModal, type AuthMode } from '../auth/AuthModal'
import {
  CurriculumSection,
  HeroSection,
  LandingFooter,
  LandingHeader,
  LearningModesSection,
} from './LandingSections'

interface LandingPageProps {
  onEnterDashboard: () => void
}

const frameSections = [
  { id: 'hero', label: 'Khởi đầu' },
  { id: 'curriculum', label: 'Lộ trình' },
  { id: 'modes', label: 'Hình thức học' },
  { id: 'footer', label: 'Bắt đầu' },
]

export function LandingPage({ onEnterDashboard }: LandingPageProps) {
  const { isAuthenticated } = useAuth()
  const [authMode, setAuthMode] = useState<AuthMode>('register')
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeFrame, setActiveFrame] = useState('hero')

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

  // Track active frame using IntersectionObserver
  useEffect(() => {
    const frameElements = document.querySelectorAll<HTMLElement>('.lp-frame-section')
    if (!frameElements.length || !('IntersectionObserver' in window)) return

    const frameObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target.id) {
            setActiveFrame(entry.target.id)
          }
        })
      },
      { threshold: 0.35 }
    )

    frameElements.forEach((el) => frameObserver.observe(el))
    return () => frameObserver.disconnect()
  }, [])

  // Bi-directional fade-in / reveal logic
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
          if (entry.isIntersecting) {
            entry.target.classList.add('lp-is-visible')
            entry.target.classList.remove('lp-is-hidden')
          } else {
            entry.target.classList.remove('lp-is-visible')
            entry.target.classList.add('lp-is-hidden')
          }
        })
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -20px 0px',
      }
    )

    reveals.forEach((element) => observer.observe(element))
    return () => {
      observer.disconnect()
      page.classList.remove('lp-motion-ready')
    }
  }, [])

  function scrollToFrame(frameId: string) {
    const target = document.getElementById(frameId)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

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

      {/* Floating 3D Frame Dot Navigator */}
      <nav className="lp-frame-nav" aria-label="Điều hướng các khung màn hình">
        {frameSections.map((frame) => (
          <button
            key={frame.id}
            type="button"
            className={`lp-frame-dot${activeFrame === frame.id ? ' is-active' : ''}`}
            onClick={() => scrollToFrame(frame.id)}
            aria-label={`Chuyển đến khung ${frame.label}`}
          >
            <span className="lp-frame-dot-inner" />
            <span className="lp-frame-dot-tooltip">{frame.label}</span>
          </button>
        ))}
      </nav>

      <main id="main-content" className="lp-main">
        {/* Frame 1: Hero */}
        <div className="lp-frame-section lp-frame-hero" id="hero">
          <HeroSection onStart={() => openAuth('register')} />
        </div>

        {/* Frame 2: Curriculum (Lộ trình 5 chặng) */}
        <div className="lp-frame-section lp-frame-curriculum" id="curriculum">
          <CurriculumSection />
        </div>

        {/* Frame 3: Learning Modes (Học qua Video YouTube, ngữ cảnh & Đấu trường từ vựng) */}
        <div className="lp-frame-section lp-frame-modes" id="modes">
          <LearningModesSection onStartDuel={() => openAuth('register')} />
        </div>

        {/* Frame 5: Final CTA & Footer */}
        <div className="lp-frame-section lp-frame-conclusion" id="footer">
          <div className="lp-conclusion-content">
            <section className="lp-final-cta" aria-labelledby="final-cta-title" data-reveal>
              <div className="lp-final-cta-copy">
                <p className="lp-eyebrow">Hành trình bắt đầu ngay hôm nay</p>
                <h2 id="final-cta-title">Bắt đầu từ một câu đơn giản.</h2>
                <p>Tạo tài khoản để mở lộ trình học và tiếp tục luyện theo nhịp của riêng bạn.</p>
              </div>
              <button className="lp-button lp-button-light" type="button" onClick={() => openAuth('register')}>
                Bắt đầu học <ArrowRight size={18} weight="bold" />
              </button>
              <span className="lp-final-cta-mark" aria-hidden="true">E</span>
            </section>
            <LandingFooter onLogin={() => openAuth('login')} onRegister={() => openAuth('register')} />
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
