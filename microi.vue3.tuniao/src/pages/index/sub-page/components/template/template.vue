<script lang="ts" setup>
import { useTemplate } from './composables'
import TnPageAddressBook from '../page-addressBook/src/page-addressBook.vue'
import { useDemoH5Page } from '@/hooks'	
import CustomPage from '@/components/custom-page/src/custom-page.vue'
import microiRequest from '@/config/api';
import { ref } from 'vue'
import { type LoadmoreStatus } from '@tuniao/tnui-vue3-uniapp';
import { tnNavPage } from '@tuniao/tnui-vue3-uniapp/utils'
// import { useUser } from '@/stores';
useTemplate()
	// const userStore = useUser()
const { isDemoH5Page } = useDemoH5Page()
	const userList = ref<any>([]) // 列表
	const loadmoreStatus = ref<LoadmoreStatus>('loadmore') // 加载更多
	const pageSize = ref<Number>(10) // 每页几条
	const pageIndex = ref<Number>(1) // 页数
	const pageCount = ref<Number>(1) // 总页数
	// 获取列表数据
	const getData = async () => {
		try {
			const obj = {
				_PageSize: pageSize.value,
				_PageIndex: pageIndex.value,
				_Keyword: '',
				DeptId: '',
				State: 1
			}
			const res = await microiRequest.getSysUser(obj);
			if (res.Code == 1) {
				pageCount.value = Math.ceil(res.DataCount/Number(pageSize.value))
				if (pageIndex.value == 1) {
					userList.value = res.Data
				} else {
					userList.value = userList.value.concat(res.Data)
				}
			}
		} catch (error) {
			console.error(error);
		}
	}
	getData()
	// 加载更多
const handleScroll = () => {
	if (pageCount.value == pageIndex.value) {
		loadmoreStatus.value = "nomore"
		return
	} else {
		loadmoreStatus.value = "loading"
	}
	pageIndex.value++
	console.log('pageIndex',pageIndex)
	getData()
}
// 点击列表详情
const userListDetail = (e: any) => { 
		// userStore.setMdeptUserInfo(e)
		uni.setStorageSync('MdeptUserInfo', e)
		tnNavPage('/pages-address/MDept/persons', 'navigateTo')
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
	<CustomPage title="通讯录" :is-h5-demo-page="!isDemoH5Page" padding="0">
	<view class="template-page">
		<TnPageAddressBook :userList="userList" :loadmoreStatus="loadmoreStatus" @handleScroll="handleScroll" @userListDetail="userListDetail" />
	</view>
</CustomPage>
</template>

<style lang="scss" scoped>
@import './styles/index.scss';
</style>
