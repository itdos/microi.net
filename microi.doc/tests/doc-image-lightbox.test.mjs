import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')

test('documentation keeps one shared Fancybox image preview implementation', () => {
  const shared = read('docs/.vitepress/config/shared.ts')
  const theme = read('docs/.vitepress/theme/index.ts')

  assert.match(shared, /mdItCustomAttrs,\s*"image",\s*\{\s*"data-fancybox":\s*"gallery"\s*\}/)
  assert.match(shared, /\/assets\/fancybox\.css/)
  assert.match(shared, /\/assets\/fancybox\.umd\.js/)
  assert.doesNotMatch(theme, /DocImageLightbox/)
})

test('platform introduction raw HTML cases join one Fancybox gallery', () => {
  const index = read('docs/doc/index.md')
  const galleryMatch = index.match(/<table class="mci-doc-preview-gallery">([\s\S]*?)<\/table>/)

  assert.ok(galleryMatch, 'platform preview table is missing')
  const images = galleryMatch[1].match(/<img\b[^>]*>/g) || []
  assert.equal(images.length, 21)
  for (const image of images) {
    assert.match(image, /data-fancybox="platform-preview"/)
    assert.match(image, /alt="[^"]+"/)
  }
  assert.match(index, /microi-ai-platform-architecture\.svg/)
})

test('MicroService cases share Fancybox and use equal half-width desktop columns', () => {
  const microApp = read('docs/doc/system-engine/micro-app.md')
  const styles = read('docs/.vitepress/theme/styles/micro-app.scss')

  assert.equal((microApp.match(/data-fancybox="micro-app-cases"/g) || []).length, 3)
  assert.match(microApp, /menu-production-counter\.jpg/)
  assert.match(microApp, /menu-packing-workbench\.jpg/)
  assert.match(styles, /\.micro-app-case-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[\s\S]*?gap:\s*18px/)
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.micro-app-case-grid[\s\S]*?grid-template-columns:\s*1fr/)
})
