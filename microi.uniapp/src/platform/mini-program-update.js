import appConfig from '@/config.js'
import { clearPlatformCache } from '@/platform/cache.js'
import { getSysConfig } from '@/utils/sysconfig.js'
import { isVersionUnsupported, normalizeVersion } from './mini-program-version-core.mjs'

// zhy：更新状态由 App、我的页和关于页共享，禁止在各页面重复注册 UpdateManager。
export const MINI_PROGRAM_UPDATE_STATUS = Object.freeze({
  IDLE: 'idle',
  CHECKING: 'checking',
  CURRENT: 'current',
  DOWNLOADING: 'downloading',
  READY: 'ready',
  FAILED: 'failed',
  UNSUPPORTED: 'unsupported'
})

const VERSION_STORAGE_KEY = `mci:${appConfig.profileId || 'default'}:runtime-version`
const VERSION_SENSITIVE_STORAGE_KEYS = ['microi_diy_table_ids_v2', 'sys_config_cache', 'SysConfig']
const VERSION_SENSITIVE_STORAGE_PREFIXES = ['microi_mobile_menu_tree_v2:']
const listeners = new Set()

let updateManager = null
let initialized = false
let readyPrompted = false
let mandatoryPrompted = false

let state = {
  status: MINI_PROGRAM_UPDATE_STATUS.IDLE,
  supported: false,
  version: normalizeVersion(appConfig.versionName) || '0.0.0',
  envVersion: 'unknown',
  envLabel: '当前环境',
  hasUpdate: false,
  updateReady: false,
  checkedAt: 0,
  message: '等待检查更新',
  minimumVersion: '',
  releaseNotes: [],
  mandatory: false
}

// zhy：对外只暴露快照，避免页面直接修改全局更新状态。
export function getMiniProgramUpdateState() {
  return { ...state, releaseNotes: [...state.releaseNotes] }
}

function emitState(patch = {}) {
  state = { ...state, ...patch }
  const snapshot = getMiniProgramUpdateState()
  listeners.forEach((listener) => {
    try { listener(snapshot) } catch (error) {}
  })
  return snapshot
}

// zhy：页面通过订阅共享同一份版本状态，离开页面时调用返回函数解除订阅。
export function subscribeMiniProgramUpdate(listener) {
  if (typeof listener !== 'function') return () => {}
  listeners.add(listener)
  listener(getMiniProgramUpdateState())
  return () => listeners.delete(listener)
}

function envLabel(envVersion) {
  return ({ develop: '开发版', trial: '体验版', release: '正式版', gray: '灰度版' })[envVersion] || '当前环境'
}

// zhy：正式版优先显示微信当前实际运行版本；开发/体验环境回退到 Profile 构建版本。
export function readMiniProgramVersionInfo() {
  let version = normalizeVersion(appConfig.versionName) || '0.0.0'
  let envVersion = 'unknown'
  let supported = false
  // #ifdef MP-WEIXIN
  supported = typeof uni !== 'undefined' && typeof uni.getUpdateManager === 'function'
  try {
    const account = typeof uni.getAccountInfoSync === 'function' ? uni.getAccountInfoSync() : null
    const miniProgram = account && account.miniProgram ? account.miniProgram : {}
    envVersion = String(miniProgram.envVersion || 'unknown').toLowerCase()
    version = normalizeVersion(miniProgram.version) || version
  } catch (error) {}
  // #endif
  return { version, envVersion, envLabel: envLabel(envVersion), supported }
}

function removeVersionSensitiveStorage() {
  clearPlatformCache()
  try {
    VERSION_SENSITIVE_STORAGE_KEYS.forEach((key) => uni.removeStorageSync(key))
    const info = uni.getStorageInfoSync()
    ;(info.keys || []).forEach((key) => {
      if (VERSION_SENSITIVE_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        uni.removeStorageSync(key)
      }
    })
  } catch (error) {}
}

// zhy：代码包版本变化后刷新派生定义，避免旧菜单/ViewSchema 缓存掩盖新功能。
export function invalidateCachesForRuntimeVersion(versionInfo = readMiniProgramVersionInfo()) {
  const marker = `${versionInfo.envVersion || 'unknown'}:${versionInfo.version || '0.0.0'}`
  let previous = ''
  try { previous = String(uni.getStorageSync(VERSION_STORAGE_KEY) || '') } catch (error) {}
  if (previous && previous !== marker) removeVersionSensitiveStorage()
  try { uni.setStorageSync(VERSION_STORAGE_KEY, marker) } catch (error) {}
  return { changed: Boolean(previous && previous !== marker), previous, current: marker }
}

