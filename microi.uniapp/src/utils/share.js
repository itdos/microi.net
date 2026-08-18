import appConfig from '@/config.js'

const HOME_PATH = '/pages/workspace/index'

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
  'pages/mall/detail': { title: SHARE_TITLES.mall, image: 'mall', sharePath: '/pages/mall/detail', allowedQuery: ['id'], timeline: true, pageSnapshot: true },
  'pages/news/index': { title: SHARE_TITLES.news, image: 'news', sharePath: '/pages/news/index', timeline: true },
  'pages/news/detail': { title: SHARE_TITLES.news, image: 'news', sharePath: '/pages/news/detail', allowedQuery: ['id'], timeline: true, pageSnapshot: true },
  'pages/privacy/index': { title: SHARE_TITLES.platform, image: 'platform', sharePath: '/pages/privacy/index', timeline: true },
  'pages/about/index': { title: SHARE_TITLES.platform, image: 'platform', sharePath: '/pages/about/index', timeline: true }
}

// Internal pages only retain the minimum route parameters required to restore the
// current page. Authentication and authorization are still enforced when the
// receiver opens the link; tokens and other login-state data are never shared.
const INTERNAL_POLICIES = {
  'pages/message/index': { title: SHARE_TITLES.platform, image: 'platform', sharePath: HOME_PATH },
  'pages/profile/index': { title: SHARE_TITLES.platform, image: 'platform', sharePath: HOME_PATH },
  'pages/message/chat': { title: SHARE_TITLES.platform, image: 'platform', sharePath: HOME_PATH },
  'pages/login/index': { title: SHARE_TITLES.platform, image: 'platform', sharePath: HOME_PATH },
  'pages/ai/index': { title: SHARE_TITLES.platform, image: 'platform', sharePath: HOME_PATH },
  'pages/business/list': { title: SHARE_TITLES.business, image: 'business', sharePath: '/pages/business/list', allowedQuery: ['key'] },
  'pages/business/catalog': { title: SHARE_TITLES.business, image: 'business', sharePath: '/pages/business/catalog' },
  'pages/business/detail': { title: SHARE_TITLES.business, image: 'business', sharePath: '/pages/business/detail', allowedQuery: ['key', 'id', 'menuId'], timeline: true, pageSnapshot: true },
  'pages/business/related-list': { title: SHARE_TITLES.business, image: 'business', sharePath: '/pages/business/list', allowedQuery: ['key'] },
  'pages/business/stats': { title: SHARE_TITLES.business, image: 'business', sharePath: HOME_PATH },
  'pages/module/catalog': { title: SHARE_TITLES.business, image: 'business', sharePath: '/pages/module/catalog' },
  'pages/module/list': { title: SHARE_TITLES.business, image: 'business', sharePath: '/pages/module/list', allowedQuery: ['key'] },
  'pages/module/detail': { title: SHARE_TITLES.business, image: 'business', sharePath: '/pages/module/detail', allowedQuery: ['id', 'menuId'], timeline: true, pageSnapshot: true },
  'pages/native-form/index': { title: SHARE_TITLES.business, image: 'business', sharePath: HOME_PATH },
  'pages/task/list': { title: SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/list' },
  'pages/task/detail': { title: SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/detail', allowedQuery: ['id'], timeline: true, pageSnapshot: true },
  'pages/task/devices': { title: SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/devices', allowedQuery: ['taskId', 'taskType'], timeline: true, pageSnapshot: true },
  'pages/task/device': { title: SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/list' },
  'pages/task/consumable': { title: SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/list' },
  'pages/task/add-devices': { title: SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/list' },
  'pages/task/scan': { title: SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/list' },
  'pages/task/map': { title: SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/map', allowedQuery: ['mode', 'customerId', 'taskId', 'taskType'], timeline: true, pageSnapshot: true },
  'pages/native/checkin': { title: SHARE_TITLES.business, image: 'business', sharePath: HOME_PATH },
  'pages/native/repair': { title: SHARE_TITLES.service, image: 'service', sharePath: HOME_PATH },
  'pages/native/customer-share': { title: SHARE_TITLES.business, image: 'business', sharePath: HOME_PATH },
  'pages/native/password': { title: SHARE_TITLES.platform, image: 'platform', sharePath: HOME_PATH },
  'pages/native/member-edit': { title: SHARE_TITLES.business, image: 'business', sharePath: HOME_PATH },
  'pages/native/reminders': { title: SHARE_TITLES.business, image: 'business', sharePath: HOME_PATH },
  'pages/native/merchant-apply': { title: SHARE_TITLES.invite, image: 'invite', sharePath: HOME_PATH },
  'pages/native/service-record': { title: SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/list' },
  'pages/native/casebook': { title: SHARE_TITLES.business, image: 'business', sharePath: HOME_PATH },
  'pages/native/watermark-camera': { title: SHARE_TITLES.service, image: 'service', sharePath: HOME_PATH },
  'pages/native/task-feedback': { title: SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/list' },
  'pages/native/task-follow-up': { title: SHARE_TITLES.service, image: 'service', sharePath: '/pages/task/list' }
}

export const PAGE_POLICIES = Object.freeze({ ...PUBLIC_POLICIES, ...INTERNAL_POLICIES })

function normalizePath(path) {
  if (!path) return HOME_PATH
  return path.charAt(0) === '/' ? path : '/' + path
}

function routeKey(path) {
  return normalizePath(path).replace(/^\//, '').split('?')[0]
}

function cleanQueryValue(value) {
  if (value === undefined || value === null) return ''
  const text = String(value).trim()
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

function getRouteInfo(vm) {
  let path = HOME_PATH
  let query = {}

  if (typeof getCurrentPages === 'function') {
    const pages = getCurrentPages()
    const current = pages && pages.length ? pages[pages.length - 1] : null
    if (current && current.route) path = normalizePath(current.route)
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
    sharePath: HOME_PATH,
    timeline: false
  }
}

function getShareImage(imageKey) {
  const images = appConfig.cdnAssets && appConfig.cdnAssets.share
  return (images && images[imageKey]) || (images && images.platform) || (appConfig.cdnAssets && appConfig.cdnAssets.logo) || appConfig.logoUrl
}

export function buildSharePayload(vm) {
  const route = getRouteInfo(vm)
  const policy = getPolicy(route.path)
  const safeQuery = pickQuery(route.query, policy.allowedQuery)
  const query = encodeQuery(safeQuery)
  const path = query ? `${policy.sharePath}?${query}` : policy.sharePath

  const payload = {
    title: policy.title,
    path,
    query: policy.timeline && policy.sharePath === normalizePath(route.path) ? query : '',
    timeline: Boolean(policy.timeline)
  }
  // WeChat generates a thumbnail from the current page when imageUrl is absent.
  // This is preferable for detail pages because it reflects the record the user
  // is actually sharing instead of reusing a generic module cover.
  if (!policy.pageSnapshot) payload.imageUrl = getShareImage(policy.image)
  return payload
}

export function buildInviteSharePayload(inviteType, currentUser = {}) {
  const type = inviteType === 'business' || inviteType === 'Insider' ? inviteType : 'normal'
  const query = {
    InviterId: cleanQueryValue(currentUser.Id),
    InviterName: cleanQueryValue(currentUser.Name || currentUser.Account),
    InviterType: type === 'normal' ? '' : type
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

function enableShareMenu(vm) {
  // #ifdef MP-WEIXIN
  try {
    const policy = getPolicy(getRouteInfo(vm).path)
    const menus = policy.timeline ? ['shareAppMessage', 'shareTimeline'] : ['shareAppMessage']
    if (!policy.timeline && typeof uni.hideShareMenu === 'function') {
      uni.hideShareMenu({ menus: ['shareTimeline'] })
    }
    uni.showShareMenu({ withShareTicket: true, menus })
  } catch (error) {}
  // #endif
}

export default {
  onLoad() {
    enableShareMenu(this)
  },
  onShow() {
    enableShareMenu(this)
  },
  onShareAppMessage() {
    const payload = buildSharePayload(this)
    return {
      title: payload.title,
      path: payload.path,
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {})
    }
  },
  onShareTimeline() {
    const payload = buildSharePayload(this)
    return {
      title: payload.title,
      query: payload.query,
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {})
    }
  }
}
