<template>
	<view class="page-container">
		<view class="list-container">
			<view class="list-item">
				<view class="list-title">
					<TnTitle title="部门" sub-title="" color="tn-type-primary" size="xl" mode="subTitle" />
				</view>
				<view class="content-container">
					<TnListItem right-icon="right" class="content-item" @click="goMDept()" :custom-style="{ padding: '12rpx 30rpx' }">
						<view class="list-content">
							<view class=" avatar-img">
								<TnAvatar icon="organizatio-fill" size="lg" />
							</view>
							<view class="">
								<view class="text">部门机构</view>
							</view>
						</view>
					</TnListItem>
				</view>
			</view>
			<view class="list-item list-item-lianxi">
				<view class="list-title">
					<TnTitle title="联系人" sub-title="" color="tn-type-primary" size="xl" mode="subTitle" />
				</view>
				<scroll-view style="height:90%;" scroll-y class="item-list" @scrolltolower="handleScroll">
					<view class="content-container">
						<view v-for="(item, index) in userList" :key="index" class="content-item">
							<TnListItem bottom-border bottom-border-indent right-icon="right" @click="navDemoPage(item)" :custom-style="{ padding: '12rpx 30rpx' }">
								<view class="list-content">
									<view class=" avatar-img">
										<TnAvatar :url="GetServerPath(item.Avatar)" icon="my-lack-fill" size="lg" />
									</view>
									<view class="">
										<view class="text">{{item.Name}}</view>
										<view class="tn-gray_text">{{item.Phone}}</view>
									</view>
								</view>
							</TnListItem>
						</view>
					</view>
					<TnLoadmore v-if="userList.length > 0" :status="loadmoreStatus" color="tn-gray" />
					<TnEmpty v-else mode="data" size="xl" color="tn-gray-disabled" />
				</scroll-view>
			</view>
		</view>
	</view>
</template>

<script lang="ts" setup>
	import { PageAddressBookProps } from './page-addressBook'
	import TnTitle from '@tuniao/tnui-vue3-uniapp/components/title/src/title.vue'
	import TnListItem from '@tuniao/tnui-vue3-uniapp/components/list/src/list-item.vue'
	import TnAvatar from '@tuniao/tnui-vue3-uniapp/components/avatar/src/avatar.vue'
	import TnLoadmore from '@tuniao/tnui-vue3-uniapp/components/loadmore/src/loadmore.vue'
	import TnEmpty from '@tuniao/tnui-vue3-uniapp/components/empty/src/empty.vue'
	import { GetServerPath } from '@/utils'
	import { tnNavPage } from '@tuniao/tnui-vue3-uniapp/utils'
	const props = defineProps(PageAddressBookProps)
	const emits = defineEmits(['userListDetail', 'handleScroll'])
	// 点击部门机构
	const goMDept = () => {
		tnNavPage('/pages-address/MDept/index', 'navigateTo')
	}
	// 滚动啦
	const handleScroll = () => {
		emits('handleScroll')
	}
	// 点击列表详情啦
	const navDemoPage = (obj: any) => {
		emits('userListDetail', obj)
	}
</script>

<style lang="scss" scoped>
	@import '../styles/index.scss';
</style>