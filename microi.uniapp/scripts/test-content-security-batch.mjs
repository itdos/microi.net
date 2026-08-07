import assert from 'node:assert/strict'
import test from 'node:test'
import { createMicroiV8 } from '../src/utils/microi.v8.js'

function reviewId(index) {
  return index.toString(16).padStart(32, '0')
}

function createRuntime({ uploadDelay = 10 } = {}) {
  let loginIndex = 0
  let uploadIndex = 0
  let activeUploads = 0
  let maxActiveUploads = 0
  const loginCodes = []

  globalThis.wx = { login() {} }
  globalThis.uni = {
    login({ success }) {
      const code = `login-code-${++loginIndex}`
      loginCodes.push(code)
      success({ code })
    },
    uploadFile({ formData, success }) {
      const current = ++uploadIndex
      activeUploads += 1
      maxActiveUploads = Math.max(maxActiveUploads, activeUploads)
      setTimeout(() => {
        activeUploads -= 1
        success({
          statusCode: 200,
          data: JSON.stringify({
            Code: 1,
            Data: {
              Path: `/tenant/img/${current}.jpg`,
              Url: `https://files.example.test/${current}.jpg`,
              ContentSecurityReviewId: reviewId(current),
              ContentSecurityStatus: 'Pending',
              LoginCodeUsed: formData.ContentSecurityLoginCode
            }
          })
        })
      }, uploadDelay)
    },
    showToast() {}
  }

  return {
    loginCodes,
    maxActiveUploads: () => maxActiveUploads,
    cleanup() {
      delete globalThis.wx
      delete globalThis.uni
    }
  }
}

function createClient(requestAdapter) {
  return createMicroiV8({
    apiBase: 'https://api.example.test',
    osClient: 'tenant',
    maxConcurrent: 8,
    requestAdapter
  })
}

test('three images upload concurrently and share one batch status request', async () => {
  const runtime = createRuntime()
  const batchCalls = []
  const client = createClient(async (request) => {
    assert.match(request.url, /mci-wechat-content-status-batch/)
    batchCalls.push(request.data.ReviewIds.slice())
    return {
      statusCode: 200,
      data: {
        Code: 1,
        Data: {
          Items: request.data.ReviewIds.map((id) => ({ ReviewId: id, Status: 'Passed' })),
          PendingCount: 0,
          NextPollAfterMs: 0
        }
      }
    }
  })

  try {
    const events = []
    const outcomes = await client.uploadFiles([
      { filePath: 'wxfile://one.jpg', name: 'one.jpg' },
      { filePath: 'wxfile://two.jpg', name: 'two.jpg' },
      { filePath: 'wxfile://three.jpg', name: 'three.jpg' }
    ], {
      preview: true,
      concurrency: 3,
      resolveUrl: false,
      contentSecurityPollInterval: 300,
      onItemChange: (event) => events.push(`${event.Index}:${event.Status}`)
    })

    assert.equal(runtime.maxActiveUploads(), 3)
    assert.equal(runtime.loginCodes.length, 3)
    assert.equal(new Set(runtime.loginCodes).size, 3, 'each upload must use a fresh one-time login code')
    assert.equal(batchCalls.length, 1)
    assert.equal(batchCalls[0].length, 3)
    assert.deepEqual(outcomes.map((item) => item.Code), [1, 1, 1])
    assert.equal(events.filter((item) => item.endsWith(':checking')).length, 3)
    assert.equal(events.filter((item) => item.endsWith(':passed')).length, 3)
  } finally {
    runtime.cleanup()
  }
})

test('mixed review results keep passed siblings and isolate rejected images', async () => {
  const runtime = createRuntime()
  const client = createClient(async (request) => ({
    statusCode: 200,
    data: {
      Code: 1,
      Data: {
        Items: request.data.ReviewIds.map((id, index) => ({
          ReviewId: id,
          Status: index === 1 ? 'Rejected' : 'Passed'
        })),
        PendingCount: 0
      }
    }
  }))

  try {
    const outcomes = await client.uploadFiles([
      { filePath: 'wxfile://one.jpg' },
      { filePath: 'wxfile://two.jpg' },
      { filePath: 'wxfile://three.jpg' }
    ], {
      preview: true,
      concurrency: 3,
      resolveUrl: false,
      contentSecurityPollInterval: 300
    })
    assert.deepEqual(outcomes.map((item) => item.Code), [1, 0, 1])
    assert.equal(outcomes[1].Error.Status, 'Rejected')
    assert.match(outcomes[1].Error.Msg, /违规信息/)
  } finally {
    runtime.cleanup()
  }
})

