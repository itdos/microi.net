import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LEGACY_UNIAPP_WITHOUT_DESKTOP_SHELL,
  buildApplicationLaunchUrl
} from '../docs/.vitepress/theme/utils/uniapp-preview-mode.js'

const desktopWindow = { matchMedia: () => ({ matches: false }) }
const mobileWindow = { matchMedia: () => ({ matches: true }) }
const target = 'https://static.itdos.com/itdos/ai-app-publish/smart-business-card/index.html'

test('audited historical shell-less UniApps use the compatibility shell on desktop', () => {
  assert.equal(LEGACY_UNIAPP_WITHOUT_DESKTOP_SHELL.length, 21)
  const launch = buildApplicationLaunchUrl({
    AppKey: 'smart-business-card',
    Name: '智能名片',
    ApplicationType: 'UniApp'
  }, target, desktopWindow)
  assert.match(launch, /^\/uniapp-preview\.html\?src=/)
  assert.equal(new URLSearchParams(launch.split('?')[1]).get('src'), target)
})

test('the same historical UniApp opens directly on mobile', () => {
  assert.equal(buildApplicationLaunchUrl({
    AppKey: 'smart-business-card',
    ApplicationType: 'UniApp'
  }, target, mobileWindow), target)
})

test('newer UniApp roots that already own a shell are not wrapped twice', () => {
  const dandelion = target.replace('smart-business-card', 'dandelion-novel')
  assert.equal(buildApplicationLaunchUrl({
    AppKey: 'dandelion-novel',
    ApplicationType: 'UniApp'
  }, dandelion, desktopWindow), dandelion)
})

test('Web applications always open their desktop-responsive root directly', () => {
  const web = target.replace('smart-business-card', 'family-chores')
  assert.equal(buildApplicationLaunchUrl({
    AppKey: 'family-chores',
    ApplicationType: 'Web'
  }, web, desktopWindow), web)
})
