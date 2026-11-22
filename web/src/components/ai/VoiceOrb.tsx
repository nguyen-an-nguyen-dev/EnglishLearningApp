import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BellRinging,
  CheckCircle,
  Clock,
  Microphone,
  MicrophoneSlash,
  PaperPlaneTilt,
  Sparkle,
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
import { isNavigationAnswer, navigationToast } from './buddyRoute'
import { AudioBars } from './AudioBars'
import { createMicMeter } from './micMeter'
import { createDictation, isDictationSupported, type Dictation } from './dictation'
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

type ChatEntry =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'agent'; text: string; answer: BuddyAnswer }

const TAB_LABEL_KEYS: Record<BuddyTarget['tab'] & string, 'navStudy' | 'navVideos' | 'navTranslate' | 'navCompete' | 'navRankings' | 'navShop' | 'navProfile'> = {
  study: 'navStudy',
  videos: 'navVideos',
  translate: 'navTranslate',
  compete: 'navCompete',
  rankings: 'navRankings',
  shop: 'navShop',
  profile: 'navProfile',
}

function localizedActionLabel(
  action: NonNullable<BuddyAnswer['action']>,
  t: ReturnType<typeof useI18n>['t'],
): string {
  if (action.kind === 'open_video') return t.buddyActionOpenVideo(action.videoTitle ?? '')
  if (action.kind === 'open_lesson') return t.buddyActionOpenLesson(action.lessonTitle ?? '')
  if (action.kind === 'open_review') return t.buddyActionOpenReview
  if (action.kind === 'open_notebook') return t.buddyActionOpenNotebook
  if (action.tab) return t[TAB_LABEL_KEYS[action.tab]]
  return action.label
}

/**
 * One voice, always in the middle of the bottom edge: tap and speak. A plain
 * destination opens immediately; anything else is answered by the coach. If the
 * browser cannot listen at all, the panel swaps the mic for a text field.
 */
