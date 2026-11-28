/* global AudioWorkletProcessor, sampleRate, registerProcessor */

const OUTPUT_RATE = 16_000

class BuddyPcmProcessor extends AudioWorkletProcessor {
  samples = new Int16Array(OUTPUT_RATE / 20)
  length = 0
  stopped = false
  filled = 0
  weightedSample = 0

  constructor() {
    super()
    this.port.onmessage = () => {
      this.stopped = true
      if (this.filled > 0) this.write(this.weightedSample / this.filled)
      if (this.length > 0) this.send()
      this.port.postMessage('flushed')
    }
  }

  send() {
    const buffer = this.samples.slice().buffer
    this.port.postMessage(buffer, [buffer])
    this.samples.fill(0)
    this.length = 0
  }

  write(sample) {
    const clamped = Math.max(-1, Math.min(1, sample))
    this.samples[this.length++] = clamped * (clamped < 0 ? 32768 : 32767)
    if (this.length === this.samples.length) this.send()
  }

  process(inputs) {
    if (this.stopped) return false
    const mono = inputs[0]?.[0]
    if (!mono) return true
    for (const sample of mono) {
      // Integrate over each output sample interval, including fractional boundaries at 44.1 kHz.
      let remaining = OUTPUT_RATE
      while (remaining > 0) {
        const take = Math.min(remaining, sampleRate - this.filled)
        this.filled += take
        this.weightedSample += sample * take
        remaining -= take
        if (this.filled === sampleRate) {
          this.write(this.weightedSample / sampleRate)
          this.filled = 0
          this.weightedSample = 0
        }
      }
    }
    return true
  }
}

registerProcessor('buddy-pcm', BuddyPcmProcessor)
