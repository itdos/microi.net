import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../src/SystemSettings.vue', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/system-settings.css', import.meta.url), 'utf8')
const navigationStyles = readFileSync(new URL('../src/system-settings-navigation.css', import.meta.url), 'utf8')
const runtime = readFileSync(new URL('../src/microi.js', import.meta.url), 'utf8')
const globalStyle = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')

test('tenant settings workbench only manages backend-private settings', () => {
  assert.match(source, /MICROI SERVER PRIVATE/)
  assert.match(source, /服务端私有设置/)
  assert.match(source, /sys_config[\s\S]*?保存功能启用与入口显示等公开开关/)
  assert.match(source, /switches switches--private/)
  assert.match(source, /const migratedPublicSettingKeys = new Set/)
  assert.match(source, /Login\.Passkey\.Display/)
  assert.match(source, /\.filter\(\(item\) => !migratedPublicSettingKeys\.has/)
  assert.match(source, /已迁移到“系统设置 → 登录界面与入口”/)
  assert.doesNotMatch(source, /class="login-display-panel"/)
  assert.doesNotMatch(source, /v-model="form\.IsPublic"[^>]*type="checkbox"/)
})

test('compatibility payload is forced private and active marker stays compact', () => {
  assert.match(source, /IsPublic:\s*false/)
  assert.match(source, /switches switches--private/)
  assert.match(styles, /\.switches\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/)
  assert.match(navigationStyles, /button\.active::before[\s\S]*?height:\s*54%/)
})

test('system settings consumes the host viewport without creating a blank tail', () => {
  assert.match(runtime, /hostViewport:\s*data\.hostViewport\s*\|\|\s*data\.HostViewport/)
  assert.match(source, /:style="settingsViewportStyle"/)
  assert.match(source, /Number\(context\.hostViewport\?\.height\s*\|\|\s*0\)/)
  assert.match(source, /--system-settings-host-height/)
  assert.match(styles, /height:\s*var\(--system-settings-host-height,\s*var\(--micro-app-available-height,\s*100vh\)\)/)
  assert.match(styles, /\.system-settings\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden/)
  assert.match(styles, /\.workspace\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?overflow:\s*hidden/)
  assert.match(styles, /\.settings-scroll\s*\{[\s\S]*?overflow-y:\s*auto/)
  assert.match(styles, /\.settings-list\s*\{[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden/)
  assert.match(globalStyle, /html,\s*body,\s*#app\s*\{[\s\S]*?min-height:\s*100%/)
})

test('security and service access filter includes tenant-owned login, OAuth and SMS keys', () => {
  assert.match(source, /安全与服务接入/)
  assert.match(source, /\^\(Login\\\.\|Security\\\.\|Sms\\\.\|OAuth\\\.\|Integration\\\.\|Map\\\.\)/)
  assert.doesNotMatch(source, /<span>登录与身份<\/span>/)
})

test('description is the primary card title and ConfigKey is the readable subtitle', () => {
  assert.match(source, /<div class="config-copy"><b>\{\{ settingTitle\(item\) \}\}<\/b><p>\{\{ item\.ConfigKey \}\}<\/p><\/div>/)
  assert.match(source, /function settingTitle\(item\) \{ return String\(item\?\.Description \|\| item\?\.Category/)
  assert.match(styles, /\.config-copy b\s*\{[\s\S]*?font-size:\s*14\.5px/)
  assert.match(styles, /\.config-copy p\s*\{[\s\S]*?font-size:\s*11px/)
})

test('Bool values use accessible inline and editor switches', () => {
  assert.match(source, /v-else-if="isBoolSetting\(item\)"/)
  assert.match(source, /class="value-switch"[\s\S]*?role="switch"[\s\S]*?@click="toggleBool\(item\)"/)
  assert.match(source, /class="bool-editor"[\s\S]*?role="switch"/)
  assert.match(source, /无需输入 true \/ false/)
  assert.match(source, /async function toggleBool\(item\)/)
})

test('editing, deletion, TOTP and secret reveal use unified accessible dialogs', () => {
  for (const dialog of ['editorDialog', 'deleteDialog', 'totpDialog', 'revealDialog']) {
    assert.match(source, new RegExp(`<dialog ref="${dialog}"`))
  }
  assert.match(source, /class="modal-title-icon"/)
  assert.match(source, /\{\{ editorTitle \}\}/)
  assert.match(source, /\{\{ editorSubtitle \}\}/)
  assert.match(source, /DELETE TENANT SETTING/)
  assert.match(source, /confirmRemove/)
  assert.doesNotMatch(source, /window\.(?:alert|confirm|prompt)\s*\(/)
})

test('dialog masks follow the host FormMaskBlur projection', () => {
  assert.match(source, /overlayClass\s*=\s*computed\(\(\)\s*=>\s*context\.disableFormMaskBlur\s*\?\s*'plain'\s*:\s*'blurred'\)/)
  assert.match(source, /:class="overlayClass"/)
  assert.match(styles, /dialog\.modal-backdrop\.blurred::backdrop\s*\{[\s\S]*?backdrop-filter:\s*blur\(/)
  assert.match(styles, /dialog\.modal-backdrop\.plain::backdrop\s*\{[\s\S]*?backdrop-filter:\s*none/)
})