export function VoiceOrb({ activeTab, view, onViewChange, onNavigate, onOpenReview }: VoiceOrbProps) {
  const { t, lang } = useI18n()
  const [feed, setFeed] = useState<BuddyFeed | null>(null)
  const [reminders, setReminders] = useState<StudyReminder[]>([])
  const [feedError, setFeedError] = useState(false)
  const [dismissedNudges, setDismissedNudges] = useState<string[]>([])

  const [phase, setPhase] = useState<VoicePhase>('idle')
  const [heard, setHeard] = useState('')
  const [question, setQuestion] = useState('')
  const [askError, setAskError] = useState<string | null>(null)
  const [conversation, setConversation] = useState<ChatEntry[]>([])
  /** Which agent bubble is being typed out, and how much is visible. */
  const [reveal, setReveal] = useState<{ id: number; chars: number } | null>(null)
  const [actionDismissed, setActionDismissed] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechAvailable, setSpeechAvailable] = useState(() => isDictationSupported())
  const [hasUsedVoice, setHasUsedVoice] = useState(() => {
    try { return localStorage.getItem('engorace_voice_used') === '1' } catch { return false }
  })
  const [reminderAccepted, setReminderAccepted] = useState(false)
  const [notificationPromptDismissed, setNotificationPromptDismissed] = useState(false)

  // `browser` = Web Speech API; `backend` = record + server Whisper/Gemini.
  // Unknown until the status probe answers; the browser engine is the default.
  const [engine, setEngine] = useState<'browser' | 'backend'>('browser')
  const dictation = useRef<Dictation | null>(null)
  const recorder = useRef<Recorder | null>(null)
  const capture = useRef<'browser' | 'backend' | null>(null)
  const pending = useRef<AbortController | null>(null)
  const mutedRef = useRef(false)
  try { mutedRef.current = localStorage.getItem('engorace_voice_muted') === '1' } catch { /* storage may be unavailable */ }
  const inputRef = useRef<HTMLInputElement | null>(null)
  const chatBodyRef = useRef<HTMLDivElement | null>(null)
  const heardRef = useRef('')
  const messageId = useRef(0)
  const speechToken = useRef(0)
  const revealTimer = useRef<number | null>(null)
  const meter = useMemo(() => createMicMeter(5), [])

  // A short, self-closing line on the dock. Navigation uses it instead of
  // opening the chat panel; it always disappears after four seconds.
  const toastTimer = useRef<number | null>(null)
  const showToast = useCallback((text: string, isError = false) => {
    setConfirmation(text)
    setAskError(isError ? text : null)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => {
      setConfirmation('')
      setAskError(null)
      toastTimer.current = null
    }, 4000)
  }, [])

  const reportVoiceError = useCallback((text: string) => showToast(text, true), [showToast])
  const reportVoiceErrorRef = useRef(reportVoiceError)

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
  // Either engine makes the voice button real; only when both are missing does
  // the panel swap the mic for a text field.
  useEffect(() => {
    let cancelled = false
    getSpeechStatusApi()
      .then((status) => {
        if (cancelled) return
        if (status.backend) {
          setEngine('backend')
          setSpeechAvailable(true)
        } else if (!isDictationSupported()) {
          setSpeechAvailable(false)
        }
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

  /** Stops any read-aloud and finishes the current reply bubble. */
  const stopSpeech = useCallback(() => {
    speechToken.current += 1
    if (revealTimer.current !== null) {
      window.clearInterval(revealTimer.current)
      revealTimer.current = null
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setReveal(null)
  }, [])

  /**
   * Speaks a line and reports how far the voice has reached, so the reply bubble
   * can type itself out in step with the audio. Returns false when the browser
   * has no speech synthesis, in which case the caller shows the full text.
   */
  const speak = useCallback((text: string, onProgress?: (chars: number) => void): boolean => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return false
    speechToken.current += 1
    const token = speechToken.current
    const report = onProgress
    if (revealTimer.current !== null) {
      window.clearInterval(revealTimer.current)
      revealTimer.current = null
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang === 'vi' ? 'vi-VN' : 'en-US'
    utterance.rate = 1
    let target = 0
    let shown = 0
    let boundarySeen = false
    const clearTimer = () => {
      if (revealTimer.current !== null) {
        window.clearInterval(revealTimer.current)
        revealTimer.current = null
      }
    }
    const finish = () => {
      if (speechToken.current !== token) return
      clearTimer()
      setIsSpeaking(false)
      report?.(text.length)
    }
    utterance.onboundary = (event) => {
      if (speechToken.current !== token) return
      boundarySeen = true
      const end = event.charIndex + (event.charLength > 0 ? event.charLength : 1)
      target = Math.max(target, Math.min(text.length, end))
    }
    utterance.onend = finish
    utterance.onerror = finish
    setIsSpeaking(true)
    if (report) {
      report(0)
      const startedAt = performance.now()
      // One character every 25ms keeps the reveal fluid; boundary events pull
      // the target ahead to the word the voice is actually pronouncing.
      revealTimer.current = window.setInterval(() => {
        if (speechToken.current !== token) {
          clearTimer()
          return
        }
        if (!boundarySeen) {
          // Safari does not emit boundary events: follow a natural speaking pace.
          const estimate = Math.floor(((performance.now() - startedAt) / 1000) * 15)
          target = Math.max(target, Math.min(text.length, estimate))
        }
        if (shown < target) {
          shown += 1
          report(shown)
        }
        if (shown >= text.length) clearTimer()
      }, 25)
    }
    window.speechSynthesis.speak(utterance)
    return true
  }, [lang])

  const send = useCallback(async (
    text: string,
    intent: 'chat' | 'plan' | 'explain' | 'how' | 'practice' = 'chat',
    options: { spoken?: boolean } = {},
  ) => {
    const trimmed = text.trim()
    if (!trimmed || pending.current || capture.current) return
    stopSpeech()

    // Plain destinations are handled on device: switch screen + short toast,
    // never open the chat panel.
    const command = routeVoiceCommand(trimmed)
    if (command) {
      setPhase(phaseAfterCommand())
      setHeard('')
      setQuestion('')
      setAskError(null)
      setActionDismissed(false)
      if (command.kind === 'review') {
        const action: NonNullable<BuddyAnswer['action']> = { kind: 'open_review', tab: 'profile', label: t.navReview }
        runAction(action, t.voiceOpened(t.navReview), Boolean(options.spoken))
        return
      }
      const label = t[TAB_LABEL_KEYS[command.tab]]
      const action: NonNullable<BuddyAnswer['action']> = { kind: 'open_tab', tab: command.tab, label }
      runAction(action, t.voiceOpened(label), Boolean(options.spoken))
      return
    }

    setPhase('thinking')
    setAskError(null)
    setHasUsedVoice(true)
    try { localStorage.setItem('engorace_voice_used', '1') } catch { /* storage may be unavailable */ }
    setReminderAccepted(false)
    setQuestion('')
    setActionDismissed(false)
    const userId = (messageId.current += 1)
    const replyId = (messageId.current += 1)
    setConversation((current) => [...current, { id: userId, role: 'user', text: trimmed }])
    const request = new AbortController()
    pending.current = request
    const context: BuddyContext = {
      ...detectLivePageContext(activeTab as BuddyContext['tab']),
      tab: activeTab as BuddyContext['tab'],
    }
    try {
      const result = await askBuddyApi(trimmed, context, intent, request.signal)
      if (request.signal.aborted) return
      if (isNavigationAnswer(result, intent)) {
        // Decision model said "go", or an older backend returned a target:
        // switch screen and show a four-second toast, no chatbot window. The
        // utterance was not a conversation turn, so drop it from the history.
        setConversation((current) => current.filter((entry) => entry.id !== userId))
        setActionDismissed(false)
        runAction(
          result.action,
          navigationToast(result, t.voiceOpened(localizedActionLabel(result.action ?? {
            kind: 'open_tab', tab: 'study', label: t.navStudy,
          }, t))),
          Boolean(options.spoken),
        )
        return
      }
      setConversation((current) => [...current, { id: replyId, role: 'agent', text: result.reply, answer: result }])
      setActionDismissed(false)
      // Only a real conversation opens the chat panel.
      onViewChange('ask')
      // Only read aloud what the learner asked for out loud, and only while
      // unmuted. The reply bubble types itself out as the voice advances.
      if (shouldReadAloud(mutedRef.current, Boolean(options.spoken))) {
        setReveal({ id: replyId, chars: 0 })
        const started = speak(result.reply, (chars) => setReveal({ id: replyId, chars }))
        if (!started) setReveal(null)
      } else {
        setReveal(null)
      }
    } catch {
      if (request.signal.aborted) return
      showToast(t.buddyErrorGeneric, true)
    } finally {
      if (pending.current === request) {
        pending.current = null
        setPhase('idle')
      }
    }
  }, [activeTab, onViewChange, speak, stopSpeech, t])

  // The dictation instance lives for the whole session, so its callbacks read the
  // newest handlers through refs instead of the values captured on the first render
  // (otherwise muting after the first dictation has no effect on voice replies).
  const sendRef = useRef(send)
  const tRef = useRef(t)
  useEffect(() => {
    sendRef.current = send
    tRef.current = t
    reportVoiceErrorRef.current = reportVoiceError
  }, [send, t, reportVoiceError])

  const cancelWork = useCallback(() => {
    capture.current = null
    pending.current?.abort()
    pending.current = null
    dictation.current?.cancel()
    recorder.current?.cancel()
    heardRef.current = ''
    stopSpeech()
  }, [stopSpeech])

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
                reportVoiceErrorRef.current(tRef.current.voiceNoSpeech)
              }
            })
            .catch((error: unknown) => {
              if (request.signal.aborted) return
              pending.current = null
              setPhase('idle')
              const code = (error as Error & { code?: string }).code
              reportVoiceErrorRef.current(
                code === 'NO_SPEECH' ? tRef.current.voiceNoSpeech : tRef.current.voiceServiceError,
              )
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
          if (kind === 'denied' || kind === 'unsupported') setSpeechAvailable(false)
          reportVoiceErrorRef.current(
            kind === 'denied' ? tRef.current.voiceDenied
              : kind === 'unsupported' ? tRef.current.voiceUnsupported
                : tRef.current.voiceError,
          )
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
    stopSpeech()
    setHasUsedVoice(true)
    try { localStorage.setItem('engorace_voice_used', '1') } catch { /* storage may be unavailable */ }
    setHeard('')
    heardRef.current = ''
    setAskError(null)
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
          if (kind === 'denied' || kind === 'unsupported') setSpeechAvailable(false)
          // The reason is readable for four seconds on the dock; no panel.
          reportVoiceErrorRef.current(
            kind === 'denied' ? t.voiceDenied
              : kind === 'no-speech' ? t.voiceNoSpeech
                : kind === 'unsupported' ? t.voiceUnsupported
                  : kind === 'network' ? t.voiceNetwork
                    : t.voiceError,
          )
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
      setSpeechAvailable(false)
      reportVoiceError(t.voiceUnsupported)
      return
    }
    // The mic opens over the page, not behind a panel: tapping the orb is the
    // whole interaction. The panel only appears if the coach has something to say.
    setPhase('listening')
    capture.current = 'browser'
    dictation.current.start()
  }, [beginBackendListening, engine, phase, stopSpeech, t])

  const closePanel = useCallback(() => {
    cancelWork()
    setPhase('idle')
    setHeard('')
    onViewChange(null)
  }, [cancelWork, onViewChange])

  // Closing the panel by any path (nudge, navigation, the X button) must also
  // drop the mic and any answer still in flight.
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
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
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
    if (view !== 'ask' || speechAvailable) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 120)
    return () => window.clearTimeout(id)
  }, [view, speechAvailable])

  // Follow the conversation while it grows, unless the learner scrolled up to
  // reread something.
  useEffect(() => {
    if (view !== 'ask') return
    const node = chatBodyRef.current
    if (!node) return
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight
    if (distance < 120) node.scrollTop = node.scrollHeight
  }, [view, conversation, phase, reveal])

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

  function runAction(action: BuddyAnswer['action'], toastText?: string, announce = false) {
    if (!action && !toastText) return
    const line = toastText ?? (action ? t.voiceOpened(localizedActionLabel(action, t)) : '')
    if (line) showToast(line)
    if (announce && line && !mutedRef.current) speak(line)
    if (!action) {
      onViewChange(null)
      return
    }
    if (action.kind === 'open_review') {
      onViewChange(null)
      onOpenReview()
      return
    }
    goTo({ tab: action.tab, lessonId: action.lessonId, videoId: action.videoId, highlight: action.highlight })
  }

  const showNotificationCta = notificationState() === 'default' && !notificationPromptDismissed
  const latestAnswer = useMemo(() => {
    for (let index = conversation.length - 1; index >= 0; index -= 1) {
      const entry = conversation[index]
      if (entry.role === 'agent') return entry.answer
    }
    return null
  }, [conversation])
  const latestIsAgent = conversation[conversation.length - 1]?.role === 'agent'
  const pendingAction = latestIsAgent && phase === 'idle' ? latestAnswer?.action ?? null : null
  const pendingSuggestion = latestIsAgent && phase === 'idle' ? latestAnswer?.suggestion ?? null : null
  // The dock only announces state while the panel is closed. Chat messages live
  // in the conversation, never in a floating bubble over the page.
  const dockStatus = phase === 'listening'
    ? (heard || t.voiceListening)
    : phase === 'thinking'
      ? t.voiceThinking
      : confirmation || askError || null
  const showDockHint = Boolean(dockStatus) || !hasUsedVoice

  return (
    <>
      {!view && (
        <div className={`voice-dock${dueNudges.length > 0 ? ' has-alert' : ''}`}>
          <div className="voice-dock-row">
            <button
              type="button"
              className={`voice-orb is-${!speechAvailable || askError ? 'muted' : isSpeaking ? 'speaking' : phase}`}
              onClick={() => {
                if (isSpeaking) {
                  stopSpeech()
                  return
                }
                if (!speechAvailable) {
                  onViewChange('ask')
                  return
                }
                if (phase === 'listening') stopListening()
                else if (phase === 'idle') beginListening()
              }}
              aria-label={!speechAvailable ? t.voiceAskByText : isSpeaking ? t.voiceInterrupt : phase === 'listening' ? t.voiceTapToStop : t.voiceOpen}
              data-voice-orb="true"
            >
              <span className="voice-orb-halo" aria-hidden="true" />
              <span className="voice-orb-core">
                {isSpeaking
                  ? <SpeakerSlash size={25} weight="bold" />
                  : !speechAvailable || askError
                    ? <MicrophoneSlash size={30} weight="bold" />
                    : phase === 'thinking'
                      ? <span className="voice-thinking-dots" aria-hidden="true"><i /><i /><i /></span>
                      : <AudioBars meter={meter} active={phase === 'listening'} size={32} />}
              </span>
              {dueNudges.length > 0 && <span className="voice-orb-dot" aria-hidden="true" />}
            </button>

          </div>

          {showDockHint && (
            <p className={`voice-dock-hint${phase === 'thinking' ? ' is-thinking' : ''}`} role="status" aria-live="polite">
              {dockStatus ?? (speechAvailable ? t.voiceHint : t.voiceAskByText)}
            </p>
          )}
        </div>
      )}

      {view && (
        <div className="voice-panel" role="dialog" aria-label={t.voiceAgentName}>
          <header className="voice-panel-head">
            <div className="voice-panel-identity">
              <strong>{t.voiceAgentName}</strong>
              <small className="voice-agent-status"><i aria-hidden="true" />{t.voiceAgentStatus}</small>
            </div>
            <button type="button" className="buddy-icon-btn voice-panel-close" onClick={closePanel} aria-label={t.buddyClose}>
              <X size={16} weight="bold" />
            </button>
          </header>

          {view === 'ask' && (
            <>
              <div className="voice-panel-body voice-chat-body" ref={chatBodyRef}>
                {conversation.length === 0 && phase === 'idle' && (
                  <div className="voice-agent-line">
                    <p className="voice-chat-bubble is-agent">{lang === 'vi' ? feed?.greeting ?? t.voiceGreeting : t.voiceGreeting}</p>
                  </div>
                )}

                {conversation.map((entry) => entry.role === 'user' ? (
                  <p key={entry.id} className="voice-chat-bubble is-user">{entry.text}</p>
                ) : (
                  <div key={entry.id} className="voice-agent-line">
                    <p className="voice-chat-bubble is-agent">
                      {reveal?.id === entry.id ? entry.text.slice(0, reveal.chars) : entry.text}
                      {reveal?.id === entry.id && reveal.chars < entry.text.length && (
                        <span className="voice-type-caret" aria-hidden="true" />
                      )}
                    </p>
                  </div>
                ))}

                {phase === 'listening' && (
                  <p className="voice-chat-bubble is-live" role="status" aria-live="polite">
                    {heard || t.voiceListening}
                  </p>
                )}
                {phase === 'thinking' && (
                  <div className="voice-agent-line">
                    <p className="voice-chat-bubble is-agent is-thinking">
                      {t.voiceThinking}
                      <span className="voice-thinking-dots" aria-hidden="true"><i /><i /><i /></span>
                    </p>
                  </div>
                )}
                {askError && <p className="buddy-inline-error">{askError}</p>}

                {pendingAction && !actionDismissed && (
                  <div className="buddy-action-confirmation voice-action-card">
                    <i className="voice-action-icon" aria-hidden="true">{pendingAction.lessonTitle?.match(/\d+/)?.[0] ?? pendingAction.videoId ?? '↗'}</i>
                    <div className="voice-action-copy">
                      <strong>{localizedActionLabel(pendingAction, t)}</strong>
                      <span>{pendingAction.kind === 'open_lesson' ? t.voiceActionStudy : pendingAction.kind === 'open_video' ? t.voiceActionVideo : pendingAction.kind === 'open_review' ? t.voiceActionReview : pendingAction.kind === 'open_notebook' ? t.buddyActionOpenNotebook : pendingAction.tab ? t[TAB_LABEL_KEYS[pendingAction.tab]] : t.voiceAgentName}</span>
                    </div>
                    <button type="button" className="buddy-solid-btn" onClick={() => runAction(pendingAction)}>
                      {t.voiceActionOpen}
                      <ArrowRight size={13} weight="bold" aria-hidden="true" />
                    </button>
                    <button type="button" className="buddy-text-btn" onClick={() => setActionDismissed(true)}>
                      {t.buddyActionCancel}
                    </button>
                  </div>
                )}

                {pendingSuggestion && !reminderAccepted && (
                  <div className="buddy-reminder-offer">
                    <span>
                      <Clock size={13} weight="bold" />
                      {pendingSuggestion.at_time
                        ? `${t.buddyReminderAt} ${pendingSuggestion.at_time}`
                        : `${t.buddyReminderIn} ${pendingSuggestion.in_minutes} ${t.buddyMinutesShort}`}
                    </span>
                    <strong>{pendingSuggestion.title}</strong>
                    <button
                      type="button"
                      className="buddy-solid-btn"
                      onClick={() => void acceptSuggestion(pendingSuggestion)}
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
              </div>

              <div className="voice-composer">
                {speechAvailable ? (
                  <button
                    type="button"
                    className={`voice-talk-btn${phase === 'listening' ? ' is-live' : ''}${isSpeaking ? ' is-speaking' : ''}`}
                    onClick={() => {
                      if (isSpeaking) {
                        stopSpeech()
                        return
                      }
                      if (phase === 'listening') stopListening()
                      else if (phase === 'idle') beginListening()
                    }}
                    disabled={phase === 'thinking'}
                    aria-label={phase === 'thinking' ? t.voiceThinking : phase === 'listening' ? t.voiceTapToStop : isSpeaking ? t.voiceInterrupt : t.voiceOpen}
                  >
                    <span className="voice-talk-icon" aria-hidden="true">
                      {phase === 'thinking'
                        ? <span className="voice-thinking-dots"><i /><i /><i /></span>
                        : phase === 'listening'
                          ? <AudioBars meter={meter} active size={20} />
                          : isSpeaking
                            ? <SpeakerSlash size={20} weight="bold" />
                            : <Microphone size={20} weight="bold" />}
                    </span>
                    <span>
                      {phase === 'thinking' ? t.voiceThinking : phase === 'listening' ? t.voiceListening : isSpeaking ? t.voiceInterrupt : t.voiceHint}
                    </span>
                  </button>
                ) : (
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
                      type="submit"
                      className="buddy-send-btn"
                      disabled={phase !== 'idle' || !question.trim()}
                      aria-label={t.voiceSend}
                    >
                      <PaperPlaneTilt size={15} weight="fill" />
                    </button>
                  </form>
                )}
              </div>
            </>
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
                  {speechAvailable ? <Microphone size={14} weight="bold" /> : <Sparkle size={14} weight="fill" />}
                  {speechAvailable ? t.voiceOpen : t.voiceAskByText}
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
