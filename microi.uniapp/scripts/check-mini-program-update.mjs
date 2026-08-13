// zhy：静态门禁确保双 Profile、全局初始化、公开入口和非破坏性缓存策略不会被后续改坏。
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// zhy：兼容项目常用的 Node 18+，不依赖较新的 import.meta.dirname。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
// zhy：统一换行符，避免 Windows 工作区的 CRLF 让语义门禁产生假失败。
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n?/g, '\n')
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

const app = read('src/App.vue')
const profilePage = read('src/pages/profile/index.vue')
const aboutPage = read('src/pages/about/index.vue')
const updateService = read('src/platform/mini-program-update.js')
const profiles = ['xjy', 'standard']

expect(app.includes('initializeMiniProgramUpdate({ promptOnReady: true })'), 'App.onLaunch 必须初始化全局更新管理器')
expect(profilePage.includes("key: 'about'"), '我的页必须声明关于小程序入口')
expect(profilePage.includes("if (item.key === 'about') {\n        uni.navigateTo"), '关于小程序入口必须在登录守卫前独立处理')
expect(aboutPage.includes('checkMiniProgramUpdate()'), '关于页必须提供手动更新状态入口')
expect(aboutPage.includes('update-button-icon'), '更新主按钮必须包含真实图形图标')
expect(updateService.includes('uni.getUpdateManager()'), '平台服务必须使用小程序 UpdateManager')
expect(updateService.includes('uni.getAccountInfoSync()'), '平台服务必须读取真实运行版本')
expect(!updateService.includes('uni.clearStorageSync'), '版本切换不得清空全部本地存储')

profiles.forEach((profileId) => {
  const profile = read(`profiles/${profileId}/profile.cjs`)
  // zhy：构建展示版本与 manifest 上传版本必须保持一致，防止用户看到错误版本号。
  const profileConfig = require(path.join(root, `profiles/${profileId}/profile.cjs`)).config
  const manifest = JSON.parse(read(`profiles/${profileId}/manifest.json`))
  const pages = JSON.parse(read(`profiles/${profileId}/pages.json`))
  const aboutRoute = pages.pages.find((item) => item.path === 'pages/about/index')
  expect(profile.includes("about: '/pages/about/index'"), `${profileId} Profile 必须配置 About 路由`)
  expect(String(profileConfig.versionName) === String(manifest.versionName), `${profileId} Profile 与 manifest 版本号必须一致`)
  expect(aboutRoute?.style?.navigationBarTitleText === '关于小程序', `${profileId} About 页面标题必须为关于小程序`)
})

if (failures.length) {
  failures.forEach((message) => console.error(`[update-check] ${message}`))
  process.exit(1)
}

console.log('[update-check] 小程序版本更新静态门禁通过。')