test('pending reviews stop after the configured finite attempt budget', async () => {
  const runtime = createRuntime()
  let statusCalls = 0
  const client = createClient(async (request) => {
    statusCalls += 1
    return {
      statusCode: 200,
      data: {
        Code: 1,
        Data: {
          Items: request.data.ReviewIds.map((id) => ({ ReviewId: id, Status: 'Pending' })),
          PendingCount: request.data.ReviewIds.length,
          NextPollAfterMs: 300
        }
      }
    }
  })

  try {
    const outcomes = await client.uploadFiles([{ filePath: 'wxfile://pending.jpg' }], {
      preview: true,
      resolveUrl: false,
      contentSecurityPollAttempts: 1,
      contentSecurityPollInterval: 300,
      contentSecurityTimeout: 3000
    })
    assert.equal(statusCalls, 1)
    assert.equal(outcomes[0].Code, 0)
    assert.equal(outcomes[0].Error.Status, 'Timeout')
  } finally {
    runtime.cleanup()
  }
})

test('more than twenty reviews are split into bounded interface-engine batches', async () => {
  const calls = []
  const client = createClient(async (request) => {
    calls.push(request.data.ReviewIds.slice())
    return {
      statusCode: 200,
      data: {
        Code: 1,
        Data: {
          Items: request.data.ReviewIds.map((id) => ({ ReviewId: id, Status: 'Passed' })),
          PendingCount: 0
        }
      }
    }
  })
  const ids = Array.from({ length: 21 }, (_, index) => reviewId(index + 1))
  const result = await client.waitForContentSecurityBatch(ids, {
    contentSecurityPollAttempts: 1,
    contentSecurityPollInterval: 300,
    contentSecurityTimeout: 3000
  })
  assert.deepEqual(calls.map((items) => items.length), [20, 1])
  assert.equal(result.Items.every((item) => item.Status === 'Passed'), true)
})

test('an unupgraded tenant falls back once to the legacy status endpoint', async () => {
  const runtime = createRuntime()
  let batchCalls = 0
  let legacyCalls = 0
  const client = createClient(async (request) => {
    if (request.url.includes('mci-wechat-content-status-batch')) {
      batchCalls += 1
      return { statusCode: 200, data: { Code: 0, Msg: '接口引擎不存在' } }
    }
    assert.match(request.url, /\/api\/WeChatContentSecurity\/Status/)
    legacyCalls += 1
    return {
      statusCode: 200,
      data: {
        Code: 1,
        Data: { ReviewId: request.data.ReviewId, Status: 'Passed' }
      }
    }
  })

  try {
    const outcomes = await client.uploadFiles([
      { filePath: 'wxfile://one.jpg' },
      { filePath: 'wxfile://two.jpg' }
    ], {
      preview: true,
      concurrency: 2,
      resolveUrl: false,
      contentSecurityPollInterval: 300
    })
    assert.deepEqual(outcomes.map((item) => item.Code), [1, 1])
    assert.equal(batchCalls, 1)
    assert.equal(legacyCalls, 2)
  } finally {
    runtime.cleanup()
  }
})

test('batch network failures stop after two attempts without legacy fan-out', async () => {
  let calls = 0
  const client = createClient(async () => {
    calls += 1
    throw new Error('network unavailable')
  })
  await assert.rejects(
    client.waitForContentSecurityBatch([reviewId(1), reviewId(2), reviewId(3)], {
      contentSecurityPollAttempts: 8,
      contentSecurityPollInterval: 300,
      contentSecurityTimeout: 3000
    }),
    /network unavailable/
  )
  assert.equal(calls, 2)
})

test('removing an image during the delay cancels it before the next status request', async () => {
  let calls = 0
  let removed = false
  const client = createClient(async () => {
    calls += 1
    throw new Error('status request must not run after removal')
  })
  setTimeout(() => { removed = true }, 30)
  const result = await client.waitForContentSecurityBatch([reviewId(1)], {
    contentSecurityPollAttempts: 2,
    contentSecurityPollInterval: 300,
    contentSecurityTimeout: 3000,
    isReviewCancelled: () => removed
  })
  assert.equal(calls, 0)
  assert.equal(result.Items[0].Status, 'Cancelled')
})
