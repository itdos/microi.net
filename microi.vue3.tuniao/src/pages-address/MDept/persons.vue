<template>
	<CustomPage title="个人资料" :is-h5-demo-page="isDemoH5Page">
		<view class="project-info">
			<view class="person-list tn-shadow">
			  <view class="person-item">
					<view class="avatar-img">
						<TnAvatar :url="GetServerPath(userInfo.Avatar)" icon="my-lack-fill" size="160" :icon-config="{ size: '90rpx' }" />
					</view>
			    <view class="left">
			      <view class="left-text">{{userInfo.Name}}</view>
						<view class="zhiwei">
							<TnTag shape="round" v-if="userInfo.DeptName">{{userInfo.DeptName}}</TnTag>&nbsp;
							<TnTag shape="round" v-if="userInfo.Gangwei&&userInfo.Gangwei.length>1">{{userInfo.Gangwei}}</TnTag>
							<TnTag shape="round" v-if="userInfo._Roles&&userInfo._Roles.length==1" >{{userInfo._Roles[0].Name || ''}}</TnTag>
						</view>
			    </view>
			  </view>
			</view>
			<view v-if="list.length>0">
				<cardDetailControl :list="list" />
			</view>
		</view>
	</CustomPage>
</template>

<script lang="ts" setup>
	import CustomPage from '@/components/custom-page/src/custom-page.vue'
	import TnAvatar from '@tuniao/tnui-vue3-uniapp/components/avatar/src/avatar.vue'
	import TnTag from '@tuniao/tnui-vue3-uniapp/components/tag/src/tag.vue'
	import { GetServerPath } from '@/utils'
	import { useDemoH5Page } from '@/hooks'
	// import { useUser } from '@/stores';
	import microiRequest from '@/config/api';
	import { ref } from 'vue'
	import { GetDiyList } from '@/utils'
	import cardDetailControl from '@/components/cardDetail-control/index.vue'
	const { isDemoH5Page } = useDemoH5Page()
	// const userStore = useUser()
	const userInfo: any = uni.getStorageSync('MdeptUserInfo')
	const formData = ref({})
	const diyData = ref([])
	const list = ref([])
	const getData = async () => {
		try {
			uni.showLoading({
				title: "加载中",
				mask: true
			});
			const obj: any = {
				FormEngineKey: 'sys_user',
				Id: userInfo.Id
			}
			const res = await microiRequest.GetFormData(obj); // 获取表需要显示的字段
			const res1 = await microiRequest.GetDiyField({
				TableName: 'sys_user'
			}) // 获取表单字段
			if (res.Code == 1) {
				formData.value = res.Data
			}
			if (res1.Code == 1) {
				diyData.value = res1.Data
			}
			list.value = await GetDiyList(diyData.value, formData.value,'')
			uni.hideLoading();
		} catch (error) {
			console.error(error);
		}
	}
	getData()
</script>

<style lang="scss" scoped>
	.project-info{
		opacity: 0;
		animation: list-item-enter-animation 0.3s ease forwards;
	}
	.person-list{
		background: white;
		border-radius: 20rpx;
		padding: 20rpx 0;
		margin-bottom: 30rpx;
		.person-item{
			display: flex;
			align-items: center;
			padding: 30rpx 40rpx;
			&-title{
				font-size: 28rpx;
				color: #A8A8A8;
				margin-right: 15px;
			}
			&-cont{
				font-size: 32rpx;
				color: #171717;
			}
			.left{
				margin-left: 30rpx;
				&-text{
					margin-bottom: 10rpx;
				}
			}
		}
	}
	/* 入场动画 start */
	@keyframes list-item-enter-animation {
	  0% {
	    opacity: 0;
	  }
	  100% {
	    opacity: 1;
	  }
	}
	/* 入场动画 end */
</style>