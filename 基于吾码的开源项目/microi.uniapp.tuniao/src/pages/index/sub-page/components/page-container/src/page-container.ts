import { buildProps, definePropType } from '@tuniao/tnui-vue3-uniapp/utils'

import type { ExtractPropTypes } from 'vue'
import type PageContainer from './page-container.vue'

export const pageContainerProps = buildProps({
  /**
   * @description 页面顶部轮播图数据
   */
  topSwiperData: {
    type: definePropType<string[]>(Array),
    default: () => [],
  },
	/**
	 * @description 页面列表数据
	 */
	homeData: {
    type: definePropType<any[]>(Array),
    default: () => [],
  },
	workData: {
    type: Object,
    default: () => {},
  },
  /**
   * @description 是否显示列表的标题
   */
  showTitle: {
    type: Boolean,
    default: true,
  },
})

export type PageContainerProps = ExtractPropTypes<typeof pageContainerProps>

export type TnDemoPageContainerInstance = InstanceType<typeof PageContainer>
