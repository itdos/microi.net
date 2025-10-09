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
			<!-- <view class="hitokoto-content">{{ yiYan.hitokoto }}</view> -->
			<view class="hitokoto-content">
				<u-radio-group v-model="PayType">
					<u-radio 
						@change="radioChange" 
						:name="'alipay'"
					>
						支付宝支付
					</u-radio>
					<u-radio
						@change="radioChange" 
						:name="'wxpay'"
					>
						微信支付
					</u-radio>
				</u-radio-group>
			</view>
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
			PayType : 'alipay',
			BtnLoading : false,
		}
	},
	onLoad() {
		// 获取一言
		// 友链 → https://hitokoto.cn/
		// this.getYiyan()
		// setInterval(() => {
		// 	this.getYiyan()
		// }, 6000)
		var ua = window.navigator.userAgent.toLowerCase();
		if (ua.match(/MicroMessenger/i) == 'micromessenger') {
		   this.PayType = 'wxpay';
		}
	},
	onShow() {
		// 设置微信分享信息
		// 需要在后端设置公众号appid和appSecrect，否则不要开启
		// this.$jwx.share()
		document.title = '支付宝/微信在线充值';
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
			var self = this;
			if(self.BtnLoading == true){
				return;
			}
			self.BtnLoading = true;
			if (this.money == '') {
				this.$refs.miToast.show({
					title: '请先输入买单金额',
					type: 'warning'
				})
				self.BtnLoading = false;
				return false
			}
			if (parseFloat(this.money) <= 0) {
				this.$refs.miToast.show({
					title: '请输入正确的金额！',
					type: 'warning'
				})
				self.BtnLoading = false;
				return false
			}
			this.$refs.keyboard.showPayText()
			var host = window.location.host;
			this.$u.api.createOrder({ 
				TotalAmount : this.money,
				Host: host,
				PayType : this.PayType,
			}).then(res => {
				if(res.Code == 1){
					//2025-10-05走原生 START
					// 1. 获取完整的 HTML 结构（需包含 <head> 和 <body>）
					const parser = new DOMParser();
					const newDoc = parser.parseFromString(res.Data, 'text/html');
					// 2. 替换 <head> 内容
					document.head.innerHTML = newDoc.head.innerHTML;
					// 3. 替换 <body> 内容
					document.body.innerHTML = newDoc.body.innerHTML; 
					// 在原有代码执行后添加
					document.body.style.display = 'none'; // 或 'visibility: hidden'
					// 4. 重新执行新脚本（如果有）
					const scripts = document.body.getElementsByTagName('script');
					Array.from(scripts).forEach(oldScript => {
						const newScript = document.createElement('script');
						newScript.text = oldScript.text;
						document.body.appendChild(newScript);
						oldScript.parentNode.removeChild(oldScript);
					});
					//2025-10-05走原生 END，以下代码为走进件
					
					// this.$u.vuex('money', '')
					// this.$refs.keyboard.resetConfirmText()
					// this.$refs.miToast.show({
					// 	title: '接口请求成功！若未弹出支付页面，请连接WIFI、或切换为电信/联通网后重试！',
					// 	type: 'warning'
					// })
					uni.showModal({
						title: '提示',
						content: '接口请求成功！若未弹出支付页面，请切换为Wifi或其它支付方式重试！',
						showCancel: false,
						// cancelColor: "#555",
						confirmColor: "#5677fc",
						confirmText: "知道了"
					})
					// self.V8.Tips('接口请求成功！若未弹出支付页面，请连接WIFI、或切换为电信/联通网后重试！');
					window.location.href = res.Data;//get
					// if(this.PayType != 'wxpay'){
					// 	window.location.href = res.Data;//get
					// }else{
					// 	debugger;
					// 	// 1. 获取完整的 HTML 结构（需包含 <head> 和 <body>）
					// 	const parser = new DOMParser();
					// 	const newDoc = parser.parseFromString(res.Data, 'text/html');
					// 	// 2. 替换 <head> 内容
					// 	document.head.innerHTML = newDoc.head.innerHTML;
					// 	// 3. 替换 <body> 内容
					// 	document.body.innerHTML = newDoc.body.innerHTML; 
					// 	// 4. 重新执行新脚本（如果有）
					// 	const scripts = document.body.getElementsByTagName('script');
					// 	Array.from(scripts).forEach(oldScript => {
					// 		const newScript = document.createElement('script');
					// 		newScript.text = oldScript.text;
					// 		document.body.appendChild(newScript);
					// 		oldScript.parentNode.removeChild(oldScript);
					// 	});
					// }
				}else{
					self.BtnLoading = false;
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
