import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createMicroiV8 as createProjectSdk } from '../src/utils/microi.v8.js'
import { createMicroiV8 as createStandardSdk } from '../../microi.skills/microi.v8.js'

function memoryStorage(failedKey) {
  const values = new Map()
  return {
    get: key => values.get(key) || '',
    set: (key, value) => { if (key !== failedKey) values.set(key, value) },
    remove: key => values.delete(key)
  }
}

for (const [name, createSdk] of [['项目', createProjectSdk], ['标准', createStandardSdk]]) {
  for (const action of ['重新登录', '退出登录']) {
    test(`${name} SDK：旧续签响应在${action}后不能恢复旧会话`, async () => {
      let resolveResponse
      const sdk = createSdk({ apiBase: 'https://example.test', storage: memoryStorage(),
        requestAdapter: () => new Promise(resolve => { resolveResponse = resolve }) })
      sdk.setToken('old-session')
      const renewal = sdk.refreshToken()
      await Promise.resolve()
      if (action === '重新登录') {
        sdk.setToken('new-login-session')
        sdk.setUser({ Id: 'new-user' })
      } else sdk.clearToken()
      resolveResponse({ statusCode: 200, data: { Code: 1 }, header: { authorization: 'Bearer old-session-renewed' } })
      await renewal
      assert.equal(sdk.getToken(), action === '重新登录' ? 'new-login-session' : '')
      assert.equal(sdk.getUser()?.Id, action === '重新登录' ? 'new-user' : undefined)
    })
  }
  test(`${name} SDK：当前会话续签仍能保存新 Token`, async () => {
    const sdk = createSdk({ apiBase: 'https://example.test', storage: memoryStorage(),
      requestAdapter: async () => ({ statusCode: 200, data: { Code: 1 }, header: { Token: 'renewed-session' } }) })
    sdk.setToken('old-session')
    await sdk.refreshToken()
    assert.equal(sdk.getToken(), 'renewed-session')
  })
  test(`${name} SDK：旧续签失败不能清除新登录，网络失败保留当前会话`, async () => {
    let resolveResponse
    let failNetwork = false
    const sdk = createSdk({ apiBase: 'https://example.test', storage: memoryStorage(),
      requestAdapter: () => failNetwork ? Promise.reject(new Error('diagnostic network error'))
        : new Promise(resolve => { resolveResponse = resolve }) })
    sdk.setToken('old-session')
    const renewal = sdk.refreshToken()
    await Promise.resolve()
    sdk.setToken('new-login-session')
    sdk.setUser({ Id: 'new-user' })
    resolveResponse({ statusCode: 200, data: { Code: 1001 }, header: {} })
    await renewal
    assert.equal(sdk.getToken(), 'new-login-session')
    assert.equal(sdk.getUser()?.Id, 'new-user')
    failNetwork = true
    await assert.rejects(sdk.refreshToken(), /diagnostic network error/)
    assert.equal(sdk.getToken(), 'new-login-session')
    assert.equal(sdk.getUser()?.Id, 'new-user')
  })
}

for (const key of ['microi_token', 'microi_user']) {
  test(`项目 SDK：${key} 静默写入失败必须报错`, () => {
    const sdk = createProjectSdk({ storage: memoryStorage(key) })
    assert.throws(() => key === 'microi_token' ? sdk.setToken('new-session') : sdk.setUser({ Id: 'user-1' }),
      error => error.Code === 'AUTH_STORAGE_FAILED')
  })
}

// 直接执行登录页现有方法，检查保存失败不会发出欢迎提示或返回首页。
const source = readFileSync(new URL('../src/pages/login/index.vue', import.meta.url), 'utf8')
const pageObject = source.slice(source.indexOf('export default ') + 'export default '.length, source.indexOf('</script>')).trim()
for (const failedKey of ['microi_token', 'microi_user', undefined]) {
  test(`账号登录页面：${failedKey || '正常保存'}的提示和导航`, async () => {
    const events = []
    const sdk = createProjectSdk({ apiBase: 'https://example.test', storage: memoryStorage(failedKey),
      requestAdapter: async () => ({ statusCode: 200, data: { Code: 1, Data: { Id: 'user-1', Name: '诊断用户' } }, header: { authorization: 'new-session' } }) })
    const page = vm.runInNewContext(`(${pageObject})`, {
      themeMixin: {}, appConfig: { osClient: 'diagnosis' }, REMEMBERED_PASSWORD_MASK: '••••••••',
      normalizeAuthLoginUser: data => data.CurrentUser || data,
      getLoginResultToken: data => data.Token || '', isValidLoginSession: (user, token) => !!(user.Id && token),
      encryptPassword: () => 'diagnostic-cipher', getClientType: () => 'WxMiniProgram',
      post: (url, data, auth) => sdk.post(url, data, { auth }),
      getToken: sdk.getToken, setToken: sdk.setToken, setUser: sdk.setUser, removeToken: sdk.clearToken,
      uni: { showToast: options => events.push(options.title), showModal: options => events.push(options.title) },
      console: { log() {}, error() {} }
    })
    const state = { ...page.methods, account: 'diagnostic', password: 'diagnostic', isAppRuntime: false,
      enableCaptcha: false, rememberPassword: false, checkPrivacy: () => true, persistLoginPreferences() {},
      t: key => key, showLoginSuccess: () => events.push('welcome'), navigateAfterLogin: () => events.push('navigate') }
    await state.handleAccountLogin()
    assert.equal(events.includes('welcome'), !failedKey)
    assert.equal(events.includes('navigate'), !failedKey)
    assert.equal(!!sdk.getToken() && !!sdk.getUser()?.Id, !failedKey)
    if (failedKey) assert.ok(events.some(message => message.includes('保存')))
    assert.equal(state.accountLoginLoading, false)
  })
}
