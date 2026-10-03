import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildNativeDockLayout, nativeDockTargetAt } from '../src/platform/app-native-dock.mjs'

const layout = buildNativeDockLayout(375, 34, true, 4, 667)
assert.equal(layout.height, 106, 'native dock must include the iPhone safe area')
assert.equal(layout.top, 561, 'native dock must use a stable absolute screen coordinate')
assert.equal(layout.pill.left, 12, 'native navigation pill must keep a balanced edge inset')
assert.equal(layout.ai.width, 56, 'AI must remain a separate circular command')
assert.deepEqual(nativeDockTargetAt(layout.pill.left + 2, layout, 4), { type: 'tab', index: 0 })
assert.deepEqual(nativeDockTargetAt(layout.pill.left + layout.tabWidth * 2.5, layout, 4), { type: 'tab', index: 2 })
assert.deepEqual(nativeDockTargetAt(layout.ai.left + 10, layout, 4), { type: 'ai', index: -1 })
assert.deepEqual(nativeDockTargetAt(1, layout, 4), { type: 'none', index: -1 })

const withoutAi = buildNativeDockLayout(375, 0, false, 4)
assert.equal(withoutAi.ai, null)
assert(withoutAi.pill.width > layout.pill.width, 'navigation pill must use the released AI width when AI is disabled')

const nativeDockSource = fs.readFileSync(new URL('../src/platform/app-native-dock.mjs', import.meta.url), 'utf8')
assert(!nativeDockSource.includes('nativeView.reset()'), 'cached tabs must not race by clearing the shared native canvas')
assert(nativeDockSource.includes("nativeStateSignature === nextStateSignature"), 'identical cached-tab state must not redraw the native canvas')
assert(!nativeDockSource.includes("bottom: '0px'"), 'NativeObj.View must not rely on unstable bottom positioning')
assert(nativeDockSource.includes("if (target.type === 'ai')") && nativeDockSource.includes('nativeView.hide()'), 'AI navigation must hide the global native dock')

const aiPageSource = fs.readFileSync(new URL('../src/pages/ai/index.vue', import.meta.url), 'utf8')
assert(aiPageSource.includes('setAppNativeDockVisible(false)'), 'AI page must hide the native dock whenever it becomes visible')
assert(aiPageSource.includes('setAppNativeDockVisible(true)'), 'AI page must restore the native dock when it unloads')

const launcherSource = fs.readFileSync(new URL('../src/components/mci-ai-launcher/mci-ai-launcher.vue', import.meta.url), 'utf8')
assert(launcherSource.includes("runtimeTarget === 'app-plus' && this.isTabBarPage"), 'App tab pages must hide the system tabBar even when the native dock is ready')
const mountedSource = launcherSource.match(/mounted\(\)\s*\{([\s\S]*?)\n  \},\n  activated\(\)/)?.[1] || ''
assert(
  mountedSource.indexOf('uni.onWindowResize(this.resizeHandler)') < mountedSource.indexOf('this.activate()'),
  'App must subscribe to viewport resize before hiding the system tabBar during first activation'
)
const activateSource = launcherSource.match(/activate\(\)\s*\{([\s\S]*?)\n    \},\n    refreshSafeArea\(\)/)?.[1] || ''
assert(activateSource.includes('this.syncActiveRoute(false)'), 'first activation must resolve the route without creating the native dock')
assert(
  activateSource.indexOf('this.activateRuntimeDock()') < activateSource.indexOf('this.refreshSafeArea()'),
  'the system tabBar must be hidden before measuring and positioning the native dock'
)
const scheduledSyncSource = launcherSource.match(/scheduleActiveRouteSync\(expectedRoute = ''\)\s*\{([\s\S]*?)\n    \},\n    activateRuntimeDock\(\)/)?.[1] || ''
assert(
  scheduledSyncSource.includes("runtimeTarget === 'app-plus'") && scheduledSyncSource.includes('this.refreshSafeArea()'),
  'App activation retries must re-read windowHeight after hideTabBar changes the viewport'
)

console.log('App native dock layout and hit testing passed.')
