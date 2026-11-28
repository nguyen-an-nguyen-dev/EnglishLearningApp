import { MicrophoneSlash } from '@phosphor-icons/react'
import { AudioBars } from './AudioBars'
import type { MicMeter } from './micMeter'

/** Every state the voice button can show. */
export type VoiceState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'typing'
  | 'unavailable'

interface VoiceIconProps {
  state: VoiceState
  meter: MicMeter
  playingAudio: boolean
}

/**
 * The voice button shows dots while listening or thinking, a waveform while
 * speaking, and a crossed-out microphone when voice input is unavailable.
 */
export function VoiceIcon({ state, meter, playingAudio }: VoiceIconProps) {
  if (state === 'listening' || state === 'thinking') {
    return (
      <span className="voice-dots" aria-hidden="true">
        <i /><i /><i />
      </span>
    )
  }

  if (state === 'unavailable') {
    return <MicrophoneSlash size={22} weight="bold" aria-hidden="true" />
  }

  return <AudioBars meter={meter} active={playingAudio} />
}
