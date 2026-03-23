import { MenuEnum } from '@goview/enums/editPageEnum'

export interface MenuOptionsItemType {
  type?: string
  label?: string
  key: MenuEnum | string
  icon?: Function
  fnHandle?: Function
  disabled?: boolean
  hidden?: boolean
}