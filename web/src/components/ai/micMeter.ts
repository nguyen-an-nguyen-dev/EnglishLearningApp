/**
 * Live microphone level for the voice waveform. One AudioContext + AnalyserNode
 * over the recorder's MediaStream. `read()` returns smoothed 0..1 levels.
 */

const FFT_SIZE = 256;
/** Frequency bins used: ~1..28 covers the voice range at 48 kHz / fft 256. */
const MAX_BIN = 28;

export interface MicMeter {
  /** Visualises an existing stream (the recorder's) without owning it. */
  attach(stream: MediaStream): void
  /** Releases the analyser without stopping the recorder's microphone. */
  stop(): void
  /** Fills `out` (length = band count) with smoothed 0..1 levels. */
  read(out: Float32Array): void
}

type MaybeWebkit = { webkitAudioContext?: typeof AudioContext }

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const scope = window as unknown as typeof window & MaybeWebkit
  return scope.AudioContext ?? scope.webkitAudioContext ?? null
}

/** Logarithmic band edges, so low voice frequencies are not squashed into one bar. */
function bandEdges(count: number): Array<[number, number]> {
  const edges: Array<[number, number]> = []
  for (let index = 0; index < count; index += 1) {
    const low = Math.round(MAX_BIN * (index / count) ** 1.4) + 1
    const high = Math.round(MAX_BIN * ((index + 1) / count) ** 1.4) + 1
    edges.push([Math.min(low, MAX_BIN), Math.max(Math.min(high, MAX_BIN), low + 1)])
  }
  return edges
}

export function createMicMeter(bandCount = 5): MicMeter {
  const edges = bandEdges(bandCount)
  const weights = edges.map((_, index) => 0.55 + 0.45 * Math.sin((Math.PI * (index + 0.5)) / bandCount))

  let context: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let data: Uint8Array<ArrayBuffer> | null = null

  function wire(stream: MediaStream): void {
    const Ctor = audioContextCtor()
    if (!Ctor) return
    if (!context) context = new Ctor()
    void context.resume().catch(() => {})
    if (analyser && source) {
      try { source.disconnect() } catch { /* already detached */ }
    }
    analyser = context.createAnalyser()
    analyser.fftSize = FFT_SIZE
    analyser.smoothingTimeConstant = 0.72
    source = context.createMediaStreamSource(stream)
    source.connect(analyser)
    data = new Uint8Array(analyser.frequencyBinCount)
  }

  return {
    attach(stream: MediaStream): void {
      wire(stream)
    },

    stop(): void {
      if (source) {
        try { source.disconnect() } catch { /* already detached */ }
      }
      source = null
      analyser = null
      data = null
      // The context is kept suspended for reuse; the microphone is already free.
      void context?.suspend().catch(() => {})
    },

    read(out: Float32Array): void {
      if (!analyser || !data) {
        for (let index = 0; index < out.length; index += 1) out[index] = 0
        return
      }
      analyser.getByteFrequencyData(data)
      for (let index = 0; index < out.length; index += 1) {
        const [low, high] = edges[index]
        let sum = 0
        for (let bin = low; bin < high; bin += 1) sum += data[bin]
        const norm = sum / (high - low) / 255
        // Noise gate then a slight boost, weighted so the centre bars lead.
        const target = Math.min(1, Math.max(0, (norm - 0.04) * 1.7) * weights[index])
        out[index] += (target - out[index]) * (target > out[index] ? 0.55 : 0.14)
      }
    },
  }
}
