import { post, V8 } from './request.js';
import appConfig from '../config.js';

export function getImageUrl(path) {
  return V8.assetUrl(path);
}

export function parseImages(value) {
  return V8.normalizeUploadValue(value).map((item) => getImageUrl(item)).filter(Boolean);
}

// Mall APIs
export function getProductCategories() {
  return post('/api/FormEngine/GetTableDataTreeAnonymous', {
    FormEngineKey: 'Diy_Fenlei',
    OsClient: appConfig.osClient,
    _OrderBy: 'Paixu'
  }, false);
}

export function getProductTypes() {
  return post('/api/ApiEngine/Run', {
    ApiEngineKey: 'getGoodsType',
    OsClient: appConfig.osClient
  }, false);
}

export function getProductList({
  pageIndex = 1,
  pageSize = 10,
  categoryId,
  keyword,
  types,
  priceMin,
  priceMax
} = {}) {
  const data = {
    FormEngineKey: 'Diy_Shangpin',
    OsClient: appConfig.osClient,
    _OrderBy: 'Paixu',
    _PageIndex: pageIndex,
    _PageSize: pageSize,
    _Where: [
      { Name: 'ShangpinZTZ', Value: 1, Type: '=' }
    ]
  };

  if (categoryId) data._Search = { PingtaiFL: categoryId };

  if (keyword) {
    data._Where.push(
      { GroupStart: true, Name: 'ShangpinMC', Value: keyword, Type: 'Like' },
      { AndOr: 'OR', Name: 'ShangpinBH', Value: keyword, Type: 'Like' },
      { AndOr: 'OR', Name: 'TenantName', Value: keyword, Type: 'Like' },
      { AndOr: 'OR', Name: 'ShangpinGYS', Value: keyword, Type: 'Like', GroupEnd: true }
    );
  }

  if (types && types.length > 0) {
    data._Where.push({
      AndOr: 'AND',
      Name: 'ShangpinLX',
      Value: JSON.stringify(types),
      Type: 'In'
    });
  }

  if (priceMin || priceMax) {
    if (priceMin && priceMax) {
      data._Where.push({
        AndOr: 'AND',
        GroupStart: true,
        Name: 'ZulinXJ',
        Value: priceMin,
        Type: '>='
      });
      data._Where.push({
        AndOr: 'AND',
        Name: 'ZulinXJ',
        Value: priceMax,
        Type: '<=',
        GroupEnd: true
      });
    } else if (priceMin) {
      data._Where.push({
        AndOr: 'AND',
        Name: 'ZulinXJ',
        Value: priceMin,
        Type: '>='
      });
    } else {
      data._Where.push({
        AndOr: 'AND',
        Name: 'ZulinXJ',
        Value: priceMax,
        Type: '<='
      });
    }
  }

  return post('/api/FormEngine/GetTableDataAnonymous', data, false);
}

export function getProductDetail(id) {
  return post('/api/FormEngine/GetFormDataAnonymous', {
    FormEngineKey: 'Diy_Shangpin',
    Id: id,
    OsClient: appConfig.osClient
  }, false);
}

export function getProductDynamicInfo(id) {
  return post('/api/ApiEngine/Run', {
    ApiEngineKey: 'goods_detail',
    ShangpinID: id,
    OsClient: appConfig.osClient
  }, false);
}

// News APIs
export function getNewsList({ pageIndex = 1, pageSize = 10 } = {}) {
  return post('/api/FormEngine/GetTableDataAnonymous', {
    FormEngineKey: 'Diy_Zixun',
    OsClient: appConfig.osClient,
    _PageIndex: pageIndex,
    _PageSize: pageSize,
    _SearchEqual: { Zhuangtai: '已发布' }
  }, false);
}

export function getNewsDetail(id) {
  return post('/api/FormEngine/GetFormDataAnonymous', {
    FormEngineKey: 'Diy_Zixun',
    Id: id,
    OsClient: appConfig.osClient
  }, false);
}

export function getBannerList() {
  return post('/api/FormEngine/GetTableDataAnonymous', {
    FormEngineKey: 'Diy_Lunbotu',
    OsClient: appConfig.osClient
  }, false);
}

// Favorite and appointment APIs
export function checkFavorite(id) {
  return post('/api/ApiEngine/Run', {
    ApiEngineKey: 'shangpin_issc',
    ShangpinID: id,
    OsClient: appConfig.osClient
  }, true);
}

export function toggleFavorite(id, type) {
  return post('/api/ApiEngine/Run', {
    ApiEngineKey: 'shangpin_sc',
    ShangpinID: id,
    Type: type,
    OsClient: appConfig.osClient
  }, true);
}

export function reserveProduct(params) {
  return post('/api/ApiEngine/Run', {
    ApiEngineKey: 'yuyue_shangpin',
    ...params,
    OsClient: appConfig.osClient
  }, true);
}
