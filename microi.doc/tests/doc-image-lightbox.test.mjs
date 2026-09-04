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
  assert.equal(images.length, 22)
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

test('Bluetooth printer previews use the shared two-column gallery before the conclusion', () => {
  const content = read('docs/doc/system-engine/bluetooth-printer.md')
  const preview = content.indexOf('## 📸 预览图')
  const conclusion = content.indexOf('## 先看结论')
  const gallery = content.match(/<div class="mci-doc-screenshot-grid">([\s\S]*?)<\/div>/)?.[1] || ''
  const expected = [
    'bluetooth-printer-output-gp-m322.jpg',
    'bluetooth-printer-output-test-page.jpg',
    'mobile-bluetooth-settings.jpg',
    'mobile-bluetooth-print-specification.jpg'
  ]

  assert.ok(preview > 0 && preview < conclusion, 'Bluetooth printer preview should precede the conclusion')
  assert.equal((gallery.match(/data-fancybox="bluetooth-printer-preview"/g) || []).length, 4)
  for (const file of expected) assert.match(gallery, new RegExp(`/images/product-screenshots/${file.replace('.', '\\.')}`))
})

test('system engine preview nodes keep the requested screenshot mapping and order', () => {
  const styles = read('docs/.vitepress/theme/styles/doc-readable.scss')
  const pages = [
    ['docs/doc/system-engine/ai-workflow-suite.md', 'ai-workflow-suite-preview', ['ai-workflow-relationship-graph.jpg', 'ai-workflow-designer.jpg']],
    ['docs/doc/system-engine/vision-engine.md', 'vision-engine-preview', ['vision-engine-workbench.jpg']],
    ['docs/doc/system-engine/ai-platform-governance.md', 'ai-platform-governance-preview', ['ai-platform-governance-observability.jpg', 'ai-platform-governance-health.jpg', 'ai-platform-governance-overview.jpg']],
    ['docs/doc/system-engine/ai-engine.md', 'ai-engine-preview', ['ai-engine-creation-center.jpg']],
    ['docs/doc/system-engine/file-manage.md', 'file-manage-preview', ['file-manage-sync-dialog.jpg']],
    ['docs/doc/system-engine/app-store.md', 'app-store-preview', ['app-store-marketplace.jpg']],
    ['docs/doc/system-engine/visualization-engine.md', 'visualization-engine-preview', ['visualization-engine-unity-dashboard.jpg']]
  ]

  assert.match(styles, /\.mci-doc-screenshot-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(styles, /\.mci-doc-screenshot-grid--single\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  for (const [file, group, images] of pages) {
    const content = read(file)
    const preview = content.indexOf('## 📸 预览图')
    const nextHeading = content.indexOf('\n## ', preview + 4)
    const section = content.slice(preview, nextHeading < 0 ? content.length : nextHeading)
    assert.ok(preview > 0, `${file} preview heading is missing`)
    assert.equal((section.match(new RegExp(`data-fancybox="${group}"`, 'g')) || []).length, images.length)
    let previous = -1
    for (const image of images) {
      const position = section.indexOf(`/images/product-screenshots/${image}`)
      assert.ok(position > previous, `${file} should keep ${image} in the requested order`)
      previous = position
    }
  }
})

test('copied product screenshots preserve the exact original bytes supplied for documentation', () => {
  const expected = new Map([
    ['microservice-crm-customer-map.png', 'dcf2f6a25884c9c032ccb5439a7fa7d0c2f6c52b7960adc9cc2afc03658a4bc4'],
    ['system-settings-light.jpg', '10ec8ca0bbc527de835041461e516fd7648360f47e0ce27f970acb2fb691f74a'],
    ['system-settings-dark.jpg', '7fcca5cd2c35d2f177d59ba2630b26207ce8a2b4e139234fd3470b3903847f3d'],
    ['api-engine-detail.jpg', '0de281a1146fb310f0617c8c30182db637f994e7e24f4766a2528b9cfb083fe5'],
    ['api-engine-ai-copilot.png', '4b8c65fb7393794400f2562093f5d6f7ea71cd0899b6c22959c89bc04839347e'],
    ['form-field-image-upload-settings.jpg', '0e554ede46e8b9b6f13e1834eec28a7718ed5d1cd32180f1a1f13fb445a10791'],
    ['form-field-text-settings.jpg', '824bb1072ad7c320c3cf878853c62e8eddc7a02281d7862467e69111554df4a9'],
    ['bluetooth-printer-output-gp-m322.jpg', 'f0349a8a0c493a7c602916b49dee773e4000a006fa0781e0a09f19455c2a02f2'],
    ['bluetooth-printer-output-test-page.jpg', 'c70f7520d92a245292eb31ce851c9c81f6ef2fd0a8df9d21fc7aaef32d4d029b'],
    ['mobile-bluetooth-settings.jpg', '2490856187ccf8ae2235d5193306a6388cb90ab121d6c31f6f9a9cfc4db8b5e0'],
    ['mobile-bluetooth-print-specification.jpg', '1bbb036c8314f5e0eed1d68ae0278d6d4dc355809f30f7db0880558495a43ec1'],
    ['webos-api-engine-workspace.jpg', '2ea4a3c6b6d192f427a934b5d0abfe0ab07e472e154473785165212d3b2d2ad0'],
    ['mobile-ai-assistant.jpg', 'fdf568794496b20e5549fd927dda701b04fbfd7b44f9ccfe622dc11775288609'],
    ['mobile-workbench.jpg', 'b9c76a2b9f2c811cc19e8ce302ae1e5df9a6583ee54660880229212fbe532e94'],
    ['ai-workflow-relationship-graph.jpg', '4a380f5ec34ce68a55f3fe19310f00cd9e10e64fd11570cddd42122b350480db'],
    ['ai-workflow-designer.jpg', 'e16b76fa6657da10f3a14ec5abe8a847f2bc7e4cc6777168829931a87ae9d181'],
    ['vision-engine-workbench.jpg', '6c9157277957b8f66ea9ed3975e331263750d33ab38fb5195469c20783bd742a'],
    ['ai-platform-governance-observability.jpg', '24a426757a9d5c3fc496d259ca08f2affc45e0af38475b6eee6203e545676650'],
    ['ai-platform-governance-health.jpg', '25f53ad2e5ef659d3eefdabf2120fb1c58aa17906061a406014b10230b427014'],
    ['ai-platform-governance-overview.jpg', '8a2b446d0f0d1b7ef4eb40f7f79dd1658207376a9d45a7b61c4111ef9a428c4f'],
    ['ai-engine-creation-center.jpg', '5c936f0ef9f2166a2ef26d37b31fc65f2b943117959c2cc0d6b6845eeec8461d'],
    ['file-manage-sync-dialog.jpg', '0559d12ec7b6a679d7fee17492e8587da04f92d4c9e507f23715927370851267'],
    ['app-store-marketplace.jpg', '05e5376bd878b6029a55a6b23fe394531c14364e9dee033a06019e70c1e7ea3a'],
    ['visualization-engine-unity-dashboard.jpg', '1843f6986d6a275fb12e1213e5c31740dbfe874a186e1d00d46cd77abfa11679']
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

test('platform preview keeps the requested three-image row and removes superseded images', () => {
  const index = read('docs/doc/index.md')
  const readme = fs.readFileSync(path.resolve(projectRoot, '..', 'README.md'), 'utf8')
  const expectedOrder = [
    'webos-api-engine-workspace.jpg',
    'ScreenShot_2026-07-08_231038_158.jpg',
    'api-engine-ai-copilot.png'
  ]
  const removed = [
    '23ca5070e927a7a7cc3687221fe483dd.jpeg',
    '6cf3c31ba0e8da4a124cb1bf8c755b74.jpeg',
    '移动端-蓝牙打印2.jpg'
  ]

  for (const content of [index, readme]) {
    const row = (content.match(/<tr>\s*<td><img[^>]*webos-api-engine-workspace\.jpg[\s\S]*?<\/tr>/) || [])[0] || ''
    assert.ok(row, 'requested platform preview row is missing')
    assert.equal((row.match(/<td>/g) || []).length, 3)
    let previous = -1
    for (const file of expectedOrder) {
      const position = row.indexOf(file)
      assert.ok(position > previous, `${file} should keep the requested order`)
      previous = position
    }
    for (const file of removed) assert.doesNotMatch(content, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(content, /mobile-bluetooth-print-specification\.jpg/)
    assert.match(content, /mobile-ai-assistant\.jpg/)
    assert.match(content, /mobile-workbench\.jpg/)
  }
})
