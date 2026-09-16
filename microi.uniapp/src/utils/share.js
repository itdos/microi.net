import appConfig from '@/config.js'
import { getToken, getUser, post } from '@/utils/request.js'

const HOME_PATH = '/pages/workspace/index'
const OFFICIAL_ACCOUNT_PATH = '/pages/native/official-account'

const FALLBACK_SHARE_TITLES = {
  platform: `${appConfig.platformName}｜${appConfig.workspaceSubTitle}`,
  business: `${appConfig.platformName}｜业务协同中心`,
  service: `${appConfig.platformName}｜专业售后服务保障`,
  mall: `${appConfig.appName}商城｜品质服务解决方案`,
  news: `${appConfig.appName}资讯｜洞察行业新动态`,
  invite: `加入${appConfig.platformName}｜连接业务与专业服务`,
  merchantInvite: `加入${appConfig.appName}｜共创服务新价值`,
  insiderInvite: `加入${appConfig.platformName}｜开启高效协作`
}
const SHARE_TITLES = { ...FALLBACK_SHARE_TITLES, ...(appConfig.shareTitles || {}) }

const PUBLIC_POLICIES = {
  'pages/workspace/index': { title: SHARE_TITLES.platform, image: 'platform', sharePath: HOME_PATH, timeline: true },
  'pages/mall/index': { title: SHARE_TITLES.mall, image: 'mall', sharePath: '/pages/mall/index', timeline: true },
  'pages/mall/detail': { title: '商品详情｜' + SHARE_TITLES.mall, image: 'mall', sharePath: '/pages/mall/detail', allowedQuery: ['id'], timeline: true, pageSnapshot: true },
  'pages/news/index': { title: SHARE_TITLES.news, image: 'news', sharePath: '/pages/news/index', timeline: true },
  'pages/news/detail': { title: '资讯详情｜' + SHARE_TITLES.news, image: 'news', sharePath: '/pages/news/detail', allowedQuery: ['id'], timeline: true, pageSnapshot: true },
  'pages/complaint/index': { title: '投诉举报中心｜' + SHARE_TITLES.service, image: 'service', sharePath: '/pages/complaint/index', allowedQuery: ['tab'], safeCover: true, timeline: true },
  'pages/privacy/index': { title: '隐私政策｜' + SHARE_TITLES.platform, image: 'platform', sharePath: '/pages/privacy/index', timeline: true, pageSnapshot: true },
  'pages/about/index': { title: '关于小程序｜' + SHARE_TITLES.platform, image: 'platform', sharePath: '/pages/about/index', timeline: true, pageSnapshot: true }
}

