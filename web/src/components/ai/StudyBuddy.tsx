import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BellRinging,
  CheckCircle,
  Clock,
  PaperPlaneTilt,
  Sparkle,
  Trash,
  X,
} from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import {
  acceptReminderSuggestionApi,
  askBuddyApi,
  dismissReminderApi,
  getBuddyFeedApi,
  listRemindersApi,
} from '../../services/buddyService'
import type {
  BuddyAnswer,
  BuddyFeed,
  BuddyTarget,
  Nudge,
  ReminderSuggestion,
  StudyReminder,
} from '../../types/buddy'
import {
  formatReminderTime,
  notificationState,
  requestNotificationPermission,
  showReminderNotification,
} from '../../utils/buddyNotifications'
import { detectLivePageContext, type BuddyContext } from './buddyContext'

export type BuddyView = 'home' | 'ask' | 'reminders' | null

interface StudyBuddyProps {
  activeTab: string
  view: BuddyView
  onViewChange: (view: BuddyView) => void
  /** Navigate somewhere in the app, optionally circling an element there. */
  onNavigate: (target: BuddyTarget) => void
  /** Bubble text the learner can click straight through to an action. */
  onOpenLesson?: (lessonId: number) => void
}

type AnswerState = {
  question: string
  answer: BuddyAnswer
} | null

const SUGGESTION_PROMPTS: Array<{ label: string; question: string; intent: 'chat' | 'plan' | 'how' | 'explain' | 'practice' }> = [
  { label: 'Học gì bây giờ?', question: 'Giờ mình nên làm gì tiếp?', intent: 'plan' },
  { label: 'Nhắc mình 30 phút nữa', question: '30 phút nữa nhắc mình quay lại học nhé', intent: 'chat' },
  { label: 'Giải thích chỗ này', question: 'Giải thích giúp mình nội dung đang hiện trên màn hình', intent: 'explain' },
  { label: 'Sai ở đâu?', question: 'Câu mình vừa làm sai ở đâu?', intent: 'explain' },
]

