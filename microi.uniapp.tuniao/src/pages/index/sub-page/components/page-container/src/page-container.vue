<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import TnTitle from '@tuniao/tnui-vue3-uniapp/components/title/src/title.vue'
import { tnNavPage } from '@tuniao/tnui-vue3-uniapp/utils'
import TnSwiper from '@tuniao/tnui-vue3-uniapp/components/swiper/src/swiper.vue'
import { GetServerPath } from '@/utils'
import { pageContainerProps } from './page-container'


const props = defineProps(pageContainerProps)

// 是否显示顶部轮播
const showTopSwiper = computed(() => props.topSwiperData?.length > 0)


// 跳转到对应的演示页面
const navDemoPage = (index: number) => {
  tnNavPage('/pages-job/myJob/index?index='+ index, 'navigateTo').catch(() => {
    uni.showToast({
      title: '即将上线',
      icon: 'none',
    })
  })
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
    <view v-if="showTopSwiper" class="top-swiper tn-animation-fade-in tn-mb">
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
		<view class="list-container">
		  <view class="list-item">
		    <view class="content-container">
		      <view
		        v-for="(dItem, dIndex) in homeData"
		        :key="dIndex"
		        class="content-item"
		        @tap.stop="navDemoPage(dIndex)"
		      >
		        <view class="bg tn-gradient-bg__blue-light" />
		        <view class="data">
		          <view class="title tn-text-ellipsis-1">{{ dItem.name }}</view>
		          <view class="path tn-gray_text tn-text-ellipsis-1">
		            <text>{{ workData[dItem.value] }}</text>
		          </view>
		          <view class="icon tn-grey_text">
		            <TnIcon :name="dItem.icon" />
		          </view>
		        </view>
		      </view>
		    </view>
		  </view>
		</view>
  </view>
</template>

<style lang="scss" scoped>
@import '../styles/index.scss';
@import '../../page-works/styles/swiper.scss';
</style>
