import { PublicConfigClass } from '@goview/packages/public'
import { VChartFunnelConfig } from './index'
import { CreateComponentType } from '@goview/packages/index.d'
import { vChartOptionPrefixHandle } from '@goview/packages/public/vChart'
import data from './data.json'
import cloneDeep from 'lodash/cloneDeep'
import { IFunnelOption } from '../../index.d'

export const includes = ['legends', 'tooltip']
export const option: IFunnelOption & { dataset?: any } = {
  // 图表配置
  type: 'funnel',
  dataset: data,
  categoryField: 'name',
  valueField: 'value',
  // 业务配置（后续会被转换为图表spec)
  category: VChartFunnelConfig.category,
}

export default class Config extends PublicConfigClass implements CreateComponentType {
  public key = VChartFunnelConfig.key
  public chartConfig = cloneDeep(VChartFunnelConfig)
  // 图表配置项
  public option = vChartOptionPrefixHandle(option, includes)
}
