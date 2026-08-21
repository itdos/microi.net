import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../docs/.vitepress/theme/components/ProductShowcase.vue', import.meta.url), 'utf8')
const detailSource = await readFile(new URL('../docs/.vitepress/theme/components/AppDetail.vue', import.meta.url), 'utf8')

test('homepage, apps page, and detail page share the stable experience resolver', () => {
  assert.match(source, /\['\/',[\s\S]*?'\/apps',[\s\S]*?'\/apps\.html'\]\.includes/)
  assert.match(source, /import \{ resolveApplicationExperienceUrl \} from '\.\.\/utils\/app-preview-url\.js'/)
  assert.match(detailSource, /import \{ resolveApplicationExperienceUrl \} from '\.\.\/utils\/app-preview-url\.js'/)
  assert.match(source, /ExperienceUrl: resolveApplicationExperienceUrl\(app,/)
  assert.match(detailSource, /ExperienceUrl: resolveApplicationExperienceUrl\(item,/)
})

test('AI application cards expose the resolved new-window experience action', () => {
  assert.match(source, /class="ai-app-experience"/)
  assert.match(source, /@click\.stop="openPreview\(app\)"/)
  assert.match(source, /v-if="app\.ExperienceUrl"/)
  assert.match(source, /window\.open\(app\.ExperienceUrl,\s*['_"]_blank['_"],\s*['_"]noopener,noreferrer['_"]\)/)
  assert.match(detailSource, /v-if="app\.ExperienceUrl"/)
  assert.match(detailSource, /window\.open\(app\.value\.ExperienceUrl,\s*['_"]_blank['_"],\s*['_"]noopener,noreferrer['_"]\)/)
  assert.doesNotMatch(detailSource, /app\.value\.PreviewUrl\s*=/)
})

test('AI application cards open their detail page in a new browser tab', () => {
  const detailHandler = source.match(/function openDetail\(app\) \{[\s\S]*?\n\}/)?.[0] || ''

  assert.match(detailHandler, /\/app-detail\.html\?app=/)
  assert.match(detailHandler, /window\.open\(detailUrl,\s*['_"]_blank['_"],\s*['_"]noopener,noreferrer['_"]\)/)
  assert.doesNotMatch(detailHandler, /window\.location\.href/)
})

test('nested card actions do not trigger detail navigation from keyboard events', () => {
  assert.match(source, /@keydown\.enter\.self="openDetail\(app\)"/)
  assert.match(source, /@keydown\.space\.self\.prevent="openDetail\(app\)"/)
})
