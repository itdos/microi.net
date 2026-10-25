import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from 'vue/compiler-sfc'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import ts from 'typescript'
import { isUnlimitedQuota, normalizeRelayQuota } from '../docs/.vitepress/theme/profile-relay-quota.mjs'

const page = readFileSync(new URL('../docs/.vitepress/theme/components/ProfilePage.vue', import.meta.url), 'utf8')
const componentUrl = new URL('../docs/.vitepress/theme/components/ProfileAiSummary.vue', import.meta.url)
const { descriptor } = parse(readFileSync(componentUrl, 'utf8'))
let compiled = compileScript(descriptor, { id: 'relay-quota-test', inlineTemplate: true, templateOptions: { ssr: true } }).content
compiled = ts.transpileModule(compiled, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replace(/from ["'](vue(?:\/server-renderer)?)["']/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`)
  .replace("'../profile-relay-quota.mjs'", JSON.stringify(new URL('../profile-relay-quota.mjs', componentUrl).href))
const { default: Summary } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('unlimited is explicit; false strings and sentinel balances never grant it', () => {
  for (const value of [true, 1, '1', 'true']) assert.equal(isUnlimitedQuota(value), true)
  for (const value of [false, 0, 'false', '0', '', null, undefined, {}, [], -1, Infinity, 'yes', 'TRUE']) assert.equal(isUnlimitedQuota(value), false)
  assert.equal(normalizeRelayQuota({ RemainingTokens: -1 }).IsUnlimited, false)
  assert.deepEqual(normalizeRelayQuota({ GiftTokens: 0, UsedTokens: '99944', RemainingTokens: '56', IsUnlimited: true }),
    { GiftTokens: 0, UsedTokens: 99944, RemainingTokens: 56, IsUnlimited: true })
})

test('real summary component renders unlimited in both languages and preserves historical usage', async () => {
  for (const [locale, label] of [['zh-CN', '无限额度'], ['en-US', 'Unlimited quota']]) {
    const props = { apiKey: '', endpoint: 'https://api.microi.net/v1', total: 100000, used: 99944, remaining: 56, locale,
      labels: { total: 'total', used: 'used', remaining: 'remaining', unlimited: label } }
    const html = await renderToString(createSSRApp(Summary, { ...props, isUnlimited: true }))
    assert.equal(html.split(label).length - 1, 2)
    assert.match(html, /99,944/)
    assert.doesNotMatch(html, /<strong\b[^>]*>56<\/strong>|progressbar|aria-valuenow/)
    const finite = await renderToString(createSSRApp(Summary, { ...props, isUnlimited: 'false' }))
    assert.doesNotMatch(finite, new RegExp(label))
    assert.match(finite, /<strong\b[^>]*>56<\/strong>/)
  }
})

function pageAction(name, nextName, bindings) {
  const code = page.slice(page.indexOf(`async function ${name}(`), page.indexOf(`async function ${nextName}(`))
  return new Function(...Object.keys(bindings), `${code}; return ${name}`)(...Object.values(bindings))
}

test('summary owns entitlement; a later legacy log response cannot overwrite unlimited or balances', async () => {
  const relayToken = { value: normalizeRelayQuota() }
  let payload = { Code: 1, Data: { GiftTokens: 100000, UsedTokens: 99944, RemainingTokens: 56, IsUnlimited: true } }
  const common = { isAuthed: { value: true }, authenticatedFetch: async () => ({ json: async () => payload }),
    API_BASE: 'https://api.microi.net', OS_CLIENT: 'iTdos', isSessionExpiredResult: () => false,
    handleSessionExpired() {}, relayToken, normalizeRelayQuota, openClawAuthBridge: { notify() {} } }
  await pageAction('refreshRelayTokenSummary', 'refreshAiApiKey', common)()
  const summary = { ...relayToken.value }
  payload = { Code: 1, Data: { GiftTokens: 1, UsedTokens: 1, RemainingTokens: 0, Logs: [{ Id: 'synthetic-log' }], TotalCount: 1 } }
  const usageBody = page.slice(page.indexOf('async function refreshAiUsage('), page.indexOf('function goAiUsagePage('))
  const refs = { ...common, apiEngineUrl: () => '/synthetic', aiUsagePageIndex: { value: 1 }, aiUsagePageSize: { value: 20 },
    aiUsageLoading: { value: false }, aiUsageTotal: { value: 0 }, relayUsageLogs: { value: [] } }
  await new Function(...Object.keys(refs), `${usageBody}; return refreshAiUsage`)(...Object.values(refs))()
  assert.deepEqual(relayToken.value, summary)
  assert.deepEqual(refs.relayUsageLogs.value, [{ Id: 'synthetic-log' }])
  assert.match(page, /:is-unlimited="relayToken.IsUnlimited"/)
  assert.doesNotMatch(page, /const tokenUsagePercent/)
})
