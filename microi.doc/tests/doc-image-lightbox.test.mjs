import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
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

  assert.equal((microApp.match(/data-fancybox="micro-app-cases"/g) || []).length, 4)
  assert.match(microApp, /microservice-crm-customer-map\.png/)
  assert.match(microApp, /menu-production-counter\.jpg/)
  assert.match(microApp, /menu-packing-workbench\.jpg/)
  assert.doesNotMatch(microApp, /micro-app-case is-wide/)
  const intro = microApp.indexOf('吾码官网 [AI 应用广场]')
  const cases = microApp.indexOf('## 真实案例：同一能力融入不同业务位置')
  const modes = microApp.indexOf('## 四种运行方式')
  assert.ok(intro < cases && cases < modes, 'MicroService case preview should be prioritized immediately after the introduction')
  assert.match(styles, /\.micro-app-case-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[\s\S]*?gap:\s*18px/)
  assert.match(styles, /\.micro-app-case img\s*\{[\s\S]*?object-fit:\s*contain/)
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.micro-app-case-grid[\s\S]*?grid-template-columns:\s*1fr/)
})

test('system settings, API engine and form fields show original screenshots in shared two-column galleries', () => {
  const styles = read('docs/.vitepress/theme/styles/doc-readable.scss')
  const pages = [
    ['docs/doc/more/sys-config.md', 'sys-config-preview', ['system-settings-light.jpg', 'system-settings-dark.jpg']],
    ['docs/doc/v8-engine/api-engine.md', 'api-engine-preview', ['api-engine-detail.jpg', 'api-engine-ai-copilot.png']],
    ['docs/doc/form-engine/form-field-info.md', 'form-field-preview', ['form-field-image-upload-settings.jpg', 'form-field-text-settings.jpg']]
  ]

  assert.match(styles, /\.mci-doc-screenshot-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.mci-doc-screenshot-grid[\s\S]*?grid-template-columns:\s*1fr/)
  for (const [file, gallery, images] of pages) {
    const content = read(file)
    assert.ok(content.indexOf('mci-doc-screenshot-grid') < content.indexOf('\n## ', content.indexOf('mci-doc-screenshot-grid') + 1), `${file} preview should precede the detailed body`)
    assert.equal((content.match(new RegExp(`data-fancybox="${gallery}"`, 'g')) || []).length, 2)
    for (const image of images) assert.match(content, new RegExp(`/images/product-screenshots/${image.replace('.', '\\.')}`))
  }
  assert.doesNotMatch(read('docs/doc/v8-engine/api-engine.md'), /microi-apiengine-20260208\.jpg/)
})

test('copied product screenshots preserve the exact original bytes supplied for documentation', () => {
  const expected = new Map([
    ['microservice-crm-customer-map.png', 'dcf2f6a25884c9c032ccb5439a7fa7d0c2f6c52b7960adc9cc2afc03658a4bc4'],
    ['system-settings-light.jpg', '10ec8ca0bbc527de835041461e516fd7648360f47e0ce27f970acb2fb691f74a'],
    ['system-settings-dark.jpg', '7fcca5cd2c35d2f177d59ba2630b26207ce8a2b4e139234fd3470b3903847f3d'],
    ['api-engine-detail.jpg', '0de281a1146fb310f0617c8c30182db637f994e7e24f4766a2528b9cfb083fe5'],
    ['api-engine-ai-copilot.png', '4b8c65fb7393794400f2562093f5d6f7ea71cd0899b6c22959c89bc04839347e'],
    ['form-field-image-upload-settings.jpg', '0e554ede46e8b9b6f13e1834eec28a7718ed5d1cd32180f1a1f13fb445a10791'],
    ['form-field-text-settings.jpg', '824bb1072ad7c320c3cf878853c62e8eddc7a02281d7862467e69111554df4a9']
  ])
  for (const [file, digest] of expected) {
    const image = fs.readFileSync(path.join(projectRoot, 'docs/public/images/product-screenshots', file))
    assert.equal(createHash('sha256').update(image).digest('hex'), digest, file)
  }
})

test('platform preview precedes searchable architecture, AI efficiency, role and highlight sections', () => {
  const index = read('docs/doc/index.md')
  const readme = fs.readFileSync(path.resolve(projectRoot, '..', 'README.md'), 'utf8')
  for (const content of [index, readme]) {
    const preview = content.indexOf('## 📸 预览图')
    assert.ok(preview > 0)
    for (const [label, pattern] of [
      ['架构能力全景（可检索文本）', /^### 架构能力全景（可检索文本）/m],
      ['为什么 AI 开发更快、更省 Token', /^#{2,3} 🚀 为什么.*更快、更省 Token/m],
      ['按角色进入', /^### 按角色进入/m],
      ['平台亮点', /^## ✨ 平台亮点/m]
    ]) {
      assert.ok(content.search(pattern) > preview, `${label} should appear after preview`)
    }
    assert.doesNotMatch(content, /microi-apiengine-20260208\.jpg/)
    assert.match(content, /product-screenshots\/api-engine-ai-copilot\.png/)
  }
})
