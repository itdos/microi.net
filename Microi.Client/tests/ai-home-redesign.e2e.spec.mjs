import { expect, test } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

const FRONTEND = process.env.PW_BASE_URL || 'http://localhost:61500'
const ACCOUNT = process.env.PW_TEST_ACCOUNT || 'admin'
const PASSWORD = process.env.PW_TEST_PASSWORD || ''
const SCREENSHOT_DIR = path.resolve(
  process.cwd(),
  process.env.PW_SCREENSHOT_DIR || '.tmp/ai-home-redesign-acceptance',
)

test.use({
  viewport: { width: 1920, height: 1080 },
  ignoreHTTPSErrors: true,
  ...(process.env.PW_BROWSER_CHANNEL ? { channel: process.env.PW_BROWSER_CHANNEL } : {}),
})
test.describe.configure({ mode: 'serial' })
test.setTimeout(180_000)

function tenantUrl(route = '') {
  return `${FRONTEND}/?OsClient=iTdos${route ? `#${route}` : ''}`
}

async function login(page) {
  await page.goto(tenantUrl(), { waitUntil: 'domcontentloaded' })
  const account = page.locator([
    'input[placeholder*="用户名"]',
    'input[placeholder*="账号"]',
    'input[placeholder*="帐号"]',
    'input[placeholder*="username" i]',
    'input[placeholder*="user name" i]',
  ].join(', ')).first()
  await expect(account).toBeVisible({ timeout: 30_000 })
  await account.fill(ACCOUNT)
  await page.locator('input[type="password"]').first().fill(PASSWORD)

  const privacy = page.locator('.privacy-policy-wrapper .el-checkbox').first()
  if (await privacy.isVisible().catch(() => false)) {
    const checked = await privacy.evaluate((element) => (
      element.classList.contains('is-checked')
      || Boolean(element.querySelector('input[type="checkbox"]')?.checked)
    ))
    if (!checked) await privacy.click()
  }

  const responsePromise = page.waitForResponse(
    (response) => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
    { timeout: 30_000 },
  )
  await page.getByRole('button', { name: '登录', exact: true }).click()
  const payload = await (await responsePromise).json()
  expect(Number(payload.Code), payload.Msg || 'UI login failed').toBe(1)
  await expect(page.getByRole('button', { name: /管理员|admin/i }).first()).toBeVisible({ timeout: 30_000 })
}

async function openRoute(page, route) {
  await page.goto(tenantUrl(route), { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.el-loading-mask:visible')).toHaveCount(0, { timeout: 60_000 })
}

function collectRuntimeFailures(page) {
  const pageErrors = []
  const serverErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500 && /\/(api|apiengine)\//i.test(response.url())) {
      serverErrors.push(`${response.status()} ${response.url()}`)
    }
  })
  return { pageErrors, serverErrors }
}

