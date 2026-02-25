/**
 * 业务 API 封装
 * 基于 Microi 低代码引擎的接口调用
 */
import { post } from './request.js'
import appConfig from './config.js'

/**
 * 获取图片完整 URL
 * @param {String} path 图片路径（支持JSON字符串、相对路径、完整URL）
 */
export function getImageUrl(path) {
  if (!path) return ''
  // 尝试解析 JSON 对象字符串 {"Path":"xxx"}
  if (path.startsWith('{')) {
    try {
      const obj = JSON.parse(path)
      path = obj.Path || obj.path || ''
    } catch (e) {}
  }
  if (!path) return ''
  if (path.startsWith('http')) return path
  // 相对路径加上图片服务器前缀
  return appConfig.fileServer + (path.startsWith('/') ? '' : '/') + path
}

/**
 * 解析图片 JSON 字段（Tupian 字段通常是 JSON 数组）
 * 格式可能是: '[{"Path":"xxx"}]' 或 '["xxx"]' 或 'xxx.jpg'
 */
export function parseImages(tupian) {
  if (!tupian) return []
  if (typeof tupian === 'string') {
    // 尝试 JSON 解析
    if (tupian.startsWith('[')) {
      try {
        const arr = JSON.parse(tupian)
        return arr.map(item => {
          if (typeof item === 'string') return getImageUrl(item)
          if (item && item.Path) return getImageUrl(item.Path)
          if (item && item.path) return getImageUrl(item.path)
          if (item && item.url) return item.url
          return ''
        }).filter(Boolean)
      } catch (e) {}
    }
    // 单个图片路径
    const url = getImageUrl(tupian)
    return url ? [url] : []
  }
  return []
}

// ======================== 商城 API ========================

/**
 * 获取商品分类列表（树形结构）
 */
export function getProductCategories() {
  return post('/api/FormEngine/GetTableDataTreeAnonymous', {
    FormEngineKey: 'Diy_Fenlei',
    OsClient: appConfig.osClient,
    _OrderBy: 'Paixu'
  }, false)
}

/**
 * 获取商品类型列表
 */
export function getProductTypes() {
  return post('/api/ApiEngine/Run', {
    ApiEngineKey: 'getGoodsType',
    OsClient: appConfig.osClient
  }, false)
}

/**
 * 获取商品列表（支持高级筛选）
 * @param {Object} params
 * @param {Number} params.pageIndex 页码
 * @param {Number} params.pageSize 每页数量
 * @param {String} params.categoryId 分类ID（可选）
 * @param {String} params.keyword 搜索关键词（可选）
 * @param {Array}  params.types 类型筛选数组（可选），如 ['设备','耗材']
 * @param {String|Number} params.priceMin 最低价（可选）
 * @param {String|Number} params.priceMax 最高价（可选）
 */
export function getProductList({ pageIndex = 1, pageSize = 10, categoryId, keyword, types, priceMin, priceMax } = {}) {
  const data = {
    FormEngineKey: 'Diy_Shangpin',
    OsClient: appConfig.osClient,
    _OrderBy: 'Paixu',
    _PageIndex: pageIndex,
    _PageSize: pageSize,
    _Where: [
      { Name: 'ShangpinZTZ', Value: 1, Type: '=' }
    ]
  }
  if (categoryId) {
    data._Search = { PingtaiFL: categoryId }
  }
  // 关键词搜索：匹配商品名称、商品编号、商家名、供应商
  if (keyword) {
    data._Where.push(
      { GroupStart: true, Name: 'ShangpinMC', Value: keyword, Type: 'Like' },
      { AndOr: 'OR', Name: 'ShangpinBH', Value: keyword, Type: 'Like' },
      { AndOr: 'OR', Name: 'TenantName', Value: keyword, Type: 'Like' },
      { AndOr: 'OR', Name: 'ShangpinGYS', Value: keyword, Type: 'Like', GroupEnd: true }
    )
  }
  // 类型筛选
  if (types && types.length > 0) {
    data._Where.push({
      AndOr: 'AND',
      Name: 'ShangpinLX',
      Value: JSON.stringify(types),
      Type: 'In'
    })
  }
  // 价格区间筛选（同时匹配租赁价和现价）
  if (priceMin || priceMax) {
    if (priceMin) {
      data._Where.push({
        AndOr: 'AND',
        GroupStart: true,
        Name: 'ZulinXJ',
        Value: priceMin,
        Type: '>='
      })
    }
    if (priceMax) {
      data._Where.push({
        AndOr: 'AND',
        Name: 'ZulinXJ',
        Value: priceMax,
        Type: '<=',
        GroupEnd: !priceMin ? false : true
      })
      if (!priceMin) {
        // only max set
        data._Where[data._Where.length - 1].GroupEnd = true
      }
    } else if (priceMin) {
      // only min set, close the group
      data._Where[data._Where.length - 1].GroupEnd = true
    }
  }
  return post('/api/FormEngine/GetTableDataAnonymous', data, false)
}

