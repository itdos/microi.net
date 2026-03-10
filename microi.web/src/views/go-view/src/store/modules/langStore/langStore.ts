import { defineStore } from 'pinia'
import { lang } from '@goview/settings/designSetting'
import { LangStateType } from './langStore.d'
import { LangEnum } from '@goview/enums/styleEnum'
import { setLocalStorage, getLocalStorage, reloadRoutePage } from '@goview/utils'
import { StorageEnum } from '@goview/enums/storageEnum'
import { useSettingStore } from '@goview/store/modules/settingStore/settingStore'

const { GO_LANG_STORE } = StorageEnum
const storageLang: LangStateType = getLocalStorage(GO_LANG_STORE)

// 语言
export const useLangStore = defineStore('useLangStore', {
  state: (): LangStateType =>
    storageLang || {
      lang
    },
  getters: {
    getLang(): LangEnum {
      return this.lang
    }
  },
  actions: {
    changeLang(lang: LangEnum): void {
      const settingStore = useSettingStore()
      if (this.lang === lang) return
      this.lang = lang
      setLocalStorage(GO_LANG_STORE, this.$state)

      if (settingStore.getChangeLangReload) {
        reloadRoutePage()
      }
    }
  }
})
