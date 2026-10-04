import { getBannerList, getNewsList, getProductCategories, getProductList, getProductTypes } from '@/utils/api.js'
import { getUser } from '@/utils/request.js'
import appConfig from '@/config.js'
import { cachedRequest, readCache } from '@/platform/cache.js'
import { loadHomeSummary } from '@/platform/business-runtime.js'

const MALL_KEY = 'tab:mall:initial'
const NEWS_KEY = 'tab:news:initial'
const SUMMARY_KEY = 'tab:summary'

function summaryCacheKey() {
  const user = getUser() || {}
  return `${SUMMARY_KEY}:${user.Id || user.Account || 'guest'}`
}

function assertResult(result, fallback) {
  if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || fallback)
  return result
}

export function readMallSnapshot() {
  const cached = readCache(MALL_KEY, 10 * 60 * 1000)
  return cached ? cached.data : null
}

export async function loadMallSnapshot(options = {}) {
  if (!appConfig.features || appConfig.features.mall !== true) {
    return { categories: [], types: [], products: [], totalCount: 0 }
  }
  const result = await cachedRequest(MALL_KEY, async () => {
    const [categories, types, products] = await Promise.all([
      getProductCategories(),
      getProductTypes(),
      getProductList({ pageIndex: 1, pageSize: 10 })
    ])
    assertResult(categories, '商品分类加载失败')
    assertResult(types, '商品类型加载失败')
    assertResult(products, '商品列表加载失败')
    return {
      categories: categories.Data || [],
      types: types.Data || [],
      products: products.Data || [],
      totalCount: Number(products.DataCount || 0)
    }
  }, { maxAge: 10 * 60 * 1000, refresh: options.refresh === true, allowStale: true })
  return result.data
}

export function readNewsSnapshot() {
  const cached = readCache(NEWS_KEY, 5 * 60 * 1000)
  return cached ? cached.data : null
}

export async function loadNewsSnapshot(options = {}) {
  if (!appConfig.features || appConfig.features.news !== true) {
    return { banners: [], news: [] }
  }
  const result = await cachedRequest(NEWS_KEY, async () => {
    const [banners, news] = await Promise.all([
      getBannerList(),
      getNewsList({ pageIndex: 1, pageSize: 10 })
    ])
    assertResult(banners, '轮播图加载失败')
    assertResult(news, '资讯加载失败')
    return { banners: banners.Data || [], news: news.Data || [] }
  }, { maxAge: 5 * 60 * 1000, refresh: options.refresh === true, allowStale: true })
  return result.data
}

export function readSummarySnapshot() {
  const cached = readCache(summaryCacheKey(), 60 * 1000)
  return cached ? cached.data : null
}

export async function loadSummarySnapshot(options = {}) {
  if (!appConfig.features || appConfig.features.business !== true) {
    return { orders: 0, devices: 0, services: 0, tasks: 0, customers: 0 }
  }
  const result = await cachedRequest(summaryCacheKey(), () => loadHomeSummary({ refresh: options.refresh === true }), {
    maxAge: 60 * 1000,
    refresh: options.refresh === true,
    allowStale: true
  })
  return result.data
}

let warmTimer = null
let warmed = false

function canWarmOnCurrentNetwork() {
  return new Promise((resolve) => {
    if (!uni.getNetworkType) {
      resolve(true)
      return
    }
    uni.getNetworkType({
      success: ({ networkType }) => resolve(!['none', '2g'].includes(String(networkType || '').toLowerCase())),
      fail: () => resolve(true)
    })
  })
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function warmPrimaryTabs(delay = 280) {
  if (warmTimer || warmed) return
  warmTimer = setTimeout(async () => {
    warmTimer = null
    if (!(await canWarmOnCurrentNetwork())) return
    warmed = true
    // 串行填充已启用的公共 Tab 缓存，避免首帧后同时发起多组请求。
    if (appConfig.features && appConfig.features.news === true) {
      await loadNewsSnapshot().catch(() => null)
    }
    if (appConfig.features && appConfig.features.mall === true) {
      await wait(180)
      await loadMallSnapshot().catch(() => null)
    }
  }, Math.max(0, Number(delay || 0)))
}

export default {
  readMallSnapshot,
  loadMallSnapshot,
  readNewsSnapshot,
  loadNewsSnapshot,
  readSummarySnapshot,
  loadSummarySnapshot,
  warmPrimaryTabs
}
