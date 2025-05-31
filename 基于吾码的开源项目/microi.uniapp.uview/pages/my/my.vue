<template>
	<view style="height: 100vh;overflow: hidden;">
		<view class="my">
			<view class="my-detail">
				<image style="width: 100%;height: 100%;" src="/static/img/my/bg.png" mode=""></image>
				<view class="my-cont" :style="{top:barHeight+'px'}" @click="goPerson">
					<u-image class="my-toux" shape="circle" width="130rpx" height="130rpx" :src="userInfo.Avatar" mode=""></u-image>
					<view class="my-name">
						<text class="name">{{userInfo.Name}}</text>
						<view v-if="vuex_token" style="display: flex;">
							<text v-if="userInfo.DeptName">{{userInfo.DeptName}}-</text>
							<text v-if="userInfo._Roles&&userInfo._Roles.length>1">{{userInfo._Roles[0].Name}} ...</text>
							<text v-else >{{userInfo._Roles[0].Name || ''}}</text>
						</view>
					</view>
				</view>
			</view>
			
			<view class="my-list" :style="{top:contHeight+'px',paddingBottom:botHeight+'px'}">
				<scroll-view scroll-y style="height: 100%;width: 92%;padding: 22rpx 30rpx 50rpx 30rpx;">
					<!-- <view class="my-item" @click="gouptPwd">
						<view class="my-left">
							<u-image width="35rpx" height="35rpx" src="/static/img/my/pwd.png" mode=""></u-image>
							<text>修改密码</text>
						</view>
						<u-image width="28rpx" height="28rpx" src="/static/img/my/right.png" mode=""></u-image>
					</view>
					<view class="my-item" @click="goOther('我的申请')">
						<view class="my-left">
							<u-image width="35rpx" height="35rpx" src="/static/img/my/huancun.png" mode=""></u-image>
							<text>我的申请</text>
						</view>
						<u-image width="28rpx" height="28rpx" src="/static/img/my/right.png" mode=""></u-image>
					</view>
					<view class="my-item">
						<view class="my-left">
							<u-image width="35rpx" height="35rpx" src="/static/img/my/about.png" mode=""></u-image>
							<text>关于我们</text>
						</view>
						<u-image width="28rpx" height="28rpx" src="/static/img/my/right.png" mode=""></u-image>
					</view> -->
					<view class="my-item" @click="outShow=true">
						<view class="my-left">
							<u-image width="35rpx" height="35rpx" src="/static/img/my/out.png" mode=""></u-image>
							<text>退出账户</text>
						</view>
						<u-image width="28rpx" height="28rpx" src="/static/img/my/right.png" mode=""></u-image>
					</view>
					<view class="my-item">
						<view class="my-left">
							<u-image width="35rpx" height="35rpx" src="/static/img/my/banben.png" mode=""></u-image>
							<text>当前版本</text>
						</view>
						<view style="display: flex;font-weight: normal;">
							{{version}}
						</view>
					</view>
				</scroll-view>
			</view>
		</view>
		
		<u-modal v-model="outShow" :content="content" :show-cancel-button="true" confirm-color="var(--itdos-color)" 
		@confirm="goOut"></u-modal>
		
		<tabbar></tabbar>
	</view>
</template>

<script>
	import tabbar from '@/components/itdos_tabbar.vue'
	export default {
		components:{
			tabbar
		},
		data() {
			return {
				barHeight:0,
				contHeight:0,
				botHeight:0,
				userInfo:{},
				outShow:false,
				content:'您是否确认退出当前登录账户？',
				version:'V1.1.0'
			}
		},
		methods: {
			goOut(){
				// uni.clearStorage();
				this.$u.vuex('vuex_token','')
				wx.setStorageSync('authorization', '');
				wx.setStorageSync('authorization_time', '');
				this.$Router.push({
					name:'login'
				})
			},
			gouptPwd(){
				this.$Router.push({
					name:'uptPwd'
				})
			},
			goPerson(){
				this.$Router.push({
					name:'personal',
					params:{
						my:true
					}
				})
			},
			goOther(type){
				if (type=='我的申请'){
					this.$Router.push({
						name:'apply'
					})
				}
			}
		},
		mounted() {
			this.barHeight = this.$store.state.navbarHeight + this.$store.state.systemInfo.statusBarHeight + 10
			this.contHeight = this.$store.state.navbarHeight + this.$store.state.systemInfo.statusBarHeight + 100
			this.botHeight = this.$store.state.navbarHeight + this.$store.state.systemInfo.statusBarHeight + 172
			
		
		},
		onShow() {
			this.userInfo = this.vuex_userInfo
			// console.log(this.$store.state.userInfo)
		},
		onLoad(){
			// #ifdef APP-PLUS
			plus.runtime.getProperty(plus.runtime.appid, (wgtinfo) => {
			   this.version ='V'+ wgtinfo.version;
				this.$forceUpdate()
			   console.log(this.version,'版本号')
			})
			// #endif
		},
		onShareAppMessage(res) { //发送给朋友
			// return {
			// 	title: this.title,
			// 	imageUrl: this.thumb,
			// }
		},
		onShareTimeline(res) { //分享到朋友圈
			// return {
			// 	title: this.title,
			// 	imageUrl: this.thumb,
			// }
		}
	}
</script>

<style lang="scss" scoped>
.my{
	height: 100vh;
	position: relative;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}
.my-detail{
	width: 100%;
	height: 430rpx;
}
.my-cont{
	display: flex;
	justify-content: flex-start;
	align-items: center;
	position: absolute;
	left: 52rpx;
	.my-toux{
		border: 5rpx solid #F7F4FF;
		border-radius: 50%;
		margin-right: 40rpx;
	}
	.my-name{
		color: #fff;
		font-size: 28rpx;
		font-weight: bold;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		align-items: flex-start;
		.name{
			font-size: 40rpx;
			margin-bottom: 25rpx;
		}
		.roles{
			width: 300rpx;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}
}
.my-list{
	width: 100%;
	height: 100%;
	border-radius: 62rpx 62rpx 0 0;
	position: absolute;
	background-color: #fff;
	overflow: hidden;
	padding-top: 20rpx;
}
.my-item{
	padding: 40rpx 12rpx;
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 30rpx;
	color: #22306D;
	font-weight: bold;
	border-bottom: 1rpx solid #efefef;
	
	.my-left{
		display: flex;
		align-items: center;
			
		text{
			margin-left: 23rpx;
		}
	}
}
</style>
