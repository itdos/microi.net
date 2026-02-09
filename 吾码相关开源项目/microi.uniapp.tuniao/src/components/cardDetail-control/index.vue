<template>
	<view class="work-item tn-shadow tn-mb tn-p">
		<view v-for="(val,key) in list" :key="key">
			<view v-if="val.Visible == 1" class="tn-flex-row tn-flex-wrap tn-mb-sm">
				<view class="tn-gray-dark_text tn-mr-sm tn-w-1-4 ">{{val.Label}}: </view>
					<!-- 图片 -->
					<view style="width: 150px;" v-if="val.Component == 'ImgUpload'">
						<view class="" v-if="Array.isArray(val._Value)">
							<view class="" v-for="(item, index) in val._Value" :key="index">
								<TnLazyLoad :src="GetServerPath(item.Path)" mode="widthFix" />
							</view>
						</view>
						<view class="" v-else>
							<TnLazyLoad :src="GetServerPath(val._Value)" mode="widthFix" />
						</view>
					</view>
					<!-- 文件 -->
					<view class="" v-else-if="val.Component == 'FileUpload'">
						<view class="word-wrap" v-for="(item, index) in val._Value" :key="index">
							{{item.Name}}
						</view>
					</view>
					<!-- 选择数据 -->
					<view class="" v-else-if="val.Component.includes('Select')">
						<view class="" v-if="Array.isArray(val._Value)">
							<view class="" v-for="(item, index) in val._Value" :key="index">
								{{item.Name}}
							</view>
						</view>
						<view class="" v-else>
							{{val._Value}}
						</view>
					</view>
					<!-- 开关 -->
					<TnSwitch v-else-if="val.Component == 'Switch'" v-model="val._Value" :disabled="true"
					:inactive-value="0"
          :active-value="1"  />
					<!-- 评分 -->
					<TnRate v-else-if="val.Component == 'Rate'" v-model="val._Value" :readonly="true" />
					<!-- 子表 -->
					<view style="width: 100%;" v-else-if="val.Component == 'TableChild'">
						<TableControl :ChildList="val.ChildList" :TableChildTableData="val.Config" :ChildListCount="val.ChildListCount" :TableRowId="TableRowId" />
					</view>
					<!-- 地图 -->
					<view class="" v-else-if="val.Component == 'Map' || val.Component == 'MapArea'">
						{{ val._Value }}
					</view>
					<!-- 文本 -->
					<view class="word-wrap" v-else v-html="String(val._Value || '')">
					</view>
			</view>
		</view>
		<TnEmpty v-if="list.length <= 0" mode="data" size="xl" color="tn-gray-disabled" />
	</view>
</template>

<script lang="ts" setup>
	import TnLazyLoad from '@tuniao/tnui-vue3-uniapp/components/lazy-load/src/lazy-load.vue'
	import TnSwitch from '@tuniao/tnui-vue3-uniapp/components/switch/src/switch.vue'
	import TnRate from '@tuniao/tnui-vue3-uniapp/components/rate/src/rate.vue'
	import TnEmpty from '@tuniao/tnui-vue3-uniapp/components/empty/src/empty.vue'
	import { GetServerPath } from '@/utils'
	import { definePropType } from '@tuniao/tnui-vue3-uniapp/utils'
	import TableControl from '@/components/table-control/index.vue'
	const props = defineProps({
		list: {
			type: definePropType<any[]>(Array),
			default: () => [],
		},
		TableRowId: {
			type: String,
			default: '',
		},
	})
</script>

<style lang="scss" scoped>
	.word-wrap{
		word-wrap: break-word;
	}
	::v-deep .word-wrap img{
		max-width: 100%;
	}

</style>