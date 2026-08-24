import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const packageModel = JSON.parse(await readFile(new URL('./app.microi.saas-engine.json', import.meta.url), 'utf8'))
const sysConfigTable = packageModel.DiyTables.find(item => String(item.Name).toLowerCase() === 'sys_config')
const fields = packageModel.DiyFields.filter(item => item.TableId === sysConfigTable.Id)
const byName = new Map(fields.map(item => [item.Name, item]))

const publicBehaviorDefaults = new Map([
  ['IdentityVerificationEnabled', '1'],
  ['PasskeyEnabled', '1'],
  ['AuthenticatorTotpEnabled', '1'],
  ['RequirePasswordChangeStepUp', '1'],
  ['ExternalLoginEnabled', '1'],
  ['FaceVerificationEnabled', '0'],
  ['GiteeLoginEnabled', '0'],
  ['WeChatLoginEnabled', '0'],
  ['GitHubLoginEnabled', '0'],
])

test('login behavior switches are public sys_config entity fields with physical columns', () => {
  const physicalNames = new Set(packageModel.PhysicalColumns
    .filter(item => String(item.TABLE_NAME).toLowerCase() === 'sys_config')
    .map(item => item.COLUMN_NAME))
  const ddl = packageModel.DDLStatements.find(item => String(item.TableName).toLowerCase() === 'sys_config').DDL
  for (const [name, defaultValue] of publicBehaviorDefaults) {
    const field = byName.get(name)
    assert.ok(field, `missing ${name}`)
    assert.equal(field.Component, 'Switch')
    assert.equal(field.Visible, 1)
    assert.equal(field.AppVisible, 1)
    assert.equal(field.DefaultValue, defaultValue)
    assert.equal(field.Tab, 'f7e10da1-0b96-4624-90ea-07c7e6991b74')
    assert.ok(physicalNames.has(name), `missing physical column ${name}`)
    assert.match(ddl, new RegExp('`' + name + '`'))
  }
})

test('private-setting dataset no longer seeds public behavior or display switches', () => {
  const dataSet = packageModel.DataSets.find(item => String(item.TableName).toLowerCase() === 'mci_system_setting')
  const keys = new Set(dataSet.Rows.map(item => item.ConfigKey))
  for (const key of [
    'Login.Identity.Enabled', 'Login.Passkey.Enabled', 'Login.Authenticator.Enabled',
    'Security.PasswordChange.RequireStepUp', 'Login.External.Enabled', 'Login.Face.Enabled',
    'Login.Gitee.Enabled', 'Login.WeChat.Enabled', 'Login.GitHub.Enabled',
    'Login.Passkey.Display', 'Login.Authenticator.Display', 'Login.Gitee.Display',
    'Login.WeChat.Display', 'Login.GitHub.Display',
  ]) assert.equal(keys.has(key), false, `${key} must not remain in private defaults`)

  for (const key of [
    'Login.Passkey.RpId', 'Login.Passkey.Origins', 'Login.Authenticator.Issuer',
    'Login.Gitee.ClientId', 'Login.Gitee.ClientSecret', 'Sms.Aliyun.AccessKeySecret',
  ]) assert.ok(keys.has(key), `missing backend-private ${key}`)
})

test('development tab uses default-expanded semantic groups and dialog CodeEditors', () => {
  const expectedGroups = new Map([
    ['DevelopmentAccessRuntimeGroup', 13],
    ['DevelopmentV8GovernanceGroup', 18],
    ['DevelopmentGlobalCodeGroup', 3],
    ['DevelopmentTemplateCodeGroup', 6],
  ])
  for (const [name] of expectedGroups) {
    const field = byName.get(name)
    assert.ok(field, `missing ${name}`)
    assert.equal(field.Component, 'CollapseGroup')
    assert.equal(field.FormWidth, 24)
    assert.equal(field.Tab, 'cfa27918-6245-4893-a77b-887c1a1e37f6')
    const config = JSON.parse(field.Config).CollapseGroup
    assert.equal(config.DefaultCollapsed, false)
    assert.equal(config.ScopeMode, 'UntilNextGroup')
    assert.equal(config.ShowFieldCount, true)
    assert.ok(config.Icon)
  }

  const developmentCodeFields = fields.filter(item =>
    item.Tab === 'cfa27918-6245-4893-a77b-887c1a1e37f6' && item.Component === 'CodeEditor')
  assert.equal(developmentCodeFields.length, 9)
  for (const field of developmentCodeFields) {
    assert.equal(JSON.parse(field.Config).CodeEditor.DisplayMode, 'Dialog', field.Name)
  }
  assert.equal(byName.get('AMapKey').Visible, 0)
  assert.equal(byName.get('AMapKey').AppVisible, 0)
})
