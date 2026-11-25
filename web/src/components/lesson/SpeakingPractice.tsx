import { useEffect, useRef, useState } from 'react'
import { Microphone, Stop } from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import { practiceSpeechApi, type SpeechPractice } from '../../services/speechService'
import { createRecorder, type Recorder } from '../ai/recorder'
import './speaking.css'

interface Props {
  sample: string
  disabled?: boolean
  onStart?: () => void
  onBusyChange?: (busy: boolean) => void
  onResult?: (result: SpeechPractice) => void
}

export function SpeakingPractice({ sample, disabled = false, onStart, onBusyChange, onResult }: Props) {
  const { t } = useI18n()
  const [phase, setPhase] = useState<'idle' | 'starting' | 'recording' | 'processing'>('idle')
  const [result, setResult] = useState<SpeechPractice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recorder = useRef<Recorder | null>(null)
  const pending = useRef<AbortController | null>(null)

  useEffect(() => () => {
    recorder.current?.cancel()
    pending.current?.abort()
    onBusyChange?.(false)
  }, [onBusyChange])

  function start() {
    onStart?.()
    onBusyChange?.(true)
    setError(null)
    setResult(null)
    setPhase('starting')
    recorder.current = createRecorder({
      onStream: () => setPhase('recording'),
      onError: (reason) => {
        setError(reason === 'empty' ? t.speakingNoSpeech : t.speakingMicError)
        setPhase('idle')
        onBusyChange?.(false)
      },
      onClip: (blob) => {
        const request = new AbortController()
        pending.current = request
        setPhase('processing')
        void practiceSpeechApi(sample, blob, request.signal)
          .then((data) => {
            if (request.signal.aborted) return
            setResult(data)
            onResult?.(data)
          })
          .catch((reason: unknown) => {
            if (request.signal.aborted) return
            const code = (reason as { code?: string } | null)?.code
            setError(code === 'NO_SPEECH' ? t.speakingNoSpeech : t.speakingServiceError)
          })
          .finally(() => {
            if (!request.signal.aborted) {
              setPhase('idle')
              onBusyChange?.(false)
            }
            if (pending.current === request) pending.current = null
          })
      },
    })
    recorder.current.start()
  }

  const recording = phase === 'recording'
  const label = recording ? t.speakingStop
    : phase === 'starting' ? t.speakingStarting
      : phase === 'processing' ? t.speakingProcessing : t.speakingRecord
  const statuses = { matched: t.speakingMatched, missing: t.speakingMissing, different: t.speakingDifferent }

  return (
    <div className="speaking-practice">
      <button type="button" className="speaking-control"
        aria-pressed={recording} disabled={disabled || phase === 'starting' || phase === 'processing'}
        onClick={() => recording ? recorder.current?.stop() : start()}>
        {recording ? <Stop size={18} aria-hidden="true" /> : <Microphone size={18} aria-hidden="true" />}
        {label}
      </button>
      {error && <p className="lesson-inline-error" role="alert">{error}</p>}
      {result && (
        <div className="speaking-result" role="status">
          <strong>{t.speakingCompleteness(Math.round(result.completeness * 100))}</strong>
          <p>{result.transcript}</p>
          <ul className="speaking-words">
            {result.words.map(({ word, status, heard }, index) => (
              <li className={`is-${status}`} key={index} aria-label={`${word} · ${statuses[status]}${heard ? ` · ${heard}` : ''}`}
                title={heard ? `${statuses[status]} · ${heard}` : statuses[status]}>{word}</li>
            ))}
          </ul>
          {result.pacing && (
            <>
              <p>{t.speakingPacing(result.pacing.wordsPerMinute)}</p>
              {result.pacing.pauses.length > 0 && (
                <ul className="speaking-pauses">
                  {result.pacing.pauses.map(({ afterWord, beforeWord, seconds }, index) => (
                    <li key={index}>{t.speakingPause(afterWord, beforeWord, seconds)}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
