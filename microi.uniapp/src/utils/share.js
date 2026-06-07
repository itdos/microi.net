const HOME_PATH = '/pages/mall/index'
const DEFAULT_TITLE = 'Microi.net'
const DEFAULT_IMAGE = '/static/microi-blue-256.png'

const PAGE_TITLES = {
  'pages/mall/index': '商城',
  'pages/news/index': '资讯',
  'pages/workspace/index': '工作台',
  'pages/message/index': '消息',
  'pages/profile/index': '我的',
  'pages/message/chat': '会话',
  'pages/mall/detail': '商品详情',
  'pages/news/detail': '资讯详情',
  'pages/login/index': '登录',
  'pages/webview/index': '工作台',
  'pages/privacy/index': '隐私政策',
  'pages/about/index': '关于我们'
}

function normalizePath(path) {
  if (!path) return HOME_PATH
  return path.charAt(0) === '/' ? path : '/' + path
}

function routeKey(path) {
  return normalizePath(path).replace(/^\//, '').split('?')[0]
}

function encodeQuery(query) {
  if (!query || typeof query !== 'object') return ''
  return Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== null && query[key] !== '')
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

function getShareTitle(vm, path) {
  if (vm) {
    const directTitle = vm.shareTitle || vm.pageTitle || vm.title
    if (directTitle) return String(directTitle)
    if (typeof vm.t === 'function') {
      const key = routeKey(path)
      const i18nKeys = {
        'pages/mall/index': 'mall.title',
        'pages/news/index': 'news.title',
        'pages/workspace/index': 'workspace.title',
        'pages/message/index': 'message.title'
      }
      const i18nKey = i18nKeys[key]
      if (i18nKey) {
        const translated = vm.t(i18nKey)
        if (translated && translated !== i18nKey) return translated
      }
    }
  }

  return PAGE_TITLES[routeKey(path)] || DEFAULT_TITLE
}

function buildSharePayload(vm) {
  const route = getRouteInfo(vm)
  const query = encodeQuery(route.query)
  const path = query ? `${route.path}?${query}` : route.path
  return {
    title: getShareTitle(vm, route.path),
    path,
    query,
    imageUrl: DEFAULT_IMAGE
  }
}

function enableShareMenu() {
  // #ifdef MP-WEIXIN
  try {
    uni.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  } catch (e) {}
  // #endif
}

export default {
  onLoad() {
    enableShareMenu()
  },
  onShow() {
    enableShareMenu()
  },
  onShareAppMessage() {
    const payload = buildSharePayload(this)
    return {
      title: payload.title,
      path: payload.path,
      imageUrl: payload.imageUrl
    }
  },
  onShareTimeline() {
    const payload = buildSharePayload(this)
    return {
      title: payload.title,
      query: payload.query,
      imageUrl: payload.imageUrl
    }
  }
}
