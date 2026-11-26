/* global AudioWorkletProcessor, sampleRate, registerProcessor */

class BuddyPcmProcessor extends AudioWorkletProcessor {
  samples = new Int16Array(sampleRate / 10)
  length = 0
  stopped = false

  constructor() {
    super()
    this.port.onmessage = () => {
      this.stopped = true
      if (this.length > 0) this.send(Math.max(this.length, sampleRate / 20))
      this.port.postMessage('flushed')
    }
  }

  send(length) {
    const buffer = this.samples.slice(0, length).buffer
    this.port.postMessage(buffer, [buffer])
    this.samples.fill(0)
    this.length = 0
  }

  process(inputs) {
    if (this.stopped) return false
    const mono = inputs[0]?.[0]
    if (!mono) return true
    for (const sample of mono) {
      const clamped = Math.max(-1, Math.min(1, sample))
      this.samples[this.length++] = clamped * (clamped < 0 ? 32768 : 32767)
      if (this.length === this.samples.length) this.send(this.length)
    }
    return true
  }
}

registerProcessor('buddy-pcm', BuddyPcmProcessor)
