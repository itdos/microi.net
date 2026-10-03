import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  MOBILE_THEME_OPTIONS,
  mobileThemeStorageKey,
  normalizeMobileThemeMode,
  resolveMobileTheme
} from '../src/platform/mobile-theme.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('mobile theme defaults to following the PC tenant theme', () => {
  const pcTheme = {
    primary: '#123456',
    primaryLight: '#456789',
    primaryDark: '#0A2030',
    brand: '#123456'
  }
  assert.deepEqual(resolveMobileTheme(pcTheme, 'system'), pcTheme)
  assert.equal(normalizeMobileThemeMode('unknown-theme'), 'system')
  assert.equal(MOBILE_THEME_OPTIONS[0].key, 'system')
})

test('a mobile choice replaces only the color palette', () => {
  const pcTheme = {
    primary: '#123456',
    primaryLight: '#456789',
    primaryDark: '#0A2030',
    brand: '#123456',
    futureToken: 'preserved'
  }
  const mobileTheme = resolveMobileTheme(pcTheme, 'professional-purple')
  assert.equal(mobileTheme.primary, '#6D28D9')
  assert.equal(mobileTheme.brand, '#6D28D9')
  assert.equal(mobileTheme.futureToken, 'preserved')
})

test('mobile choices are isolated by profile, API and OsClient', () => {
  const first = mobileThemeStorageKey({ profileId: 'microi', apiBase: 'https://api.one.test/', osClient: 'tenant-a' })
  const same = mobileThemeStorageKey({ profileId: 'MICROI', apiBase: 'https://api.one.test', osClient: 'TENANT-A' })
  const secondTenant = mobileThemeStorageKey({ profileId: 'microi', apiBase: 'https://api.one.test', osClient: 'tenant-b' })
  const secondApi = mobileThemeStorageKey({ profileId: 'microi', apiBase: 'https://api.two.test', osClient: 'tenant-a' })
  assert.equal(first, same)
  assert.notEqual(first, secondTenant)
  assert.notEqual(first, secondApi)
})

test('profile exposes a compact public theme selector', () => {
  const source = fs.readFileSync(path.join(root, 'src/pages/profile/index.vue'), 'utf8')
  assert.match(source, /title: '颜色主题'/)
  assert.match(source, /默认跟随 PC/)
  assert.match(source, /themeSheetVisible/)
  assert.match(source, /setThemeMode\(option\.key\)/)
})
