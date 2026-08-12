import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../docs/.vitepress/theme/components/ProductShowcase.vue', import.meta.url), 'utf8')

test('AI application cards expose a direct new-window experience action', () => {
  assert.match(source, /class="ai-app-experience"/)
  assert.match(source, /@click\.stop="openPreview\(app\)"/)
  assert.match(source, /buildApplicationLaunchUrl\(app, previewUrl, window\)/)
  assert.match(source, /window\.open\([^\n]+['_"]_blank['_"],\s*['_"]noopener,noreferrer['_"]/)
})

test('nested card actions do not trigger detail navigation from keyboard events', () => {
  assert.match(source, /@keydown\.enter\.self="openDetail\(app\)"/)
  assert.match(source, /@keydown\.space\.self\.prevent="openDetail\(app\)"/)
})
