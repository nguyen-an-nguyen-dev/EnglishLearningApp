import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BellRinging,
  CheckCircle,
  Clock,
  PaperPlaneTilt,
  Sparkle,
  SpeakerHigh,
  SpeakerSlash,
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
import { AudioBars } from './AudioBars'
import { createMicMeter } from './micMeter'
import { createDictation, type Dictation } from './dictation'
import { createRecorder, type Recorder } from './recorder'
import { getSpeechStatusApi, transcribeAudioApi } from '../../services/speechService'
import {
  phaseAfterCommand,
  phaseAfterEnd,
  phaseForFinalTranscript,
  shouldReadAloud,
  type VoicePhase,
} from './voiceFlow'
import { routeVoiceCommand } from './voiceCommands'

export type BuddyView = 'home' | 'ask' | 'reminders' | null

interface VoiceOrbProps {
  activeTab: string
  view: BuddyView
  onViewChange: (view: BuddyView) => void
  /** Navigate somewhere in the app, optionally circling an element there. */
  onNavigate: (target: BuddyTarget) => void
  /** Review is the profile's button, so a spoken "ôn tập" opens that session. */
  onOpenReview: () => void
}

type AnswerState = { question: string; answer: BuddyAnswer } | null

const SUGGESTIONS: Array<{ key: 'voiceSuggestPlan' | 'voiceSuggestRank' | 'voiceSuggestReview' | 'voiceSuggestArena'; question: string; intent: 'chat' | 'plan' | 'explain' | 'how' | 'practice' }> = [
  { key: 'voiceSuggestPlan', question: 'Hôm nay mình nên học gì?', intent: 'plan' },
  { key: 'voiceSuggestRank', question: 'Bảng xếp hạng tuần này của mình', intent: 'chat' },
  { key: 'voiceSuggestReview', question: 'Mình có bài nào cần ôn không?', intent: 'plan' },
  { key: 'voiceSuggestArena', question: 'Vào đấu trường', intent: 'chat' },
]

const TAB_LABEL_KEYS: Record<BuddyTarget['tab'] & string, 'navStudy' | 'navVideos' | 'navTranslate' | 'navCompete' | 'navRankings' | 'navShop' | 'navProfile'> = {
  study: 'navStudy',
  videos: 'navVideos',
  translate: 'navTranslate',
  compete: 'navCompete',
  rankings: 'navRankings',
  shop: 'navShop',
  profile: 'navProfile',
}

/**
 * One voice, always in the middle of the bottom edge: tap and speak. A plain
 * destination opens immediately; anything else is answered by the coach. Typing
 * stays available because dictation needs a microphone the browser may refuse.
 */
