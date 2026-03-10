import { defineStore } from 'pinia'
import { ConfigType, PackagesStoreType, PackagesType } from './packagesStore.d'
import { packagesList } from '@goview/packages/index'
import { StorageEnum } from '@goview/enums/storageEnum'
import { getLocalStorage, setLocalStorage } from '@goview/utils'

// 组件 packages
export const usePackagesStore = defineStore('usePackagesStore', {
  state: (): PackagesStoreType => ({
    packagesList: Object.freeze(packagesList),
    newPhoto: undefined
  }),
  getters: {
    getPackagesList(): PackagesType {
      return this.packagesList
    }
  },
  actions: {
    addPhotos(newPhoto: ConfigType, index: number) {
      this.newPhoto = newPhoto
      this.packagesList.Photos.splice(index, 0, newPhoto)
    },
    deletePhotos(photoInfo: ConfigType, index: number) {
      this.packagesList.Photos.splice(index, 1)
      const StoreKey = StorageEnum.GO_USER_MEDIA_PHOTOS
      const userPhotosList = getLocalStorage(StoreKey)
      userPhotosList.splice(index - 1, 1)
      setLocalStorage(StoreKey, userPhotosList)
    }
  }
})
