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
  assert.match(source, /osClient: OS_CLIENT/)
  assert.match(detailSource, /osClient: OS_CLIENT/)
})

test('AI application cards expose the resolved new-window experience action', () => {
  assert.match(source, /class="ai-app-experience"/)
  assert.match(source, /v-if="app\.ExperienceUrl"/)
  assert.match(source, /:href="app\.ExperienceUrl"/)
  assert.match(source, /target="_blank"/)
  assert.match(source, /rel="noopener noreferrer"/)
  assert.doesNotMatch(source, /openPreview\(app\)|window\.open\(app\.ExperienceUrl/u)
  assert.match(detailSource, /v-if="app\.ExperienceUrl"/)
  assert.match(detailSource, /:href="app\.ExperienceUrl"/)
  assert.match(detailSource, /target="_blank"/)
  assert.match(detailSource, /rel="noopener noreferrer"/)
  assert.doesNotMatch(detailSource, /openPreview\(\)|window\.open\(app\.value\.ExperienceUrl/u)
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

test('detail page uses exact application lookup and exposes recommendation state', () => {
  assert.match(detailSource, /JSON\.stringify\(\{ ExactAppKey: appKey, PageIndex: 1, PageSize: 1 \}\)/)
  assert.match(detailSource, /v-if="app\.IsRecommend" class="app-detail-recommend-tag"/)
  assert.match(detailSource, /v-if="isSuperAdmin"/)
  assert.match(detailSource, /official_ai_app_recommend\?OsClient=/)
  assert.match(detailSource, /Number\(currentUser\.value\?\.Level \|\| 0\) >= 9999/)
})

test('detail update log uses a clean surface without grid-line background', () => {
  const changelogStyles = detailSource.match(/\.app-detail-changelog \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(changelogStyles, /linear-gradient\(135deg/)
  assert.doesNotMatch(changelogStyles, /linear-gradient\(var\(--mci-app-detail-line\) 1px/)
  assert.doesNotMatch(changelogStyles, /background-size:/)
  assert.doesNotMatch(detailSource, /app-detail-changelog-sweep/)
})
