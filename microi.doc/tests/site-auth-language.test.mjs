import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import { buildSiteApiEngineUrl } from '../docs/.vitepress/theme/utils/site-api-base.js'
import { buildSiteSessionHeaders, getOrCreateSiteDid } from '../docs/.vitepress/theme/utils/site-session.js'

const component = fs.readFileSync(new URL('../docs/.vitepress/theme/components/LoginPage.vue', import.meta.url), 'utf8')
const script = component.match(/<script setup>([\s\S]*?)<\/script>/)[1]
  .replace(/^import .*$/gm, '')
  .replaceAll('import.meta.env', 'env')

// 执行页面真实提交函数，只替换网络与生命周期；不把凭据写入磁盘或调用线上接口。
function fixture(locale, result = { Code: 0, Msg: '服务端本地化错误' }) {
  const requests = []
  const pageLanguage = { value: locale }
  const values = new Map()
  const context = {
    env: {},
    ref: value => ({ value }),
    computed: getter => ({ get value() { return getter() } }),
    watch() {}, onMounted() {}, onUnmounted() {},
    useData: () => ({ lang: pageLanguage }),
    siteStyle: { value: 'minimal' },
    resolveSiteApiBase: () => 'https://api.example.invalid',
    buildSiteApiEngineUrl, buildSiteSessionHeaders, getOrCreateSiteDid,
    localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) },
    window: { crypto: { randomUUID: () => '11111111-2222-4333-8444-555555555555' }, location: { search: '' } },
    URLSearchParams,
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    fetch: async (url, options) => {
      requests.push({ url, ...options, body: options.body ? JSON.parse(options.body) : null })
      return { json: async () => result, headers: { get: () => null } }
    }
  }
  vm.createContext(context)
  vm.runInContext(`${script}\nthis.subject = {
    handleLogin, handleRegister, resetPassword, sendRegisterSmsCode, sendResetSmsCode,
    loginAccount, loginPassword, registerPhone, registerSmsCode, registerPassword, confirmPassword,
    resetPhone, resetSmsCode, resetPasswordValue, resetConfirmPassword, captchaId, captchaValue, toastMsg
  }`, context)
  const subject = context.subject
  for (const field of ['loginAccount', 'registerPhone', 'resetPhone']) subject[field].value = '13800000000'
  for (const field of ['loginPassword', 'registerPassword', 'confirmPassword', 'resetPasswordValue', 'resetConfirmPassword']) subject[field].value = 'fixture-password'
  for (const field of ['registerSmsCode', 'resetSmsCode', 'captchaValue']) subject[field].value = '123456'
  subject.captchaId.value = 'fixture-captcha'
  return { requests, pageLanguage, subject }
}

const actions = [
  ['handleLogin', 'official_sms_login'],
  ['handleRegister', 'official_sms_login'],
  ['resetPassword', 'official_password_reset'],
  ['sendRegisterSmsCode', 'send-sms-reg'],
  ['sendResetSmsCode', 'official_password_reset_send_sms']
]

for (const locale of ['zh-CN', 'en-US', 'zh-TW']) {
  for (const [action, engine] of actions) {
    test(`${action} 将当前页面 ${locale} 同时传给语言 Header 和正文`, async () => {
      const f = fixture(locale)
      await f.subject[action]()
      const request = f.requests.find(item => item.url.endsWith(`/apiengine/${engine}`))
      assert.ok(request, '必须实际发出目标认证请求')
      assert.equal(request.headers.lang, locale)
      assert.equal(request.body._Lang, locale)
      assert.equal(request.headers.osclient, 'iTdos')
      assert.equal(request.body.OsClient, 'iTdos')
      assert.match(request.headers.did, /^MicroiWeb:/)
    })
  }
}

test('登录错误保持服务器返回的语言文案，不在客户端伪造成功或替换错误', async () => {
  const f = fixture('en-US', { Code: 0, Msg: 'Incorrect account or password.' })
  await f.subject.handleLogin()
  assert.equal(f.subject.toastMsg.value, 'Incorrect account or password.')
})

test('提交时读取当前页面语言，路由语言切换后不复用旧语言', async () => {
  const f = fixture('zh-CN')
  f.pageLanguage.value = 'en-US'
  await f.subject.handleLogin()
  assert.equal(f.requests[0].headers.lang, 'en-US')
  assert.equal(f.requests[0].body._Lang, 'en-US')
})

test('页面语言缺失时使用官网默认简体中文', async () => {
  const f = fixture('')
  await f.subject.handleLogin()
  assert.equal(f.requests[0].headers.lang, 'zh-CN')
  assert.equal(f.requests[0].body._Lang, 'zh-CN')
})
