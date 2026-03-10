import { PublicConfigClass } from '@goview/packages/public'
import { CreateComponentType } from '@goview/packages/index.d'
import { VideoConfig } from './index'
import cloneDeep from 'lodash/cloneDeep'
import video from '@goview/assets/videos/earth.mp4'

export const option = {
  // 视频路径
  dataset: video,
  // 循环播放
  loop: true,
  // 静音
  muted: true,
  // 适应方式
  fit: 'contain',
  // 圆角
  borderRadius: 10
}

export default class Config extends PublicConfigClass implements CreateComponentType {
  public key = VideoConfig.key
  public chartConfig = cloneDeep(VideoConfig)
  public option = cloneDeep(option)
}