// Internal pages only retain the minimum route parameters required to restore the
// current page. Authentication and authorization are still enforced when the
// receiver opens the link; tokens and other login-state data are never shared.
const INTERNAL_POLICIES = {
  'pages/message/index': { title: '消息中心｜' + SHARE_TITLES.platform, image: 'platform', sharePath: '/pages/message/index', safeCover: true, timeline: true },
  'pages/profile/index': { title: '个人中心｜' + SHARE_TITLES.platform, image: 'platform', sharePath: '/pages/profile/index', safeCover: true, timeline: true },
  'pages/message/chat': { title: '会话｜' + SHARE_TITLES.platform, image: 'platform', sharePath: '/pages/message/chat', allowedQuery: ['id', 'type'], safeCover: true },
  'pages/login/index': { title: '登录｜' + SHARE_TITLES.platform, image: 'platform', sharePath: '/pages/login/index', pageSnapshot: true, timeline: true },
  'pages/ai/index': { title: '消息中心｜' + SHARE_TITLES.platform, image: 'platform', sharePath: '/pages/ai/index', safeCover: true, timeline: true },
  'pages/business/list': { title: '业务列表｜' + SHARE_TITLES.business, image: 'business', sharePath: '/pages/business/list', allowedQuery: ['key'], safeCover: true, timeline: true },
  'pages/business/catalog': { title: '全部功能｜' + SHARE_TITLES.business, image: 'business', sharePath: '/pages/business/catalog', pageSnapshot: true, timeline: true },
  'pages/business/detail': { title: '业务详情｜' + SHARE_TITLES.business, image: 'business', sharePath: '/pages/business/detail', allowedQuery: ['key', 'id', 'menuId'], safeCover: true, timeline: true },
  'pages/business/proposal-compare': { title: '方案比价｜' + SHARE_TITLES.business, image: 'business', sharePath: '/pages/business/proposal-compare', allowedQuery: ['ids'], safeCover: true, timeline: true },
  'pages/business/related-list': { title: '关联列表｜' + SHARE_TITLES.business, image: 'business', sharePath: '/pages/business/related-list', allowedQuery: ['fieldId', 'parentId', 'parentMenuId', 'parentTableId', 'parentTableName', 'relationValue', 'title'], safeCover: true },
  'pages/business/stats': { title: '业绩统计｜' + SHARE_TITLES.business, image: 'business', sharePath: '/pages/business/stats', safeCover: true, timeline: true },
  'pages/module/catalog': { title: '全部应用｜' + SHARE_TITLES.business, image: 'business', sharePath: '/pages/module/catalog', pageSnapshot: true, timeline: true },
  'pages/module/list': { title: '业务列表｜' + SHARE_TITLES.business, image: 'business', sharePath: '/pages/module/list', allowedQuery: ['menuId'], safeCover: true, timeline: true },
  'pages/module/detail': { title: '业务详情｜' + SHARE_TITLES.business, image: 'business', sharePath: '/pages/module/detail', allowedQuery: ['id', 'menuId'], safeCover: true, timeline: true },
  'pages/native-form/index': { title: '业务表单｜' + SHARE_TITLES.business, image: 'business', sharePath: '/pages/native-form/index', allowedQuery: ['table', 'menuId', 'id', 'title', 'moduleEngineKey'], forceQuery: (query) => ({ mode: query.id ? 'View' : 'Add' }), safeCover: true },
  'pages/task/list': { title: '售后任务｜' + SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/list', safeCover: true, timeline: true },
  'pages/task/detail': { title: '任务详情｜' + SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/detail', allowedQuery: ['id'], safeCover: true, timeline: true },
  'pages/task/devices': { title: '任务设备｜' + SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/devices', allowedQuery: ['taskId', 'taskType'], safeCover: true, timeline: true },
  'pages/task/device': { title: '设备处理｜' + SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/device', allowedQuery: ['id', 'taskId', 'taskType'], safeCover: true },
  'pages/task/consumable': { title: '设备耗材｜' + SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/consumable', allowedQuery: ['deviceId', 'taskId', 'source'], safeCover: true },
  'pages/task/add-devices': { title: '选择售后设备｜' + SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/add-devices', allowedQuery: ['taskId', 'customerId'], safeCover: true },
  'pages/task/scan': { title: '扫码做任务｜' + SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/scan', allowedQuery: ['deviceId'], safeCover: true },
  'pages/task/map': { title: '设备地图｜' + SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/map', allowedQuery: ['mode', 'customerId', 'taskId', 'taskType'], safeCover: true, timeline: true },
  'pages/complaint/detail': { title: '投诉处理详情｜' + SHARE_TITLES.service, image: 'service', sharePath: '/pages/complaint/detail', allowedQuery: ['id', 'public'], safeCover: true },
  'pages/native/checkin': { title: '拜访打卡｜' + SHARE_TITLES.business, image: 'business', sharePath: '/pages/native/checkin', allowedQuery: ['taskId', 'targetType', 'customerId'], safeCover: true },
  'pages/native/repair': { title: '设备报修｜' + SHARE_TITLES.service, image: 'service', sharePath: '/pages/native/repair', allowedQuery: ['deviceId', 'id', 'entry'], safeCover: true },
  'pages/native/customer-share': { title: '分享客户｜' + SHARE_TITLES.business, image: 'business', sharePath: '/pages/native/customer-share', allowedQuery: ['customerId', 'id'], safeCover: true },
  'pages/native/password': { title: '修改密码｜' + SHARE_TITLES.platform, image: 'platform', sharePath: '/pages/native/password', safeCover: true },
  'pages/native/member-edit': { title: '新增成员｜' + SHARE_TITLES.business, image: 'business', sharePath: '/pages/native/member-edit', safeCover: true },
  'pages/native/reminders': { title: '提醒管理｜' + SHARE_TITLES.business, image: 'business', sharePath: '/pages/native/reminders', safeCover: true },
  'pages/native/merchant-apply': { title: '商家入驻｜' + SHARE_TITLES.invite, image: 'invite', sharePath: '/pages/native/merchant-apply', allowedQuery: ['InviterId', 'InviterName', 'InviterType'], safeCover: true, timeline: true },
  'pages/native/service-record': { title: '服务记录表｜' + SHARE_TITLES.service, image: 'service', sharePath: '/pages/native/service-record', allowedQuery: ['id', 'customerId'], forceQuery: (query) => query.id ? { mode: 'view' } : {}, safeCover: true },
  'pages/native/casebook': { title: '案例册｜' + SHARE_TITLES.business, image: 'business', sharePath: '/pages/native/casebook', allowedQuery: ['id'], safeCover: true },
  'pages/native/watermark-camera': { title: '现场水印相机｜' + SHARE_TITLES.service, image: 'service', sharePath: '/pages/native/watermark-camera', safeCover: true },
  'pages/native/task-feedback': { title: '服务反馈｜' + SHARE_TITLES.service, image: 'service', sharePath: '/pages/native/task-feedback', allowedQuery: ['taskId', 'taskType'], safeCover: true },
  'pages/native/task-follow-up': { title: '追加评价｜' + SHARE_TITLES.service, image: 'service', sharePath: '/pages/native/task-follow-up', allowedQuery: ['id'], safeCover: true },
  'pages/native/official-account': { title: '关注公众号｜' + SHARE_TITLES.platform, image: 'platform', sharePath: '/pages/native/official-account', timeline: true, pageSnapshot: true }
}

export const PAGE_POLICIES = Object.freeze({ ...PUBLIC_POLICIES, ...INTERNAL_POLICIES })

const SHARE_WITHOUT_LOGIN = new Set([
  'pages/workspace/index', 'pages/mall/index', 'pages/mall/detail',
  'pages/news/index', 'pages/news/detail', 'pages/complaint/index',
  'pages/login/index', 'pages/privacy/index', 'pages/about/index',
  'pages/profile/index', 'pages/native/merchant-apply', 'pages/native/official-account'
])

function normalizePath(path) {
  if (!path) return HOME_PATH
  return path.charAt(0) === '/' ? path : '/' + path
}

function routeKey(path) {
  return normalizePath(path).replace(/^\//, '').split('?')[0]
}

function decodeQueryValue(value) {
  let text = value === undefined || value === null ? '' : String(value)
  for (let index = 0; index < 3; index += 1) {
    if (!/%[0-9a-f]{2}/i.test(text)) break
    try {
      const decoded = decodeURIComponent(text)
      if (decoded === text) break
      text = decoded
    } catch (error) {
      break
    }
  }
  return text
}

function cleanQueryValue(value) {
  if (value === undefined || value === null) return ''
  const text = decodeQueryValue(value).trim()
  return text.length > 160 ? text.slice(0, 160) : text
}

function pickQuery(query, allowedKeys = []) {
  if (!query || typeof query !== 'object' || !allowedKeys.length) return {}
  return allowedKeys.reduce((result, key) => {
    const value = cleanQueryValue(query[key])
    if (value) result[key] = value
    return result
  }, {})
}

function encodeQuery(query) {
  return Object.keys(query || {})
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(query[key]))}`)
    .join('&')
}

function getRouteInfo(vm, pagePath) {
  let path = pagePath ? normalizePath(pagePath) : HOME_PATH
  let query = {}

  if (typeof getCurrentPages === 'function') {
    const pages = getCurrentPages()
    const current = pages && pages.length ? pages[pages.length - 1] : null
    if (!pagePath && current && current.route) path = normalizePath(current.route)
    if (current && current.options) query = current.options
  } else if (vm && vm.$route) {
    if (vm.$route.path) path = normalizePath(vm.$route.path)
    if (vm.$route.query) query = vm.$route.query
  }

  return { path, query }
}

function getPolicy(path) {
  return PAGE_POLICIES[routeKey(path)] || {
    title: SHARE_TITLES.platform,
    image: 'platform',
    sharePath: normalizePath(path),
    safeCover: true,
    timeline: true
  }
}

function getShareImage(imageKey) {
  const images = appConfig.cdnAssets && appConfig.cdnAssets.share
  return (images && images[imageKey]) || (images && images.platform) || (appConfig.cdnAssets && appConfig.cdnAssets.logo) || appConfig.logoUrl
}

let officialAccountUsername = ''
let officialAccountFollowStatus = 'unknown'
let officialAccountRequest = null
let officialAccountRequestAction = ''

/** The ID comes only from the current tenant's wx_mp.GongzhonghaoID projection. */
export function getOfficialAccountUsername() {
  return officialAccountUsername
}

function getWechatLoginCode() {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || typeof wx.login !== 'function') return resolve('')
    try {
      wx.login({
        success: (result) => resolve(cleanQueryValue(result && result.code)),
        fail: () => resolve('')
      })
    } catch (error) { resolve('') }
  })
}

/** Request the public ID and the server-verified follow status before prompting. */
export function warmOfficialAccountConfig(forceStatusCheck = false) {
  // #ifdef MP-WEIXIN
  const apiEngineKey = cleanQueryValue(appConfig.shareOfficialAccountApiEngineKey)
  if (!/^[a-z0-9-]{3,100}$/.test(apiEngineKey)) return Promise.resolve('unknown')
  if (officialAccountRequest) {
    return forceStatusCheck && officialAccountRequestAction === 'Config'
      ? officialAccountRequest.then(() => warmOfficialAccountConfig(true))
      : officialAccountRequest
  }
  if (!forceStatusCheck && officialAccountUsername) {
    return Promise.resolve(officialAccountFollowStatus)
  }
  officialAccountRequestAction = forceStatusCheck ? 'Status' : 'Config'
  officialAccountRequest = (forceStatusCheck ? getWechatLoginCode() : Promise.resolve('')).then((loginCode) => {
    return post(`/apiengine/${apiEngineKey}`, {
      Action: officialAccountRequestAction,
      ...(loginCode ? { LoginCode: loginCode } : {})
    }, Boolean(getToken()))
  }).then((result) => {
    const data = result && result.Code === 1 ? (result.Data || {}) : {}
    const username = cleanQueryValue(data.Username)
    officialAccountUsername = /^gh_[a-zA-Z0-9]{6,40}$/.test(username) ? username : ''
    officialAccountFollowStatus = data.FollowStatus === 'followed' || data.FollowStatus === 'not_followed'
      ? data.FollowStatus : 'unknown'
    return officialAccountFollowStatus
  }).catch(() => {
    officialAccountUsername = ''
    officialAccountFollowStatus = 'unknown'
    return officialAccountFollowStatus
  }).finally(() => { officialAccountRequest = null; officialAccountRequestAction = '' })
  return officialAccountRequest
  // #endif
  return Promise.resolve('unknown')
}

function showFollowError(title, content) {
  try {
    uni.showModal({
      title,
      content,
      showCancel: false
    })
  } catch (error) {}
}

function canUseOfficialAccountComponent() {
  // The native component is only populated for these documented entry scenes.
  // Keep it as a fallback there; a chat/card share must use the direct API.
  try {
    const launch = typeof wx !== 'undefined' && typeof wx.getLaunchOptionsSync === 'function'
      ? wx.getLaunchOptionsSync()
      : null
    return [1038, 1047, 1089].includes(Number(launch && launch.scene))
  } catch (error) {
    return false
  }
}

export function openOfficialAccountProfile() {
  // #ifdef MP-WEIXIN
  // This API is intentionally called only from the modal/button click handler.
  // Unlike <official-account>, it is not restricted to a small set of entry
  // scenes such as scan-code or recent-use entries.
  const username = getOfficialAccountUsername()
  if (!username) {
    if (canUseOfficialAccountComponent()) {
      try {
        uni.navigateTo({ url: OFFICIAL_ACCOUNT_PATH })
        return true
      } catch (error) {}
    }
    showFollowError('暂时无法关注公众号', '后台公众号配置尚未加载，请稍后重试。')
    return false
  }
  if (typeof wx === 'undefined' || typeof wx.openOfficialAccountProfile !== 'function') {
    showFollowError('微信版本不支持', '当前微信版本不支持一键关注，请升级微信后重试。')
    return false
  }
  try {
    wx.openOfficialAccountProfile({
      username,
      fail: (error) => {
        const message = error && error.errMsg ? String(error.errMsg) : '请稍后重试。'
        showFollowError('打开公众号失败', message.length > 120 ? `${message.slice(0, 120)}…` : message)
      }
    })
    return true
  } catch (error) {
    showFollowError('打开公众号失败', '请稍后重试。')
    return false
  }
  // #endif
  return false
}

export function buildSharePayload(vm, pagePath) {
  const route = getRouteInfo(vm, pagePath)
  const policy = getPolicy(route.path)
  // 分享标记仅用于接收者的自愿关注提示；业务定位参数仍由每页白名单筛选。
  const pickedQuery = pickQuery(route.query, policy.allowedQuery)
  const forcedQuery = typeof policy.forceQuery === 'function' ? policy.forceQuery(pickedQuery) : (policy.forceQuery || {})
  const safeQuery = {
    ...pickedQuery,
    ...forcedQuery,
    fromShare: '1'
  }
  const query = encodeQuery(safeQuery)
  const path = `${policy.sharePath}?${query}`

  const payload = {
    title: policy.title,
    path,
    query,
    timeline: true
  }
  // 所有页面都不传 imageUrl，交由微信截取发起分享时的当前画面作为卡片预览。
  return payload
}

export function buildFriendShare(vm, pagePath) {
  const payload = buildSharePayload(vm, pagePath)
  return { title: payload.title, path: payload.path }
}

export function buildTimelineShare(vm, pagePath) {
  const payload = buildSharePayload(vm, pagePath)
  return { title: payload.title, query: payload.query }
}

export function buildInviteSharePayload(inviteType, currentUser = {}) {
  const type = inviteType === 'business' || inviteType === 'Insider' ? inviteType : 'normal'
  const query = {
    InviterId: cleanQueryValue(currentUser.Id),
    InviterName: cleanQueryValue(currentUser.Name || currentUser.Account),
    InviterType: type === 'normal' ? '' : type,
    fromShare: '1'
  }
  const queryString = encodeQuery(Object.keys(query).reduce((result, key) => {
    if (query[key]) result[key] = query[key]
    return result
  }, {}))
  const basePath = type === 'business' ? '/pages/native/merchant-apply' : HOME_PATH
  const title = type === 'business'
    ? SHARE_TITLES.merchantInvite
    : (type === 'Insider' ? SHARE_TITLES.insiderInvite : SHARE_TITLES.invite)

  return {
    title,
    path: queryString ? `${basePath}?${queryString}` : basePath,
    imageUrl: getShareImage('invite')
  }
}

export function enableShareMenu(vm) {
  // #ifdef MP-WEIXIN
  try {
    uni.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] })
  } catch (error) {}
  // #endif
}

let sharedAuthRedirecting = false

export function maybeRedirectSharedReceiver() {
  // #ifdef MP-WEIXIN
  if (sharedAuthRedirecting || typeof getCurrentPages !== 'function') return
  const pages = getCurrentPages()
  const current = pages && pages.length ? pages[pages.length - 1] : null
  if (!current || String(current.options && current.options.fromShare || '') !== '1') return
  if (SHARE_WITHOUT_LOGIN.has(current.route || '')) return
  const user = getUser() || {}
  if (getToken() && user.Id) return

  // 原页面留在栈中；登录页已有 redirect 恢复逻辑，业务记录继续走服务端行权限。
  sharedAuthRedirecting = true
  const redirect = buildFriendShare(null, current.route).path
  uni.navigateTo({
    url: `/pages/login/index?redirect=${encodeURIComponent(redirect)}`,
    fail: () => { sharedAuthRedirecting = false },
    complete: () => { setTimeout(() => { sharedAuthRedirecting = false }, 800) }
  })
  // #endif
}

let followPromptShown = false
let followPromptTimer = null

export function maybePromptFollow() {
  // #ifdef MP-WEIXIN
  if (followPromptShown || followPromptTimer || typeof getCurrentPages !== 'function') return
  const pages = getCurrentPages()
  const current = pages && pages.length ? pages[pages.length - 1] : null
  if (!current || String(current.options && current.options.fromShare || '') !== '1') return
  if (/^pages\/(login|privacy|about)\//.test(current.route || '') || current.route === 'pages/native/official-account') return

  followPromptTimer = setTimeout(() => {
    warmOfficialAccountConfig(true).then((status) => {
      followPromptTimer = null
      const activePages = getCurrentPages()
      const active = activePages && activePages.length ? activePages[activePages.length - 1] : null
      if (!active || active.route !== current.route || String(active.options && active.options.fromShare || '') !== '1') return
      // An unknown identity or failed WeChat check must never be treated as unfollowed.
      if (status !== 'not_followed' || !getOfficialAccountUsername()) return
      followPromptShown = true
      uni.showModal({
        title: '欢迎查看分享内容',
        content: '你可以继续查看此页面。点击“一键关注”将打开关联公众号主页，关注后可接收平台资讯。',
        cancelText: '继续查看',
        confirmText: '一键关注',
        success: (result) => {
          if (result.confirm) openOfficialAccountProfile()
        }
      })
    })
  }, 1200)
  // #endif
}

export default {
  onLoad() {
    enableShareMenu(this)
  },
  onShow() {
    enableShareMenu(this)
    maybeRedirectSharedReceiver()
    maybePromptFollow()
  },
  onShareAppMessage() {
    return buildFriendShare(this)
  },
  onShareTimeline() {
    return buildTimelineShare(this)
  }
}
