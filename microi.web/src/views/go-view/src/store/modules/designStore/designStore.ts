import { defineStore } from 'pinia'
import { theme } from '@goview/settings/designSetting'
import { DesignStateType, AppThemeColorType } from './designStore.d'
import { setLocalStorage, getLocalStorage } from '@goview/utils'
import { StorageEnum } from '@goview/enums/storageEnum'
import { ThemeEnum } from '@goview/enums/styleEnum'

const { GO_DESIGN_STORE } = StorageEnum

const { darkTheme, appTheme, appThemeDetail } = theme

const storageDesign = getLocalStorage(GO_DESIGN_STORE)

export const useDesignStore = defineStore('useDesignStore', {
  state: (): DesignStateType =>
    storageDesign || {
      // 是否暗黑
      darkTheme,
      // 主题名称
      themeName: (darkTheme && ThemeEnum.DARK) || ThemeEnum.LIGHT,
      // 颜色色号
      appTheme,
      appThemeDetail,
    },
  getters: {
    getDarkTheme(e): boolean {
      return this.darkTheme
    },
    getAppTheme(): string {
      return this.appTheme
    },
    getAppThemeDetail(): AppThemeColorType | null {
      return this.appThemeDetail
    }
  },
  actions: {
    // 切换主题
    changeTheme(): void {
      this.darkTheme = !this.darkTheme
      this.themeName = this.darkTheme ? ThemeEnum.DARK : ThemeEnum.LIGHT
      setLocalStorage(GO_DESIGN_STORE, this.$state)
    },
    // 设置颜色
    setAppColor(color: AppThemeColorType): void {
      this.appTheme = color.hex
      this.appThemeDetail = color
      setLocalStorage(GO_DESIGN_STORE, this.$state)
    }
  }
})