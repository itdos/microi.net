import { DiyCommon } from '@/utils/diy.common'

function call(url, params) {
  return DiyCommon.PostAsync(url, params || {}, null, null, 'json')
}

export const PageVersionApi = {
  detail(pageId) {
    return call('/api/V8Engine/GetPageEngineDetail', { PageId: pageId })
  },
  save(page) {
    return call('/api/V8Engine/SavePageEngine', page)
  },
  listHistory(pageId, pageIndex = 1, pageSize = 50) {
    return call('/api/V8Engine/ListPageEngineHistory', {
      PageId: pageId,
      PageIndex: pageIndex,
      PageSize: pageSize,
    })
  },
  getHistory(pageId, historyId) {
    return call('/api/V8Engine/GetPageEngineHistory', {
      PageId: pageId,
      HistoryId: historyId,
    })
  },
  compare(pageId, leftHistoryId, rightHistoryId) {
    return call('/api/V8Engine/ComparePageEngineVersions', {
      PageId: pageId,
      LeftHistoryId: leftHistoryId || undefined,
      RightHistoryId: rightHistoryId || undefined,
    })
  },
  export(pageId) {
    return call('/api/V8Engine/ExportPageEngine', { PageId: pageId })
  },
  rollback(pageId, historyId, expectedCurrentHash, changeSummary) {
    return call('/api/V8Engine/RollbackPageEngine', {
      PageId: pageId,
      HistoryId: historyId,
      ExpectedCurrentHash: expectedCurrentHash,
      ChangeSummary: changeSummary || undefined,
    })
  },
  listPublishedAssets(assetType) {
    const where = [['Status', '=', 'Published']]
    if (assetType) where.push(['AND', 'AssetType', '=', assetType])
    return DiyCommon.FormEngine.GetTableData('mci_asset_package', {
      _Where: where,
      _SelectFields: ['Id', 'PackageKey', 'Name', 'AssetType', 'Scope', 'CurrentVersionId', 'Owner', 'TagsJson', 'Description'],
      _OrderBy: 'UpdateTime',
      _OrderByType: 'DESC',
      _PageIndex: 1,
      _PageSize: 500,
    })
  },
  resolveAsset(packageKey) {
    return DiyCommon.ApiEngine.Run('mci-asset-resolve', { PackageKey: packageKey })
  },
}

export default PageVersionApi
