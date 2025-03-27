<template>
	<view class="content">
		<view class="input-box u-flex">
			<text class="tips">消费金额</text>
			<view class="sign">￥</view>
			<view class="money-box">
				<text>{{ money }}</text>
			</view>
			<view class="cursor"></view>
		</view>
		<keyboard @confirm="submit" ref="keyboard"></keyboard>
		<view class="hitokoto-box">
			<view class="hitokoto-content">{{ yiYan.hitokoto }}</view>
			<view class="from">
				<text v-if="yiYan.from">—— {{ yiYan.from }}</text>
			</view>
		</view>
		<mi-toast ref="miToast"></mi-toast>
		<view v-if="PostData" v-html="PostData" style="position: fixed;width: 80%;height: 80%;background-color: #d5d5d5; border:solid 1px #ccc;">
			
		</view>
	</view>
</template>

<script>
import keyboard from '@/components/keyboard.vue'
export default {
	data() {
		return {
			yiYan: {},
			PostData : '',
		}
	},
	onLoad() {
		// 获取一言
		// 友链 → https://hitokoto.cn/
		// this.getYiyan()
		// setInterval(() => {
		// 	this.getYiyan()
		// }, 6000)
	},
	onShow() {
		// 设置微信分享信息
		// 需要在后端设置公众号appid和appSecrect，否则不要开启
		// this.$jwx.share()
	},
	components: {
		keyboard
	},
	methods: {
		showToast(){
			this.$refs.miToast.show({
				title: '请先输入买单金额',
				type: 'success'
			})
		},
		getYiyan() {
			this.$u.api.getYiyan().then(res => {
				// console.log(res)
				this.yiYan = res.data
			})
		},
		submit() {
			// return
			if (this.money == '') {
				this.$refs.miToast.show({
					title: '请先输入买单金额',
					type: 'warning'
				})
				return false
			}
			this.$refs.keyboard.showPayText()
			this.$u.api.createOrder({ 
				TotalAmount : this.money
			}).then(res => {
				if(res.Code == 1){
					// this.$u.vuex('money', '')
					// this.$refs.keyboard.resetConfirmText()
					
					window.location.href = res.Data;//get
					// this.PostData = res.Data;//post
					// this.$nextTick(function(){
					// 	document.forms['alipaysubmit'].submit();
					// })
				}else{
					this.$refs.miToast.show({
						title: res.Msg,
						type: 'warning'
					})
					this.$refs.keyboard.resetConfirmText()
				}
				// console.log(res)
				// this.$jwx.wxpay({
				// 	data: res.data,
				// 	success: res => {
						
				// 		this.$refs.miToast.show({
				// 			title: '支付成功',
				// 			type: 'success'
				// 		})
						
				// 	},
				// 	fail: err => {
				// 		console.log(err)
				// 		this.$refs.miToast.show({
				// 			title: '取消支付',
				// 			type: 'warning'
				// 		})
				// 		this.$refs.keyboard.resetConfirmText()
				// 	}
				// })
			})
		}
	}
}
</script>

<style lang="scss">
page {
	background-color: #f3f3f3;
}
.content {
	font-size: 28rpx;
	.btn {
		margin-top: 60rpx;
		padding: 0 60rpx;
	}
}
.hitokoto-box {
	position: fixed;
	bottom: 700rpx;
	width: 100%;
	color: #999;
	.hitokoto-content {
		padding: 0 60rpx;
		margin-top: 360rpx;
		margin-bottom: 30rpx;
	}
	.from {
		padding: 0 60rpx;
		text-align: right;
		text {
			color: #aaa;
		}
	}
}


.input-box {
	position: fixed;
	top: 100rpx;
	left: 50%;
	width: 700rpx;
	transform: translateX(-50%);
	display: flex;
	align-items: center;
	padding: 0 40rpx 0 30rpx;
	background-color: #ffffff;
	height: 120rpx;
	border-radius: 12rpx;
	box-sizing: border-box;
	.tips {
		color: #868686;
		font-size: 32rpx;
		font-weight: bold;
	}
	.sign {
		margin-left: auto;
		font-size: 36rpx;
		font-weight: bold;
		transform: translateY(8rpx);
	}
	.money-box {
		color: #333;
		font-size: 56rpx;
		font-weight: bold;
	}
	.cursor {
		position: absolute;
		right: 30rpx;
		width: 4rpx;
		height: 58rpx;
		background-color: #768afa;
		animation: flicker 1.2s infinite;
		@keyframes flicker {
			0%,
			100% {
				opacity: 0;
			}

			50% {
				opacity: 1;
			}
		}
	}
}
::v-deep .keyboard .list .key {
	box-sizing: border-box;
}
</style>