export function StudyBuddy({ activeTab, view, onViewChange, onNavigate }: StudyBuddyProps) {
  const { t } = useI18n()
  const [feed, setFeed] = useState<BuddyFeed | null>(null)
  const [reminders, setReminders] = useState<StudyReminder[]>([])
  const [feedError, setFeedError] = useState(false)
  const [dismissedNudges, setDismissedNudges] = useState<string[]>([])
  const [bubbleIndex, setBubbleIndex] = useState(0)

  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState<AnswerState>(null)
  const [askError, setAskError] = useState<string | null>(null)
  const [acceptedReminders, setAcceptedReminders] = useState<number[]>([])
  const [notificationPromptDismissed, setNotificationPromptDismissed] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    try {
      const [nextFeed, nextReminders] = await Promise.all([getBuddyFeedApi(), listRemindersApi()])
      setFeed(nextFeed)
      setReminders(nextReminders)
      setFeedError(false)
      // A reminder that just became due is worth an OS notification too.
      for (const reminder of nextReminders) {
        if (reminder.is_due && !reminder.delivered_at) showReminderNotification(reminder)
      }
    } catch {
      setFeedError(true)
    }
  }, [])

  useEffect(() => {
    // Deferred so the first paint is not blocked by the request; state is written
    // from the promise callbacks, never synchronously inside the effect.
    const id = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(id)
  }, [load])

  // Poll while the tab is open: that is the only moment a reminder can fire.
  useEffect(() => {
    const id = window.setInterval(() => void load(), 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const visibleNudges = useMemo(
    () => (feed?.nudges ?? []).filter((nudge) => !dismissedNudges.includes(nudge.id)),
    [feed, dismissedNudges],
  )

  const dueNudges = visibleNudges.filter((nudge) => nudge.kind === 'reminder')
  const otherNudges = visibleNudges.filter((nudge) => nudge.kind !== 'reminder')

  // The car speaks the most urgent thing it has, rotating slowly so it never
  // becomes wallpaper.
  const bubbles = useMemo(() => {
    const lines: Array<{ text: string; nudge?: Nudge }> = []
    if (feed?.greeting) lines.push({ text: feed.greeting })
    for (const nudge of dueNudges) lines.push({ text: `${nudge.title}`, nudge })
    return lines
  }, [feed, dueNudges])

  useEffect(() => {
    if (bubbles.length < 2) return
    const id = window.setInterval(() => {
      setBubbleIndex((current) => (current + 1) % bubbles.length)
    }, 9_000)
    return () => window.clearInterval(id)
  }, [bubbles.length])

  const bubble = bubbles[bubbleIndex % Math.max(1, bubbles.length)]

  useEffect(() => {
    if (!view) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onViewChange(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, onViewChange])

  useEffect(() => {
    if (view !== 'ask') return
    const id = window.setTimeout(() => inputRef.current?.focus(), 120)
    return () => window.clearTimeout(id)
  }, [view])

  async function send(text: string, intent: 'chat' | 'plan' | 'explain' | 'how' | 'practice' = 'chat') {
    const trimmed = text.trim()
    if (!trimmed || asking) return
    setAsking(true)
    setAskError(null)
    setAnswer(null)
    const context: BuddyContext = {
      ...detectLivePageContext(activeTab as BuddyContext['tab']),
      tab: activeTab as BuddyContext['tab'],
    }
    try {
      const result = await askBuddyApi(trimmed, context, intent)
      setAnswer({ question: trimmed, answer: result })
      setQuestion('')
    } catch {
      setAskError(t.buddyErrorGeneric)
    } finally {
      setAsking(false)
    }
  }

  async function acceptSuggestion(suggestion: ReminderSuggestion) {
    try {
      const reminder = await acceptReminderSuggestionApi(suggestion, { tab: activeTab as BuddyTarget['tab'] })
      setAcceptedReminders((current) => [...current, reminder.id])
      setReminders((current) => [...current, reminder].sort((a, b) => a.due_at.localeCompare(b.due_at)))
      await requestNotificationPermission()
    } catch {
      setAskError(t.buddyErrorGeneric)
    }
  }

  async function removeReminder(reminderId: number) {
    try {
      await dismissReminderApi(reminderId)
      setReminders((current) => current.filter((entry) => entry.id !== reminderId))
    } catch {
      /* the next poll will resync */
    }
  }

  function goTo(target: BuddyTarget) {
    onNavigate(target)
    onViewChange(null)
  }

  const upcoming = reminders.filter((reminder) => !reminder.dismissed_at)
  const showNotificationCta = notificationState() === 'default' && !notificationPromptDismissed

  return (
    <>
      {!view && bubble && (
        <button
          type="button"
          className="buddy-nudge-bubble"
          onClick={() => onViewChange('home')}
        >
          <span>{bubble.text}</span>
          {bubble.nudge && <ArrowRight size={13} weight="bold" aria-hidden="true" />}
        </button>
      )}

      <button
        type="button"
        className={`buddy-dock${dueNudges.length > 0 ? ' has-alert' : ''}`}
        onClick={() => onViewChange(view ? null : 'home')}
        aria-label={view ? t.buddyClose : t.buddyOpen}
        aria-expanded={Boolean(view)}
      >
        <img src="/logo.png" alt="" className="buddy-dock-car" draggable={false} />
        {dueNudges.length > 0 && <span className="buddy-dock-dot" aria-hidden="true" />}
      </button>

      {view && (
        <div className="buddy-panel" ref={panelRef} role="dialog" aria-label={t.buddyTitle}>
          <header className="buddy-panel-head">
            {view !== 'home' && (
              <button
                type="button"
                className="buddy-icon-btn"
                onClick={() => onViewChange('home')}
                aria-label={t.buddyBack}
                title={t.buddyBack}
              >
                <ArrowLeft size={16} weight="bold" />
              </button>
            )}
            <div className="buddy-panel-identity">
              <img src="/logo.png" alt="" className="buddy-panel-car" draggable={false} />
              <div>
                <strong>{t.buddyTitle}</strong>
                <small>{feed?.greeting ?? t.buddySubtitle}</small>
              </div>
            </div>
            <button
              type="button"
              className="buddy-icon-btn"
              onClick={() => onViewChange(null)}
              aria-label={t.buddyClose}
            >
              <X size={16} weight="bold" />
            </button>
          </header>

          {view === 'home' && (
            <div className="buddy-panel-body">
              {!feed && !feedError && <p className="buddy-muted">{t.buddyLoading}</p>}
              {feedError && (
                <div className="buddy-inline-error">
                  <span>{t.buddyErrorOffline}</span>
                  <button type="button" onClick={() => void load()}>{t.buddyRetry}</button>
                </div>
              )}

              {dueNudges.map((nudge) => (
                <article key={nudge.id} className="buddy-nudge is-due">
                  <span className="buddy-nudge-kind">
                    <BellRinging size={13} weight="fill" /> {t.buddyReminderDue}
                  </span>
                  <h4>{nudge.title}</h4>
                  <p>{nudge.body}</p>
                  <div className="buddy-nudge-actions">
                    <button type="button" className="buddy-solid-btn" onClick={() => goTo(nudge.action.target)}>
                      {nudge.action.label}
                    </button>
                    <button
                      type="button"
                      className="buddy-text-btn"
                      onClick={() => setDismissedNudges((current) => [...current, nudge.id])}
                    >
                      {t.buddyLater}
                    </button>
                  </div>
                </article>
              ))}

              {otherNudges.slice(0, 3).map((nudge) => (
                <article key={nudge.id} className={`buddy-nudge is-${nudge.tone}`}>
                  <h4>{nudge.title}</h4>
                  <p>{nudge.body}</p>
                  <div className="buddy-nudge-actions">
                    <button type="button" className="buddy-solid-btn" onClick={() => goTo(nudge.action.target)}>
                      {nudge.action.label}
                      <ArrowRight size={13} weight="bold" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="buddy-icon-btn"
                      onClick={() => setDismissedNudges((current) => [...current, nudge.id])}
                      aria-label={t.buddyDismiss}
                      title={t.buddyDismiss}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </article>
              ))}

              {feed && visibleNudges.length === 0 && (
                <p className="buddy-muted">{t.buddyNothing}</p>
              )}

              <div className="buddy-cta-row">
                <button type="button" className="buddy-ghost-btn" onClick={() => onViewChange('ask')}>
                  <Sparkle size={14} weight="fill" /> {t.buddyAskTitle}
                </button>
                <button type="button" className="buddy-ghost-btn" onClick={() => onViewChange('reminders')}>
                  <Clock size={14} /> {t.buddyReminders(upcoming.length)}
                </button>
              </div>

              {showNotificationCta && (
                <button
                  type="button"
                  className="buddy-notify-cta"
                  onClick={async () => {
                    const state = await requestNotificationPermission()
                    if (state !== 'default') setNotificationPromptDismissed(true)
                  }}
                >
                  <BellRinging size={15} weight="fill" />
                  <span>{t.buddyEnableNotifications}</span>
                </button>
              )}
            </div>
          )}

          {view === 'ask' && (
            <div className="buddy-panel-body">
              <form
                className="buddy-ask-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void send(question)
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder={t.buddyAskPlaceholder}
                  aria-label={t.buddyAskPlaceholder}
                  disabled={asking}
                />
                <button type="submit" className="buddy-send-btn" disabled={asking || !question.trim()} aria-label={t.buddySend}>
                  <PaperPlaneTilt size={15} weight="fill" />
                </button>
              </form>

              <div className="buddy-suggestions">
                {SUGGESTION_PROMPTS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="buddy-suggestion"
                    onClick={() => void send(item.question, item.intent)}
                    disabled={asking}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {asking && <p className="buddy-muted">{t.buddySending}</p>}
              {askError && <p className="buddy-inline-error">{askError}</p>}

              {answer && (
                <article className="buddy-answer">
                  <p className="buddy-answer-question">{answer.question}</p>
                  <p className="buddy-answer-body">{answer.answer.reply}</p>

                  {answer.answer.action && (
                    <button
                      type="button"
                      className="buddy-solid-btn"
                      onClick={() => goTo({
                        tab: answer.answer.action?.tab,
                        lessonId: answer.answer.action?.lessonId,
                        videoId: answer.answer.action?.videoId,
                        highlight: answer.answer.action?.highlight,
                      })}
                    >
                      {answer.answer.action.label}
                      <ArrowRight size={13} weight="bold" aria-hidden="true" />
                    </button>
                  )}

                  {answer.answer.suggestion && !acceptedReminders.includes(0) && (
                    <div className="buddy-reminder-offer">
                      <span>
                        <Clock size={13} weight="bold" />
                        {answer.answer.suggestion.at_time
                          ? `${t.buddyReminderAt} ${answer.answer.suggestion.at_time}`
                          : `${t.buddyReminderIn} ${answer.answer.suggestion.in_minutes} ${t.buddyMinutesShort}`}
                      </span>
                      <strong>{answer.answer.suggestion.title}</strong>
                      <button
                        type="button"
                        className="buddy-solid-btn"
                        onClick={() => void acceptSuggestion(answer.answer.suggestion as ReminderSuggestion)}
                      >
                        <BellRinging size={13} weight="fill" /> {t.buddyReminderSet}
                      </button>
                    </div>
                  )}

                  {acceptedReminders.length > 0 && (
                    <p className="buddy-ok">
                      <CheckCircle size={14} weight="fill" /> {t.buddyReminderSaved}
                    </p>
                  )}

                  {answer.answer.followups.length > 0 && (
                    <div className="buddy-suggestions">
                      {answer.answer.followups.map((followup) => (
                        <button
                          key={followup}
                          type="button"
                          className="buddy-suggestion"
                          onClick={() => void send(followup)}
                        >
                          {followup}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              )}
            </div>
          )}

          {view === 'reminders' && (
            <div className="buddy-panel-body">
              {upcoming.length === 0 && <p className="buddy-muted">{t.buddyNoReminders}</p>}
              {upcoming.map((reminder) => (
                <div key={reminder.id} className={`buddy-reminder-row${reminder.is_due ? ' is-due' : ''}`}>
                  <div>
                    <strong>{reminder.title}</strong>
                    <small>
                      {formatReminderTime(reminder.due_at)}
                      {reminder.body ? ` · ${reminder.body}` : ''}
                    </small>
                  </div>
                  <div className="buddy-reminder-actions">
                    {reminder.target && (
                      <button type="button" className="buddy-text-btn" onClick={() => goTo(reminder.target as BuddyTarget)}>
                        {t.buddyGoNow}
                      </button>
                    )}
                    <button
                      type="button"
                      className="buddy-icon-btn"
                      onClick={() => void removeReminder(reminder.id)}
                      aria-label={t.buddyDeleteReminder}
                      title={t.buddyDeleteReminder}
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              ))}

              <button type="button" className="buddy-ghost-btn" onClick={() => onViewChange('ask')}>
                <PlusMark /> {t.buddyNewReminder}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function PlusMark() {
  return <span aria-hidden="true" className="buddy-plus">+</span>
}
