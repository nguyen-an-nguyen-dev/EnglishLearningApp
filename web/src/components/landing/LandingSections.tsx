import { useEffect, useRef, useState } from 'react'
import {
  ArrowCounterClockwise,
  ArrowRight,
  BookOpenText,
  CaretDown,
  ChatCircleDots,
  CheckCircle,
  Clock,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  Fire,
  Headphones,
  List,
  Microphone,
  Sparkle,
  SpeakerHigh,
  Sword,
  Trophy,
  X,
  XCircle,
  YoutubeLogo,
} from '@phosphor-icons/react'

export interface LandingHeaderProps {
  isAuthenticated: boolean
  menuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
  onLogin: () => void
  onRegister: () => void
  onContinue: () => void
}

const navItems = [
  { href: '#curriculum', label: 'Lộ trình' },
  { href: '#modes', label: 'Hình thức học' },
]

export function LandingHeader({
  isAuthenticated,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onLogin,
  onRegister,
  onContinue,
}: LandingHeaderProps) {
  return (
    <header className="lp-header">
      <div className="lp-header-inner">
        <a className="lp-wordmark" href="#top" onClick={onCloseMenu} aria-label="Engorace, về đầu trang">
          <div className="lp-brand-logo-wrap" aria-hidden="true">
            <img src="/logo.png" alt="Engorace Logo" className="lp-brand-logo-img" />
          </div>
          <span className="lp-brand-wordmark"><span className="lp-brand-eng">Eng</span><span className="lp-brand-o">o</span><span className="lp-brand-race">race</span></span>
        </a>

        <button
          className="lp-menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="lp-primary-nav"
          aria-label={menuOpen ? 'Đóng điều hướng' : 'Mở điều hướng'}
          onClick={onToggleMenu}
        >
          {menuOpen ? <X size={21} weight="regular" /> : <List size={21} weight="regular" />}
        </button>

        <nav id="lp-primary-nav" className={`lp-primary-nav${menuOpen ? ' is-open' : ''}`} aria-label="Điều hướng chính">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} onClick={onCloseMenu}>{item.label}</a>
          ))}
          <div className="lp-mobile-nav-actions">
            {isAuthenticated ? (
              <button className="lp-button lp-button-primary" type="button" onClick={onContinue}>
                Bắt đầu <ArrowRight size={17} weight="bold" />
              </button>
            ) : (
              <>
                <button className="lp-nav-login" type="button" onClick={onLogin}>Đăng nhập</button>
                <button className="lp-button lp-button-primary" type="button" onClick={onRegister}>
                  Bắt đầu <ArrowRight size={17} weight="bold" />
                </button>
              </>
            )}
          </div>
        </nav>

        <div className="lp-header-actions">
          {isAuthenticated ? (
            <button className="lp-button lp-button-primary" type="button" onClick={onContinue}>
              Bắt đầu <ArrowRight size={17} weight="bold" />
            </button>
          ) : (
            <>
              <button className="lp-nav-login" type="button" onClick={onLogin}>Đăng nhập</button>
              <button className="lp-button lp-button-primary" type="button" onClick={onRegister}>
                Bắt đầu <ArrowRight size={17} weight="bold" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

interface HeroSectionProps {
  onStart: () => void
}

const greetingOptions = ['Good morning', 'Good night', 'Goodbye']

function LessonPreview() {
  const [choice, setChoice] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const isCorrect = choice === 'Good morning'

  function resetPreview() {
    setChoice(null)
    setChecked(false)
  }

  return (
    <article className="lp-lesson-preview" aria-label="Bản xem trước một bài tập tiếng Anh">
      <div className="lp-preview-topline">
        <span className="lp-preview-course"><BookOpenText size={17} weight="duotone" /> English Foundations</span>
        <span className="lp-preview-label">Bài tập mẫu 3D</span>
      </div>
      <div className="lp-preview-question">
        <p className="lp-preview-context">Chào hỏi hằng ngày</p>
        <h2>Chọn câu chào phù hợp với buổi sáng.</h2>
      </div>
      <div className="lp-answer-list" role="group" aria-label="Chọn một câu trả lời">
        {greetingOptions.map((option) => {
          const selected = choice === option
          let stateClass = ''
          if (checked && option === 'Good morning') stateClass = ' is-correct'
          else if (checked && selected && !isCorrect) stateClass = ' is-incorrect'
          else if (selected) stateClass = ' is-selected'

          return (
            <button
              className={`lp-answer-option${stateClass}`}
              type="button"
              key={option}
              aria-pressed={selected}
              onClick={() => {
                setChoice(option)
                setChecked(false)
              }}
            >
              <span>{option}</span>
              {checked && option === 'Good morning' && <CheckCircle size={19} weight="fill" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
      <div className="lp-preview-footer">
        <span className={`lp-preview-feedback${checked ? (isCorrect ? ' is-correct' : ' is-incorrect') : ''}`} aria-live="polite">
          {checked ? (isCorrect ? 'Đúng rồi. “Good morning” dùng vào buổi sáng.' : 'Chưa đúng. Hãy chọn lại câu phù hợp.') : 'Chọn câu trả lời của bạn'}
        </span>
        {checked ? (
          <button className="lp-preview-check" type="button" onClick={resetPreview} aria-label="Làm lại bài tập mẫu">
            <ArrowCounterClockwise size={18} />
          </button>
        ) : (
          <button className="lp-preview-submit" type="button" disabled={!choice} onClick={() => setChecked(true)}>
            Kiểm tra <ArrowRight size={16} weight="bold" />
          </button>
        )}
      </div>
    </article>
  )
}

export function HeroSection({ onStart }: HeroSectionProps) {
  return (
    <section className="lp-hero" aria-labelledby="lp-hero-title" data-section="hero">
      <div className="lp-hero-grid">
        <div className="lp-hero-copy" data-reveal>
          <p className="lp-eyebrow">Tiếng Anh cho những điều bạn muốn làm</p>
          <h1 id="lp-hero-title">Học mọi nơi,<br /><span>chơi mọi lúc</span></h1>
          <p className="lp-hero-description">Luyện tiếng Anh qua tình huống đời thường, từng bài ngắn có ngữ cảnh và cách dùng rõ ràng.</p>
          <div className="lp-hero-actions">
            <button className="lp-button lp-button-primary lp-button-large" type="button" onClick={onStart}>
              Bắt đầu học <ArrowRight size={19} weight="bold" />
            </button>
            <a className="lp-text-link" href="#modes">Khám phá hình thức học <ArrowRight size={16} weight="regular" /></a>
          </div>
        </div>

        <div className="lp-hero-art" data-reveal>
          <div className="lp-hero-orbit lp-hero-orbit-back" aria-hidden="true" />
          <div className="lp-hero-orbit lp-hero-orbit-front" aria-hidden="true" />
          <div className="lp-floating-note lp-floating-note-top" aria-hidden="true">
            <span className="lp-note-icon"><Headphones size={19} weight="duotone" /></span>
            <span>Nghe để nhớ</span>
          </div>
          <div className="lp-floating-note lp-floating-note-bottom" aria-hidden="true">
            <span className="lp-note-icon lp-note-icon-deep"><Microphone size={18} weight="duotone" /></span>
            <span>Nói thành lời</span>
          </div>
          <div className="lp-preview-floor" aria-hidden="true" />
          <LessonPreview />
          <p className="lp-hero-caption">Một bài mẫu. Một câu có thể dùng ngay.</p>
        </div>
      </div>
      <a className="lp-hero-edge-link" href="#curriculum" aria-label="Xem lộ trình học">
        <span>Khám phá lộ trình</span><span className="lp-edge-line" aria-hidden="true" />
      </a>
    </section>
  )
}

const curriculumStages = [
  {
    number: '01',
    title: 'English Foundations',
    subtitle: 'Nền tảng khởi đầu',
    description: 'Bắt đầu với những câu giao tiếp nền tảng, tạo phản xạ câu ngắn chuẩn mực.',
    topics: ['Chào hỏi', 'Giới thiệu', 'Gia đình'],
    level: 'Chặng 1',
  },
  {
    number: '02',
    title: 'Everyday English',
    subtitle: 'Tình huống thường ngày',
    description: 'Dùng tiếng Anh tự nhiên trong mọi hoạt động đời sống quen thuộc.',
    topics: ['Ăn uống', 'Mua sắm', 'Di chuyển'],
    level: 'Chặng 2',
  },
  {
    number: '03',
    title: 'English in Action',
    subtitle: 'Mở rộng thực tế',
    description: 'Luyện cách diễn đạt đa dạng ở trường, khi đi du lịch xa và trong giao lưu.',
    topics: ['Du lịch', 'Sở thích', 'Phỏng vấn'],
    level: 'Chặng 3',
  },
  {
    number: '04',
    title: 'English at Work',
    subtitle: 'Môi trường làm việc',
    description: 'Xây dựng sự đĩnh đạc và chuyên nghiệp khi trao đổi công việc hằng ngày.',
    topics: ['Điện thoại', 'Họp hành', 'Gửi email'],
    level: 'Chặng 4',
  },
  {
    number: '05',
    title: 'Confident Communication',
    subtitle: 'Làm chủ hội thoại',
    description: 'Diễn đạt suy nghĩ sâu sắc, kể câu chuyện rành mạch và tự tin đối đáp.',
    topics: ['Quan điểm', 'Câu chuyện', 'Kế hoạch'],
    level: 'Chặng 5',
  },
]

export function CurriculumSection() {
  const [activeStage, setActiveStage] = useState(0)
  const [revealedCount, setRevealedCount] = useState(1)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el || !('IntersectionObserver' in window)) return

    let intervalId: number | null = null

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            let current = 1
            setRevealedCount(1)
            setActiveStage(0)

            if (intervalId) clearInterval(intervalId)
            intervalId = window.setInterval(() => {
              current += 1
              if (current <= 5) {
                setRevealedCount(current)
                setActiveStage(current - 1)
              } else {
                if (intervalId) clearInterval(intervalId)
              }
            }, 550)
          }
        })
      },
      { threshold: 0.15 }
    )

    observer.observe(el)
    return () => {
      observer.disconnect()
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  return (
    <section id="curriculum" ref={sectionRef} className="lp-curriculum" aria-labelledby="curriculum-title" data-reveal>
      <div className="lp-curriculum-intro">
        <div className="lp-section-heading">
          <p className="lp-eyebrow">Lộ trình học liên hoàn</p>
          <h2 id="curriculum-title">Từ câu đầu tiên đến những cuộc trò chuyện tự tin.</h2>
        </div>
        <p className="lp-curriculum-note">
          Các chặng học đi qua chủ đề đời thường, học tập và công việc. Mỗi chặng là một bước đệm vững chắc mở ra thêm một cách dùng tiếng Anh trong thực tế.
        </p>
      </div>

      <div className="lp-stage-pathway" role="region" aria-label="Lộ trình 5 chặng liên kết 3D">
        <div className="lp-stage-track-rail" aria-hidden="true">
          <div className="lp-rail-line-base" />
          <div
            className="lp-rail-line-glow"
            style={{ width: `${Math.min(100, Math.max(12, ((revealedCount - 1) / 4) * 100))}%` }}
          />
        </div>

        <ol className="lp-stage-track" aria-label="Các chặng trong chương trình học">
          {curriculumStages.map((stage, index) => {
            const isRevealed = index < revealedCount
            const isActive = index === activeStage
            return (
              <li
                className={`lp-stage-item lp-stage-item-${index + 1} ${isRevealed ? 'is-revealed' : 'is-pending'} ${isActive ? 'is-active' : ''}`}
                key={stage.title}
                onClick={() => {
                  setActiveStage(index)
                  if (index >= revealedCount) setRevealedCount(index + 1)
                }}
              >
                <div className="lp-stage-node-container">
                  <span className="lp-stage-node" aria-hidden="true">
                    <span>{stage.number}</span>
                  </span>
                  <span className="lp-stage-node-ring" aria-hidden="true" />
                </div>

                <div className="lp-stage-card-3d">
                  <span className="lp-stage-level">{stage.level}</span>
                  <h3>{stage.title}</h3>
                  <p className="lp-stage-subtitle">{stage.subtitle}</p>
                  <p className="lp-stage-desc">{stage.description}</p>
                  <div className="lp-stage-topics-wrap">
                    {stage.topics.map((item) => (
                      <span key={item} className="lp-stage-chip">{item}</span>
                    ))}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

/* =========================================================================
   FRAME 3: HỌC QUA ĐA DẠNG HÌNH THỨC, YOUTUBE & GAME 1V1 (PREMIUM AGENCY TABS)
   ========================================================================= */

interface SubtitleToken {
  word: string
  ipa: string
  meaning: string
  detail: string
}

const videoSubtitleTokens: SubtitleToken[] = [
  { word: 'Actually,', ipa: '/ˈæk.tʃu.ə.li/', meaning: 'Thực ra', detail: 'Từ đệm tự nhiên người bản xứ hay dùng để mở đầu ý kiến.' },
  { word: 'to', ipa: '/tuː/', meaning: 'để', detail: 'Giới từ liên kết mục đích.' },
  { word: 'be', ipa: '/biː/', meaning: 'thì', detail: 'Động từ to be nguyên mẫu.' },
  { word: 'completely', ipa: '/kəmˈpliːt.li/', meaning: 'hoàn toàn', detail: 'Trạng từ nhấn mạnh mức độ triệt để.' },
  { word: 'honest,', ipa: '/ˈɒn.ɪst/', meaning: 'thành thật', detail: 'Cụm “to be honest” = thành thật mà nói.' },
  { word: 'I', ipa: '/aɪ/', meaning: 'tôi', detail: 'Đại từ chủ ngữ ngôi thứ nhất.' },
  { word: 'had', ipa: '/hæd/', meaning: 'đã', detail: 'Quá khứ đơn của have.' },
  { word: 'no', ipa: '/nəʊ/', meaning: 'không', detail: 'Từ phủ định.' },
  { word: 'idea', ipa: '/aɪˈdɪə/', meaning: 'biết', detail: '“have no idea” = hoàn toàn không hề biết trước.' },
  { word: 'how', ipa: '/haʊ/', meaning: 'thế nào', detail: 'Liên từ chỉ phương thức.' },
  { word: 'natural', ipa: '/ˈnætʃ.ər.əl/', meaning: 'tự nhiên', detail: 'Tính từ: trôi chảy, không gượng gạo.' },
  { word: 'this', ipa: '/ðɪs/', meaning: 'điều này', detail: 'Đại từ chỉ định.' },
  { word: 'would', ipa: '/wʊd/', meaning: 'sẽ', detail: 'Trợ động từ chỉ khả năng.' },
  { word: 'feel!', ipa: '/fiːl/', meaning: 'cảm nhận!', detail: 'Động từ: mang lại cảm giác.' },
]

interface DuelQuestion {
  prompt: string
  clue: string
  options: string[]
  correct: string
  translation: string
}

const duelQuestions: DuelQuestion[] = [
  {
    prompt: 'Nơi đọc và mượn sách miễn phí',
    clue: 'A public building where you can borrow books to study.',
    options: ['Library', 'Bakery', 'Pharmacy', 'Stadium'],
    correct: 'Library',
    translation: 'Thư viện',
  },
  {
    prompt: 'Khuyến khích, tiếp thêm động lực',
    clue: 'To give someone the support, courage, or confidence to act.',
    options: ['Hesitate', 'Encourage', 'Criticize', 'Postpone'],
    correct: 'Encourage',
    translation: 'Động viên, khích lệ',
  },
  {
    prompt: 'Đẹp đến mức gây choáng ngợp, nghẹt thở',
    clue: 'Extremely impressive, exciting, or visually surprising.',
    options: ['Breathtaking', 'Ordinary', 'Awkward', 'Tedious'],
    correct: 'Breathtaking',
    translation: 'Ngoạn mục, tuyệt mỹ',
  },
]

export function LearningModesSection({ onStartDuel }: { onStartDuel?: () => void }) {
  const [currentSlide, setCurrentSlide] = useState<number>(0)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const sliderRef = useRef<HTMLDivElement>(null)

  const [selectedWord, setSelectedWord] = useState<SubtitleToken | null>(videoSubtitleTokens[0])
  const [savedWords, setSavedWords] = useState<string[]>([])
  const [isMaskedMode, setIsMaskedMode] = useState<boolean>(true)
  const [revealedWords, setRevealedWords] = useState<string[]>([videoSubtitleTokens[0].word])

  function handleTokenClick(token: SubtitleToken) {
    setSelectedWord(token)
    setRevealedWords((prev) => (prev.includes(token.word) ? prev : [...prev, token.word]))
    playSpokenWord(token.word)
  }

  function toggleMaskMode() {
    setIsMaskedMode((prev) => !prev)
  }

  // 1v1 Word Duel States
  const [duelRound, setDuelRound] = useState<number>(0)
  const [playerHp, setPlayerHp] = useState<number>(100)
  const [botHp, setBotHp] = useState<number>(100)
  const [playerScore, setPlayerScore] = useState<number>(0)
  const [streak, setStreak] = useState<number>(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [answerResult, setAnswerResult] = useState<'correct' | 'incorrect' | null>(null)
  const [gameFinished, setGameFinished] = useState<boolean>(false)
  const [timeLeft, setTimeLeft] = useState<number>(10)
  const timerRef = useRef<number | null>(null)

  // Dragging support
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const scrollLeftRef = useRef(0)

  function scrollToSlide(index: number) {
    if (!sliderRef.current) return
    const slides = sliderRef.current.querySelectorAll<HTMLElement>('.lp-modes-slide')
    if (slides[index]) {
      slides[index].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
    } else {
      const slideWidth = sliderRef.current.clientWidth
      sliderRef.current.scrollTo({
        left: index * (slideWidth + 24),
        behavior: 'smooth',
      })
    }
    setCurrentSlide(index)
  }

  function handleSliderScroll() {
    if (!sliderRef.current) return
    const { scrollLeft, clientWidth } = sliderRef.current
    if (clientWidth > 0) {
      const index = Math.round(scrollLeft / (clientWidth + 20))
      if (index !== currentSlide && (index === 0 || index === 1)) {
        setCurrentSlide(index)
      }
    }
  }

  // Auto-slide every 5 seconds (pause when user hovers or is in a live duel)
  useEffect(() => {
    if (isPaused) return

    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        const next = prev === 0 ? 1 : 0
        if (sliderRef.current) {
          const slideWidth = sliderRef.current.clientWidth
          sliderRef.current.scrollTo({
            left: next * slideWidth,
            behavior: 'smooth',
          })
        }
        return next
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [isPaused])

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!sliderRef.current) return
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('iframe') || target.closest('input')) return
    isDraggingRef.current = true
    startXRef.current = e.pageX - sliderRef.current.offsetLeft
    scrollLeftRef.current = sliderRef.current.scrollLeft
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!isDraggingRef.current || !sliderRef.current) return
    e.preventDefault()
    const x = e.pageX - sliderRef.current.offsetLeft
    const walk = (x - startXRef.current) * 1.3
    sliderRef.current.scrollLeft = scrollLeftRef.current - walk
  }

  function handleMouseUpOrLeave() {
    isDraggingRef.current = false
  }

  // Timer effect for 1v1 duel
  useEffect(() => {
    if (currentSlide !== 1 || gameFinished || answerResult !== null) return

    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          handleTimeout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [currentSlide, duelRound, gameFinished, answerResult])

  function handleTimeout() {
    setAnswerResult('incorrect')
    setPlayerHp((prev) => Math.max(0, prev - 25))
    setStreak(0)
    setTimeout(() => {
      advanceDuel()
    }, 1500)
  }

  function handleSelectAnswer(option: string) {
    if (answerResult !== null || gameFinished) return
    if (timerRef.current) clearInterval(timerRef.current)

    setSelectedAnswer(option)
    const currentQ = duelQuestions[duelRound]

    if (option === currentQ.correct) {
      setAnswerResult('correct')
      const bonus = streak > 0 ? streak * 50 : 0
      setPlayerScore((prev) => prev + 150 + bonus)
      setBotHp((prev) => Math.max(0, prev - 35))
      setStreak((prev) => prev + 1)
    } else {
      setAnswerResult('incorrect')
      setPlayerHp((prev) => Math.max(0, prev - 20))
      setStreak(0)
    }

    setTimeout(() => {
      advanceDuel()
    }, 1600)
  }

  function advanceDuel() {
    setSelectedAnswer(null)
    setAnswerResult(null)
    setTimeLeft(10)

    if (duelRound < duelQuestions.length - 1) {
      setDuelRound((prev) => prev + 1)
    } else {
      setGameFinished(true)
    }
  }

  function resetDuel() {
    setDuelRound(0)
    setPlayerHp(100)
    setBotHp(100)
    setPlayerScore(0)
    setStreak(0)
    setSelectedAnswer(null)
    setAnswerResult(null)
    setGameFinished(false)
    setTimeLeft(10)
  }

  function toggleSaveWord(word: string) {
    setSavedWords((prev) =>
      prev.includes(word) ? prev.filter((w) => w !== word) : [...prev, word]
    )
  }

  function playSpokenWord(word: string) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const cleanWord = word.replace(/[^a-zA-Z]/g, '')
      const utterance = new SpeechSynthesisUtterance(cleanWord)
      utterance.lang = 'en-US'
      utterance.rate = 0.92
      window.speechSynthesis.speak(utterance)
    }
  }

  const currentQuestion = duelQuestions[duelRound]

  return (
    <section id="modes" className="lp-modes lp-frame-inner" aria-labelledby="modes-title" data-reveal>
      <div className="lp-modes-lead">
        <div className="lp-section-heading">
          <p className="lp-eyebrow">Hình thức học</p>
          <h2 id="modes-title">Học qua ngữ cảnh. Chơi để phản xạ.</h2>
        </div>
      </div>

      {/* Horizontal Swipeable & Auto-sliding Viewport (Auto 5s) */}
      <div
        className="lp-modes-slider-viewport"
        ref={sliderRef}
        onScroll={handleSliderScroll}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') scrollToSlide(1)
          if (e.key === 'ArrowLeft') scrollToSlide(0)
        }}
        aria-label="Khung slide hình thức học. Tự động chuyển mỗi 5s hoặc vuốt để lướt."
      >
        <div className="lp-modes-slider-track">
          {/* SLIDE 1: YOUTUBE & SMART SUBTITLES */}
          <div className="lp-modes-slide">
            <div className="lp-modes-shell">
              <div className="lp-modes-core">
                <div className="lp-video-arena">
                  <div className="lp-video-showcase">
                    <div className="lp-video-frame">
                      <div className="lp-yt-player-wrap">
                        <iframe
                          className="lp-yt-iframe"
                          src="https://www.youtube-nocookie.com/embed/juKd26qkNAw?autoplay=0&controls=1&rel=0&modestbranding=1"
                          title="English Conversation Video Clip"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>

                      {/* Subtitle Strip */}
                      <div className="lp-subtitle-engine">
                        <div className="lp-subtitle-header">
                          <span className="lp-exercise-tag">
                            <Sparkle size={13} weight="fill" /> Phụ đề tương tác
                          </span>
                          <button
                            type="button"
                            className="lp-mask-toggle-btn"
                            onClick={toggleMaskMode}
                            aria-label={isMaskedMode ? 'Hiện toàn bộ chữ' : 'Ẩn từ (***) để luyện nghe'}
                          >
                            {isMaskedMode ? <Eye size={13} weight="bold" /> : <EyeSlash size={13} weight="bold" />}
                            <span>{isMaskedMode ? 'Hiện đầy đủ' : 'Ẩn từ luyện nghe (***)'}</span>
                          </button>
                        </div>

                        <div className="lp-subtitle-phrase" role="region" aria-label="Dòng phụ đề tương tác">
                          {videoSubtitleTokens.map((token) => {
                            const isSelected = selectedWord?.word === token.word
                            const isSaved = savedWords.includes(token.word)
                            const isRevealed = !isMaskedMode || revealedWords.includes(token.word)

                            return (
                              <button
                                key={token.word}
                                type="button"
                                className={`lp-sub-word${isSelected ? ' is-active' : ''}${isSaved ? ' is-saved' : ''}${!isRevealed ? ' is-masked' : ''}`}
                                onClick={() => handleTokenClick(token)}
                                title={!isRevealed ? 'Bấm để mở chữ & nghe phát âm' : `Nghe phát âm: ${token.word}`}
                              >
                                {isRevealed ? token.word : '***'}
                              </button>
                            )
                          })}
                        </div>
                        <p className="lp-subtitle-vi">
                          “Thực ra mà nói thật lòng, tôi không hề biết cảm giác này lại tự nhiên đến thế!”
                        </p>
                      </div>
                    </div>

                    {/* Word Inspector Sidebar */}
                    <div className="lp-word-inspector">
                      <div className="lp-inspector-head">
                        <span className="lp-exercise-tag">Tra cứu tức thì</span>
                        {selectedWord && (
                          <button
                            type="button"
                            className={`lp-bookmark-btn${savedWords.includes(selectedWord.word) ? ' is-saved' : ''}`}
                            onClick={() => toggleSaveWord(selectedWord.word)}
                          >
                            <Sparkle size={14} weight="fill" />
                            <span>{savedWords.includes(selectedWord.word) ? 'Đã lưu' : 'Lưu từ'}</span>
                          </button>
                        )}
                      </div>

                      {selectedWord && (
                        <div className="lp-inspector-card">
                          <div className="lp-inspector-main">
                            <span className="lp-word-entry">{selectedWord.word}</span>
                            <span className="lp-word-ipa">{selectedWord.ipa}</span>
                            <button
                              type="button"
                              className="lp-speak-mini-btn"
                              onClick={() => playSpokenWord(selectedWord.word)}
                              aria-label={`Nghe phát âm từ ${selectedWord.word}`}
                            >
                              <SpeakerHigh size={17} weight="duotone" />
                            </button>
                          </div>
                          <div className="lp-word-meaning-box">
                            <span className="lp-meaning-label">Nghĩa tiếng Việt:</span>
                            <p className="lp-meaning-text">{selectedWord.meaning}</p>
                          </div>
                          <p className="lp-word-tip">{selectedWord.detail}</p>
                        </div>
                      )}

                      <div className="lp-video-features-list">
                        <div className="lp-v-feature-item">
                          <Headphones size={18} weight="duotone" className="lp-vf-icon" />
                          <div>
                            <strong>Shadowing ngắt câu</strong>
                            <span>Nghe và lặp lại theo ngữ điệu bản xứ</span>
                          </div>
                        </div>
                        <div className="lp-v-feature-item">
                          <BookOpenText size={18} weight="duotone" className="lp-vf-icon" />
                          <div>
                            <strong>Sổ từ vựng ngữ cảnh</strong>
                            <span>Lưu từ kèm video gốc để ghi nhớ sâu</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SLIDE 2: LIVE 1V1 WORD DUEL ARENA */}
          <div className="lp-modes-slide">
            <div className="lp-modes-shell">
              <div className="lp-modes-core">
                <div className="lp-duel-arena">
                  {!gameFinished ? (
                    <>
                      {/* Premium Duel Scoreboard with Real Avatars */}
                      <div className="lp-duel-scoreboard">
                        {/* Player (Left) */}
                        <div className="lp-fighter lp-fighter-player">
                          <div className="lp-fighter-avatar lp-avatar-ring-blue">
                            <img
                              src="/avatars/player.jpg"
                              alt="Bạn (Học viên)"
                              className="lp-fighter-avatar-img"
                            />
                          </div>
                          <div className="lp-fighter-info">
                            <div className="lp-fighter-name-row">
                              <strong>Bạn (Học viên)</strong>
                              <span className="lp-fighter-score">{playerScore} LP</span>
                            </div>
                            <div className="lp-hp-bar-track">
                              <div className="lp-hp-fill lp-hp-player" style={{ width: `${playerHp}%` }} />
                            </div>
                            <span className="lp-hp-text">{playerHp} / 100 HP</span>
                          </div>
                        </div>

                        {/* Middle VS Badge & Timer */}
                        <div className="lp-vs-center">
                          <div className="lp-vs-emblem">
                            <Sword size={15} weight="fill" />
                            <span>VS</span>
                          </div>
                          <div className="lp-round-timer">
                            <Clock size={13} weight="bold" />
                            <span className={`lp-timer-num${timeLeft <= 3 ? ' is-urgent' : ''}`}>{timeLeft}s</span>
                          </div>
                          <div className="lp-timer-bar">
                            <div className="lp-timer-bar-fill" style={{ width: `${(timeLeft / 10) * 100}%` }} />
                          </div>
                        </div>

                        {/* Bot Challenger (Right) */}
                        <div className="lp-fighter lp-fighter-bot">
                          <div className="lp-fighter-info lp-text-right">
                            <div className="lp-fighter-name-row lp-row-reverse">
                              <strong>Alex (AI Tutor 🇺🇸)</strong>
                              <span className="lp-fighter-bot-score">Master</span>
                            </div>
                            <div className="lp-hp-bar-track">
                              <div className="lp-hp-fill lp-hp-bot" style={{ width: `${botHp}%` }} />
                            </div>
                            <span className="lp-hp-text">{botHp} / 100 HP</span>
                          </div>
                          <div className="lp-fighter-avatar lp-avatar-ring-cyan">
                            <img
                              src="/avatars/bot.jpg"
                              alt="Alex (AI Bot)"
                              className="lp-fighter-avatar-img"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Duel Prompt Card */}
                      <div className="lp-duel-card">
                        <div className="lp-duel-card-meta">
                          <span className="lp-stage-chip">Vòng {duelRound + 1} / {duelQuestions.length}</span>
                          {streak > 1 && (
                            <span className="lp-streak-pill">
                              <Fire size={14} weight="fill" /> Streak x{streak}!
                            </span>
                          )}
                        </div>
                        <p className="lp-duel-prompt-vi">{currentQuestion.prompt}</p>
                        <p className="lp-duel-clue-en">“{currentQuestion.clue}”</p>

                        <div className="lp-duel-options-grid" role="group" aria-label="Chọn từ chính xác">
                          {currentQuestion.options.map((option) => {
                            const isSelected = selectedAnswer === option
                            const isCorrectOption = option === currentQuestion.correct
                            let btnClass = ''

                            if (answerResult) {
                              if (isCorrectOption) btnClass = ' is-correct'
                              else if (isSelected) btnClass = ' is-incorrect'
                            } else if (isSelected) {
                              btnClass = ' is-selected'
                            }

                            return (
                              <button
                                key={option}
                                type="button"
                                className={`lp-duel-option-btn${btnClass}`}
                                disabled={answerResult !== null}
                                onClick={() => handleSelectAnswer(option)}
                              >
                                <span className="lp-option-label">{option}</span>
                                {answerResult && isCorrectOption && <CheckCircle size={18} weight="fill" className="lp-opt-icon" />}
                                {answerResult && isSelected && !isCorrectOption && <XCircle size={18} weight="fill" className="lp-opt-icon" />}
                              </button>
                            )
                          })}
                        </div>

                        <div className="lp-duel-feedback" aria-live="polite">
                          {answerResult === 'correct' && (
                            <span className="lp-feedback-correct">
                              <CheckCircle size={16} weight="fill" /> Chính xác! +150 LP. Đối thủ bị trừ -35 HP!
                            </span>
                          )}
                          {answerResult === 'incorrect' && (
                            <span className="lp-feedback-incorrect">
                              <X size={16} weight="bold" /> Chưa đúng! Đáp án: “{currentQuestion.correct}” ({currentQuestion.translation}).
                            </span>
                          )}
                          {!answerResult && (
                            <span className="lp-feedback-hint">
                              Chọn nhanh từ tiếng Anh đúng trước khi hết 10 giây.
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* VICTORY SCREEN */
                    <div className="lp-duel-victory">
                      <div className="lp-victory-badge">
                        <Trophy size={42} weight="duotone" />
                      </div>
                      <h3>
                        {playerScore >= 300 ? 'Chiến thắng vang dội! 🎉' : 'Hoàn thành ván đấu! 🤝'}
                      </h3>
                      <p className="lp-victory-sub">
                        Bạn đã xuất sắc ghi được <strong>{playerScore} LP</strong> rèn luyện phản xạ đoán từ tức thì trong áp lực đối kháng.
                      </p>

                      <div className="lp-victory-stats">
                        <div className="lp-v-stat">
                          <span className="lp-stat-val">{playerScore} LP</span>
                          <span className="lp-stat-lbl">Điểm thưởng</span>
                        </div>
                        <div className="lp-v-stat">
                          <span className="lp-stat-val">3 / 3</span>
                          <span className="lp-stat-lbl">Vòng hoàn thành</span>
                        </div>
                        <div className="lp-v-stat">
                          <span className="lp-stat-val">🔥 x{Math.max(1, streak)}</span>
                          <span className="lp-stat-lbl">Chuỗi thắng</span>
                        </div>
                      </div>

                      <div className="lp-victory-actions">
                        <button type="button" className="lp-button lp-button-primary" onClick={resetDuel}>
                          <ArrowCounterClockwise size={16} weight="bold" /> Đấu ván khác
                        </button>
                        {onStartDuel && (
                          <button type="button" className="lp-button lp-button-nested" onClick={onStartDuel}>
                            <span>Vào Đấu trường từ vựng</span>
                            <span className="lp-button-icon-disc"><ArrowRight size={14} weight="bold" /></span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Slide Progress Indicators (5s timer visual) */}
      <div className="lp-slider-auto-indicators" role="tablist" aria-label="Trạng thái tự lướt slide">
        <button
          type="button"
          className={`lp-auto-indicator-tab${currentSlide === 0 ? ' is-active' : ''}`}
          onClick={() => scrollToSlide(0)}
          role="tab"
          aria-selected={currentSlide === 0}
        >
          <div className="lp-auto-ind-meta">
            <YoutubeLogo size={16} weight="duotone" />
            <span className="lp-auto-ind-num">01</span>
            <span className="lp-auto-ind-label">Học qua Video YouTube</span>
          </div>
          <span className="lp-auto-ind-bar">
            <span className={`lp-auto-ind-fill${currentSlide === 0 && !isPaused ? ' is-running' : ''}`} />
          </span>
        </button>

        <button
          type="button"
          className={`lp-auto-indicator-tab${currentSlide === 1 ? ' is-active' : ''}`}
          onClick={() => scrollToSlide(1)}
          role="tab"
          aria-selected={currentSlide === 1}
        >
          <div className="lp-auto-ind-meta">
            <Sword size={16} weight="duotone" />
            <span className="lp-auto-ind-num">02</span>
            <span className="lp-auto-ind-label">Đấu trường từ vựng</span>
          </div>
          <span className="lp-auto-ind-bar">
            <span className={`lp-auto-ind-fill${currentSlide === 1 && !isPaused ? ' is-running' : ''}`} />
          </span>
        </button>
      </div>
    </section>
  )
}

/* =========================================================================
   FRAME 4: CÂU HỎI THƯỜNG GẶP (FAQ SECTION)
   ========================================================================= */

interface FaqItem {
  id: string
  category: 'all' | 'curriculum' | 'game' | 'pricing'
  question: string
  answer: string
}

const faqList: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'curriculum',
    question: 'Tôi mất gốc tiếng Anh hoặc người mới bắt đầu có theo kịp không?',
    answer:
      'Hoàn toàn phù hợp! Lộ trình của Engorace bắt đầu từ Chặng 1 "English Foundations" dành riêng cho người mới, tập trung vào các câu chào hỏi, giới thiệu và sinh hoạt quen thuộc. Mỗi câu đều có phát âm chậm của người bản xứ và giải nghĩa song ngữ rõ ràng, không bắt bạn phải học vẹt bảng công thức ngữ pháp khô khan.',
  },
  {
    id: 'faq-2',
    category: 'game',
    question: 'Học qua Video YouTube và Đấu trường từ vựng giúp ghi nhớ từ như thế nào?',
    answer:
      'Khoa học chứng minh não bộ nhớ sâu nhất khi liên kết đồng thời giữa hình ảnh, âm thanh đời thực (Video YouTube) và phản xạ có áp lực thời gian tích cực (Đấu trường từ vựng). Khi tham gia đấu trường, bạn không chỉ "nhìn" từ mà phải "truy xuất" từ vựng trong 10 giây, kích hoạt cơ chế Spaced Retrieval giúp từ vựng đi thẳng vào trí nhớ dài hạn.',
  },
  {
    id: 'faq-3',
    category: 'game',
    question: 'Chế độ Đấu trường từ vựng có thể thách đấu cùng bạn bè thật không?',
    answer:
      'Chắc chắn rồi! Bạn có thể tạo phòng thi đấu riêng với Mã Phòng (Room Code) để rủ bạn bè, đồng nghiệp so tài, hoặc bấm "Ghép ngẫu nhiên" để đấu đối kháng cùng hàng chục ngàn người học khác trên khắp cả nước. Hệ thống xếp hạng tự động cân bằng trình độ để trận đấu luôn công bằng và kịch tính.',
  },
  {
    id: 'faq-4',
    category: 'pricing',
    question: 'Ứng dụng Engorace có miễn phí không? Tôi có cần nhập thẻ thanh toán không?',
    answer:
      'Engorace hoàn toàn không yêu cầu thẻ tín dụng khi đăng ký. Bạn có thể mở tài khoản miễn phí để học toàn bộ bài học Chặng 1, xem các video tình huống mẫu và tham gia các lượt đấu từ vựng mỗi ngày mà không tốn bất kỳ chi phí nào.',
  },
  {
    id: 'faq-5',
    category: 'curriculum',
    question: 'Mỗi ngày tôi nên dành bao nhiêu thời gian để đạt kết quả tốt nhất?',
    answer:
      'Chỉ cần 15 đến 20 phút mỗi ngày. Các bài học và ván game được đóng gói theo mô hình Micro-learning ngắn gọn (5-7 phút mỗi phiên). Sự kiên trì và đều đặn mỗi ngày quan trọng hơn rất nhiều so với việc dồn học 3 tiếng vào cuối tuần.',
  },
]

export function FaqSection() {
  const [activeCategory, setActiveCategory] = useState<'all' | 'curriculum' | 'game' | 'pricing'>('all')
  const [openIds, setOpenIds] = useState<string[]>(['faq-1', 'faq-2'])

  const filteredFaqs = faqList.filter(
    (item) => activeCategory === 'all' || item.category === activeCategory
  )

  function toggleFaq(id: string) {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  return (
    <section id="faq" className="lp-faq lp-frame-inner" aria-labelledby="faq-title" data-reveal>
      <div className="lp-faq-lead">
        <div className="lp-section-heading">
          <p className="lp-eyebrow">Giải đáp thắc mắc</p>
          <h2 id="faq-title">Câu hỏi thường gặp</h2>
        </div>
        <p className="lp-faq-desc">
          Mọi thông tin bạn cần biết về lộ trình học, video ngữ cảnh, Đấu trường từ vựng và chính sách trải nghiệm miễn phí.
        </p>
      </div>

      {/* Filter Category Pills */}
      <div className="lp-faq-filter-dock" role="tablist" aria-label="Lọc chủ đề câu hỏi">
        <button
          type="button"
          className={`lp-faq-filter-pill${activeCategory === 'all' ? ' is-active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          Tất cả câu hỏi
        </button>
        <button
          type="button"
          className={`lp-faq-filter-pill${activeCategory === 'curriculum' ? ' is-active' : ''}`}
          onClick={() => setActiveCategory('curriculum')}
        >
          Lộ trình & Phương pháp
        </button>
        <button
          type="button"
          className={`lp-faq-filter-pill${activeCategory === 'game' ? ' is-active' : ''}`}
          onClick={() => setActiveCategory('game')}
        >
          Video & Đấu từ vựng
        </button>
        <button
          type="button"
          className={`lp-faq-filter-pill${activeCategory === 'pricing' ? ' is-active' : ''}`}
          onClick={() => setActiveCategory('pricing')}
        >
          Chi phí & Bắt đầu
        </button>
      </div>

      {/* Accordion Layout Grid */}
      <div className="lp-faq-layout-grid">
        <div className="lp-faq-accordion-list" role="region" aria-label="Danh sách câu hỏi thường gặp">
          {filteredFaqs.map((faq) => {
            const isOpen = openIds.includes(faq.id)
            return (
              <div
                key={faq.id}
                className={`lp-faq-accordion-item${isOpen ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  className="lp-faq-question-btn"
                  onClick={() => toggleFaq(faq.id)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${faq.id}`}
                >
                  <span className="lp-faq-question-text">{faq.question}</span>
                  <span className="lp-faq-icon-disc" aria-hidden="true">
                    <CaretDown size={16} weight="bold" />
                  </span>
                </button>
                <div
                  id={`faq-answer-${faq.id}`}
                  className="lp-faq-answer-panel"
                  hidden={!isOpen}
                >
                  <p>{faq.answer}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Side Support Card */}
        <aside className="lp-faq-support-aside">
          <div className="lp-support-card">
            <div className="lp-support-icon">
              <ChatCircleDots size={26} weight="duotone" />
            </div>
            <h3>Cần tư vấn thêm?</h3>
            <p>
              Đội ngũ trợ giảng của Engorace luôn trực tuyến hỗ trợ bạn 24/7 để tư vấn lộ trình học phù hợp nhất.
            </p>
            <div className="lp-support-response-time">
              <span className="lp-live-dot" /> Phản hồi &lt; 5 phút
            </div>
            <a
              href="mailto:support@engorace.app?subject=Tư vấn lộ trình Engorace"
              className="lp-button lp-button-primary lp-button-w-full"
            >
              <EnvelopeSimple size={16} weight="bold" /> Nhắn tin cho trợ giảng
            </a>
          </div>
        </aside>
      </div>
    </section>
  )
}

/* =========================================================================
   FRAME 5: FINAL CTA & FOOTER (KHÔI PHỤC THIẾT KẾ GỐC ĐẲNG CẤP)
   ========================================================================= */

interface LandingFooterProps {
  onLogin: () => void
  onRegister: () => void
}

export function LandingFooter({ onLogin, onRegister }: LandingFooterProps) {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-main">
        <a className="lp-wordmark" href="#top" aria-label="Engorace, về đầu trang">
          <div className="lp-brand-logo-wrap" aria-hidden="true">
            <img src="/logo.png" alt="Engorace Logo" className="lp-brand-logo-img" />
          </div>
          <span className="lp-brand-wordmark"><span className="lp-brand-eng">Eng</span><span className="lp-brand-o">o</span><span className="lp-brand-race">race</span></span>
        </a>
        <p>Học tiếng Anh qua câu nói có thể dùng trong cuộc sống mỗi ngày.</p>
        <div className="lp-footer-actions">
          <button type="button" onClick={onLogin}>Đăng nhập</button>
          <button type="button" onClick={onRegister}>Bắt đầu học <ArrowRight size={15} /></button>
        </div>
      </div>
      <div className="lp-footer-bottom">
        <span>© {new Date().getFullYear()} Engorace</span>
        <nav aria-label="Liên kết đến các phần trên trang">
          <a href="#curriculum">Lộ trình</a>
          <a href="#modes">Hình thức học</a>
        </nav>
        <a href="#top" className="lp-back-top">Về đầu trang <ArrowRight size={14} className="lp-back-top-icon" aria-hidden="true" /></a>
      </div>
    </footer>
  )
}

/* Backward-compatible wrappers */
export function LearningMethodSection() {
  return <LearningModesSection />
}

export function PracticeSection() {
  return <FaqSection />
}

export function VocabularySection() {
  return null
}

export function ListeningSection() {
  return null
}

export function SpeakingSection() {
  return null
}

export function BenefitsSection() {
  return null
}
