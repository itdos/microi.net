import assert from 'node:assert/strict'
import test from 'node:test'

import { isAiAssistantVisible } from '../src/utils/feature-flags.js'

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
