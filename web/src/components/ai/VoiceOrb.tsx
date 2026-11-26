import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowRight,
  BellRinging,
  CheckCircle,
  Clock,
  Keyboard,
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
  startBuddyVoiceSession,
} from '../../services/buddyService'
import type {
  BuddyAnswer,
  BuddyIntent,
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
import { speakText } from '../../utils/speech'
import { createRecorder, type Recorder } from './recorder'
import { streamBuddyAudio, type BuddyVoiceToken } from './buddyStreaming'
import { getSpeechStatusApi, transcribeAudioApi } from '../../services/speechService'
import {
  phaseAfterCommand,
  phaseAfterEnd,
  shouldReadAloud,
  type VoicePhase,
} from './voiceFlow'
import { routeVoiceCommand } from './voiceCommands'
import type { BuddyDockPosition } from './buddyDockSettings'
import { useBuddyDockDrag } from './useBuddyDockDrag'

export type BuddyView = 'home' | 'ask' | 'reminders' | null

interface VoiceOrbProps {
  activeTab: string
  view: BuddyView
  enabled: boolean
  position: BuddyDockPosition | null
  onPositionChange: (position: BuddyDockPosition) => void
  onViewChange: (view: BuddyView) => void
  /** Navigate somewhere in the app, optionally circling an element there. */
  onNavigate: (target: BuddyTarget) => void
  /** Review is the profile's button, so a spoken "ôn tập" opens that session. */
  onOpenReview: () => void
}

type ChatEntry =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'agent'; text: string; answer: BuddyAnswer }

type BuddyTiming = { started: number; path: 'typed' | 'streaming' | 'recorded' | 'recorded-fallback' }

function measureBuddy(stage: string, timing: BuddyTiming, start = timing.started) {
  performance.measure(`buddy.${stage}`, { start, detail: { path: timing.path } })
}

const TAB_LABEL_KEYS: Record<BuddyTarget['tab'] & string, 'navStudy' | 'navVideos' | 'navTranslate' | 'navCompete' | 'navRankings' | 'navShop' | 'navProfile'> = {
  study: 'navStudy',
  videos: 'navVideos',
  translate: 'navTranslate',
  compete: 'navCompete',
  rankings: 'navRankings',
  shop: 'navShop',
  profile: 'navProfile',
}

function isBuddyMuted(): boolean {
  try {
    return localStorage.getItem('engorace_voice_muted') === '1'
  } catch {
    return false
  }
}

