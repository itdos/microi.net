import { defineStore } from 'pinia'
import { systemSetting } from '@goview/settings/systemSetting'
import { asideCollapsedWidth } from '@goview/settings/designSetting'
import { SettingStoreType, ToolsStatusEnum } from './settingStore.d'
import { setLocalStorage, getLocalStorage } from '@goview/utils'
import { StorageEnum } from '@goview/enums/storageEnum'
const { GO_SYSTEM_SETTING_STORE } = StorageEnum

const storageSetting: SettingStoreType = getLocalStorage(
  GO_SYSTEM_SETTING_STORE
)

// 全局设置
export const useSettingStore = defineStore('useSettingStore', {
  state: (): SettingStoreType => storageSetting || systemSetting,
  getters: {
    getHidePackageOneCategory(): boolean {
      return this.hidePackageOneCategory
    },
    getChangeLangReload(): boolean {
      return this.changeLangReload
    },
    getAsideAllCollapsed(): boolean {
      return this.asideAllCollapsed
    },
    getAsideCollapsedWidth(): number {
      return this.asideAllCollapsed ? 0 : asideCollapsedWidth
    },
    getChartMoveDistance(): number {
      return this.chartMoveDistance
    },
    getChartAlignRange(): number {
      return this.chartAlignRange
    },
    getChartToolsStatus(): ToolsStatusEnum {
      return this.chartToolsStatus
    },
    getChartToolsStatusHide(): boolean {
      return this.chartToolsStatusHide
    },
  },
  actions: {
    setItem<T extends keyof SettingStoreType, K extends SettingStoreType[T]>(
      key: T,
      value: K
    ): void {
      this.$patch(state => {
        state[key] = value
      })
      setLocalStorage(GO_SYSTEM_SETTING_STORE, this.$state)
    }
  }
})
