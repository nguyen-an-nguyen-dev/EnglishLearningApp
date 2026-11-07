import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  ArrowRight,
  ArrowsClockwise,
  ChatCircleDots,
  ClockCounterClockwise,
  ListChecks,
  PaperPlaneTilt,
  TrashSimple,
  X,
} from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import type { Dict } from '../../i18n'
import { ApiError } from '../../services/apiClient'
import {
  createAiChatApi,
  deleteAiChatApi,
  getAiChatApi,
  getStudyPlanApi,
  listAiChatsApi,
  sendAiMessageApi,
  type AiChat,
  type AiFeedback,
  type AiMessage,
  type ChatContext,
  type ChatIntent,
  type ChatTab,
  type StudyPlan,
  type StudyStep,
} from '../../services/aiChatService'

export type BuddyView = 'chat' | 'plan' | 'history' | null

interface StudyBuddyProps {
  activeTab: ChatTab
  tabLabel: string
  focusLabel: string
  view: BuddyView
  onViewChange: (view: BuddyView) => void
  onAction: (step: StudyStep) => void
}

interface Bubble {
  id: number | string
  role: 'USER' | 'AI'
  content: string
  feedback?: AiFeedback[]
}

interface QuickAction {
  key: string
  label: string
  prompt: string
  intent: ChatIntent
}

function quickActions(t: Dict, tab: ChatTab): QuickAction[] {
  const plan: QuickAction = { key: 'plan', label: t.buddyQuickPlan, prompt: t.buddyPromptPlan, intent: 'plan' }
  const how: QuickAction = { key: 'how', label: t.buddyQuickHow, prompt: t.buddyPromptHow, intent: 'how' }
  const explain: QuickAction = { key: 'explain', label: t.buddyQuickExplain, prompt: t.buddyPromptExplain, intent: 'explain' }
  const practice: QuickAction = { key: 'practice', label: t.buddyQuickPractice, prompt: t.buddyPromptPractice, intent: 'practice' }
  const video: QuickAction = { key: 'video', label: t.buddyQuickVideo, prompt: t.buddyPromptVideo, intent: 'explain' }
  const word: QuickAction = { key: 'word', label: t.buddyQuickWord, prompt: t.buddyPromptWord, intent: 'explain' }
  const recap: QuickAction = { key: 'recap', label: t.buddyQuickRecap, prompt: t.buddyPromptRecap, intent: 'explain' }
  const next: QuickAction = { key: 'next', label: t.buddyQuickNext, prompt: t.buddyPromptNext, intent: 'plan' }

  switch (tab) {
    case 'videos': return [video, how, practice]
    case 'translate': return [word, practice, plan]
    case 'compete': return [how, practice, plan]
    case 'rankings':
    case 'profile': return [recap, next, how]
    default: return [plan, how, explain]
  }
}

function describeError(error: unknown, t: Dict): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return t.buddyErrorBusy
    if (error.status === 504) return t.buddyErrorSlow
    if (error.status === 503) return t.buddyErrorOffline
    return error.message || t.buddyErrorGeneric
  }
  if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return t.buddyErrorSlow
  }
  return error instanceof Error && error.message ? error.message : t.buddyErrorGeneric
}

function toBubbles(messages: AiMessage[]): Bubble[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
  }))
}

function formatDate(value: string, lang: 'vi' | 'en'): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit' })
}

type CarMood = 'idle' | 'cheer' | 'thinking' | 'oops'

/** The book-car from the brand logo is the buddy itself, not a generic bot avatar. */
function BuddyCar({ className = '', mood = 'idle' }: { className?: string; mood?: CarMood }) {
  return (
    <img
      className={`buddy-car is-${mood} ${className}`}
      src="/logo.png"
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  )
}

