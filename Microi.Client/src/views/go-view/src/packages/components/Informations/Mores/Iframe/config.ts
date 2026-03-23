import { PublicConfigClass } from '@goview/packages/public'
import { CreateComponentType } from '@goview/packages/index.d'
import { chartInitConfig } from '@goview/settings/designSetting'
import { IframeConfig } from './index'
import cloneDeep from 'lodash/cloneDeep'

export const option = {
  // 网站路径
  dataset: "https://www.mtruning.club/",
  // 圆角
  borderRadius: 10
}

export default class Config extends PublicConfigClass implements CreateComponentType
{
  public key = IframeConfig.key
  public attr = { ...chartInitConfig, w: 1200, h: 800, zIndex: -1 }
  public chartConfig = cloneDeep(IframeConfig)
  public option = cloneDeep(option)
}
