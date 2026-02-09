<template>
	<view class="message tn-safe-area-inset-bottom">

		<!-- 顶部自定义导航 -->
		<tn-nav-bar :isBack="false" :bottomShadow="false" backgroundColor="#FFFFFF">
			<view class="custom-nav tn-flex tn-flex-col-center tn-flex-row-left" @click="tn('/minePages/message')">
				<view class="custom-nav__back">
					<text class="tn-text-bold tn-text-xl tn-color-black">消息</text>
				</view>
			</view>
		</tn-nav-bar>

		<view class="" :style="{paddingTop: vuex_custom_bar_height + 'px'}">

			<!-- @click="tn('/pageB/chat/chat')" -->
			<view class="wallpaper-shadow tn-margin tn-padding">
				<view class="tn-flex tn-flex-col-top">
					<!-- 这个是图标形式 -->
					<!-- <view class="">
						<view class="icon15__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur"
							style="background-color: #F3F2F7;color: #7C8191;">
							<view class="tn-icon-constellation"></view>
						</view>
					</view> -->
					<!-- 这个是图片形式，自己看需要去使用 -->
					<view class="">
						<view class="logo-pic">
							<view class="logo-image">
								<view class="" style="width: 100rpx;height: 100rpx;background-size: cover;"
									:style="{ backgroundImage : 'url(' + Microi.FileServer + '/jsnzk/img/upload/B6.png' + ')' }">
								</view>
							</view>
						</view>
					</view>
					<view class="tn-padding-left-sm" style="width: 100%;">
						<view class="tn-flex tn-flex-row-between tn-flex-col-between">
							<view class="justify-content-item">
								<text class="tn-color-wallpaper tn-text-lg tn-text-bold">系统消息</text>
							</view>
						</view>
						<view class=" tn-padding-top-xs  tn-text-ellipsis-2">
							<text class="tn-color-gray">您暂时没有未读消息</text>
						</view>
					</view>
				</view>
				<view class="tn-flex tn-flex-row-between tn-flex-col-between tn-margin-top-sm">
					<view class="justify-content-item tn-color-gray tn-text-center tn-color-gray">
						<text class="tn-icon-time tn-padding-right-xs tn-padding-left-xs tn-text-df"></text>
						<text class="tn-text-sm">{{Microi.DateTimeNow.Format('yyyy-MM-dd HH:mm:ss')}}</text>
					</view>
					<view class="justify-content-item tn-round tn-text-xs tn-bg-blue--light tn-color-blue"
						style="padding: 5rpx 15rpx;">
						<text class="tn-padding-right-xs">#</text> 官 方
					</view>
				</view>
			</view>


			<view class="tn-margin wallpaper-shadow tn-padding" v-for="(item,index) in 0" :key="index"
				@click="tn('/pageB/chat/chat')">
				<view class="tn-flex tn-flex-col-top">
					<view class="">
						<view class="logo-pic">
							<view class="logo-image">
								<view class=""
									style="background-image:url('https://resource.tuniaokj.com/images/blogger/blogger_beibei.jpg');width: 100rpx;height: 100rpx;background-size: cover;">
								</view>
							</view>
						</view>
					</view>
					<view class="tn-padding-left-sm" style="width: 100%;">
						<view class="tn-flex tn-flex-row-between tn-flex-col-between">
							<view class="justify-content-item">
								<text class="tn-color-wallpaper tn-text-lg tn-text-bold">抓住那只猪</text>
								<text class="tn-color-gray tn-padding-left-sm tn-padding-right-xs">市场经理</text>
							</view>
							<!-- <view class="justify-content-item tn-round tn-text-xs tn-bg-red--light tn-color-red" style="padding: 10rpx 20rpx;">
                删 除
              </view> -->
						</view>
						<view class=" tn-padding-top-xs">
							<text class="tn-color-gray">人生就是这样，得意淡然，失意坦然；喜而不狂，忧而不伤。</text>
						</view>
					</view>
				</view>
				<view class="tn-flex tn-flex-row-between tn-flex-col-between tn-margin-top-sm">
					<view class="justify-content-item tn-color-gray tn-text-center tn-color-gray">
						<text class="tn-icon-time tn-padding-right-xs tn-padding-left-xs tn-text-df"></text>
						<text class="tn-text-sm">2022-10-25 16:27</text>
					</view>
					<view class="justify-content-item tn-round tn-text-xs tn-bg-orange--light tn-color-orange"
						style="padding: 5rpx 15rpx;">
						<text class="tn-padding-right-xs">#</text> 5条未读消息
					</view>
				</view>
			</view>


		</view>

		<view class="tn-tabbar-height"></view>

	</view>
</template>

<script>
	export default {
		name: 'Message',
		data() {
			return {
				Microi: this.Microi,
			}
		},
		onLoad() {

		},
		methods: {
			// 跳转
			tn(e) {
				uni.navigateTo({
					url: e,
				});
			},
		}
	}
</script>

<style lang="scss" scoped>
	.message {
		max-height: 100vh;
	}

	/* 自定义导航栏内容 start */
	.custom-nav {
		height: 100%;

		&__back {
			margin: auto 30rpx;
			font-size: 40rpx;
			margin-right: 10rpx;
			flex-basis: 5%;
			width: 100rpx;
			position: absolute;
		}
	}

	/* 自定义导航栏内容 end */

	/* 底部安全边距 start*/
	.tn-tabbar-height {
		min-height: 20rpx;
		height: calc(40rpx + env(safe-area-inset-bottom) / 2);
		height: calc(40rpx + constant(safe-area-inset-bottom));
	}


	.tn-color-wallpaper {
		color: #1D2541;
	}

	/* 页面阴影 start*/
	.wallpaper-shadow {
		border-radius: 15rpx;
		box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
	}



	/* 图标容器15 start */
	.icon15 {
		&__item {
			width: 30%;
			background-color: #FFFFFF;
			border-radius: 10rpx;
			padding: 30rpx;
			margin: 20rpx 10rpx;
			transform: scale(1);
			transition: transform 0.3s linear;
			transform-origin: center center;

			&--icon {
				width: 105rpx;
				height: 105rpx;
				font-size: 60rpx;
				border-radius: 50%;
				margin-bottom: 18rpx;
				position: relative;
				z-index: 1;

				&::after {
					content: " ";
					position: absolute;
					z-index: -1;
					width: 100%;
					height: 100%;
					left: 0;
					bottom: 0;
					border-radius: inherit;
					opacity: 1;
					transform: scale(1, 1);
					background-size: 100% 100%;


				}
			}
		}
	}

	/* 用户头像 start */
	.logo-image {
		width: 100rpx;
		height: 100rpx;
		position: relative;
	}

	.logo-pic {
		background-size: cover;
		background-repeat: no-repeat;
		// background-attachment:fixed;
		background-position: top;
		border: 1rpx solid rgba(255, 255, 255, 0.05);
		box-shadow: 0rpx 0rpx 80rpx 0rpx rgba(0, 0, 0, 0.05);
		border-radius: 50%;
		overflow: hidden;
		// background-color: #FFFFFF;
	}
</style>