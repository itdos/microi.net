<script lang="ts" setup>
import TnDemoPageContainer from '../page-container/src/page-container.vue'
import { useDemoH5Page } from '@/hooks'	
import CustomPage from '@/components/custom-page/src/custom-page.vue'
import { useBasic } from './composables'
import { inject } from 'vue'
// import { useUser } from '@/stores';
// const userStore = useUser()
const { workData } = useBasic()
const { isDemoH5Page } = useDemoH5Page()
const Microi: any = inject('Microi'); // 使用注入Microi实例
const sysConfigData = Microi.SysConfig; // 获取系统配置
const topSwiperData = sysConfigData?.AppIndexSlideshow ? JSON.parse(sysConfigData.AppIndexSlideshow) : []
const homeData = [
	{
		name: '我的待办',
		value: 'TodoCount',
		icon: 'order',
	},
	{
		name: '我的处理',
		value: 'DoneCount',
		icon: 'edit-form',
	},
	{
		name: '我发起的',
		value: 'SenderCount',
		icon: 'image-text',
	},
	{
		name: '抄送我的',
		value: 'CopyCount',
		icon: 'copy-fill',
	},
]

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
	<CustomPage title="首页" :is-h5-demo-page="!isDemoH5Page" padding="0">
  <TnDemoPageContainer
    :top-swiper-data="topSwiperData"
		:homeData="homeData"
		:workData="workData"
    :show-title="false"
  />
	</CustomPage>
</template>

<style lang="scss" scoped>
@import './styles/index.scss';
</style>
