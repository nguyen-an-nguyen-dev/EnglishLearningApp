/**
 * Pure phase rules for the voice orb, kept out of the component so the state
 * machine is testable with node:test.
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

/** Only spoken questions are read back, and only while the orb is unmuted. */
export function shouldReadAloud(muted: boolean, spoken: boolean): boolean {
  return spoken && !muted
}
