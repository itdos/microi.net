import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const workspaceRoot = resolve(root, '..', '..', '..', '..', '..')
const read = (file) => readFile(resolve(root, file), 'utf8')

test('十个治理路由都有页面实现且导入中心使用后台任务', async () => {
  const [navigation, app, importer, client] = await Promise.all([
    read('src/domain/navigation.ts'), read('src/App.vue'), read('src/pages/ImportPage.vue'), read('src/platform/client.ts')
  ])
  for (const path of ['/overview', '/portal', '/identity', '/access', '/configuration', '/release', '/services', '/observability', '/assets', '/import']) {
    assert.match(navigation, new RegExp(path.replace('/', '\\/')))
  }
  assert.match(app, /AccessPage/)
  assert.match(app, /ConfigurationPage/)
  assert.match(app, /AssetsPage/)
  assert.match(app, /ImportPage/)
  assert.match(importer, /mci-import-plan/)
  assert.match(importer, /mci-import-stage/)
  assert.match(importer, /mci-import-execute/)
  assert.match(importer, /mci-import-rollback/)
  assert.match(client, /BackgroundTask\/RunApiEngine/)
})

test('治理总览声明应用商城菜单迁移入口', async () => {
  const routes = JSON.parse(await read('microi.routes.json'))
  const overview = routes.find((item) => item.path === '/overview')
  assert.ok(overview)
  assert.deepEqual(overview.legacyMenuUrls, ['/micro-app/ai-platform-studio/overview'])
})

test('微服务遵循宿主协议且不使用原生阻塞弹窗', async () => {
  const files = [
    'src/App.vue', 'src/platform/host.ts', 'src/platform/client.ts',
    'src/pages/OverviewPage.vue', 'src/pages/PortalPage.vue', 'src/pages/IdentityPage.vue',
    'src/pages/AccessPage.vue', 'src/pages/ConfigurationPage.vue', 'src/pages/ReleasePage.vue', 'src/pages/ServicesPage.vue',
    'src/pages/ObservabilityPage.vue', 'src/pages/AssetsPage.vue', 'src/pages/ImportPage.vue'
  ]
  const source = (await Promise.all(files.map(read))).join('\n')
  assert.match(source, /micro-app:ready/)
  assert.match(source, /hostGeneration/)
  assert.doesNotMatch(source, /\b(?:alert|prompt|confirm)\s*\(/)
  assert.doesNotMatch(source, /access_key\s*=/i)
})

test('微服务内部导航只替换内容区并由局部骨架屏承接异步页面', async () => {
  const [app, host] = await Promise.all([read('src/App.vue'), read('src/platform/host.ts')])

  assert.match(app, /<Suspense\s+:timeout="0">/)
  assert.match(app, /class="content-skeleton"/)
  assert.match(app, /defineAsyncComponent\(\(\)\s*=>\s*import\('\.\/pages\/OverviewPage\.vue'\)\)/)
  assert.match(app, /currentRoute\.value\s*=\s*navigateMicroRoute\(path\)/)
  assert.doesNotMatch(app, /callMicroiHost\(['"]replaceTab['"]/)
  assert.match(host, /navigateMicroRoute\(path:\s*unknown/)
  assert.match(host, /window\.history\[replace\s*\?\s*'replaceState'\s*:\s*'pushState'\]/)
})

test('微服务主题与装饰样式被限制在自身根容器内', async () => {
  const [app, styles, tokens] = await Promise.all([
    read('src/App.vue'), read('src/styles/app.css'), read('src/styles/tokens.css')
  ])

  assert.match(app, /data-mci-ui-root="ai-platform-studio"/)
  assert.match(app, /\.studio::before\s*\{\s*position:\s*absolute;/)
  assert.doesNotMatch(app, /\.studio::before\s*\{\s*position:\s*fixed;/)
  assert.doesNotMatch(app, /document\.documentElement\.dataset/)
  assert.doesNotMatch(styles, /(?:^|\n)\s*(?:html|body|#app|button|\*)\s*[,\{]/)
  assert.doesNotMatch(tokens, /:root/)
  assert.match(tokens, /\[data-mci-ui-root="ai-platform-studio"\]\[data-theme="dark"\]/)
})

test('新增治理控制面使用计划哈希、条件回滚、租约和资产不可变版本', async () => {
  const [access, assets, release, services, observability] = await Promise.all([
    read('src/pages/AccessPage.vue'), read('src/pages/AssetsPage.vue'),
    read('src/pages/ReleasePage.vue'),
    read('src/pages/ServicesPage.vue'), read('src/pages/ObservabilityPage.vue')
  ])
  assert.match(access, /mci-identity-group-preview/)
  assert.match(access, /mci-access-change-plan/)
  assert.match(access, /ExpectedPlanHash/)
  assert.match(access, /mci-access-change-rollback/)
  assert.match(access, /mci-identity-tag-assign/)
  assert.match(access, /mci-access-request/)
  assert.match(access, /访问申请与临时权限/)
  assert.match(assets, /mci-asset-publish/)
  assert.match(assets, /ExpectedCurrentHash/)
  assert.match(assets, /mci-collaboration-lease/)
  assert.match(assets, /mci-change-set-validate/)
  assert.match(release, /mci-release-plan-publish/)
  assert.match(release, /mci-release-transition/)
  assert.match(release, /ExpectedRowVersion/)
  assert.match(release, /mci-release-validate/)
  assert.match(release, /mci-release-execute/)
  assert.match(release, /IdempotencyKey/)
  assert.match(release, /断点续/)
  assert.doesNotMatch(release, /addRow\(/)
  assert.match(services, /mci_service_registry/)
  assert.match(observability, /mci-alert-evaluate/)
})

test('共享 Microi V8 helper 与源文件规范化一致', async () => {
  const [copy, source] = await Promise.all([
    read('src/utils/microi.v8.js'),
    readFile(resolve(workspaceRoot, 'microi.skills', 'microi.v8.js'), 'utf8')
  ])
  const normalize = (value) => value.replace(/\r\n/g, '\n').trimEnd()
  assert.equal(normalize(copy), normalize(source))
})
