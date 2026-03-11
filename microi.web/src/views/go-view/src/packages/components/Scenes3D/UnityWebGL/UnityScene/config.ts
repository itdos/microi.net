import { PublicConfigClass } from '@goview/packages/public'
import { CreateComponentType } from '@goview/packages/index.d'
import { UnitySceneConfig } from './index'
import { chartInitConfig } from '@goview/settings/designSetting'
import cloneDeep from 'lodash/cloneDeep'

export const option = {
  // Unity WebGL 构建产物 URL
  loaderUrl: '',
  dataUrl: '',
  frameworkUrl: '',
  codeUrl: '',
  // Unity 项目基本信息
  productName: 'Unity3D',
  productVersion: '1.0',
  companyName: 'DefaultCompany',
  streamingAssetsUrl: 'StreamingAssets',
  // 画布背景色
  backgroundColor: '#000000'
}

export default class Config extends PublicConfigClass implements CreateComponentType {
  public key = UnitySceneConfig.key
  public attr = { ...chartInitConfig, w: 1200, h: 800, zIndex: -1 }
  public chartConfig = cloneDeep(UnitySceneConfig)
  public option = cloneDeep(option)
}
