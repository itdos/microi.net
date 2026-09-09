import test from 'node:test'
import assert from 'node:assert/strict'
import { createMicroiV8 } from '../src/utils/microi.v8.js'
import { createMicroiV8 as createTemplateV8 } from '../../microi.skills/microi.v8.js'

const nextTurn = () => new Promise((resolve) => setImmediate(resolve))

async function withinDeadline(promise) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Request queue failed to drain')), 1000)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

for (const [name, createClient] of [['UniApp SDK', createMicroiV8], ['SDK template', createTemplateV8]]) {
  for (const limit of [1, 8]) {
    for (const mixedFailures of [false, true]) {
      test(`${name}: limit ${limit}, ${mixedFailures ? 'success/rejection/throw' : 'success'} bursts release every slot`, async () => {
        let running = 0
        let peak = 0
        let started = 0
        const client = createClient({
          apiBase: 'https://queue-test.invalid',
          did: 'queue-test',
          maxConcurrent: limit,
          storage: { get: () => '', set() {}, remove() {} },
          requestAdapter() {
            const index = ++started
            if (mixedFailures && index % 5 === 0) throw new Error('synchronous adapter failure')
            running += 1
            peak = Math.max(peak, running)
            return nextTurn().then(() => {
              if (mixedFailures && index % 3 === 0) throw new Error('asynchronous adapter failure')
              return { statusCode: 200, data: { Code: 1 }, header: {} }
            }).finally(() => { running -= 1 })
          }
        })
        const request = () => client.request({ url: '/list', auth: false, silentError: true })
        // More than twice the capacity reproduces the original leaked-counter failure.
        for (let wave = 0; wave < 3; wave += 1) {
          const results = await withinDeadline(Promise.allSettled(Array.from({ length: limit * 4 }, request)))
          assert.equal(results.length, limit * 4)
          if (!mixedFailures) assert.ok(results.every((result) => result.status === 'fulfilled'))
          assert.equal(running, 0)
        }
        const before = started
        await withinDeadline(Promise.allSettled([request()]))
        assert.equal(started, before + 1, 'a request from another page must reach the adapter')
        assert.ok(peak <= limit, 'queue must still enforce its concurrency limit')
        assert.equal(running, 0)
      })
    }
  }
}
