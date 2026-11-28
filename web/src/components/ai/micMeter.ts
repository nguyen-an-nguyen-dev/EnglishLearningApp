/**
 * Audio features for the voice visualiser. The analyser can read the microphone
 * or the same audio graph that sends the voice reply to the speakers.
 */

const FFT_SIZE = 2048
const BAND_EDGES = [80, 200, 400, 800, 1600, 4000] as const
const BAND_COUNT = BAND_EDGES.length - 1
const MIN_PITCH = 75
const MAX_PITCH = 400
const PITCH_INTERVAL_MS = 45

export interface VoiceSignal {
  /** Overall loudness, from 0 to 1. */
  level: number
  /** Fundamental frequency in Hz; 0 when the signal is unvoiced or silent. */
  pitch: number
  /** Five band energies from low to high, each from 0 to 1. */
  bands: Float32Array
}

export interface MicMeter {
  prepare(): void
  /** Visualises an existing stream (the recorder's) without owning it. */
  attach(stream: MediaStream): void
  attachPlayback(player: HTMLAudioElement): void
  /** Releases the analyser without stopping the recorder's microphone. */
  stop(): void
  dispose(): void
  /** Fills `out` from the live analyser. `out.bands` must hold five entries. */
  readSignal(out: VoiceSignal): void
}

type MaybeWebkit = { webkitAudioContext?: typeof AudioContext }

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const scope = window as unknown as typeof window & MaybeWebkit
  return scope.AudioContext ?? scope.webkitAudioContext ?? null
}

function detectPitch(
  input: Float32Array<ArrayBuffer>,
  count: number,
  sampleRate: number,
  scratch: Float32Array<ArrayBuffer>,
  correlations: Float32Array<ArrayBuffer>,
): number {
  // Decimate by two: enough detail for speech, half the autocorrelation work.
  const length = Math.floor(count / 2)
  let mean = 0
  for (let index = 0; index < length; index += 1) mean += input[index * 2] + input[index * 2 + 1]
  mean /= length * 2

  let energy = 0
  for (let index = 0; index < length; index += 1) {
    const value = (input[index * 2] + input[index * 2 + 1]) / 2 - mean
    scratch[index] = value
    energy += value * value
  }
  if (energy < 1e-4) return 0

  const rate = sampleRate / 2
  const minLag = Math.max(2, Math.floor(rate / MAX_PITCH))
  const maxLag = Math.min(length - 2, Math.floor(rate / MIN_PITCH), correlations.length - 2)
  const baseline = energy / length
  let bestLag = 0
  let best = 0

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0
    for (let index = 0; index < length - lag; index += 1) sum += scratch[index] * scratch[index + lag]
    const correlation = sum / ((length - lag) * baseline)
    correlations[lag] = correlation
    if (correlation > best) {
      best = correlation
      bestLag = lag
    }
  }
  if (best < 0.35 || bestLag === 0) return 0

  // Prefer the first strong peak: a later peak can be an octave below the voice.
  for (let lag = minLag + 1; lag < maxLag; lag += 1) {
    const correlation = correlations[lag]
    if (correlation > 0.55 && correlation > correlations[lag - 1] && correlation >= correlations[lag + 1]) {
      bestLag = lag
      break
    }
  }

  return rate / bestLag
}

export function createMicMeter(): MicMeter {
  let context: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let source: AudioNode | null = null
  let samples: Float32Array<ArrayBuffer> | null = null
  let spectrum: Uint8Array<ArrayBuffer> | null = null
  let scratch: Float32Array<ArrayBuffer> | null = null
  let correlations: Float32Array<ArrayBuffer> | null = null
  let cachedPitch = 0
  let lastPitchAt = 0
  const playbackSources = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>()

  function prepare(): AudioContext | null {
    const Ctor = audioContextCtor()
    if (!Ctor) return null
    try {
      context ??= new Ctor()
      void context.resume().catch(() => {})
      return context
    } catch {
      return null
    }
  }

  function detach() {
    if (source && analyser) source.disconnect(analyser)
    source = null
    analyser = null
    samples = null
    spectrum = null
    scratch = null
    correlations = null
    cachedPitch = 0
    lastPitchAt = 0
  }

  function createAnalyser(audio: AudioContext) {
    analyser = audio.createAnalyser()
    analyser.fftSize = FFT_SIZE
    analyser.smoothingTimeConstant = 0.55
    samples = new Float32Array(analyser.fftSize)
    spectrum = new Uint8Array(analyser.frequencyBinCount)
    scratch = new Float32Array(analyser.fftSize / 2)
    correlations = new Float32Array(Math.ceil((audio.sampleRate / 2) / MIN_PITCH) + 2)
    return analyser
  }

  return {
    prepare,
    attach(stream) {
      detach()
      const audio = prepare()
      if (!audio || !stream.getAudioTracks().length) return
      try {
        const input = audio.createMediaStreamSource(stream)
        input.connect(createAnalyser(audio))
        source = input
      } catch {
        detach()
      }
    },
    attachPlayback(player) {
      detach()
      // Leave media playback untouched if the browser still requires a gesture.
      const audio = context
      if (audio?.state !== 'running') return
      try {
        let playback = playbackSources.get(player)
        if (!playback) {
          playback = audio.createMediaElementSource(player)
          // Keep playback audible when the analyser detaches or the clip buffers.
          playback.connect(audio.destination)
          playbackSources.set(player, playback)
        }
        playback.connect(createAnalyser(audio))
        source = playback
      } catch {
        detach()
      }
    },
    stop: detach,
    dispose() {
      detach()
      void context?.close().catch(() => {})
      context = null
    },

    readSignal(out) {
      out.level = 0
      out.pitch = 0
      out.bands.fill(0)
      if (!analyser || !samples || !spectrum || !scratch || !correlations || context?.state !== 'running') return

      analyser.getFloatTimeDomainData(samples)
      let energy = 0
      for (const value of samples) energy += value * value
      const rms = Math.sqrt(energy / samples.length)
      const level = Math.min(1, Math.sqrt(Math.max(0, rms - 0.002) * 18))
      out.level = level

      analyser.getByteFrequencyData(spectrum)
      const binWidth = context.sampleRate / analyser.fftSize
      for (let band = 0; band < BAND_COUNT; band += 1) {
        const start = Math.max(1, Math.floor(BAND_EDGES[band] / binWidth))
        const end = Math.min(spectrum.length - 1, Math.ceil(BAND_EDGES[band + 1] / binWidth))
        let sum = 0
        for (let index = start; index <= end; index += 1) sum += spectrum[index]
        const average = end >= start ? sum / (end - start + 1) / 255 : 0
        out.bands[band] = Math.min(1, Math.max(0, (average - 0.24) / 0.76))
      }
      if (level < 0.02) out.bands.fill(0)

      const now = performance.now()
      if (now - lastPitchAt >= PITCH_INTERVAL_MS) {
        lastPitchAt = now
        cachedPitch = level > 0.025 ? detectPitch(samples, samples.length, context.sampleRate, scratch, correlations) : 0
      }
      out.pitch = level > 0.025 ? cachedPitch : 0
    },
  }
}
