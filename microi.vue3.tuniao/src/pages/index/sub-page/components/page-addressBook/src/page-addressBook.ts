import type { ExtractPropTypes } from 'vue'
import { buildProps, definePropType } from '@tuniao/tnui-vue3-uniapp/utils'
export const PageAddressBookProps = buildProps({
	/**
	 * @description 页面列表数据
	 */
	userList: {
	  type: definePropType<any[]>(Array),
	  default: () => [],
	},
	loadmoreStatus:  {
	  type: definePropType(String),
	  default: () => '',
	},
})

export type PageAddressBookProps = ExtractPropTypes<typeof PageAddressBookProps>