/**
 * 获取商品详情
 * @param {String} id 商品ID
 */
export function getProductDetail(id) {
  return post('/api/FormEngine/GetFormDataAnonymous', {
    FormEngineKey: 'Diy_Shangpin',
    Id: id,
    OsClient: appConfig.osClient
  }, false)
}

/**
 * 获取商品动态属性
 * @param {String} id 商品ID
 */
export function getProductDynamicInfo(id) {
  return post('/api/ApiEngine/Run', {
    ApiEngineKey: 'goods_detail',
    ShangpinID: id
  }, false)
}

// ======================== 资讯 API ========================

/**
 * 获取资讯列表
 * @param {Object} params
 * @param {Number} params.pageIndex 页码
 * @param {Number} params.pageSize 每页数量
 */
export function getNewsList({ pageIndex = 1, pageSize = 10 } = {}) {
  return post('/api/FormEngine/GetTableDataAnonymous', {
    FormEngineKey: 'Diy_Zixun',
    OsClient: appConfig.osClient,
    _PageIndex: pageIndex,
    _PageSize: pageSize,
    _SearchEqual: { Zhuangtai: '已发布' }
  }, false)
}

/**
 * 获取资讯详情
 * @param {String} id 资讯ID
 */
export function getNewsDetail(id) {
  return post('/api/FormEngine/GetFormDataAnonymous', {
    FormEngineKey: 'Diy_Zixun',
    Id: id,
    OsClient: appConfig.osClient
  }, false)
}

/**
 * 获取轮播图
 */
export function getBannerList() {
  return post('/api/FormEngine/GetTableDataAnonymous', {
    FormEngineKey: 'Diy_Lunbotu',
    OsClient: appConfig.osClient
  }, false)
}

// ======================== 收藏 & 预约 API ========================

/**
 * 检查是否已收藏
 * @param {String} id 商品ID
 */
export function checkFavorite(id) {
  return post('/api/ApiEngine/Run', {
    ApiEngineKey: 'shangpin_issc',
    ShangpinID: id,
    OsClient: appConfig.osClient
  }, true)
}

/**
 * 收藏/取消收藏
 * @param {String} id 商品ID
 * @param {Number} type 0=收藏, 1=取消收藏
 */
export function toggleFavorite(id, type) {
  return post('/api/ApiEngine/Run', {
    ApiEngineKey: 'shangpin_sc',
    ShangpinID: id,
    Type: type,
    OsClient: appConfig.osClient
  }, true)
}

/**
 * 预约商品
 * @param {Object} params
 * @param {String} params.ShangpinID 商品ID
 * @param {String} params.Xingming 姓名
 * @param {String} params.Dianhua 手机号
 * @param {Number} params.Shuliang 数量
 */
export function reserveProduct(params) {
  return post('/api/ApiEngine/Run', {
    ApiEngineKey: 'yuyue_shangpin',
    ...params,
    OsClient: appConfig.osClient
  }, true)
}