export function VoiceOrb({ activeTab, view, onViewChange, onNavigate, onOpenReview }: VoiceOrbProps) {
  const { t } = useI18n()
  const [feed, setFeed] = useState<BuddyFeed | null>(null)
  const [reminders, setReminders] = useState<StudyReminder[]>([])
  const [feedError, setFeedError] = useState(false)
  const [dismissedNudges, setDismissedNudges] = useState<string[]>([])

  const [phase, setPhase] = useState<VoicePhase>('idle')
  const [heard, setHeard] = useState('')
  const [question, setQuestion] = useState('')
  const [askError, setAskError] = useState<string | null>(null)
  const [answer, setAnswer] = useState<AnswerState>(null)
  const [reminderAccepted, setReminderAccepted] = useState(false)
  const [notificationPromptDismissed, setNotificationPromptDismissed] = useState(false)
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem('engorace_voice_muted') === '1'
    } catch {
      return false
    }
  })

  // `browser` = Web Speech API; `backend` = record + server Whisper/Gemini.
  // Unknown until the status probe answers; the browser engine is the default.
  const [engine, setEngine] = useState<'browser' | 'backend'>('browser')
  const dictation = useRef<Dictation | null>(null)
  const recorder = useRef<Recorder | null>(null)
  const capture = useRef<'browser' | 'backend' | null>(null)
  const pending = useRef<AbortController | null>(null)
  const mutedRef = useRef(muted)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const heardRef = useRef('')
  const meter = useMemo(() => createMicMeter(5), [])

  const load = useCallback(async () => {
    try {
      const [nextFeed, nextReminders] = await Promise.all([getBuddyFeedApi(), listRemindersApi()])
      setFeed(nextFeed)
      setReminders(nextReminders)
      setFeedError(false)
      for (const reminder of nextReminders) {
        if (reminder.is_due && !reminder.delivered_at) showReminderNotification(reminder)
      }
    } catch {
      setFeedError(true)
    }
  }, [])

  useEffect(() => {
    // Deferred so the first paint is not blocked by the request.
    const id = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(id)
  }, [load])

  // The server reports whether it can transcribe audio. If it can, the orb
  // records and posts a clip instead of depending on the browser vendor's
  // speech servers (which fail with a "network" error in some environments).
  useEffect(() => {
    let cancelled = false
    getSpeechStatusApi()
      .then((status) => {
        if (!cancelled && status.backend) setEngine('backend')
      })
      .catch(() => { /* keep the browser engine */ })
    return () => { cancelled = true }
  }, [])

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
  const upcoming = reminders.filter((reminder) => !reminder.dismissed_at)

  /** Speaks a line. Callers decide whether the learner wants to hear it. */
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'vi-VN'
    utterance.rate = 1
    window.speechSynthesis.speak(utterance)
  }, [])

  const send = useCallback(async (
    text: string,
    intent: 'chat' | 'plan' | 'explain' | 'how' | 'practice' = 'chat',
    options: { spoken?: boolean } = {},
  ) => {
    const trimmed = text.trim()
    if (!trimmed || pending.current || capture.current) return

    // A plain destination is handled on device: no network, no wait.
    const command = routeVoiceCommand(trimmed)
    if (command) {
      // Handled on device: leave the thinking phase the caller may have set.
      setPhase(phaseAfterCommand())
      setHeard('')
      setQuestion('')
      setAskError(null)
      setAnswer(null)
      if (command.kind === 'review') {
        onViewChange(null)
        onOpenReview()
        if (shouldReadAloud(mutedRef.current, Boolean(options.spoken))) speak(t.voiceGoingTo(t.navReview))
        return
      }
      const label = t[TAB_LABEL_KEYS[command.tab]]
      onNavigate({ tab: command.tab })
      if (shouldReadAloud(mutedRef.current, Boolean(options.spoken))) speak(t.voiceGoingTo(label))
      return
    }

    setPhase('thinking')
    setAskError(null)
    setAnswer(null)
    setReminderAccepted(false)
    setQuestion(trimmed)
    const request = new AbortController()
    pending.current = request
    const context: BuddyContext = {
      ...detectLivePageContext(activeTab as BuddyContext['tab']),
      tab: activeTab as BuddyContext['tab'],
    }
    try {
      const result = await askBuddyApi(trimmed, context, intent, request.signal)
      if (request.signal.aborted) return
      setAnswer({ question: trimmed, answer: result })
      setQuestion('')
      // The reply needs room to be read, so the panel opens on the result.
      onViewChange('ask')
      // Only read aloud what the learner asked for out loud, and only while unmuted.
      if (shouldReadAloud(mutedRef.current, Boolean(options.spoken))) speak(result.reply)
    } catch {
      if (request.signal.aborted) return
      setAskError(t.buddyErrorGeneric)
      onViewChange('ask')
    } finally {
      if (pending.current === request) {
        pending.current = null
        setPhase('idle')
      }
    }
  }, [activeTab, onNavigate, onOpenReview, onViewChange, speak, t])

  // The dictation instance lives for the whole session, so its callbacks read the
  // newest handlers through refs instead of the values captured on the first render
  // (otherwise muting after the first dictation has no effect on voice replies).
  const sendRef = useRef(send)
  const tRef = useRef(t)
  const onViewChangeRef = useRef(onViewChange)
  useEffect(() => {
    sendRef.current = send
    tRef.current = t
    onViewChangeRef.current = onViewChange
  }, [send, t, onViewChange])

  const cancelWork = useCallback(() => {
    capture.current = null
    pending.current?.abort()
    pending.current = null
    dictation.current?.cancel()
    recorder.current?.cancel()
    heardRef.current = ''
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  const stopListening = useCallback(() => {
    if (capture.current === 'backend') recorder.current?.stop()
    if (capture.current === 'browser') dictation.current?.stop()
  }, [])

  /** Records one clip and sends it to the backend transcription service. */
  const beginBackendListening = useCallback(() => {
    if (!recorder.current) {
      recorder.current = createRecorder({
        onStream: (stream) => meter.attach(stream),
        onClip: (clip) => {
          if (capture.current !== 'backend') return
          capture.current = null
          const request = new AbortController()
          pending.current = request
          setPhase('thinking')
          void transcribeAudioApi(clip, request.signal)
            .then((transcript) => {
              if (request.signal.aborted) return
              pending.current = null
              const text = transcript.text?.trim() ?? ''
              if (text) {
                setHeard(text)
                void sendRef.current(text, 'chat', { spoken: true })
              } else {
                setPhase('idle')
                setAskError(tRef.current.voiceNoSpeech)
                onViewChangeRef.current('ask')
              }
            })
            .catch((error: unknown) => {
              if (request.signal.aborted) return
              pending.current = null
              setPhase('idle')
              const code = (error as Error & { code?: string }).code
              setAskError(
                code === 'NO_SPEECH' ? tRef.current.voiceNoSpeech : tRef.current.voiceServiceError,
              )
              onViewChangeRef.current('ask')
            })
        },
        onError: (kind) => {
          if (kind === 'empty') {
            capture.current = null
            setPhase('idle')
            return
          }
          if (capture.current !== 'backend') return
          capture.current = null
          setPhase('idle')
          setAskError(
            kind === 'denied' ? tRef.current.voiceDenied
              : kind === 'unsupported' ? tRef.current.voiceUnsupported
                : tRef.current.voiceError,
          )
          onViewChangeRef.current('ask')
        },
      })
    }
    if (!recorder.current.supported) {
      return false
    }
    capture.current = 'backend'
    setPhase('listening')
    recorder.current.start()
    return true
  }, [meter])

  const beginListening = useCallback(() => {
    if (phase !== 'idle' || capture.current || pending.current) return
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setHeard('')
    heardRef.current = ''
    setAskError(null)
    setAnswer(null)
    if (engine === 'backend' && beginBackendListening()) return
    if (!dictation.current) {
      dictation.current = createDictation({
        onTranscript: (text, isFinal) => {
          if (capture.current !== 'browser') return
          setHeard(text)
          if (!isFinal) {
            heardRef.current = text
            return
          }
          // The engine finished a phrase: send it and empty the buffer so no
          // other path (a stop tap, onEnd) can send the same words twice.
          const finalText = text.trim()
          capture.current = null
          heardRef.current = ''
          setPhase(phaseForFinalTranscript(finalText))
          setHeard('')
          if (finalText) void sendRef.current(finalText, 'chat', { spoken: true })
        },
        onError: (kind) => {
          if (capture.current !== 'browser') return
          capture.current = null
          const t = tRef.current
          heardRef.current = ''
          setHeard('')
          setPhase('idle')
          setAskError(
            kind === 'denied' ? t.voiceDenied
              : kind === 'no-speech' ? t.voiceNoSpeech
                : kind === 'unsupported' ? t.voiceUnsupported
                  : kind === 'network' ? t.voiceNetwork
                    : t.voiceError,
          )
          // The reason has to be readable, so the panel carries it.
          onViewChangeRef.current('ask')
        },
        onEnd: () => {
          if (capture.current !== 'browser') return
          capture.current = null
          const text = heardRef.current.trim()
          heardRef.current = ''
          setHeard('')
          if (text) {
            void sendRef.current(text, 'chat', { spoken: true })
            return
          }
          setPhase((current) => phaseAfterEnd(current))
        },
      })
    }
    if (!dictation.current.supported) {
      setAskError(t.voiceUnsupported)
      onViewChange('ask')
      return
    }
    // The mic opens over the page, not behind a panel: tapping the orb is the
    // whole interaction. The panel only appears if the coach has something to say.
    setPhase('listening')
    capture.current = 'browser'
    dictation.current.start()
  }, [beginBackendListening, engine, onViewChange, phase, t])

  const closePanel = useCallback(() => {
    cancelWork()
    setPhase('idle')
    setHeard('')
    onViewChange(null)
  }, [cancelWork, onViewChange])

  // Closing the panel by any path (nudge, navigation, Escape) must also drop
  // the mic and any answer still in flight, not only the panel's own X button.
  useEffect(() => {
    if (view) return
    const id = window.setTimeout(() => {
      if (!capture.current && !pending.current) return
      cancelWork()
      setPhase((current) => phaseAfterEnd(current))
      setHeard('')
    }, 0)
    return () => window.clearTimeout(id)
  }, [view, cancelWork])

  useEffect(() => {
    return () => {
      cancelWork()
      meter.stop()
    }
  }, [cancelWork, meter])

  // The waveform follows the mic: the browser engine opens its own stream, the
  // backend engine hands the recorder's stream over; either way the audio graph is
  // released when the phase leaves "listening".
  useEffect(() => {
    if (phase !== 'listening') {
      meter.stop()
      return
    }
    if (capture.current === 'browser') void meter.open()
  }, [phase, meter])

  useEffect(() => {
    if (view !== 'ask') return
    const id = window.setTimeout(() => inputRef.current?.focus(), 120)
    return () => window.clearTimeout(id)
  }, [view])

  useEffect(() => {
    if (!view) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, closePanel])

  function toggleMute() {
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    try {
      localStorage.setItem('engorace_voice_muted', next ? '1' : '0')
    } catch {
      /* storage can be unavailable in private mode */
    }
    if (next && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  async function acceptSuggestion(suggestion: ReminderSuggestion) {
    try {
      const reminder = await acceptReminderSuggestionApi(suggestion, { tab: activeTab as BuddyTarget['tab'] })
      setReminderAccepted(true)
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

  function runAction(action: BuddyAnswer['action']) {
    if (!action) return
    if (action.kind === 'open_review') {
      onViewChange(null)
      onOpenReview()
      return
    }
    goTo({ tab: action.tab, lessonId: action.lessonId, videoId: action.videoId, highlight: action.highlight })
  }

  const showNotificationCta = notificationState() === 'default' && !notificationPromptDismissed
  const liveLine = phase === 'listening'
    ? (heard || t.voiceListening)
    : phase === 'thinking'
      ? t.voiceThinking
      : null

  return (
    <>
      <div className={`voice-dock${view ? ' is-open' : ''}${dueNudges.length > 0 ? ' has-alert' : ''}`}>
        {liveLine && (
          <p className="voice-caption" role="status" aria-live="polite">
            {liveLine}
          </p>
        )}

        <div className="voice-dock-row">
          <button
            type="button"
            className="voice-side-btn"
            onClick={toggleMute}
            aria-label={muted ? t.voiceUnmute : t.voiceMute}
            title={muted ? t.voiceUnmute : t.voiceMute}
          >
            {muted ? <SpeakerSlash size={17} weight="bold" /> : <SpeakerHigh size={17} weight="bold" />}
          </button>

          <button
            type="button"
            className={`voice-orb is-${phase}${view ? ' is-open' : ''}`}
            onClick={() => {
              if (view) {
                closePanel()
                return
              }
              if (phase === 'listening') {
                stopListening()
                return
              }
              if (phase === 'thinking') closePanel()
              else beginListening()
            }}
            aria-label={view || phase === 'thinking' ? t.voiceClose : phase === 'listening' ? t.voiceTapToStop : t.voiceOpen}
            aria-expanded={Boolean(view)}
            data-voice-orb="true"
          >
            <span className="voice-orb-halo" aria-hidden="true" />
            <span className="voice-orb-core">
              {view || phase === 'thinking' ? <X size={25} weight="bold" /> : <AudioBars meter={meter} active={phase === 'listening'} size={32} />}
            </span>
            {dueNudges.length > 0 && !view && <span className="voice-orb-dot" aria-hidden="true" />}
          </button>

          <button
            type="button"
            className="voice-side-btn"
            onClick={() => {
              if (view === 'home') closePanel()
              else onViewChange('home')
            }}
            aria-label={t.buddyTitle}
            title={t.buddyTitle}
          >
            <Sparkle size={17} weight="fill" />
          </button>
        </div>

        {!view && (
          <p className="voice-dock-hint">{phase === 'listening' ? t.voiceTapToStop : t.voiceHint}</p>
        )}
      </div>

      {view && (
        <div className="voice-panel" role="dialog" aria-label={t.buddyTitle}>
          <header className="voice-panel-head">
            <div>
              <strong>{t.buddyTitle}</strong>
              <small>{feed?.greeting ?? t.buddySubtitle}</small>
            </div>
            <button type="button" className="buddy-icon-btn" onClick={closePanel} aria-label={t.buddyClose}>
              <X size={16} weight="bold" />
            </button>
          </header>

          {view === 'ask' && (
            <div className="voice-panel-body">
              <form
                className="voice-ask-form"
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
                  placeholder={t.voiceTypePlaceholder}
                  aria-label={t.voiceTypePlaceholder}
                  disabled={phase !== 'idle'}
                  maxLength={2000}
                />
                <button
                  type="button"
                  className={`voice-mic-btn${phase === 'listening' ? ' is-live' : ''}`}
                  onClick={() => (phase === 'listening' ? stopListening() : beginListening())}
                  disabled={phase === 'thinking'}
                  aria-label={phase === 'listening' ? t.voiceTapToStop : t.voiceOpen}
                  title={phase === 'listening' ? t.voiceTapToStop : t.voiceOpen}
                >
                  <AudioBars meter={meter} active={phase === 'listening'} size={22} />
                </button>
                <button
                  type="submit"
                  className="buddy-send-btn"
                  disabled={phase !== 'idle' || !question.trim()}
                  aria-label={t.voiceSend}
                >
                  <PaperPlaneTilt size={15} weight="fill" />
                </button>
              </form>

              {phase === 'listening' && (
                <p className="voice-heard" role="status" aria-live="polite">
                  {heard || t.voiceListening}
                </p>
              )}
              {phase === 'thinking' && <p className="buddy-muted">{t.voiceThinking}</p>}
              {askError && <p className="buddy-inline-error">{askError}</p>}

              {!answer && phase !== 'listening' && (
                <>
                  <p className="voice-hint-line">{t.voiceAskHint}</p>
                  <div className="buddy-suggestions">
                    {SUGGESTIONS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className="buddy-suggestion"
                        onClick={() => void send(item.question, item.intent)}
                        disabled={phase === 'thinking'}
                      >
                        {t[item.key]}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {answer && (
                <article className="buddy-answer">
                  <p className="buddy-answer-question">{answer.question}</p>
                  <p className="buddy-answer-body">{answer.answer.reply}</p>

                  {answer.answer.action && (
                    <button type="button" className="buddy-solid-btn" onClick={() => runAction(answer.answer.action)}>
                      {answer.answer.action.label}
                      <ArrowRight size={13} weight="bold" aria-hidden="true" />
                    </button>
                  )}

                  {answer.answer.suggestion && !reminderAccepted && (
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

                  {reminderAccepted && (
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

          {view === 'home' && (
            <div className="voice-panel-body">
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
                    <button
                      type="button"
                      className="buddy-solid-btn"
                      onClick={() => {
                        onViewChange(null)
                        goTo(nudge.action.target)
                      }}
                    >
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
                    <button
                      type="button"
                      className="buddy-solid-btn"
                      onClick={() => {
                        // "Có bài ôn tập" must land in the session, not on the
                        // profile page where the button merely lives.
                        if (nudge.kind === 'review-due') {
                          onViewChange(null)
                          onOpenReview()
                          return
                        }
                        goTo(nudge.action.target)
                      }}
                    >
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

              {feed && visibleNudges.length === 0 && <p className="buddy-muted">{t.buddyNothing}</p>}

              <div className="buddy-cta-row">
                <button type="button" className="buddy-ghost-btn" onClick={() => onViewChange('ask')}>
                  <Sparkle size={14} weight="fill" /> {t.voiceAskByText}
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

          {view === 'reminders' && (
            <div className="voice-panel-body">
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
            </div>
          )}
        </div>
      )}
    </>
  )
}
