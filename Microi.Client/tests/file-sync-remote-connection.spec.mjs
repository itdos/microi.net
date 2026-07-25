import { expect, test } from '@playwright/test'

const FRONTEND = process.env.FRONTEND || 'http://localhost:61500'
const BACKEND = process.env.BACKEND || 'https://localhost:61501'
const OS_CLIENT = process.env.MICROI_OSCLIENT || 'iTdos'
const ACCOUNT = process.env.PW_TEST_ACCOUNT || 'admin'
const PASSWORD = process.env.PW_TEST_PASSWORD || ''
const FAKE_REMOTE = 'https://missing-file-cabinet.test'
const BROWSER_EXECUTABLE = process.env.PW_BROWSER_EXECUTABLE || ''

test.use({
  ignoreHTTPSErrors: true,
  launchOptions: BROWSER_EXECUTABLE ? { executablePath: BROWSER_EXECUTABLE } : undefined
})
test.setTimeout(120_000)

async function loginCurrent(page) {
  if (!PASSWORD) throw new Error('PW_TEST_PASSWORD is required')
  const response = await page.request.post(`${BACKEND}/api/SysUser/login`, {
    headers: { OsClient: OS_CLIENT },
    data: { Account: ACCOUNT, Pwd: PASSWORD, OsClient: OS_CLIENT, _ClientType: 'PC' }
  })
  const result = await response.json()
  expect(result.Code, result.Msg || 'current platform login failed').toBe(1)
  const headers = response.headers()
  return {
    token: headers.authorization || result.DataAppend?.Token || result.Data?.Token,
    user: result.Data
  }
}

async function runConnectionEngine(page, token, param) {
  const response = await page.request.post(`${BACKEND}/api/ApiEngine/Run`, {
    headers: { OsClient: OS_CLIENT, authorization: token },
    data: { ApiEngineKey: 'mci_file_remote_connection', ...param },
    timeout: 10_000
  })
  return response.json()
}

test('remote login session persists, reconnects and reports missing target capability', async ({ page }) => {
  const { token } = await loginCurrent(page)
  const remoteCalls = []

  await page.route(`${FAKE_REMOTE}/**`, async route => {
    const url = new URL(route.request().url())
    remoteCalls.push(`${route.request().method()} ${url.pathname}`)
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,osclient,authorization',
      'access-control-expose-headers': 'authorization,captchaid'
    }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders, body: '' })
      return
    }
    if (url.pathname === '/api/FormEngine/GetSysConfig') {
      await route.fulfill({ headers: corsHeaders, json: { Code: 1, Data: { EnableCaptcha: 0 } } })
      return
    }
    if (url.pathname === '/api/SysUser/login') {
      await route.fulfill({
        headers: { ...corsHeaders, authorization: 'Bearer fake-remote-token' },
        json: { Code: 1, Data: { Id: 'remote-user', Account: 'codex_remote', Name: '远程测试用户' } }
      })
      return
    }
    if (url.pathname === '/api/ApiEngine/Run') {
      await route.fulfill({ headers: corsHeaders, json: { Code: 0, Msg: '未找到接口引擎：mci_file_sync_capability' } })
      return
    }
    await route.fulfill({ headers: corsHeaders, json: { Code: 1, Data: {} } })
  })

  await page.goto(`${FRONTEND}/?OsClient=${OS_CLIENT}#/mci-file-manage`, { waitUntil: 'domcontentloaded' })
  const usernameInput = page.locator('input[placeholder="请输入用户名"], input[placeholder="Please enter user name."]').first()
  const loginVisible = await usernameInput.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)
  if (loginVisible) {
    await usernameInput.fill(ACCOUNT)
    await page.locator('input[placeholder="请输入密码"], input[placeholder="Please enter user password."]').first().fill(PASSWORD)
    await page.getByRole('button', { name: /登\s*录|log\s*in/i }).click()
  }
  await expect(page.getByText('文件同步', { exact: true }).first()).toBeVisible({ timeout: 30_000 })

  try {
    await page.getByText('文件同步', { exact: true }).first().click()
    const dialog = page.locator('.mci-file-sync-dialog')
    await expect(dialog).toBeVisible()
    const targetPanel = dialog.locator('.platform-panel').nth(1)
    await targetPanel.getByText('远程平台', { exact: true }).click()
    await targetPanel.locator('input[placeholder="ApiBase"]').fill(FAKE_REMOTE)
    await targetPanel.locator('input[placeholder="OsClient"]').fill('fake_remote')
    await targetPanel.locator('input[placeholder="帐号"]').fill('codex_remote')
    await targetPanel.locator('input[placeholder="密码"]').fill('saved-password')
    await targetPanel.locator('input[placeholder="OsClient"]').blur()
    await targetPanel.getByRole('button', { name: '登录', exact: true }).click()

    await expect(targetPanel.locator('.login-identity')).toContainText('远程测试用户', { timeout: 20_000 })
    await expect(targetPanel).toContainText('目标平台未安装文件同步接口或文件柜版本过低')
    const savedConnections = await runConnectionEngine(page, token, { Action: 'list' })
    const savedConnection = (savedConnections.Data || []).find(item => item.ApiBase === FAKE_REMOTE)
    expect(savedConnection?.Id).toBeTruthy()
    await targetPanel.getByRole('button', { name: '退出', exact: true }).click()
    await expect(targetPanel.getByRole('button', { name: '登录', exact: true })).toBeVisible()
    const loggedOutConnections = await runConnectionEngine(page, token, { Action: 'list' })
    const loggedOutConnection = (loggedOutConnections.Data || []).find(item => item.Id === savedConnection.Id)
    expect(loggedOutConnection?.IsLoggedIn).toBe(0)
    expect(loggedOutConnection?.HasToken).toBe(false)

    await targetPanel.locator('.connection-toolbar .el-select').click()
    await page.locator('.el-select-dropdown__item:visible').filter({ hasText: 'fake_remote / codex_remote' }).click()
    await expect(targetPanel.locator('.login-identity')).toContainText('远程测试用户', { timeout: 20_000 })
    expect(remoteCalls.filter(call => call === 'POST /api/SysUser/login')).toHaveLength(2)

    await targetPanel.getByTitle('删除历史连接').click()
    await page.locator('.el-message-box__btns .el-button--primary').click()
    await expect(targetPanel.getByRole('button', { name: '登录', exact: true })).toBeVisible()
  } finally {
    const list = await runConnectionEngine(page, token, { Action: 'list' })
    const leftovers = (list.Data || []).filter(item => item.ApiBase === FAKE_REMOTE)
    for (const item of leftovers) {
      await runConnectionEngine(page, token, { Action: 'delete', Id: item.Id })
    }
  }
})
