import { PackagesType, ConfigType } from '@goview/packages/index.d'

export { ConfigType }

export { PackagesType }
export interface PackagesStoreType {
  packagesList: PackagesType,
  newPhoto?: ConfigType
}
