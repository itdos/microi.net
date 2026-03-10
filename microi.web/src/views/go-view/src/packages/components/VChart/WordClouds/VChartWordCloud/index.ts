import { ConfigType, PackagesCategoryEnum, ChartFrameEnum } from '@goview/packages/index.d'
import { ChatCategoryEnum, ChatCategoryEnumName } from '../../index.d'

export const VChartWordCloudConfig: ConfigType = {
  key: 'VChartWordCloud',
  chartKey: 'VVChartWordCloud',
  conKey: 'VCVChartWordCloud',
  title: '词云图-VChart',
  category: ChatCategoryEnum.WORDCLOUD,
  categoryName: ChatCategoryEnumName.WORDCLOUD,
  package: PackagesCategoryEnum.VCHART,
  chartFrame: ChartFrameEnum.VCHART,
  image: 'vchart_word_cloud.png'
}
