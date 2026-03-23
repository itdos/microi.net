import { useChartEditStore } from '@goview/store/modules/chartEditStore/chartEditStore'
import { ChartEditStoreEnum } from '@goview/store/modules/chartEditStore/chartEditStore.d'
import type { ChartEditStorageType } from '../index.d'

// store 相关
export const useStore = (localStorageInfo: ChartEditStorageType) => {
  const chartEditStore = useChartEditStore()
  chartEditStore.requestGlobalConfig = localStorageInfo[ChartEditStoreEnum.REQUEST_GLOBAL_CONFIG]
}