function normalizeReleaseNotes(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  if (!value) return []
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return normalizeReleaseNotes(parsed)
    } catch (error) {}
    return value.split(/\r?\n|；|;/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function showMandatoryPrompt() {
  if (!state.mandatory || mandatoryPrompted) return
  mandatoryPrompted = true
  const ready = state.status === MINI_PROGRAM_UPDATE_STATUS.READY
  uni.showModal({
    title: '需要更新小程序',
    content: ready
      ? `当前版本 ${state.version} 已停止支持，新版本已准备好，更新后将重新进入小程序。`
      : `当前版本 ${state.version} 已停止支持，请退出小程序后重新进入以获取新版本。`,
    showCancel: !ready,
    confirmText: ready ? '立即更新' : '我知道了',
    success(result) {
      if (ready && result.confirm) applyMiniProgramUpdate()
    }
  })
}

// zhy：最低支持版本和更新说明复用 SaaS 系统配置；字段未配置时完全不影响现有租户。
export function applyMiniProgramVersionPolicy(config = {}) {
  const minimumVersion = normalizeVersion(
    config.MiniProgramMinVersion || config.MinMiniProgramVersion || appConfig.minimumMiniProgramVersion
  )
  const releaseNotes = normalizeReleaseNotes(
    config.MiniProgramReleaseNotes || config.MiniProgramUpdateNotes || appConfig.releaseNotes
  )
  const mandatory = isVersionUnsupported({
    currentVersion: state.version,
    minimumVersion,
    envVersion: state.envVersion
  })
  emitState({ minimumVersion, releaseNotes, mandatory })
  showMandatoryPrompt()
  return getMiniProgramUpdateState()
}

// zhy：系统配置延迟加载，避免阻塞首屏；读取失败按“无强制版本策略”降级。
export async function loadMiniProgramVersionPolicy(options = {}) {
  try {
    const config = await getSysConfig({ refresh: options.refresh === true })
    return applyMiniProgramVersionPolicy(config || {})
  } catch (error) {
    return applyMiniProgramVersionPolicy({})
  }
}

function promptReadyUpdate() {
  if (readyPrompted || state.status !== MINI_PROGRAM_UPDATE_STATUS.READY) return
  readyPrompted = true
  uni.showModal({
    title: state.mandatory ? '需要更新小程序' : '发现新版本',
    content: state.mandatory
      ? '当前版本已停止支持，新版本已经准备好，更新后将重新进入小程序。'
      : '新版本已经准备好。建议先保存正在编辑的内容，再更新并重新进入小程序。',
    showCancel: !state.mandatory,
    cancelText: '稍后',
    confirmText: '立即更新',
    success(result) {
      if (result.confirm) applyMiniProgramUpdate()
    }
  })
}

// zhy：初始化必须尽早且仅执行一次，微信会在当前会话内完成一次版本检查和后台下载。
export function initializeMiniProgramUpdate(options = {}) {
  const info = readMiniProgramVersionInfo()
  invalidateCachesForRuntimeVersion(info)
  emitState({ ...info })
  if (initialized) return getMiniProgramUpdateState()
  initialized = true

  // #ifndef MP-WEIXIN
  emitState({
    status: MINI_PROGRAM_UPDATE_STATUS.UNSUPPORTED,
    supported: false,
    message: '当前平台不支持小程序内更新'
  })
  return getMiniProgramUpdateState()
  // #endif

  // #ifdef MP-WEIXIN
  if (!info.supported) {
    emitState({ status: MINI_PROGRAM_UPDATE_STATUS.UNSUPPORTED, message: '当前基础库不支持版本更新' })
    return getMiniProgramUpdateState()
  }
  updateManager = uni.getUpdateManager()
  emitState({ status: MINI_PROGRAM_UPDATE_STATUS.CHECKING, message: '正在检查更新' })

  updateManager.onCheckForUpdate((result) => {
    const hasUpdate = Boolean(result && result.hasUpdate)
    emitState({
      status: hasUpdate ? MINI_PROGRAM_UPDATE_STATUS.DOWNLOADING : MINI_PROGRAM_UPDATE_STATUS.CURRENT,
      hasUpdate,
      checkedAt: Date.now(),
      message: hasUpdate ? '发现新版本，正在后台下载' : '当前已是最新版本'
    })
  })

  updateManager.onUpdateReady(() => {
    emitState({
      status: MINI_PROGRAM_UPDATE_STATUS.READY,
      hasUpdate: true,
      updateReady: true,
      message: '新版本已准备好'
    })
    if (options.promptOnReady !== false) promptReadyUpdate()
    showMandatoryPrompt()
  })

  updateManager.onUpdateFailed(() => {
    emitState({
      status: MINI_PROGRAM_UPDATE_STATUS.FAILED,
      hasUpdate: true,
      updateReady: false,
      message: '新版本下载失败，请检查网络后退出并重新进入小程序'
    })
  })
  return getMiniProgramUpdateState()
  // #endif
}

// zhy：微信不提供当前会话内的强制重复检查 API，手动入口负责反馈检查状态或应用已下载版本。
export function checkMiniProgramUpdate() {
  const snapshot = initializeMiniProgramUpdate({ promptOnReady: false })
  if (snapshot.status === MINI_PROGRAM_UPDATE_STATUS.READY) return applyMiniProgramUpdate()
  if (snapshot.status === MINI_PROGRAM_UPDATE_STATUS.CURRENT) {
    uni.showToast({ title: '当前已是最新版本', icon: 'success' })
  } else if (snapshot.status === MINI_PROGRAM_UPDATE_STATUS.CHECKING) {
    uni.showToast({ title: '正在检查更新', icon: 'none' })
  } else if (snapshot.status === MINI_PROGRAM_UPDATE_STATUS.DOWNLOADING) {
    uni.showToast({ title: '新版本正在下载', icon: 'none' })
  } else if (snapshot.status === MINI_PROGRAM_UPDATE_STATUS.FAILED) {
    uni.showModal({ title: '更新失败', content: snapshot.message, showCancel: false })
  } else if (!snapshot.supported) {
    uni.showToast({ title: snapshot.message, icon: 'none' })
  }
  return snapshot
}

// zhy：只有 onUpdateReady 之后才允许应用更新，防止无准备状态下误重启。
export function applyMiniProgramUpdate() {
  if (!updateManager || state.status !== MINI_PROGRAM_UPDATE_STATUS.READY) return false
  try {
    updateManager.applyUpdate()
    return true
  } catch (error) {
    emitState({ status: MINI_PROGRAM_UPDATE_STATUS.FAILED, message: '应用新版本失败，请退出后重新进入小程序' })
    uni.showModal({ title: '更新失败', content: state.message, showCancel: false })
    return false
  }
}
