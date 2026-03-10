import { getSessionStorage } from '@goview/utils'
import { StorageEnum } from '@goview/enums/storageEnum'
import { ChartEditStorage } from '@goview/store/modules/chartEditStore/chartEditStore.d'
import { useChartEditStore } from '@goview/store/modules/chartEditStore/chartEditStore'

export interface ChartEditStorageType extends ChartEditStorage {
  id: string
}

// 根据路由 id 获取存储数据的信息
export const getSessionStorageInfo = () => {
  const chartEditStore = useChartEditStore()
  const urlHash = document.location.hash
  const toPathArray = urlHash.split('/')
  const id = toPathArray && toPathArray[toPathArray.length - 1]

  const storageList: ChartEditStorageType[] = getSessionStorage(
    StorageEnum.GO_CHART_STORAGE_LIST
  )

  if (storageList) {
    for (let i = 0; i < storageList.length; i++) {
      if (id.toString() === storageList[i]['id']) {
        const { editCanvasConfig, requestGlobalConfig, componentList } = storageList[i]
        chartEditStore.editCanvasConfig = editCanvasConfig
        chartEditStore.requestGlobalConfig = requestGlobalConfig
        chartEditStore.componentList = componentList
        return storageList[i]
      }
    }
  }
}