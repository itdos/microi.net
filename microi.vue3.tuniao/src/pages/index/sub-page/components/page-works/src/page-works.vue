<script lang="ts" setup>
	import { computed, ref, watch } from 'vue'
	import TnTitle from '@tuniao/tnui-vue3-uniapp/components/title/src/title.vue'
	import TnPopup from '@tuniao/tnui-vue3-uniapp/components/popup/src/popup.vue'
	import TnSwiper from '@tuniao/tnui-vue3-uniapp/components/swiper/src/swiper.vue'
	import TnAvatar from '@tuniao/tnui-vue3-uniapp/components/avatar/src/avatar.vue'
	import { tnNavPage } from '@tuniao/tnui-vue3-uniapp/utils'
	import { PageWorksProps } from './page-works'
	import type { PageWorksDataItem } from './page-works'
	import { GetServerPath } from '@/utils'
	type ListData = {
		title : string
		data : PageWorksDataItem[]
		tips ?: string
	}

	const props = defineProps(PageWorksProps)
	// 是否弹窗
	const showPopup = ref(false)
	const workDataChild = ref<any>([])
	// 是否显示顶部轮播
	const showTopSwiper = computed(() => props.topSwiperData?.length > 0)
	const childTitle = ref('')
	// 列表数据
	const listData = ref<ListData[]>([])
	watch(
		() => props.data,
		(val) => {
			if (val) {
				listData.value = Object.entries(val).map(([key, value]) => ({
					title: key,
					data: value.data,
					tips: value?.tips || '',
				}))
			}
		},
		{
			immediate: true,
		}
	)

	// 跳转到对应的演示页面
	const navDemoPage = (obj : any) => {
		console.log(obj)
		if (obj._Child && obj._Child.length > 0) {
			showPopup.value = true
			childTitle.value = obj.Name
			workDataChild.value = obj._Child.filter((i: { Display: number }) => i.Display == 1)
		} else {
			uni.navigateTo({
			  url: `/pages-workspace/work-list/index?DiyTableId=${obj.DiyTableId}&Description=${obj.Name}&Id=${obj.Id}`,
			});
		}
	}
	// 点击标题显示隐藏列表
	const clickHide = (item: any) => {
		item.show =!item.show
	}
</script>

// #ifdef MP-WEIXIN
<script lang="ts">
	export default {
		options: {
			// 在微信小程序中将组件节点渲染为虚拟节点，更加接近Vue组件的表现(不会出现shadow节点下再去创建元素)
			virtualHost: true,
		},
	}
</script>
// #endif

<template>
	<view class="page-container">
		<!-- 顶部轮播 -->
		<view v-if="showTopSwiper" class="top-swiper tn-animation-fade-in">
			<view class="swiper-container">
				<view class="swiper-item">
					<view class="swiper-wrapper">
						<TnSwiper :data="topSwiperData" width="100%" height="420" indicator indicator-type="dot"
							indicator-position="left-bottom">
							<template #default="{ data }">
								<view class="swiper-data">
									<image class="image" :src="GetServerPath(data.Path)" mode="aspectFill" />
								</view>
							</template>
						</TnSwiper>
					</view>
				</view>
			</view>
		</view>
		<!-- 列表数据  v-if="dItem.Display == 1"-->
		<view class="list-container">
			<view v-for="(item, index) in workData" :key="index" class="list-item tn-mt">
				<view class="list-title tn-mb">
					<TnTitle :title="item.Name" sub-title="" color="tn-type-primary" size="xl" mode="subTitle" @click="clickHide(item)" />
				</view>
				<transition name="fade">
					<view class="workData-container" v-if="item.show">
						<view v-for="i in item._Child" :key="i.Id" class="data-item data-item-menu tn-flex tn-flex-column items-center" @tap.stop="navDemoPage(i)">
							<TnAvatar :url="GetServerPath(i.Icon)" icon="image" size="lg" shape="square" shadow
              shadow-color="tn-blue-disabled" :icon-config="{ size: '50rpx' }"/>
							<view class="item-ti tle tn-mt-xs"> {{i.Name}} </view>
						</view>
					</view>
				</transition>
				<!-- <view class="content-container">
					<view class="content-item" v-for="(dItem, dIndex) in item._Child" :key="dIndex"
						@tap.stop="navDemoPage(dItem)">
						<view class="bg tn-gradient-bg__blue-light" />
						<view class="data">
							<view class="title tn-text-ellipsis-1">{{ dItem.Name }}</view>
							<view class="icon tn-grey_text">
								<image class="image" :src="GetServerPath(dItem.Icon)" mode="heightFix" />
							</view>
						</view>
					</view>
				</view> -->
			</view>
			
		</view>
		<TnPopup v-model="showPopup" width="80%" bg-color="tn-gradient-bg__blue-light" :z-index="20091">
			<view class="tn-text-xl tn-text-center tn-mt-lg">{{childTitle}}</view>
			<view class="workData-container tn-p">
				<view v-for="i in workDataChild" :key="i.Id" class="data-item tn-flex tn-flex-column items-center" @tap.stop="navDemoPage(i)">
					<TnAvatar :url="GetServerPath(i.Icon)" icon="image-fill" size="lg" />
					<view class="item-title tn-mt-xs"> {{i.Name}} </view>
				</view>
			</view>

		</TnPopup>
	</view>
</template>

<style lang="scss" scoped>
	@import '../styles/index.scss';
	@import '../styles/swiper.scss';
</style>