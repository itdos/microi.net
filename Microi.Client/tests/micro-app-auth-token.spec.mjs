import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createMicroiV8 } from '../../microi.skills/microi.v8.js'
import { platformServiceSourcePath } from './helpers/platform-service-source.mjs'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('micro app SDK keeps rotated tokens across normal requests and uploads', async () => {
  const originalFetch = globalThis.fetch
  const requests = []
  const tokenChanges = []
  const responses = [
    new Response(JSON.stringify({ Code: 1, Data: {} }), {
      headers: { authorization: 'Bearer rotated-after-query' }
    }),
    new Response(JSON.stringify({ Code: 1, Data: [{ Path: '/itdos/file/202607/a.zip' }] }), {
      headers: { authorization: 'Bearer rotated-after-upload' }
    })
  ]
  const values = new Map()
  const storage = {
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    remove: (key) => values.delete(key)
  }

  globalThis.fetch = async (url, options) => {
    requests.push({ url, options })
    return responses.shift()
  }

  try {
    const client = createMicroiV8({
      apiBase: 'https://localhost:61501',
      osClient: 'itdos',
      token: 'initial-token',
      storage,
      onTokenChanged: (token, requestToken) => tokenChanges.push({ token, requestToken })
    })

    await client.post('/api/Os/GetOsClient', {})
    assert.equal(client.getToken(), 'rotated-after-query')

    await client.uploadFile(new Blob(['zip']), {
      file: new Blob(['zip']),
      fileName: 'database.zip',
      path: 'file',
      preview: false,
      preferFetch: true,
      resolveUrl: false
    })

    const uploadHeaders = requests[1].options.headers
    const authorization = Object.entries(uploadHeaders).find(([key]) => key.toLowerCase() === 'authorization')?.[1]
    assert.equal(authorization, 'Bearer rotated-after-query')
    assert.equal(client.getToken(), 'rotated-after-upload')
    assert.deepEqual(tokenChanges, [
      { token: 'rotated-after-query', requestToken: 'initial-token' },
      { token: 'rotated-after-upload', requestToken: 'rotated-after-query' }
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('tenant micro app uses one V8 instance and synchronizes rotated tokens with its host', () => {
  const appRoot = platformServiceSourcePath('src')
  const bridge = readFileSync(resolve(appRoot, 'microi.js'), 'utf8')
  const sdk = readFileSync(resolve(appRoot, 'utils/microi.v8.js'), 'utf8')

  assert.match(bridge, /import V8 from/)
  assert.doesNotMatch(bridge, /createMicroiV8/)
  assert.match(bridge, /onTokenChanged:\s*notifyHostTokenChanged/)
  assert.match(bridge, /micro-app:token/)
  assert.match(sdk, /handleReturnedToken\(res\.headers\)/)
  assert.match(sdk, /handleReturnedToken\(res\.header \|\| res\.headers \|\| \{\}\)/)

  for (const file of ['dialog.vue', 'host.vue', 'dev-component.vue']) {
    assert.match(read(`src/views/micro-app/${file}`), /applyMicroAppToken/)
  }
})
