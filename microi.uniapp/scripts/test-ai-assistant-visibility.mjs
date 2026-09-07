import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  isAiAssistantVisible,
  isInviteEntryVisible,
  isMessageTabBarVisible
} from '../src/utils/feature-flags.js'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('AI assistant is visible unless DisableAiAssistant is explicitly enabled', () => {
  for (const config of [
    undefined,
    null,
    {},
    { DisableAiAssistant: undefined },
    { DisableAiAssistant: null },
    { DisableAiAssistant: '' },
    { DisableAiAssistant: 0 },
    { DisableAiAssistant: '0' },
    { DisableAiAssistant: false },
    { DisableAiAssistant: 'false' },
    { DisableAiAssistant: 'unexpected' }
  ]) {
    assert.equal(isAiAssistantVisible(config), true)
  }

  for (const value of [1, '1', true, 'true', ' TRUE ']) {
    assert.equal(isAiAssistantVisible({ DisableAiAssistant: value }), false)
  }
})

test('deprecated IsShowAiAssistant never participates in visibility', () => {
  assert.equal(isAiAssistantVisible({ IsShowAiAssistant: 0 }), true)
  assert.equal(isAiAssistantVisible({ IsShowAiAssistant: 1 }), true)
  assert.equal(isAiAssistantVisible({ IsShowAiAssistant: 0, DisableAiAssistant: 0 }), true)
  assert.equal(isAiAssistantVisible({ IsShowAiAssistant: 1, DisableAiAssistant: 1 }), false)
})

for (const [label, fieldName, resolver] of [
  ['message tabBar', 'DisableMessageTabBar', isMessageTabBarVisible],
  ['invite entry', 'DisableInviteEntry', isInviteEntryVisible]
]) {
  test(`${label} is visible unless ${fieldName} is explicitly enabled`, () => {
    for (const value of [undefined, null, '', 0, '0', false, 'false', 'unexpected']) {
      assert.equal(resolver({ [fieldName]: value }), true)
    }
    for (const value of [1, '1', true, 'true', ' TRUE ']) {
      assert.equal(resolver({ [fieldName]: value }), false)
    }
  })
}

test('mobile entry switches are wired to both tabBar runtimes and the profile invitation row', async () => {
  const [launcher, customTabBar, profile, app, theme] = await Promise.all([
    readFile(resolve(projectRoot, 'src/components/mci-ai-launcher/mci-ai-launcher.vue'), 'utf8'),
    readFile(resolve(projectRoot, 'src/custom-tab-bar/index.js'), 'utf8'),
    readFile(resolve(projectRoot, 'src/pages/profile/index.vue'), 'utf8'),
    readFile(resolve(projectRoot, 'src/App.vue'), 'utf8'),
    readFile(resolve(projectRoot, 'src/utils/theme.js'), 'utf8')
  ])

  assert.match(launcher, /getMessageTabBarEnabled/)
  assert.match(launcher, /MESSAGE_TAB_ROUTE/)
  assert.match(launcher, /const initialEntryState = readGlobalEntryState\(\)/)
  assert.match(launcher, /scheduleWeixinTabBarSync\(\)/)
  assert.match(launcher, /\[0, 32, 120, 300\]/)
  assert.match(
    launcher,
    /updateGlobalEntryState\(aiAssistantEnabled, messageTabBarEnabled\)[\s\S]*scheduleWeixinTabBarSync\(\)/
  )
  const activateMethod = launcher.match(/activate\(\) \{([\s\S]*?)\n    \},\n    restoreGlobalEntryState/)
  assert.ok(activateMethod, 'launcher activate method must remain inspectable')
  assert.doesNotMatch(activateMethod[1], /(?:sync|schedule)WeixinTabBarSync\(/,
    'page activation must not push visible defaults before resolving the entry switches')
  assert.match(customTabBar, /messageTabBarEnabled/)
  assert.match(customTabBar, /MESSAGE_TAB_ROUTE/)
  assert.match(profile, /getInviteEntryEnabled/)
  assert.match(profile, /inviteEntryEnabled && featureEnabled\('invitations'\)/)
  assert.match(app, /mciMessageTabBarEnabled: true/)
  assert.match(theme, /tabBar\.syncSelectedFromRoute\(\)/)
})