test('AI 助手首屏以对话框和完整分类能力目录为核心', async ({ page }) => {
  test.skip(!PASSWORD, 'PW_TEST_PASSWORD is required for the real UI login.')
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true })
  const failures = collectRuntimeFailures(page)

  await login(page)
  await openRoute(page, '/mic-ai-engine')

  const assistant = page.locator('.ai-engine-page:not(.is-compact)[data-testid="unified-ai-assistant"]:visible').last()
  await expect(assistant).toBeVisible({ timeout: 45_000 })
  await expect(assistant.locator('.ai-engine-sidebar')).toHaveCount(0)
  await expect(assistant.getByTestId('unified-ai-input')).toBeVisible()
  await expect(assistant.getByTestId('ai-capability-directory')).toBeVisible()

  for (const label of ['智能助手', '视觉创作', '声音创作', '模型与扩展']) {
    await expect(assistant.getByText(label, { exact: true })).toBeVisible()
  }
  for (const id of ['chat', 'data', 'image', 'music', 'video', 'models']) {
    await expect(assistant.getByTestId(`ai-capability-${id}`)).toBeVisible()
  }

  const composerBox = await assistant.locator('.composer-box').boundingBox()
  const directoryBox = await assistant.getByTestId('ai-capability-directory').boundingBox()
  expect(composerBox).not.toBeNull()
  expect(directoryBox).not.toBeNull()
  expect(composerBox.y).toBeLessThan(directoryBox.y)

  const allTools = assistant.locator('button[data-testid^="ai-image-tool-"]')
  await expect(allTools).toHaveCount(29)
  for (const id of [
    'text-to-image', 'image-to-image', 'redraw', 'upscale', 'erase', 'outpaint',
    'remove-watermark', 'id-photo', 'multi-composite', 'remove-background', 'colorize', 'restore',
  ]) {
    await expect(assistant.getByTestId(`ai-image-tool-${id}`)).toHaveCount(1)
  }

  const toolDirectoryOverflow = await assistant.getByTestId('ai-image-tool-directory').evaluate(
    (element) => element.scrollHeight - element.clientHeight,
  )
  expect(toolDirectoryOverflow).toBeLessThanOrEqual(1)

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '01-ai-assistant-1920x1080.png'),
    fullPage: false,
  })
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '02-ai-assistant-full-page.png'),
    fullPage: true,
  })

  await assistant.getByTestId('unified-ai-history-toggle').click()
  await expect(assistant.getByTestId('unified-ai-history')).toBeVisible()
  await assistant.getByTestId('unified-ai-history-toggle').click()
  await expect(assistant.getByTestId('unified-ai-history')).toHaveCount(0)

  await assistant.getByTestId('ai-image-tool-upscale').click()
  await expect(page.getByTestId('ai-image-studio')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'AI 图像工作台', exact: true })).toBeVisible()

  expect(failures.serverErrors, `server errors: ${failures.serverErrors.join('\n')}`).toEqual([])
  expect(failures.pageErrors, `page errors: ${failures.pageErrors.join('\n')}`).toEqual([])
})

test('PAGE5 复用 AI 对话框并展示真实趋势和常用应用', async ({ page }) => {
  test.skip(!PASSWORD, 'PW_TEST_PASSWORD is required for the real UI login.')
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true })
  const failures = collectRuntimeFailures(page)

  await login(page)
  await openRoute(page, '/')

  const embeddedAssistant = page.locator('.aiengine-widget [data-testid="unified-ai-assistant"]:visible').last()
  await expect(embeddedAssistant).toBeVisible({ timeout: 60_000 })
  await expect(embeddedAssistant.getByTestId('unified-ai-input')).toBeVisible()
  await expect(embeddedAssistant.getByTestId('ai-capability-directory')).toBeVisible()
  await expect(embeddedAssistant.getByTestId('ai-home-primary-tools')).toBeVisible()

  const overview = page.getByTestId('platform-home-overview')
  await expect(overview).toBeVisible({ timeout: 60_000 })
  await expect(overview.getByText('近 7 日使用趋势', { exact: true })).toBeVisible()
  await expect(overview.getByTestId('home-usage-chart')).toBeVisible()
  const apps = overview.getByTestId('home-frequent-apps').locator('.app-entry')
  expect(await apps.count()).toBeGreaterThan(0)
  expect(await apps.count()).toBeLessThanOrEqual(6)
  await expect(overview.getByText('AI助手', { exact: true }).first()).toBeVisible()

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '03-platform-home-1920x1080.png'),
    fullPage: false,
  })
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '04-platform-home-full-page.png'),
    fullPage: true,
  })

  await page.evaluate(async () => {
    const { setThemeMode } = await import('/src/utils/theme-color.js')
    setThemeMode('dark')
  })
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true)
  await page.waitForTimeout(500)
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '05-platform-home-dark-1920x1080.png'),
    fullPage: false,
  })

  await page.evaluate(async () => {
    const { setThemeMode } = await import('/src/utils/theme-color.js')
    setThemeMode('light')
  })

  await page.setViewportSize({ width: 1366, height: 768 })
  await openRoute(page, '/mic-ai-engine')
  const assistant = page.locator('.ai-engine-page:not(.is-compact)[data-testid="unified-ai-assistant"]:visible').last()
  await expect(assistant.getByTestId('unified-ai-input')).toBeVisible({ timeout: 45_000 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '06-ai-assistant-1366x768.png'),
    fullPage: false,
  })

  expect(failures.serverErrors, `server errors: ${failures.serverErrors.join('\n')}`).toEqual([])
  expect(failures.pageErrors, `page errors: ${failures.pageErrors.join('\n')}`).toEqual([])
})
