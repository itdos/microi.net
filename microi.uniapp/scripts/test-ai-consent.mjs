import assert from 'node:assert/strict'
import fs from 'node:fs'
import { aiConsentStorageKey, grantAiConsent, readAiConsent, revokeAiConsent } from '../src/platform/ai-consent.mjs'
import { resolveAiAssistantEntryEnabled } from '../src/platform/ai-entry-visibility.mjs'
import { isInviteEntryVisible, isMessageTabBarVisible } from '../src/utils/feature-flags.js'

const values = new Map()
globalThis.uni = {
  getStorageSync(key) { return values.get(key) },
  setStorageSync(key, value) { values.set(key, value) },
  removeStorageSync(key) { values.delete(key) }
}

const apiBase = 'https://api.jima.pro'
const osClient = 'wxcrm'
const userId = 'user-1'
const key = aiConsentStorageKey(apiBase, osClient, userId)
assert.match(key, /^mci_ai_consent_v1:[0-9a-f]{8}$/)
assert.equal(key.includes(userId), false, '本地同意键不得包含明文用户标识')
assert.equal(readAiConsent(apiBase, osClient, userId), null)

assert.equal(resolveAiAssistantEntryEnabled(null), false, '缺少 SysConfig 时 AI 入口必须失败即关闭')
assert.equal(resolveAiAssistantEntryEnabled({}), true, '有效 SysConfig 未禁用 AI 时应与 PC 默认显示契约一致')
assert.equal(resolveAiAssistantEntryEnabled({ DisableAiAssistant: 0, IsShowAiAssistant: 0 }), true, '不得再被旧正向字段误隐藏')
for (const value of [1, true, '1', 'true', ' TRUE ']) {
  assert.equal(resolveAiAssistantEntryEnabled({ DisableAiAssistant: value }), false, `DisableAiAssistant=${value} 应隐藏入口`)
  assert.equal(isMessageTabBarVisible({ DisableMessageTabBar: value }), false, `DisableMessageTabBar=${value} 应隐藏消息入口`)
  assert.equal(isInviteEntryVisible({ DisableInviteEntry: value }), false, `DisableInviteEntry=${value} 应隐藏邀请入口`)
}
assert.equal(isMessageTabBarVisible({}), true, '旧租户缺少消息开关时必须保持消息入口')
assert.equal(isInviteEntryVisible(null), true, '系统配置暂时不可用时必须保持邀请入口原行为')
assert.equal(grantAiConsent(apiBase, osClient, userId), true)
assert.equal(readAiConsent(apiBase, osClient, userId).version, '1.0')
assert.equal(readAiConsent(apiBase, osClient, 'user-2'), null, '同意状态必须按账号隔离')
assert.equal(readAiConsent(apiBase, 'other', userId), null, '同意状态必须按租户连接隔离')
revokeAiConsent(apiBase, osClient, userId)
assert.equal(readAiConsent(apiBase, osClient, userId), null)

const component = fs.readFileSync(new URL('../src/pages/ai/components/mci-ai-assistant/mci-ai-assistant.vue', import.meta.url), 'utf8')
for (const keyword of ['consentGranted', 'acceptConsent', 'confirmRevokeConsent', '内容反馈', 'submitAiContentFeedback']) {
  assert.ok(component.includes(keyword), `AI 助手缺少治理能力：${keyword}`)
}
assert.ok(component.includes('不会把登录密码、Token 或连接密钥放入 AI 问题'), 'AI 使用前必须清楚说明不会发送认证秘密')

console.log('[ai-consent] PASS: PC-aligned AI entry, scoped consent, revoke and in-app feedback entry')
