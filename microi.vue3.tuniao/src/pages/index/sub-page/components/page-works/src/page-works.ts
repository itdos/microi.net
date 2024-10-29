import { buildProps, definePropType } from '@tuniao/tnui-vue3-uniapp/utils'

import type { ExtractPropTypes } from 'vue'
import type PageWorks from './page-works.vue'

export interface PageWorksDataItem {
  title: string
  path: string
  url: string
  icon: string
}

export type PageWorksData = Record<
  string,
  {
    data: PageWorksDataItem[]
    tips?: string
  }
>

export const PageWorksProps = buildProps({
  /**
   * @description 页面顶部轮播图数据
   */
  topSwiperData: {
    type: definePropType<string[]>(Array),
    default: () => [],
  },
	/**
	 * @description 页面顶部轮播图数据
	 */
	workData: {
	  type: definePropType<any[]>(Array),
	  default: () => [],
	},
  /**
   * @description 页面列表数据
   */
  data: {
    type: definePropType<PageWorksData>(Object),
    default: () => ({}),
  },
  /**
   * @description 是否显示列表的标题
   */
  showTitle: {
    type: Boolean,
    default: true,
  },
})

export type PageWorksProps = ExtractPropTypes<typeof PageWorksProps>

export type TnDemoPageWorksInstance = InstanceType<typeof PageWorks>