export function detectLivePageContext(
  activeTab: ChatTab,
  fallbackFocus?: string
): { focus?: string; detail?: string; badge?: string } {
  if (typeof document === 'undefined') {
    return { focus: fallbackFocus || undefined }
  }

  try {
    // 1. Video Lesson / Library
    if (activeTab === 'videos') {
      const videoDetailEl = document.querySelector('.video-detail') as HTMLElement | null
      if (videoDetailEl) {
        const title =
          videoDetailEl.dataset.videoTitle ||
          document.querySelector('.practice-hero h1')?.textContent?.trim() ||
          ''
        const topic = videoDetailEl.dataset.videoTopic || ''
        const level = videoDetailEl.dataset.videoLevel || ''
        const desc =
          videoDetailEl.dataset.videoDesc ||
          document.querySelector('.practice-hero p')?.textContent?.trim() ||
          ''
        const segments = videoDetailEl.dataset.videoSegments || ''
        const currentSegment =
          document.querySelector('.practice-target-phrase')?.textContent?.trim() || ''

        const details = [
          `Đang xem video học tiếng Anh.`,
          title ? `Tên video / bài hát: "${title}"` : '',
          topic ? `Chủ đề: ${topic}` : '',
          level ? `Trình độ: ${level}` : '',
          desc ? `Mô tả: ${desc}` : '',
          currentSegment ? `Câu đang luyện nghe/gõ: "${currentSegment}"` : '',
          segments ? `Lời thoại / phân đoạn trong video: ${segments}` : '',
        ]
          .filter(Boolean)
          .join(' | ')

        return {
          focus: title ? `Video: ${title}` : 'Học qua video',
          badge: title ? `Video · ${title}` : 'Học qua video',
          detail: details,
        }
      }

      const isNotebook = Boolean(document.querySelector('.video-notebook'))
      if (isNotebook) {
        return {
          focus: 'Sổ từ vựng video',
          badge: 'Sổ từ vựng video',
          detail: 'Người dùng đang xem và ôn tập các từ vựng đã lưu trong lúc luyện nghe video.',
        }
      }

      return {
        focus: 'Thư viện video',
        badge: 'Thư viện video',
        detail: 'Người dùng đang duyệt danh sách thư viện video học tiếng Anh trên YouTube.',
      }
    }

    // 2. Active lesson in LessonPlayer
    const lessonPlayerEl = document.querySelector('.lesson-player') as HTMLElement | null
    if (lessonPlayerEl || document.querySelector('.lesson-header')) {
      const lessonTitle =
        lessonPlayerEl?.dataset.lessonTitle ||
        document.querySelector('.lesson-header')?.textContent?.trim() ||
        fallbackFocus ||
        ''
      const questionPrompt =
        lessonPlayerEl?.dataset.questionPrompt ||
        document.querySelector('.lesson-question-text')?.textContent?.trim() ||
        ''
      const questionIndex = lessonPlayerEl?.dataset.questionIndex || ''
      const questionType = lessonPlayerEl?.dataset.questionType || ''
      const questionExplanation = lessonPlayerEl?.dataset.questionExplanation || ''

      const details = [
        `Người dùng đang làm bài học tương tác.`,
        lessonTitle ? `Tên bài học: "${lessonTitle}"` : '',
        questionIndex ? `Tiến độ câu hỏi: ${questionIndex}` : '',
        questionType ? `Dạng bài tập: ${questionType}` : '',
        questionPrompt ? `Nội dung câu hỏi đang làm: "${questionPrompt}"` : '',
        questionExplanation ? `Giải thích thêm: "${questionExplanation}"` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      return {
        focus: lessonTitle ? `Bài học: ${lessonTitle}` : 'Bài học',
        badge: lessonTitle ? `Bài học · ${lessonTitle}` : 'Đang làm bài',
        detail: details,
      }
    }

    // 3. Study roadmap
    if (activeTab === 'study') {
      const mainEl = document.querySelector('.learning-page') as HTMLElement | null
      const currentLesson = mainEl?.dataset.currentLesson || fallbackFocus || ''
      const currentStage = mainEl?.dataset.currentStage || ''
      const doneLessons = mainEl?.dataset.completedLessons || ''
      const totalLessons = mainEl?.dataset.totalLessons || ''

      const details = [
        `Người dùng đang ở Lộ trình học tiếng Anh (Roadmap).`,
        currentStage ? `Chặng hiện tại: ${currentStage}` : '',
        currentLesson ? `Bài học tiếp theo cần hoàn thành: "${currentLesson}"` : '',
        totalLessons ? `Tiến độ: Đã xong ${doneLessons}/${totalLessons} bài học.` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      return {
        focus: currentLesson ? `Lộ trình: ${currentLesson}` : 'Lộ trình học',
        badge: currentLesson ? `Lộ trình · ${currentLesson}` : 'Lộ trình học',
        detail: details,
      }
    }

    // 4. Translate View
    if (activeTab === 'translate') {
      const pageEl = document.querySelector('.translate-page') as HTMLElement | null
      const sourceLang = pageEl?.dataset.sourceLang || 'en'
      const targetLang = pageEl?.dataset.targetLang || 'vi'
      const sourceText =
        pageEl?.dataset.sourceText ||
        document.querySelector<HTMLTextAreaElement>('.translate-textarea')?.value?.trim() ||
        ''
      const resultText =
        pageEl?.dataset.resultText ||
        document.querySelector('.translate-result-text')?.textContent?.trim() ||
        ''
      const pos = pageEl?.dataset.detectedPos || ''
      const meanings = pageEl?.dataset.detectedMeanings || ''

      const langDirection = `${sourceLang === 'en' ? 'Anh' : 'Việt'} → ${targetLang === 'vi' ? 'Việt' : 'Anh'}`
      const details = [
        `Người dùng đang ở công cụ Dịch tài liệu song ngữ (${langDirection}).`,
        sourceText ? `Đoạn văn bản gốc cần dịch: "${sourceText.slice(0, 400)}"` : 'Chưa nhập văn bản',
        resultText ? `Bản dịch hệ thống đã cho: "${resultText.slice(0, 400)}"` : '',
        pos ? `Từ loại: ${pos}` : '',
        meanings ? `Nghĩa gợi ý: ${meanings}` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      return {
        focus: sourceText ? `Dịch (${langDirection})` : 'Dịch tài liệu',
        badge: `Dịch tài liệu · ${langDirection}`,
        detail: details,
      }
    }

    // 5. Compete / Arena
    if (activeTab === 'compete') {
      const matchEl = document.querySelector('.arena-match') as HTMLElement | null
      if (matchEl) {
        const round = matchEl.dataset.round || '1'
        const totalRounds = matchEl.dataset.totalRounds || '5'
        const myScore = matchEl.dataset.myScore || '0'
        const opponentName = matchEl.dataset.opponentName || 'Đối thủ'
        const opponentScore = matchEl.dataset.opponentScore || '0'
        const translation = matchEl.dataset.questionTranslation || ''
        const example = matchEl.dataset.questionExample || ''
        const level = matchEl.dataset.questionLevel || ''

        const details = [
          `Đang trong trận đấu Đấu trường từ vựng 1v1 theo thời gian thực.`,
          `Đối thủ: ${opponentName}.`,
          `Vòng đấu: ${round}/${totalRounds}.`,
          `Tỉ số hiện tại: Bạn ${myScore} - ${opponentScore} ${opponentName}.`,
          translation ? `Câu hỏi vòng này: nghĩa tiếng Việt là "${translation}"` : '',
          example ? `Câu ví dụ/gợi ý: "${example}"` : '',
          level ? `Trình độ từ: ${level}` : '',
        ]
          .filter(Boolean)
          .join(' | ')

        return {
          focus: `Đấu trường · vs ${opponentName}`,
          badge: `Trận đấu · Vòng ${round}/${totalRounds}`,
          detail: details,
        }
      }

      const isQueue = Boolean(document.querySelector('.arena-queue'))
      if (isQueue) {
        return {
          focus: 'Đấu trường từ vựng',
          badge: 'Đấu trường · Tìm đối thủ',
          detail: 'Người dùng đang trong hàng chờ ghép trận Đấu trường từ vựng 1v1.',
        }
      }

      const arenaEl = document.querySelector('.arena-view') as HTMLElement | null
      const played = arenaEl?.dataset.played || '0'
      const wins = arenaEl?.dataset.wins || '0'
      const winRate = arenaEl?.dataset.winRate || '0'
      const winStreak = arenaEl?.dataset.winStreak || '0'

      return {
        focus: 'Đấu trường từ vựng',
        badge: 'Đấu trường 1v1',
        detail: `Đang ở sảnh Đấu trường từ vựng 1v1. Thành tích: đã chơi ${played} trận, thắng ${wins} trận (tỉ lệ thắng ${winRate}%), chuỗi thắng ${winStreak} trận.`,
      }
    }

    // 6. Rankings
    if (activeTab === 'rankings') {
      const rankEl = document.querySelector('.rank-view') as HTMLElement | null
      const myRank = rankEl?.dataset.myRank
      const totalUsers = rankEl?.dataset.totalUsers || ''
      const myXp = rankEl?.dataset.myXp || ''
      const leaderName = rankEl?.dataset.leaderName || ''
      const leaderXp = rankEl?.dataset.leaderXp || ''
      const aboveName = rankEl?.dataset.aboveName || ''
      const aboveRank = rankEl?.dataset.aboveRank || ''
      const aboveXp = rankEl?.dataset.aboveXp || ''
      const belowName = rankEl?.dataset.belowName || ''
      const belowRank = rankEl?.dataset.belowRank || ''
      const belowXp = rankEl?.dataset.belowXp || ''

      const details = [
        `Người dùng đang xem Bảng xếp hạng thi đua học tập.`,
        myRank ? `Thứ hạng hiện tại của bạn: Hạng #${myRank} trên tổng số ${totalUsers} học viên` : 'Chưa có thứ hạng cụ thể',
        myXp ? `Điểm kinh nghiệm (XP) của bạn: ${myXp} XP` : '',
        leaderName ? `Người dẫn đầu bảng xếp hạng: ${leaderName} (${leaderXp} XP)` : '',
        aboveName ? `Người xếp ngay phía trên bạn: ${aboveName} (Hạng #${aboveRank}, có ${aboveXp} XP, hơn bạn ${Math.max(0, Number(aboveXp) - Number(myXp))} XP)` : 'Bạn đang đứng đầu bảng!',
        belowName ? `Người xếp ngay phía dưới bạn: ${belowName} (Hạng #${belowRank}, có ${belowXp} XP, kém bạn ${Math.max(0, Number(myXp) - Number(belowXp))} XP)` : 'Không có ai xếp sau bạn.',
      ]
        .filter(Boolean)
        .join(' | ')

      return {
        focus: myRank ? `Bảng xếp hạng · Hạng #${myRank}` : 'Bảng xếp hạng',
        badge: myRank ? `Bảng xếp hạng · Hạng #${myRank}` : 'Bảng xếp hạng',
        detail: details,
      }
    }

    // 7. Profile
    if (activeTab === 'profile') {
      const profileEl = document.querySelector('.profile-view') as HTMLElement | null
      const userName = profileEl?.dataset.userName || ''
      const userEmail = profileEl?.dataset.userEmail || ''
      const userXp = profileEl?.dataset.userXp || ''
      const userStreak = profileEl?.dataset.userStreak || ''
      const lessonsDone = profileEl?.dataset.lessonsDone || ''
      const lessonsTotal = profileEl?.dataset.lessonsTotal || ''
      const progressPercent = profileEl?.dataset.progressPercent || ''
      const currentStage = profileEl?.dataset.currentStage || ''
      const badgesCount = profileEl?.dataset.badgesCount || ''

      const details = [
        `Người dùng đang xem trang Hồ sơ cá nhân của mình.`,
        userName ? `Tên học viên: ${userName}` : '',
        userEmail ? `Email: ${userEmail}` : '',
        userXp ? `Tổng điểm XP: ${userXp}` : '',
        userStreak ? `Chuỗi học tập liên tục (Streak): ${userStreak} ngày` : '',
        lessonsTotal ? `Tiến độ hoàn thành: ${lessonsDone}/${lessonsTotal} bài (${progressPercent}%)` : '',
        currentStage ? `Chặng học hiện tại: ${currentStage}` : '',
        badgesCount ? `Số lượng huy hiệu đã đạt: ${badgesCount}` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      return {
        focus: userName ? `Hồ sơ · ${userName}` : 'Hồ sơ cá nhân',
        badge: userName ? `Hồ sơ · ${userName}` : 'Hồ sơ cá nhân',
        detail: details,
      }
    }
  } catch {
    /* ignore DOM errors */
  }

  return {
    focus: fallbackFocus || undefined,
    badge: undefined,
    detail: undefined,
  }
}

export function StudyBuddy({ activeTab, tabLabel: _tabLabel, focusLabel, view, onViewChange, onAction }: StudyBuddyProps) {
  const { t, lang } = useI18n()
  const [chats, setChats] = useState<AiChat[]>([])
  const [activeChatId, setActiveChatId] = useState<number | null>(null)
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [hintIndex, setHintIndex] = useState(0)
  const [hintVisible, setHintVisible] = useState(true)
  const [closing, setClosing] = useState(false)
  const initializedRef = useRef(false)
  const lastViewRef = useRef<BuddyView>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)
  const hintTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)

  function switchView(next: BuddyView) {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    setClosing(false)
    onViewChange(next)
  }

  const closeBuddy = useCallback(() => {
    if (closeTimerRef.current) return
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      onViewChange(null)
      return
    }
    setClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      setClosing(false)
      onViewChange(null)
    }, 220)
  }, [onViewChange])

  const loadPlan = useCallback(async () => {
    setPlanLoading(true)
    setPlanError(null)
    try {
      setPlan(await getStudyPlanApi())
    } catch (loadError) {
      setPlanError(describeError(loadError, t))
    } finally {
      setPlanLoading(false)
    }
  }, [t])

  const loadChats = useCallback(async () => {
    try {
      const list = await listAiChatsApi()
      const coachChats = list.filter((chat) => chat.topic === 'STUDY_COACH')
      setChats(coachChats)
      const latest = coachChats[0]
      if (latest) {
        setActiveChatId(latest.id)
        const data = await getAiChatApi(latest.id)
        setBubbles(toBubbles(data.messages))
      }
    } catch (loadError) {
      setHistoryError(describeError(loadError, t))
    }
  }, [t])

  useEffect(() => {
    const reopened = lastViewRef.current === null && view !== null
    lastViewRef.current = view
    if (!view) return
    if (!initializedRef.current) {
      initializedRef.current = true
      void loadChats()
    }
    // Re-opening after a lesson should show a plan built from the latest progress.
    if (reopened) void loadPlan()
  }, [view, loadChats, loadPlan])

  useEffect(() => {
    const id = window.setInterval(() => {
      setHintVisible(false)
      hintTimerRef.current = window.setTimeout(() => {
        setHintIndex((current) => (current + 1) % 3)
        setHintVisible(true)
      }, 220)
    }, 7000)
    return () => {
      window.clearInterval(id)
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current)
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (view !== 'chat' || !threadRef.current) return
    threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [bubbles, sending, view])

  useEffect(() => {
    if (!view) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeBuddy()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [view, closeBuddy])

  async function send(text: string, intent: ChatIntent = 'chat') {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError(null)
    const optimisticId = `local-${Date.now()}`
    setBubbles((current) => [...current, { id: optimisticId, role: 'USER', content: trimmed }])
    setInput('')
    const live = detectLivePageContext(activeTab, focusLabel)
    const context: ChatContext = {
      tab: activeTab,
      focus: live.focus || focusLabel || undefined,
      detail: live.detail || undefined,
    }
    try {
      let chatId = activeChatId
      if (!chatId) {
        const chat = await createAiChatApi('STUDY_COACH')
        chatId = chat.id
        setActiveChatId(chat.id)
        setChats((current) => [chat, ...current])
      }
      const result = await sendAiMessageApi(chatId, trimmed, intent, context)
      setBubbles((current) => [
        ...current.filter((bubble) => bubble.id !== optimisticId),
        { id: result.userMessage.id, role: 'USER', content: result.userMessage.content },
        { id: result.aiMessage.id, role: 'AI', content: result.aiMessage.content, feedback: result.feedback },
      ])
    } catch (sendError) {
      setBubbles((current) => current.filter((bubble) => bubble.id !== optimisticId))
      setInput(trimmed)
      setError(describeError(sendError, t))
    } finally {
      setSending(false)
    }
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void send(input)
    }
  }

  async function openChat(chatId: number) {
    setHistoryError(null)
    try {
      const data = await getAiChatApi(chatId)
      setActiveChatId(chatId)
      setBubbles(toBubbles(data.messages))
      switchView('chat')
    } catch (loadError) {
      setHistoryError(describeError(loadError, t))
    }
  }

  async function removeChat(chatId: number) {
    setHistoryError(null)
    try {
      await deleteAiChatApi(chatId)
      setChats((current) => current.filter((chat) => chat.id !== chatId))
      if (activeChatId === chatId) {
        setActiveChatId(null)
        setBubbles([])
      }
    } catch (deleteError) {
      setHistoryError(describeError(deleteError, t))
    }
  }

  function newChat() {
    setActiveChatId(null)
    setBubbles([])
    setInput('')
    setError(null)
    switchView('chat')
  }

  const carMood: CarMood = sending ? 'thinking' : error || planError ? 'oops' : 'cheer'
  const hints = [t.buddyHintOne, t.buddyHintTwo, t.buddyHintThree]

  if (!view) {
    return (
      <button
        type="button"
        className="buddy-launcher"
        onClick={() => switchView('chat')}
        aria-label={t.buddyOpen}
        title={t.buddyOpen}
      >
        <span className={`buddy-launcher-bubble${hintVisible ? '' : ' is-faded'}`}>{hints[hintIndex]}</span>
        <span className="buddy-breathe">
          <BuddyCar className="buddy-launcher-car" mood={carMood} />
        </span>
        <span className="buddy-launcher-shadow" aria-hidden="true" />
      </button>
    )
  }

  const actions = quickActions(t, activeTab)

  return (
    <aside className={`buddy-panel${closing ? ' is-closing' : ''}`} role="dialog" aria-label={t.buddyTitle}>
      <header className="buddy-head">
        <BuddyCar className="buddy-head-car" mood={carMood} />
        <div className="buddy-head-copy">
          <h2>{t.buddyTitle}</h2>
          <span className="buddy-status">{t.buddyStatus}</span>
        </div>
        <button
          type="button"
          className="buddy-close"
          onClick={closeBuddy}
          aria-label={t.buddyClose}
          title={t.buddyClose}
        >
          <X size={17} weight="bold" />
        </button>
      </header>

      <nav className="buddy-tabs" aria-label={t.buddyTitle}>
        <div className="buddy-tabs-track">
          <button
            type="button"
            className={view === 'chat' ? 'is-active' : ''}
            onClick={() => switchView('chat')}
          >
            <ChatCircleDots size={14} weight={view === 'chat' ? 'fill' : 'bold'} />
            <span>{t.buddyTabChat}</span>
          </button>
          <button
            type="button"
            className={view === 'plan' ? 'is-active' : ''}
            onClick={() => switchView('plan')}
          >
            <ListChecks size={14} weight={view === 'plan' ? 'fill' : 'bold'} />
            <span>{t.buddyTabPlan}</span>
          </button>
          <button
            type="button"
            className={view === 'history' ? 'is-active' : ''}
            onClick={() => switchView('history')}
          >
            <ClockCounterClockwise size={14} weight={view === 'history' ? 'fill' : 'bold'} />
            <span>{t.buddyTabHistory}</span>
          </button>
        </div>
      </nav>

      {view === 'plan' && (
        <div className="buddy-body buddy-plan">
          <div className="buddy-plan-lead">
            <h3>{t.buddyPlanTitle}</h3>
            {plan && <p>{t.buddyPlanLead(plan.snapshot.completedLessons, plan.snapshot.totalLessons)}</p>}
          </div>

          {plan && (
            <div className="buddy-plan-note">
              <BuddyCar className="buddy-note-car" mood="cheer" />
              <p>
                <strong>{plan.aiNote ? t.buddyPlanAi : t.buddyPlanFallback}</strong>
                {plan.aiNote ? ` ${plan.aiNote}` : ''}
              </p>
            </div>
          )}

          {planLoading && !plan && <p className="buddy-muted">{t.buddyLoading}</p>}
          {planError && (
            <div className="buddy-error" role="alert">
              <span>{planError}</span>
              <button type="button" onClick={() => void loadPlan()}>{t.buddyRetry}</button>
            </div>
          )}

          {plan && (
            <ol className="buddy-steps">
              {plan.steps.map((step, index) => (
                <li key={step.id} className="buddy-step">
                  <span className="buddy-step-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <div className="buddy-step-copy">
                    <strong>{step.title}</strong>
                    <p>{step.reason}</p>
                    <span className="buddy-step-meta">{t.buddyMinutes(step.minutes)}</span>
                  </div>
                  <button type="button" className="buddy-step-action" onClick={() => onAction(step)}>
                    <span>{t.buddyPlanStart}</span>
                    <ArrowRight size={13} weight="bold" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          )}

          <div className="buddy-plan-foot">
            <button type="button" className="buddy-text-btn" onClick={() => void loadPlan()} disabled={planLoading}>
              <ArrowsClockwise size={13} aria-hidden="true" />
              <span>{planLoading ? t.buddyLoading : t.buddyPlanRefresh}</span>
            </button>
            <button
              type="button"
              className="buddy-text-btn"
              onClick={() => { switchView('chat'); void send(t.buddyPromptPlan, 'plan') }}
            >
              <ChatCircleDots size={13} aria-hidden="true" />
              <span>{t.buddyPlanAsk}</span>
            </button>
          </div>
        </div>
      )}

      {view === 'chat' && (
        <div className="buddy-body buddy-chat">
          <div className="buddy-thread" ref={threadRef} aria-live="polite">
            {bubbles.length === 0 && !sending && (
              <div className="buddy-empty">
                <span className="buddy-breathe">
                  <BuddyCar className="buddy-empty-car" mood="cheer" />
                </span>
                <p>{t.buddyEmpty}</p>
              </div>
            )}
            {bubbles.map((bubble) => (
              <div key={bubble.id} className={`buddy-turn is-${bubble.role.toLowerCase()}`}>
                {bubble.role === 'AI' && <BuddyCar className="buddy-turn-car" mood="idle" />}
                <div className={`buddy-bubble is-${bubble.role.toLowerCase()}`}>
                  <p>{bubble.content}</p>
                  {bubble.feedback && bubble.feedback.length > 0 && (
                    <div className="buddy-feedback">
                      <strong>{t.buddyFeedbackTitle}</strong>
                      {bubble.feedback.map((item, index) => (
                        <div key={`${bubble.id}-f-${index}`} className="buddy-feedback-row">
                          <del>{item.original_text}</del>
                          <span aria-hidden="true">→</span>
                          <b>{item.corrected_text}</b>
                          <small>{item.explanation}</small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="buddy-turn is-ai">
                <BuddyCar className="buddy-turn-car" mood="thinking" />
                <div className="buddy-bubble is-ai is-typing">
                  <span className="buddy-dots" aria-hidden="true"><i /><i /><i /></span>
                  <span className="buddy-sr-only">{t.buddySending}</span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="buddy-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} aria-label={t.buddyClose}><X size={12} /></button>
            </div>
          )}

          <div className="buddy-quick" aria-label={t.buddyQuickLabel}>
            {actions.map((action) => (
              <button
                key={action.key}
                type="button"
                className="buddy-chip"
                disabled={sending}
                onClick={() => void send(action.prompt, action.intent)}
              >
                {action.label}
              </button>
            ))}
          </div>

          <div className="buddy-compose-wrap">
            <div className="buddy-compose">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={t.buddyPlaceholder}
                aria-label={t.buddyPlaceholder}
                rows={1}
                maxLength={2000}
                disabled={sending}
              />
              <button
                type="button"
                className="buddy-send"
                onClick={() => void send(input)}
                disabled={!input.trim() || sending}
                aria-label={t.buddySend}
                title="Gửi tin nhắn (Enter)"
              >
                <PaperPlaneTilt size={16} weight="fill" />
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'history' && (
        <div className="buddy-body buddy-history">
          {historyError && <div className="buddy-error" role="alert"><span>{historyError}</span></div>}
          {chats.length === 0 ? (
            <p className="buddy-muted">{t.buddyHistoryEmpty}</p>
          ) : (
            <ul className="buddy-history-list">
              {chats.map((chat) => (
                <li key={chat.id} className={chat.id === activeChatId ? 'is-active' : ''}>
                  <button type="button" className="buddy-history-open" onClick={() => void openChat(chat.id)}>
                    <span className="buddy-history-date">{formatDate(chat.updated_at, lang)}</span>
                    <strong>{chat.title || t.buddyTitle}</strong>
                    <small>{chat.last_message || t.buddyHistoryEmpty}</small>
                  </button>
                  <button
                    type="button"
                    className="buddy-history-delete"
                    onClick={() => void removeChat(chat.id)}
                    aria-label={t.buddyDeleteChat}
                    title={t.buddyDeleteChat}
                  >
                    <TrashSimple size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="buddy-text-btn buddy-history-new" onClick={newChat}>
            <ClockCounterClockwise size={13} aria-hidden="true" />
            <span>{t.buddyNewChat}</span>
          </button>
        </div>
      )}
    </aside>
  )
}