function localizedActionLabel(
  action: NonNullable<BuddyAnswer['action']>,
  t: ReturnType<typeof useI18n>['t'],
): string {
  if (action.kind === 'open_video') return t.buddyActionOpenVideo(action.videoTitle ?? '')
  if (action.kind === 'open_lesson') {
    return action.mode === 'reveal'
      ? t.buddyActionRevealLesson(action.lessonTitle ?? '')
      : t.buddyActionOpenLesson(action.lessonTitle ?? '')
  }
  if (action.kind === 'show_shop_item' || action.kind === 'spotlight') return action.label
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
export function VoiceOrb({ activeTab, view, enabled, position, onPositionChange, onViewChange, onNavigate, onOpenReview }: VoiceOrbProps) {
  const { t, lang } = useI18n()
  const { areaRef, dockRef, handlers: dragHandlers, shouldSuppressClick } = useBuddyDockDrag(position, onPositionChange)
  const speechPlayback = useRef<AbortController | null>(null)
  const [feed, setFeed] = useState<BuddyFeed | null>(null)
  const [reminders, setReminders] = useState<StudyReminder[]>([])
  const [feedError, setFeedError] = useState(false)
  const [dismissedNudges, setDismissedNudges] = useState<string[]>([])

  const [phase, setPhase] = useState<VoicePhase>('idle')
  const [heard, setHeard] = useState('')
  const [question, setQuestion] = useState('')
  const [askError, setAskError] = useState<string | null>(null)
  const [conversation, setConversation] = useState<ChatEntry[]>([])
  const [confirmation, setConfirmation] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechAvailable, setSpeechAvailable] = useState(false)
  const [hasUsedVoice, setHasUsedVoice] = useState(() => {
    try { return localStorage.getItem('engorace_voice_used') === '1' } catch { return false }
  })
  const [reminderAccepted, setReminderAccepted] = useState(false)
  const [notificationPromptDismissed, setNotificationPromptDismissed] = useState(false)

  const recorder = useRef<Recorder | null>(null)
  const streamingEnabled = useRef(false)
  const voiceToken = useRef<(BuddyVoiceToken & { expiresAt: number }) | null>(null)
  const liveSpeech = useRef<ReturnType<typeof streamBuddyAudio>>(null)
  const stoppedAt = useRef<number | null>(null)
  const pendingPaint = useRef<{ id: number; timing: BuddyTiming } | null>(null)
  const capture = useRef<'backend' | null>(null)
  const pending = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const chatBodyRef = useRef<HTMLDivElement | null>(null)
  const messageId = useRef(0)
  const meter = useMemo(() => createMicMeter(5), [])

  // A short, self-closing line on the dock. Navigation uses it instead of
  // opening the chat panel; it disappears five seconds after the conversation ends.
  const showToast = useCallback((text: string, isError = false) => {
    setConfirmation(text)
    setAskError(isError ? text : null)
  }, [])

  const reportVoiceError = useCallback((text: string) => showToast(text, true), [showToast])
  const reportVoiceErrorRef = useRef(reportVoiceError)
  const prepareVoiceToken = useCallback(() => {
    if (!enabled || !streamingEnabled.current || typeof AudioContext === 'undefined' || typeof AudioWorkletNode === 'undefined') return
    if (voiceToken.current && performance.now() < voiceToken.current.expiresAt) return
    voiceToken.current?.request.abort()
    const request = new AbortController()
    const token = startBuddyVoiceSession(AbortSignal.any([request.signal, AbortSignal.timeout(2_500)]))
      .then((session) => session.token)
      .catch(() => null)
    voiceToken.current = { token, expiresAt: performance.now() + 110_000, request }
    void token.then((value) => {
      if (!value && voiceToken.current?.token === token) voiceToken.current = null
    })
  }, [enabled])

  const load = useCallback(async () => {
    try {
      const [nextFeed, nextReminders] = await Promise.all([enabled ? getBuddyFeedApi() : null, listRemindersApi()])
      if (nextFeed) setFeed(nextFeed)
      setReminders(nextReminders)
      setFeedError(false)
      for (const reminder of nextReminders) {
        if (reminder.is_due && !reminder.delivered_at) showReminderNotification(reminder)
      }
    } catch {
      setFeedError(true)
    }
  }, [enabled])

  useEffect(() => {
    // Deferred so the first paint is not blocked by the request.
    const id = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(id)
  }, [load])

  // The server reports whether AssemblyAI is configured. Every voice turn is
  // recorded and posted; without the backend the panel swaps the mic for a
  // text field instead of falling back to a browser speech vendor.
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    getSpeechStatusApi()
      .then((status) => {
        if (cancelled) return
        setSpeechAvailable(status.backend)
        streamingEnabled.current = status.buddyStreaming === true
        prepareVoiceToken()
      })
      .catch(() => {
        if (!cancelled) setSpeechAvailable(false)
      })
    return () => { cancelled = true }
  }, [enabled, prepareVoiceToken])

  useEffect(() => {
    if (phase === 'idle') prepareVoiceToken()
  }, [phase, prepareVoiceToken])

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

  const stopSpeech = useCallback(() => {
    speechPlayback.current?.abort()
    speechPlayback.current = null
    setIsSpeaking(false)
  }, [])

  const speak = useCallback((text: string, replyLanguage = lang, timing?: BuddyTiming) => {
    speechPlayback.current?.abort()
    const playback = new AbortController()
    const started = speakText(text, replyLanguage, {
      signal: playback.signal,
      onStart: timing ? () => measureBuddy('audio-ready', timing) : undefined,
      onEnd: () => {
        speechPlayback.current = null
        setIsSpeaking(false)
      },
      browserFallback: false,
    })
    speechPlayback.current = started ? playback : null
    setIsSpeaking(started)
  }, [lang])

  const goTo = useCallback((target: BuddyTarget) => {
    onNavigate(target)
    onViewChange(null)
  }, [onNavigate, onViewChange])

  const runAction = useCallback((action: BuddyAnswer['action'], toastText?: string, announce = false, replyLanguage = lang) => {
    if (!action && !toastText) return
    const line = toastText ?? (action ? t.voiceOpened(localizedActionLabel(action, t)) : '')
    if (line) showToast(line)
    if (announce && line && !isBuddyMuted()) speak(line, replyLanguage)
    if (!action) {
      onViewChange(null)
      return
    }
    if (action.kind === 'open_review') {
      onViewChange(null)
      onOpenReview()
      return
    }
    goTo({ tab: action.tab, lessonId: action.lessonId, lessonTitle: action.lessonTitle, mode: action.mode, videoId: action.videoId, highlight: action.highlight })
  }, [goTo, lang, onOpenReview, onViewChange, showToast, speak, t])

  const send = useCallback(async (
    text: string,
    intent: BuddyIntent = 'chat',
    options: { spoken?: boolean; timing?: BuddyTiming } = {},
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
      if (command.kind === 'review') {
        const action: NonNullable<BuddyAnswer['action']> = { kind: 'open_review', tab: 'profile', label: t.navReview }
        runAction(action, t.voiceOpened(t.navReview), Boolean(options.spoken))
        return
      }
      const label = t[TAB_LABEL_KEYS[command.tab]]
      const action: NonNullable<BuddyAnswer['action']> = {
        kind: 'open_tab', tab: command.tab, label,
        ...(command.tab === 'shop' ? { highlight: 'control:shop-catalog' } : {}),
      }
      runAction(action, t.voiceOpened(label), Boolean(options.spoken))
      return
    }

    setPhase('thinking')
    setAskError(null)
    setHasUsedVoice(true)
    try { localStorage.setItem('engorace_voice_used', '1') } catch { /* storage may be unavailable */ }
    setReminderAccepted(false)
    setQuestion('')
    const userId = (messageId.current += 1)
    const replyId = (messageId.current += 1)
    setConversation((current) => [...current, { id: userId, role: 'user', text: trimmed }])
    const request = new AbortController()
    pending.current = request
    const context: BuddyContext = {
      ...detectLivePageContext(activeTab as BuddyContext['tab']),
      tab: activeTab as BuddyContext['tab'],
    }
    const requestStarted = performance.now()
    const timing: BuddyTiming = options.timing ?? { started: requestStarted, path: 'typed' }
    try {
      const result = await askBuddyApi(trimmed, context, intent, request.signal)
      if (request.signal.aborted) return
      measureBuddy('answer-api', timing, requestStarted)
      if (isNavigationAnswer(result)) {
        // The backend found a destination, so switch screens and show a toast.
        setConversation((current) => current.filter((entry) => entry.id !== userId))
        runAction(
          result.action,
          navigationToast(result, t.voiceOpened(localizedActionLabel(result.action ?? {
            kind: 'open_tab', tab: 'study', label: t.navStudy,
          }, t))),
          Boolean(options.spoken),
          result.language,
        )
        return
      }
      pendingPaint.current = { id: replyId, timing }
      setConversation((current) => [...current, { id: replyId, role: 'agent', text: result.reply, answer: result }])
      onViewChange('ask')
      if (shouldReadAloud(isBuddyMuted(), Boolean(options.spoken))) {
        speak(result.reply, result.language, timing)
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
  }, [activeTab, onViewChange, runAction, showToast, speak, stopSpeech, t])

  // The recorder lives for the whole session, so its callbacks read the newest
  // handlers through refs instead of the values captured on the first render
  // (otherwise muting after the first recording has no effect on voice replies).
  const sendRef = useRef(send)
  const tRef = useRef(t)
  const langRef = useRef(lang)
  useEffect(() => {
    sendRef.current = send
    tRef.current = t
    langRef.current = lang
    reportVoiceErrorRef.current = reportVoiceError
  }, [send, t, reportVoiceError, lang])

  const cancelWork = useCallback(() => {
    capture.current = null
    pending.current?.abort()
    pending.current = null
    recorder.current?.cancel()
    liveSpeech.current?.cancel()
    liveSpeech.current = null
    stoppedAt.current = null
    pendingPaint.current = null
    stopSpeech()
  }, [stopSpeech])

  useEffect(() => () => {
    voiceToken.current?.request.abort()
    voiceToken.current = null
    pending.current?.abort()
    recorder.current?.cancel()
    liveSpeech.current?.cancel()
    speechPlayback.current?.abort()
  }, [])

  const stopListening = useCallback(() => {
    if (capture.current !== 'backend') return
    stoppedAt.current ??= performance.now()
    recorder.current?.stop()
  }, [])

  /** Records one clip and sends it to the backend transcription service. */
  const beginBackendListening = useCallback(() => {
    if (!recorder.current) {
      recorder.current = createRecorder({
        onStream: (stream) => {
          liveSpeech.current?.attach(stream)
          meter.attach(stream)
        },
        onClip: (clip) => {
          if (capture.current !== 'backend') return
          capture.current = null
          const request = new AbortController()
          pending.current = request
          setPhase('thinking')
          const started = stoppedAt.current ?? performance.now()
          stoppedAt.current = null
          const transcribe = async (): Promise<{ text: string; timing: BuddyTiming }> => {
            const session = liveSpeech.current
            const streamed = await session?.finish()
            if (request.signal.aborted) return { text: '', timing: { started, path: 'recorded' } }
            liveSpeech.current = null
            if (streamed) return { text: streamed, timing: { started, path: 'streaming' } }
            const transcript = await transcribeAudioApi(clip, request.signal, langRef.current)
            return { text: transcript.text?.trim() ?? '', timing: { started, path: session ? 'recorded-fallback' : 'recorded' } }
          }
          void transcribe()
            .then(({ text, timing }) => {
              if (request.signal.aborted) return
              pending.current = null
              measureBuddy('transcript-ready', timing)
              if (text) {
                setHeard(text)
                void sendRef.current(text, 'chat', { spoken: true, timing })
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
          liveSpeech.current?.cancel()
          liveSpeech.current = null
          stoppedAt.current = null
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
    prepareVoiceToken()
    const session = voiceToken.current
    voiceToken.current = null
    if (session) {
      liveSpeech.current = streamBuddyAudio(session)
      if (!liveSpeech.current) session.request.abort()
    }
    setPhase('listening')
    recorder.current.start()
    return true
  }, [meter, prepareVoiceToken])

  const beginListening = useCallback(() => {
    if (phase !== 'idle' || capture.current || pending.current) return
    stopSpeech()
    setHasUsedVoice(true)
    try { localStorage.setItem('engorace_voice_used', '1') } catch { /* storage may be unavailable */ }
    setHeard('')
    setAskError(null)
    if (beginBackendListening()) return
    setSpeechAvailable(false)
    reportVoiceError(t.voiceUnsupported)
  }, [beginBackendListening, phase, reportVoiceError, stopSpeech, t])

  const closePanel = useCallback(() => {
    cancelWork()
    setPhase('idle')
    setHeard('')
    onViewChange(null)
  }, [cancelWork, onViewChange])

  useEffect(() => {
    if (enabled) return
    voiceToken.current?.request.abort()
    voiceToken.current = null
    streamingEnabled.current = false
    const id = window.setTimeout(() => {
      cancelWork()
      setPhase('idle')
      setHeard('')
      setConfirmation('')
      setAskError(null)
    }, 0)
    return () => window.clearTimeout(id)
  }, [enabled, cancelWork])

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
    }
  }, [cancelWork, meter])

  const conversationIdle = phase === 'idle' && !isSpeaking
  const hasDockLine = Boolean(confirmation || askError)
  useEffect(() => {
    if (!conversationIdle || !hasDockLine) return
    const id = window.setTimeout(() => {
      setConfirmation('')
      setAskError(null)
    }, 5000)
    return () => window.clearTimeout(id)
  }, [conversationIdle, hasDockLine, confirmation, askError])

  // The recorder hands its stream to the meter; release the audio graph when
  // the phase leaves "listening".
  useEffect(() => {
    if (phase !== 'listening') meter.stop()
  }, [phase, meter])

  useEffect(() => {
    if (view !== 'ask') return
    const id = window.setTimeout(() => inputRef.current?.focus(), 120)
    return () => window.clearTimeout(id)
  }, [view])

  useEffect(() => {
    const reply = pendingPaint.current
    if (view !== 'ask' || !reply || conversation.at(-1)?.id !== reply.id) return
    pendingPaint.current = null
    measureBuddy('text-ready', reply.timing)
  }, [conversation, view])

  // Follow the conversation while it grows, unless the learner scrolled up to
  // reread something.
  useEffect(() => {
    if (view !== 'ask') return
    const node = chatBodyRef.current
    if (!node) return
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight
    if (distance < 120) node.scrollTop = node.scrollHeight
  }, [view, conversation, phase])

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

  const showNotificationCta = notificationState() === 'default' && !notificationPromptDismissed
  const latestAnswer = useMemo(() => {
    for (let index = conversation.length - 1; index >= 0; index -= 1) {
      const entry = conversation[index]
      if (entry.role === 'agent') return entry.answer
    }
    return null
  }, [conversation])
  const latestIsAgent = conversation[conversation.length - 1]?.role === 'agent'
  const pendingSuggestion = latestIsAgent && phase === 'idle' ? latestAnswer?.suggestion ?? null : null
  // The dock only announces state while the panel is closed. Chat messages live
  // in the conversation, never in a floating bubble over the page.
  const dockStatus = phase === 'listening'
    ? (heard || t.voiceListening)
    : phase === 'thinking'
      ? t.voiceThinking
      : confirmation || askError || null
  const showDockHint = Boolean(dockStatus) || !hasUsedVoice
  if (!enabled) return null

  return (
    <>
      {!view && (
        <div
          ref={areaRef}
          className="voice-dock-area"
          data-positioned={position !== null}
          data-upper={position !== null && position.y < 0.4}
          data-caption-align={position && position.x < 0.2 ? 'start' : position && position.x > 0.8 ? 'end' : undefined}
          style={position ? { '--dock-x': position.x, '--dock-y': position.y } as CSSProperties : undefined}
        >
          <div ref={dockRef} className="voice-dock voice-dock-row">
            <button
              type="button"
              className={`voice-orb is-${!speechAvailable || askError ? 'muted' : isSpeaking ? 'speaking' : phase}`}
              {...dragHandlers}
              onPointerEnter={prepareVoiceToken}
              onFocus={prepareVoiceToken}
              onClick={(event) => {
                if (shouldSuppressClick(event.detail)) return
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
              aria-description={t.buddyDockMoveHint}
              data-voice-orb="true"
            >
              <span className="voice-orb-halo" aria-hidden="true" />
              <span className="voice-orb-core">
                {isSpeaking
                  ? <SpeakerSlash size={25} weight="bold" />
                  : !speechAvailable || askError
                    ? <MicrophoneSlash size={30} weight="bold" />
                    : phase === 'thinking'
                      ? <Microphone size={25} weight="bold" aria-hidden="true" />
                      : <AudioBars meter={meter} active={phase === 'listening'} size={32} />}
              </span>
              {dueNudges.length > 0 && <span className="voice-orb-dot" aria-hidden="true" />}
            </button>
            {speechAvailable && (
              <button type="button" className="buddy-icon-btn voice-type-trigger"
                onClick={() => onViewChange('ask')} disabled={phase !== 'idle'}
                aria-label={t.voiceAskByText} title={t.voiceAskByText}>
                <Keyboard size={20} weight="bold" aria-hidden="true" />
              </button>
            )}
          </div>

          {showDockHint && (
            <div className="voice-dock-caption">
              <p className="voice-dock-hint" role="status" aria-live="polite">
                {dockStatus ?? (speechAvailable ? t.voiceHint : t.voiceAskByText)}
              </p>
            </div>
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
                    <p className="voice-chat-bubble is-agent">{entry.text}</p>
                  </div>
                ))}

                {phase === 'listening' && (
                  <p className="voice-chat-bubble is-live" role="status" aria-live="polite">
                    {heard || t.voiceListening}
                  </p>
                )}
                {phase === 'thinking' && (
                  <div className="voice-agent-line">
                    <p className="voice-chat-bubble is-agent" role="status">
                      {t.voiceThinking}
                    </p>
                  </div>
                )}
                {askError && <p className="buddy-inline-error">{askError}</p>}

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
                    onPointerEnter={prepareVoiceToken}
                    onFocus={prepareVoiceToken}
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
                    {phase !== 'thinking' && <span className="voice-talk-icon" aria-hidden="true">
                      {phase === 'listening'
                          ? <AudioBars meter={meter} active size={20} />
                          : isSpeaking
                            ? <SpeakerSlash size={20} weight="bold" />
                            : <Microphone size={20} weight="bold" />}
                    </span>}
                    <span>
                      {phase === 'thinking' ? t.voiceThinking : phase === 'listening' ? t.voiceListening : isSpeaking ? t.voiceInterrupt : t.voiceHint}
                    </span>
                  </button>
                ) : null}
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
