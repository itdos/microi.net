<template>
	<view>
		<view class="top u-flex">
			<view class="username">{{ userInfo.nickname || '未登录' }}</view>
			<view class="avatar">
				<u-avatar :src="userInfo.avatarUrl" :size="160" show-sex :sex-icon="sexIcon" @click="wxLogin"></u-avatar>
				<!-- <image :src="userInfo.avatarUrl || 'https://img01.sogoucdn.com/app/a/100520146/8c7158727decbbcb91e1e004d165bfb0'"></image> -->
			</view>
		</view>
		<!-- <view class="card statistics">
			<view class="box">
				<view class="item">
					<text>我的订单</text>
					<text>19</text>
				</view>
				<view class="item">
					<text>我的卡券</text>
					<text>8</text>
				</view>
				<view class="item">
					<text>我的推广</text>
					<text>26</text>
				</view>
			</view>
		</view> -->
		<!-- <view class="card level">
			<view class="title">
				当前等级
			</view>
			<view class="num">
				V3.0
			</view>
			<view class="progress">
				<u-line-progress inactive-color="#FFEDED" active-color="#FF5259" :percent="70" :show-percent="false" height="18" striped-active striped></u-line-progress>
			</view>
		</view> -->
		<view class="card entrance">
			<view class="item" @click="goToOrder">
				<image src="../../static/icon/distribution.png" mode=""></image>
				<text>订单中心</text>
				<u-icon name="arrow-right" color="#999" size="28"></u-icon>
			</view>
			<!-- <view class="item">
				<image src="../../static/icon/meal.png" mode=""></image>
				<text>美味之旅</text>
				<u-icon name="arrow-right" color="#999" size="28"></u-icon>
			</view> -->
			<view class="item" @click="goToHelp">
				<image src="../../static/icon/hot.png" mode=""></image>
				<text>帮助</text>
				<u-icon name="arrow-right" color="#999" size="28"></u-icon>
			</view>
			<!-- <view class="item">
				<image src="../../static/icon/setting.png" mode=""></image>
				<text>设置</text>
				<u-icon name="arrow-right" color="#999" size="28"></u-icon>
			</view> -->
		</view>
	</view>
</template>

<script>
export default {
	data() {
		return {}
	},
	methods: {
		goToOrder() {
			if (!this.isLogin){
				// this.wxOauth()
			} else {
				// uni.navigateTo({
				// 	url: '../order/order'
				// })
			}
			
		},
		goToHelp() {
			uni.navigateTo({
				url: '../help/help'
			})
		},
		wxLogin(){
			if(this.isLogin) return
			// this.wxOauth()
		}
	},
	computed:{
		sexIcon(){
			if (this.userInfo.gender == 1) {
				return 'man'
			} else if (this.userInfo.gender == 2) {
				return 'woman'
			} else {
				return 'question'
			}
		}
	}
}
</script>

<style lang="scss">
page {
	background-color: #fafafa;
}
.top {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	height: 292rpx;
	background: url(../../static/user-bg.png) no-repeat center / 100% 100%;
	.username {
		font-size: 32rpx;
		color: #fff;
		margin-bottom: 60rpx;
		font-weight: bold;
	}
	.avatar {
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translate(-50%, 50%);
		display: flex;
		justify-content: center;
		align-items: center;
		// width: 160rpx;
		// height: 160rpx;
		background-color: #fff;
		border-radius: 80rpx;
		box-shadow: 1rpx 3rpx 6rpx 10rpx rgba($color: #000, $alpha: 0.03);
		// image {
		// 	width: 152rpx;
		// 	height: 152rpx;
		// 	border-radius: 76rpx;
		// }
	}
}
.card {
	border-radius: 18rpx;
	background-color: #fff;
}
.statistics {
	padding: 150rpx 60rpx 30rpx;
	margin-top: -60rpx;
	border-radius: 36rpx;
	.box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 100rpx;
		font-size: 26rpx;
		text:first-child {
			color: #666;
			margin-right: 10rpx;
		}
		text:last-child {
			color: #000;
			font-size: 36rpx;
			font-weight: bold;
		}
	}
}
.level {
	margin: 30rpx 24rpx 0;
	padding: 20rpx 24rpx 32rpx;
	.title {
		font-size: 26rpx;
		color: #666;
	}
	.num {
		font-size: 38rpx;
		color: #000;
		font-weight: bold;
		margin-top: 10rpx;
	}
}
.entrance {
	display: flex;
	flex-direction: column;
	margin: 120rpx 24rpx 30rpx;
	padding: 10rpx 24rpx;

	.item {
		display: flex;
		align-items: center;
		padding-left: 12rpx;
		height: 140rpx;
		image {
			width: 60rpx;
			height: 60rpx;
		}
		text {
			margin-left: 30rpx;
			margin-right: auto;
			color: #333;
			font-weight: bold;
			font-size: 32rpx;
		}
		u-icon {
			// margin-left: auto;
		}
	}
}
</style>
