import { PublicConfigClass } from '@goview/packages/public'
import { CreateComponentType } from '@goview/packages/index.d'
import { Decorates03Config } from './index'
import cloneDeep from 'lodash/cloneDeep'
import { chartInitConfig } from '@goview/settings/designSetting'

export const option = {
  dataset: '我是标题',
  textColor: '#fff',
  textSize: 32,
  colors: ['#1dc1f5', '#1dc1f5']
}

export default class Config extends PublicConfigClass implements CreateComponentType {
  public key = Decorates03Config.key
  public attr = { ...chartInitConfig, w: 500, h: 70, zIndex: 1 }
  public chartConfig = cloneDeep(Decorates03Config)
  public option = cloneDeep(option)
}
