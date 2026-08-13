import { expect, test } from '@playwright/test'

const baseUrl = process.env.MICROI_CORE_E2E_BASE_URL || 'http://127.0.0.1:41739'

const captureErrors = (page) => {
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  return { pageErrors, consoleErrors }
}

test('旧 Page 编辑器入口真实创建 Monaco 编辑器', async ({ page }) => {
  const { pageErrors, consoleErrors } = captureErrors(page)

  await page.goto(`${baseUrl}/tests/harness/core-engine-renderers.html?mode=editor`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1_000)
  if (pageErrors.length || consoleErrors.length) {
    throw new Error(`renderer harness failed: ${JSON.stringify({ pageErrors, consoleErrors })}`)
  }

  const editor = page.locator('[data-testid="legacy-editor"] .monaco-editor')
  await expect(editor).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: '确认修改' })).toHaveCount(2)
  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
})

test('Page 饼图入口真实创建 ECharts Canvas', async ({ page }) => {
  const { pageErrors, consoleErrors } = captureErrors(page)
  await page.goto(`${baseUrl}/tests/harness/core-engine-renderers.html?mode=chart`, { waitUntil: 'networkidle' })

  const chart = page.getByTestId('echarts-pie')
  await expect(chart.locator('canvas')).toHaveCount(1)
  await expect(chart.locator('[data-zr-dom-id]')).toBeVisible()
  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
})
