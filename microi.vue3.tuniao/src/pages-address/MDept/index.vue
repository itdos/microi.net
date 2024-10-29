<template>
	<CustomPage title="部门机构" :is-h5-demo-page="isDemoH5Page">
		<view class="mdept-list">
			<uni-breadcrumb separator=">">
			    <uni-breadcrumb-item v-for="(route,index) in routes" :key="index" :to="route.to" 
					class="title"
					 @tap.stop="goMuen(route.name, index)">{{route.name}}</uni-breadcrumb-item>
			</uni-breadcrumb>
			<scroll-view style="height:80%;" scroll-y class="item-list" @scrolltolower="handleScroll">
				<view class="mdept-list-content-container">
					<view v-for="(item, index) in userList" :key="index" class="content-item">
						<TnListItem bottom-border bottom-border-indent right-icon="right" @click="clickMdept(item)">
								<view class="text">{{item.Name}}</view>
						</TnListItem>
					</view>
				</view>
				<!-- <TnLoadmore v-if="userList.length > 0" :status="loadmoreStatus" /> -->
				<TnEmpty v-if="userList.length <= 0" mode="data" size="xl" color="tn-gray-disabled" />
			</scroll-view>
		</view>
	</CustomPage>
</template>

<script lang="ts" setup>
	import CustomPage from '@/components/custom-page/src/custom-page.vue'
	import microiRequest from '@/config/api';
	import configHttp from '@/config'
	import { inject, ref } from 'vue'
	import { type LoadmoreStatus } from '@tuniao/tnui-vue3-uniapp';
	import { useDemoH5Page } from '@/hooks'
	import TnListItem from '@tuniao/tnui-vue3-uniapp/components/list/src/list-item.vue'
	import TnEmpty from '@tuniao/tnui-vue3-uniapp/components/empty/src/empty.vue'
	import { tnNavPage } from '@tuniao/tnui-vue3-uniapp/utils'
	// import { useUser } from '@/stores';
	const { isDemoH5Page } = useDemoH5Page()
	// const userStore = useUser()
	const userList = ref<any>([]) // 列表
	const loadmoreStatus = ref<LoadmoreStatus>('loadmore') // 加载更多
	const pageSize = ref<Number>(10) // 每页几条
	const pageIndex = ref<Number>(1) // 页数
	const pageCount = ref<Number>(1) // 总页数
	const Mdept_Child = ref<any>([]) // 列表
	const routes = ref<any>([])
	const Microi: any = inject('Microi'); // 使用注入Microi实例
	// 获取部门列表数据
	const getData = async () => {
		try {
			const obj = {
				OsClient: Microi.OsClient,
				_PageSize: pageSize.value,
				_PageIndex: pageIndex.value,
				State: 1
			}
			const res = await microiRequest.GetSysDeptStep(obj);
			if (res.Code == 1) {
				pageCount.value = Math.ceil(res.DataCount/Number(pageSize.value))
				if (pageIndex.value == 1) {
					Mdept_Child.value = res.Data
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
	// 滚动啦
	const handleScroll = () => {
		console.log('handleScroll')
	}
	const clickMdept = (item: any) => {
		if (item.isPerson) {
			// userStore.setMdeptUserInfo(item)
			uni.setStorageSync('MdeptUserInfo', item)
			tnNavPage('/pages-address/MDept/persons', 'navigateTo')
			return
		}
		if (item._Child) {
			userList.value = item._Child
		} else {
			getUser(item.Id)
		}
		routes.value.push({name: item.Name, to: ''})
	}
	// 获取用户列表数据
	const getUser = async (DeptId: any) => {
		try {
			const obj = {
				_PageSize: pageSize.value,
				_PageIndex: pageIndex.value,
				_Keyword: '',
				DeptId: DeptId,
				State: 1
			}
			const res = await microiRequest.getSysUser(obj);
			if (res.Code == 1) {
				userList.value = []
				res.Data.forEach((item: { isPerson: boolean; }) => {
					item.isPerson = true
					userList.value.push(item)
				})
				// userList.value = res.Data
			}
		} catch (error) {
			console.error(error);
		}
	}
	// 点击了头部
	const goMuen = (name: string, index: number) => {
		console.log(1111,name)
		const obj = getmdeptlist(Mdept_Child.value,name)
		routes.value = routes.value.slice(0, index+1)
		userList.value = obj[0]
	}
	// 获取数据
	const getmdeptlist = (arr: any, name: string) => {
		let newArr = ref<any>([])
		arr.some((item: { Name: string, _Child: any}) => {
			if (item.Name == name) {
				return newArr.value.push(item._Child)
			} else {
				if (item._Child) {
					newArr.value = getmdeptlist(item._Child,name)
				}
			}
		})
		return newArr.value // 返回 newArr 的值
	}
</script>

<style lang="scss" scoped>
	
</style>