import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import '@fontsource-variable/baloo-2'
import {
  ArrowRight,
  ArrowUp,
  BellRinging,
  BookOpen,
  Check,
  CheckCircle,
  Clock,
  Keyboard,
  Microphone,
  Sparkle,
  Stop,
  Trash,
  X,
} from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import { TurboMascot } from '../cosmetics/TurboMascot'
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
import { VoiceIcon, type VoiceState } from './VoiceIcon'
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
  onNavigate: (target: BuddyTarget, keepChatOpen?: boolean) => boolean
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

/** Docked voice and text access to Bác Turbo. */
export function VoiceOrb({ activeTab, view, enabled, position, onPositionChange, onViewChange, onNavigate, onOpenReview }: VoiceOrbProps) {
  const { t, lang } = useI18n()
  const dockVisible = enabled && (!view || view === 'ask')
  const { areaRef, dockRef, handlers: dragHandlers, shouldSuppressClick } = useBuddyDockDrag(position, onPositionChange)
  const speechPlayback = useRef<AbortController | null>(null)
  const [feed, setFeed] = useState<BuddyFeed | null>(null)
  const [reminders, setReminders] = useState<StudyReminder[]>([])
  const [feedError, setFeedError] = useState(false)
  const [dismissedNudges, setDismissedNudges] = useState<string[]>([])

  const [phase, setPhase] = useState<VoicePhase>('idle')
  const [heard, setHeard] = useState('')
  const [question, setQuestion] = useState('')
  const [draft, setDraft] = useState('')
  const [askError, setAskError] = useState<string | null>(null)
  const [conversation, setConversation] = useState<ChatEntry[]>([])
  const [confirmation, setConfirmation] = useState('')
  const [playbackState, setPlaybackState] = useState<'idle' | 'loading' | 'playing'>('idle')
  const hasPlayback = playbackState !== 'idle'
  const [speechAvailable, setSpeechAvailable] = useState<boolean | null>(null)
  const [micDenied, setMicDenied] = useState(false)
  const voiceReady = speechAvailable && !micDenied
  const [typing, setTyping] = useState(false)
  const streamingReply = phase === 'thinking' && Boolean(draft)
  const [reminderAccepted, setReminderAccepted] = useState(false)
  const [notificationPromptDismissed, setNotificationPromptDismissed] = useState(false)

  const recorder = useRef<Recorder | null>(null)
  const streamingEnabled = useRef(false)
  const voiceToken = useRef<(BuddyVoiceToken & { expiresAt: number }) | null>(null)
  const liveSpeech = useRef<ReturnType<typeof streamBuddyAudio>>(null)
  const stoppedAt = useRef<number | null>(null)
  const pendingPaint = useRef<{ id: number; timing: BuddyTiming; firstText: boolean } | null>(null)
  const capture = useRef<'backend' | null>(null)
  const pending = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const orbRef = useRef<HTMLButtonElement | null>(null)
  const typingTriggerRef = useRef<HTMLButtonElement | null>(null)
  const chatBodyRef = useRef<HTMLDivElement | null>(null)
  const followChat = useRef(true)
  const cardTitleId = useId()
  const messageId = useRef(0)
  const meter = useMemo(() => createMicMeter(), [])

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
    const token = startBuddyVoiceSession(AbortSignal.any([request.signal, AbortSignal.timeout(4_500)]))
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

  // The server reports whether AssemblyAI is configured for streaming and clip upload.
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    getSpeechStatusApi()
      .then((status) => {
        if (cancelled) return
        setSpeechAvailable(status.backend && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined')
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
    meter.stop()
    setPlaybackState('idle')
  }, [meter])

  const speak = useCallback((text: string, replyLanguage = lang, timing?: BuddyTiming) => {
    speechPlayback.current?.abort()
    // Text questions can reach speech without the microphone having prepared the graph.
    meter.prepare()
    const playback = new AbortController()
    const reset = () => {
      if (speechPlayback.current !== playback) return
      speechPlayback.current = null
      meter.stop()
      setPlaybackState('idle')
    }
    const started = speakText(text, replyLanguage, {
      signal: playback.signal,
      onStart: timing ? () => measureBuddy('audio-ready', timing) : undefined,
      onPlayback: (player) => {
        if (speechPlayback.current !== playback) return
        if (player) meter.attachPlayback(player)
        else meter.stop()
        setPlaybackState(player ? 'playing' : 'loading')
      },
      onEnd: reset,
      onStop: reset,
    })
    speechPlayback.current = started ? playback : null
    setPlaybackState(started ? 'loading' : 'idle')
  }, [lang, meter])

  const goTo = useCallback((target: BuddyTarget, keepChatOpen = false) => {
    const opened = onNavigate(target, keepChatOpen)
    if (opened && !keepChatOpen) onViewChange(null)
    return opened
  }, [onNavigate, onViewChange])

  const runAction = useCallback((action: BuddyAnswer['action'], toastText?: string, announce = false, replyLanguage = lang, keepChatOpen = false) => {
    if (!action) return false
    if (action.kind === 'open_review') {
      if (!keepChatOpen) onViewChange(null)
      onOpenReview()
    } else if (!goTo({
      tab: action.tab, lessonId: action.lessonId, lessonTitle: action.lessonTitle,
      mode: action.mode, videoId: action.videoId, highlight: action.highlight,
    }, keepChatOpen)) {
      return false
    }
    const line = toastText ?? t.voiceOpened(localizedActionLabel(action, t))
    if (!keepChatOpen) showToast(line)
    if (announce && line && !isBuddyMuted()) speak(line, replyLanguage)
    return true
  }, [goTo, lang, onOpenReview, onViewChange, showToast, speak, t])

  const send = useCallback(async (
    text: string,
    intent: BuddyIntent = 'chat',
    options: { spoken?: boolean; timing?: BuddyTiming } = {},
  ) => {
    const trimmed = text.trim()
    if (!trimmed || pending.current || capture.current) return
    stopSpeech()
    setTyping(false)

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
    setDraft('')
    onViewChange('ask')
    setAskError(null)
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
      let sawDraft = false
      const result = await askBuddyApi(trimmed, context, intent, request.signal, (text) => {
        if (request.signal.aborted) return
        if (text && !sawDraft) {
          sawDraft = true
          measureBuddy('text-first', timing)
        }
        setDraft(text)
      })
      if (request.signal.aborted) return
      measureBuddy('answer-api', timing, requestStarted)
      if (isNavigationAnswer(result) && result.action) {
        const keepChatOpen = result.keepChatOpen === true
        const fallback = t.voiceOpened(localizedActionLabel(result.action, t))
        const line = navigationToast(result, fallback)
        const opened = runAction(result.action, line,
          Boolean(options.spoken) && !keepChatOpen, line === fallback ? lang : result.language, keepChatOpen)
        if (!opened) {
          setConversation((current) => current.filter((entry) => entry.id !== userId))
          showToast(t.buddyNavigationCancelled)
          return
        }
        if (!keepChatOpen) {
          setConversation((current) => current.filter((entry) => entry.id !== userId))
          return
        }
      }
      pendingPaint.current = { id: replyId, timing, firstText: !sawDraft }
      setConversation((current) => [...current, { id: replyId, role: 'agent', text: result.reply, answer: result }])
      onViewChange('ask')
      if (shouldReadAloud(isBuddyMuted(), Boolean(options.spoken))) {
        speak(result.reply, result.language, timing)
      }
    } catch {
      if (request.signal.aborted) return
      setConversation((current) => current.filter((entry) => entry.id !== userId))
      if (!options.spoken) {
        setQuestion((current) => current || trimmed)
        setTyping(true)
      }
      showToast(t.buddyErrorGeneric, true)
    } finally {
      if (pending.current === request) {
        pending.current = null
        setDraft('')
        setPhase('idle')
      }
    }
  }, [activeTab, lang, onViewChange, runAction, showToast, speak, stopSpeech, t])

  // The recorder lives for the whole session, so its callbacks read the newest
  // handlers through refs instead of the values captured on the first render
  // (otherwise muting after the first recording has no effect on voice replies).
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
    setDraft('')
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

  /** Streams mic audio and retains a clip for fallback. */
  const beginBackendListening = useCallback(() => {
    if (!recorder.current) {
      recorder.current = createRecorder({
        onStream: (stream) => {
          setMicDenied(false)
          liveSpeech.current?.attach(stream)
        },
        onStopping: () => {
          meter.stop()
          stoppedAt.current ??= performance.now()
          void liveSpeech.current?.finish()
        },
        onClip: (clip) => {
          if (capture.current !== 'backend') return
          meter.stop()
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
            if (streamed != null) return { text: streamed, timing: { started, path: 'streaming' } }
            const clipSignal = AbortSignal.any([request.signal, AbortSignal.timeout(15_000)])
            const transcript = await transcribeAudioApi(clip, clipSignal, null)
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
          meter.stop()
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
          if (kind === 'denied') setMicDenied(true)
          if (kind === 'unsupported') setSpeechAvailable(false)
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
    meter.prepare()
    prepareVoiceToken()
    const session = voiceToken.current
    voiceToken.current = null
    if (session) {
      liveSpeech.current = streamBuddyAudio(session, setHeard)
      if (!liveSpeech.current) session.request.abort()
    }
    setPhase('listening')
    recorder.current.start()
    return true
  }, [meter, prepareVoiceToken])

  const beginListening = useCallback(() => {
    if (phase !== 'idle' || capture.current || pending.current) return
    stopSpeech()
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
    setTyping(false)
    setConfirmation('')
    setAskError(null)
    onViewChange(null)
  }, [cancelWork, onViewChange])

  function leaveTyping() {
    setTyping(false)
    window.requestAnimationFrame(() => (typingTriggerRef.current ?? orbRef.current)?.focus())
  }

  function closeVoiceCard() {
    closePanel()
    orbRef.current?.focus()
  }

  const openTyping = useCallback(() => {
    if (phase === 'thinking') return
    if (phase === 'listening') {
      cancelWork()
      setPhase('idle')
      setHeard('')
    }
    onViewChange('ask')
    setTyping(true)
  }, [cancelWork, onViewChange, phase])

  const toggleVoice = useCallback(() => {
    if (hasPlayback) {
      stopSpeech()
    } else if (streamingReply) {
      cancelWork()
      setPhase('idle')
    } else if (phase === 'listening') {
      stopListening()
    } else if (phase === 'idle') {
      if (!speechAvailable) {
        openTyping()
        return
      }
      setTyping(false)
      onViewChange('ask')
      beginListening()
    }
  }, [beginListening, cancelWork, hasPlayback, onViewChange, openTyping, phase, speechAvailable, stopListening, stopSpeech, streamingReply])

  useEffect(() => {
    if (!enabled || (view && view !== 'ask')) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.defaultPrevented || event.repeat || event.isComposing
        || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable
        || target.closest('input, textarea, select, button, a[href], [role="button"], [role="dialog"]'))) return
      if (!voiceReady || typing || document.querySelector('[aria-modal="true"]')) return
      event.preventDefault()
      toggleVoice()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, voiceReady, toggleVoice, typing, view])

  useEffect(() => {
    if (enabled) return
    voiceToken.current?.request.abort()
    voiceToken.current = null
    streamingEnabled.current = false
    const id = window.setTimeout(() => {
      cancelWork()
      setPhase('idle')
      setHeard('')
      setTyping(false)
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
      meter.dispose()
    }
  }, [cancelWork, meter])

  const conversationIdle = phase === 'idle' && !hasPlayback
  const hasDockLine = Boolean(confirmation || askError)
  useEffect(() => {
    if (!conversationIdle || !hasDockLine) return
    const id = window.setTimeout(() => {
      setConfirmation('')
      setAskError(null)
    }, 5000)
    return () => window.clearTimeout(id)
  }, [conversationIdle, hasDockLine, confirmation, askError])

  useEffect(() => {
    if (!typing) return
    const area = areaRef.current
    const viewport = window.visualViewport
    if (!area || !viewport) return
    function fitKeyboard() {
      if (!area || !viewport) return
      const covered = viewport.scale === 1
        ? Math.max(0, document.documentElement.clientHeight - viewport.height - viewport.offsetTop)
        : 0
      area.style.setProperty('--dock-keyboard-bottom', `${covered ? covered + 12 : 0}px`)
      area.style.setProperty('--dock-viewport-top', `${covered ? viewport.offsetTop + 12 : 0}px`)
    }
    fitKeyboard()
    viewport.addEventListener('resize', fitKeyboard)
    viewport.addEventListener('scroll', fitKeyboard)
    return () => {
      viewport.removeEventListener('resize', fitKeyboard)
      viewport.removeEventListener('scroll', fitKeyboard)
      area.style.removeProperty('--dock-keyboard-bottom')
      area.style.removeProperty('--dock-viewport-top')
    }
  }, [areaRef, typing, dockVisible])

  useLayoutEffect(() => {
    if (typing) inputRef.current?.focus({ preventScroll: true })
  }, [typing])

  useEffect(() => {
    const reply = pendingPaint.current
    if (view !== 'ask' || !reply || conversation.at(-1)?.id !== reply.id) return
    pendingPaint.current = null
    if (reply.firstText) measureBuddy('text-first', reply.timing)
    measureBuddy('text-ready', reply.timing)
  }, [conversation, view])

  useLayoutEffect(() => {
    const node = chatBodyRef.current
    if (!node) {
      followChat.current = true
    } else if (followChat.current) {
      node.scrollTop = node.scrollHeight
    }
  }, [view, conversation, phase, reminderAccepted, askError, heard, draft])

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
  const latestActions = latestIsAgent && phase === 'idle'
    ? latestAnswer?.actions ?? (latestAnswer?.action ? [latestAnswer.action] : [])
    : []
  const keepActionCards = latestActions.length > 1 || pendingSuggestion !== null
  const waitingForReply = phase === 'thinking' && !streamingReply
  const replying = hasPlayback || streamingReply
  const audioActivity = playbackState === 'playing' ? 'speaking' : playbackState
  const activity = streamingReply ? 'speaking' : phase === 'idle' ? audioActivity : phase
  const micUnavailable = speechAvailable === false || micDenied
  const activityLabel = {
    idle: micUnavailable ? t.voiceMicError : t.voicePillPrompt,
    listening: t.voiceListening,
    thinking: t.voiceThinking,
    loading: t.voiceReading,
    speaking: t.voiceReading,
  }[activity]
  const voiceState: VoiceState = typing ? 'typing'
    : activity === 'loading' ? 'speaking'
      : activity === 'idle' && micUnavailable ? 'unavailable' : activity
  const statusLabel = activity === 'idle' && !micUnavailable ? ''
    : activity === 'loading' ? t.voicePreparingSpeech : activityLabel
  const idleAction = micDenied ? t.voiceMicEnable : t.voiceAskByText
  const stopLabel = hasPlayback ? t.voiceInterrupt : streamingReply ? t.voiceStopReply : t.voiceStopRecording
  const canStopVoice = phase === 'listening' || replying
  const showVoiceCard = view === 'ask' || (!view && hasDockLine)
  if (!enabled) return null

  return (
    <>
      {dockVisible && (
        <div ref={areaRef} className="voice-dock-area"
          data-positioned={position !== null} data-upper={position !== null && position.y < 0.5}
          data-voice-state={voiceState}
          style={position ? { '--dock-x': position.x, '--dock-y': position.y } as CSSProperties : undefined}>
          <span className="sr-only" role="status">{statusLabel}</span>
          {showVoiceCard && (
            <section className="voice-card" role="dialog" aria-labelledby={cardTitleId}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return
                event.stopPropagation()
                closeVoiceCard()
              }}>
              <header className="voice-card-head">
                <span className="voice-card-avatar" aria-hidden="true"><TurboMascot portrait /></span>
                <h2 id={cardTitleId}>{t.voiceAgentName}</h2>
                <button type="button" className="buddy-icon-btn voice-card-close" onClick={closeVoiceCard} aria-label={t.buddyClose}>
                  <span aria-hidden="true"><X size={16} weight="bold" /></span>
                </button>
              </header>
              {view === 'ask' ? (
                <div className="voice-card-body voice-chat-body" ref={chatBodyRef} tabIndex={0}
                  role="log" aria-labelledby={cardTitleId}
                  onScroll={(event) => {
                    const { scrollHeight, scrollTop, clientHeight } = event.currentTarget
                    followChat.current = scrollHeight - scrollTop - clientHeight < 48
                  }}>
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
                  {phase === 'thinking' && draft && (
                    <div className="voice-agent-line" aria-hidden="true">
                      <p className="voice-chat-bubble is-agent">{draft}</p>
                    </div>
                  )}

                  {phase === 'listening' && heard && (
                    <p className="voice-chat-bubble is-live">{heard}</p>
                  )}
                  {askError && <p className="buddy-inline-error" role="alert">{askError}</p>}

                  {latestActions.map((action) => {
                    const title = action.lessonTitle || action.videoTitle || action.itemName
                    const key = JSON.stringify([action.kind, action.tab, action.lessonId, action.videoId, action.mode, action.itemCode, action.highlight])
                    return (
                      <button key={key} type="button" className="voice-action"
                        onClick={() => {
                          if (!runAction(action, undefined, false, lang, keepActionCards)) {
                            showToast(t.buddyNavigationCancelled, true)
                          } else if (!keepActionCards) {
                            orbRef.current?.focus()
                          }
                        }}>
                        <span className="voice-action-icon" aria-hidden="true">
                          {action.lessonId ?? <BookOpen size={17} weight="bold" />}
                        </span>
                        <span className="voice-action-copy">
                          <strong>{title || localizedActionLabel(action, t)}</strong>
                          {title && action.tab && <small>{t[TAB_LABEL_KEYS[action.tab]]}</small>}
                        </span>
                        <span className="voice-action-open"><Check size={13} weight="bold" aria-hidden="true" />{t.voiceActionOpen}</span>
                      </button>
                    )
                  })}

                  {latestIsAgent && phase === 'idle' && latestAnswer?.followups.length ? (
                    <div className="buddy-followups">
                      {latestAnswer.followups.map((followup) => (
                        <button key={followup} type="button" className="voice-followup" onClick={() => void send(followup)}>
                          <span>{followup}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}

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
              ) : <p className="voice-card-note" role={askError ? 'alert' : 'status'}>{confirmation || askError}</p>}
            </section>
          )}
          <div ref={dockRef} className="voice-dock voice-pill" onKeyDown={(event) => {
            if (event.key !== 'Escape' || event.nativeEvent.isComposing) return
            if (typing) {
              event.stopPropagation()
              leaveTyping()
            } else if (showVoiceCard) {
              event.stopPropagation()
              closeVoiceCard()
            }
          }}>
            <button ref={orbRef} type="button" className="voice-orb" data-state={voiceState} {...dragHandlers}
              onPointerEnter={prepareVoiceToken} onFocus={prepareVoiceToken}
              onClick={(event) => {
                if (shouldSuppressClick(event.detail)) return
                if (typing && !speechAvailable) leaveTyping()
                else toggleVoice()
              }}
              aria-label={canStopVoice ? stopLabel : waitingForReply ? activityLabel : (typing
                ? speechAvailable ? t.voiceSwitchToVoice : t.voiceCancelTyping
                : voiceReady ? t.voiceOpen : idleAction)}
              aria-keyshortcuts={voiceReady && !typing ? 'Space' : undefined} aria-description={t.buddyDockMoveHint}
              aria-disabled={waitingForReply} data-voice-orb="true">
              <VoiceIcon state={voiceState} meter={meter} playingAudio={playbackState === 'playing'} />
              {dueNudges.length > 0 && <span className="voice-orb-badge" aria-hidden="true" />}
            </button>
            {typing ? (
              <form className="voice-pill-form voice-ask-form" onSubmit={(event) => {
                event.preventDefault()
                if (!question.trim()) return
                followChat.current = true
                orbRef.current?.focus()
                void send(question)
              }}>
                <input ref={inputRef} type="text" value={question} onChange={(event) => setQuestion(event.target.value)}
                  placeholder={t.voicePillPlaceholder} aria-label={t.voicePillPlaceholder} maxLength={2000} />
                <button type="submit" className="voice-pill-send" disabled={!question.trim()}
                  aria-label={t.voiceSend} title={t.voiceSend}>
                  <ArrowUp size={20} weight="bold" aria-hidden="true" />
                </button>
              </form>
            ) : (
              <>
                <button type="button" className="voice-pill-label" {...dragHandlers}
                  onClick={(event) => { if (!shouldSuppressClick(event.detail)) toggleVoice() }}
                  tabIndex={-1} aria-description={t.buddyDockMoveHint} aria-disabled={waitingForReply}>
                  <span>{activityLabel}</span>
                  {activity === 'idle' && voiceReady && <kbd>Space</kbd>}
                  {voiceState === 'unavailable' && <span className="voice-pill-hint">{micDenied ? t.voiceMicEnable : t.voiceTypeShort}</span>}
                </button>
                {replying ? (
                  <button type="button" className="voice-type-trigger"
                    onClick={() => { orbRef.current?.focus(); toggleVoice() }} aria-label={stopLabel} title={stopLabel}>
                    <Stop size={16} weight="fill" aria-hidden="true" />
                  </button>
                ) : (
                  <button ref={typingTriggerRef} type="button" className="voice-type-trigger"
                    onClick={openTyping} aria-label={t.voiceAskByText} title={t.voiceAskByText}
                    aria-disabled={waitingForReply}>
                    <Keyboard size={20} weight="bold" aria-hidden="true" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {view && view !== 'ask' && (
        <div className="voice-panel" role="dialog" aria-label={t.voiceAgentName}>
          <header className="voice-panel-head">
            <div className="voice-panel-identity"><strong>{t.voiceAgentName}</strong></div>
            <button type="button" className="buddy-icon-btn voice-panel-close" onClick={closePanel} aria-label={t.buddyClose}>
              <X size={16} weight="bold" aria-hidden="true" />
            </button>
          </header>

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
