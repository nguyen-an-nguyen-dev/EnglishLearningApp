import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('./buddyPcm.worklet.js', import.meta.url), 'utf8')

for (const sampleRate of [16_000, 44_100, 48_000]) {
  test(`Buddy resamples microphone audio at ${sampleRate} Hz to 50 ms PCM16 frames`, () => {
    interface Processor {
      process(inputs: Float32Array[][]): boolean
      port: { onmessage: () => void }
    }
    const frames: Array<ArrayBuffer | 'flushed'> = []
    let processor: Processor | undefined
    runInNewContext(source, {
      sampleRate,
      AudioWorkletProcessor: class {
        port = { postMessage: (frame: ArrayBuffer | 'flushed') => frames.push(frame) }
      },
      registerProcessor: (_name: string, Ctor: new () => Processor) => { processor = new Ctor() },
    })
    assert.ok(processor)
    processor.process([[new Float32Array(sampleRate / 20).fill(0.25)]])
    processor.process([[new Float32Array(sampleRate / 100).fill(0.5)]])
    processor.port.onmessage()

    assert.equal(frames.length, 3)
    assert.equal(frames[2], 'flushed')
    const first = new Int16Array(frames[0] as ArrayBuffer)
    const tail = new Int16Array(frames[1] as ArrayBuffer)
    assert.equal(first.length, 800)
    assert.ok(first.every((value) => value === 8191))
    assert.deepEqual([...new Set(tail.slice(0, 160))], [16383])
    assert.ok(tail.slice(160).every((value) => value === 0))
    assert.equal(processor.process([[]]), false)
  })
}
