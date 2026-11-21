/**
 * Pure phase rules for the voice orb. Kept out of the React component so the
 * state machine that used to strand the orb in "thinking" can be tested with
 * nothing but node:test.
 */

export type VoicePhase = 'idle' | 'listening' | 'thinking'

/** A command matched on device never reaches the model, so the orb is done. */
export function phaseAfterCommand(): VoicePhase {
  return 'idle'
}

/** The recognition engine ending only releases an active listening session. */
export function phaseAfterEnd(phase: VoicePhase): VoicePhase {
  return phase === 'listening' ? 'idle' : phase
}

/** A final phrase starts an answer; an empty one simply ends the session. */
export function phaseForFinalTranscript(text: string): VoicePhase {
  return text.trim() ? 'thinking' : 'idle'
}

/** Only spoken questions are read back, and only while the orb is unmuted. */
export function shouldReadAloud(muted: boolean, spoken: boolean): boolean {
  return spoken && !muted
}
