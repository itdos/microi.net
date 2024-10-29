<template>
	<view>
		<u-navbar :is-back="true" :title="title" title-color="#fff" title-size="34" :border-bottom="false"
		:background="background" :immersive="true" back-icon-color="#fff" :title-bold="true">
			<view class="slot-wrap" style="justify-content: flex-end;">
				<!-- <u-image width="40rpx" height="40rpx" src="/static/img/work/edit.png" mode="" @click="choiceShow=true">
				</u-image> -->
			</view>
		</u-navbar>
		
		<view class="personal">
			<view class="head" :style="{paddingTop:titleHeight+'px'}">
				<view class="person-detail">
					<view class="name">
						{{userInfo.Name}}
						<!-- 是否关注atten.png 和 atten-select.png，判断字段还没有 -->
						<!-- <u-image v-if="!isUser" style="margin-left: 30rpx;position: relative;top: -8rpx;" width="40rpx" height="40rpx" src="/static/img/my/atten.png" mode=""></u-image> -->
					</view>
					<view class="zhiwei" style="display: flex;">
						<text v-if="userInfo.DeptName">{{userInfo.DeptName}}</text>
						<text v-if="userInfo.DeptName&&userInfo._Roles&&userInfo._Roles.length>1">-</text>
						<text v-if="userInfo._Roles&&userInfo._Roles.length>1">{{userInfo._Roles[0].Name}} ...</text>
						<text v-if="userInfo._Roles&&userInfo._Roles.length==1" >{{userInfo._Roles[0].Name || ''}}</text>
					</view>
				</view>
				<u-image :border-radius="8" width="96rpx" height="96rpx" :src="userInfo.Avatar" mode=""></u-image>
			</view>
			
			<view class="person-list" :style="{top:barHeight+'px',paddingBottom:isUser?barHeight+'px':barHeight+84+'px'}">
				<scroll-view scroll-y style="height: 100%;width: 100%;padding-top: 22rpx;padding-bottom: 50rpx;">
					<view class="person-item">
						<view class="person-item-title">
							登录账号
						</view>
						<view class="person-item-cont">
							{{userInfo.Account}}
						</view>
					</view>
					<view class="person-item">
						<view class="person-item-title">
							性别
						</view>
						<view class="person-item-cont" v-if="userInfo.Sex">
							{{userInfo.Sex}}
						</view>
					</view>
					<view class="person-item">
						<view class="person-item-title">
							联系电话
						</view>
						<view class="person-item-cont" v-if="userInfo.Phone">
							{{userInfo.Phone}}
						</view>
					</view>
					<view class="person-item">
						<view class="person-item-title">
							邮箱
						</view>
						<view class="person-item-cont" v-if="userInfo.Email">
							{{userInfo.Email}}
						</view>
					</view>
					<view class="person-item">
						<view class="person-item-title">
							组织机构
						</view>
						<view class="person-item-cont" v-if="userInfo.DeptName">
							{{userInfo.DeptName}}
						</view>
					</view>
					<!-- <view class="person-item">
						<view class="person-item-title">
							角色
						</view>
						<view class="person-item-cont" v-if="userInfo._Roles&&userInfo._Roles.length>0">
							<view v-for="(item,index) in userInfo._Roles" :key="index">
								{{item.Name}}
							</view>
						</view>
					</view> -->
					<view class="person-item">
						<view class="person-item-title">
							级别
						</view>
						<view class="person-item-cont">
							{{userInfo.Level}}
						</view>
					</view>
					<view class="person-item">
						<view class="person-item-title">
							状态
						</view>
						<view class="person-item-cont">
							{{userInfo.State==1?'启用':'停用'}}
						</view>
					</view>
				</scroll-view>
			</view>
		</view>
		
		<view class="per-bottom" v-if="isUser==false">
			 <!-- style="margin-right: 192rpx;" -->
			<view class="per-bottom-item" @click="phoneCall">
				<u-image width="52rpx" height="52rpx" src="/static/img/tell.png" mode=""></u-image>
				<text>打电话</text>
			</view>
			<!-- <view class="per-bottom-item" @click="goChat">
				<u-image width="52rpx" height="52rpx" src="/static/img/chat.png" mode=""></u-image>
				<text>发消息</text>
			</view> -->
		</view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				keyword:'',
				userInfo:{},
				title:'个人资料',
				background:{
					background:'transparent'
				},
				barHeight:0,
				titleHeight:0,
				isUser:true,
			}
		},
		methods: {
			phoneCall(){
				uni.makePhoneCall({
					phoneNumber: this.userInfo.Phone
				})
			},
			goChat(){
				// this.$Router.push({
				// 	name:'chatbox'
				// })
				uni.showToast({
					icon:'none',
					title:'敬请期待！'
				})
			}
		},
		onLoad() {
			// console.log(this.$Route.query)
			if (this.$Route.query.my=='true'){
				this.userInfo = this.vuex_userInfo
				this.isUser = true
			}else{
				this.userInfo = this.vuex_person
				this.isUser = false
			}
		},
		mounted() {
			// console.log(this.$store.state)
			this.barHeight = this.$store.state.navbarHeight + this.$store.state.systemInfo.statusBarHeight + 92.5
			this.titleHeight = this.$store.state.navbarHeight + this.$store.state.systemInfo.statusBarHeight + 20
		}
	}
</script>

<style lang="scss" scoped>
.slot-wrap {
	display: flex;
	align-items: center;
	/* 如果您想让slot内容占满整个导航栏的宽度 */
	flex: 1;
	/* 如果您想让slot内容与导航栏左右有空隙 */
	padding: 0 30rpx;
}
.head{
	width: 100%;
	height: 429rpx;
	background-color: #3F5CD9;
	display: flex;
	justify-content: space-between;
	padding: 0 46rpx;
}
.personal{
	height: 100vh;
	position: relative;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}
.person-list{
	width: 100%;
	height: 100%;
	border-radius: 62rpx 62rpx 0 0;
	position: absolute;
	background-color: #fff;
	overflow: hidden;
	.person-item{
		padding: 37rpx 40rpx;
		border-bottom: 1rpx solid #E6E6E6;
		
		&-title{
			font-size: 28rpx;
			color: #A8A8A8;
			margin-bottom: 15px;
		}
		&-cont{
			font-size: 32rpx;
			color: #171717;
		}
	}
	.person-item:last-child{
		margin-bottom: 80rpx;
	}
}
.person-detail{
	color: #fff;
	.name{
		display: flex;
		justify-content: left;
		align-items: center;
		font-size: 48rpx;
		font-weight: bold;
	}
	.zhiwei{
		font-size: 28rpx;
		margin-top: 20rpx;
	}
}
.per-bottom{
	width: 100%;
	height: 168rpx;
	background-color: #fff;
	box-shadow: -4rpx 0 9rpx #B3B3B3;
	position: absolute;
	left: 0;
	bottom: 0;
	z-index: 999;
	display: flex;
	flex-direction: row;
	justify-content: center;
	padding-top: 25rpx;
	&-item{
		display: flex;
		flex-direction: column;
		align-items: center;
		font-size: 24rpx;
		color: #3F5CD9;
		text{
			margin-top: 20rpx;
		}
	}
}
</style>
