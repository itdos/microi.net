<template>
	<view>
		<u-navbar :is-back="isBack" :height="height" :title="title" :title-width="titleWidth" :title-color="titleColor"
		 :title-size="titleSize" :z-index="zIndex" :border-bottom="borderBottom" :background="background" :is-fixed="isFixed"
		 :immersive="immersive" :title-bold="titleBold" :custom-back="customBack">
			<view class="slot-wrap">
				<view :class="isBlack?'backBlack':'back'" :style="{width:(backBtn && IsPageBack() && homeBtn ? dwidth : dwidth / 2)+'px',height:dheight+'px'}">
					<image style="width: 36rpx;height: 36rpx;" v-if="backBtn && IsPageBack()" @click="goBack" :src="isBlack?`https://static-img.aijuhome.com/static/img/app/homeIcon/left1.svg`:`https://static-img.aijuhome.com/static/img/app/homeIcon/left.svg`"
					 mode=""></image>
					<view v-if="backBtn && IsPageBack() && homeBtn" class="lines"></view>
					<image style="width: 36rpx;height: 36rpx;" v-if="homeBtn" @click="goHome" :src="isBlack?`https://static-img.aijuhome.com/static/img/app/homeIcon/home1.svg`:`https://static-img.aijuhome.com/static/img/app/homeIcon/home.svg`"
					 mode=""></image>
				</view>
			</view>
		</u-navbar>
	</view>
</template>

<script>
	import {
		mapState
	} from 'vuex'
	export default {
		props: {
			// 是否为黑色
			isBlack: {
				type: Boolean | String,
				default: false
			},
			backBtn: {
				type: Boolean | String,
				default: true
			},
			homeBtn: {
				type: Boolean,
				default: true
			},
			homeUrl: {
				type: String,
				default: '/pages/index/index'
			},
			// 上面是自定义的参数  下面是uView的参数---------------------------
			// uView的自带返回 这里直接关掉！！！！
			isBack: {
				type: Boolean,
				default: false
			},
			// 导航栏高度(不包括状态栏高度在内，内部自动加上)，注意这里的单位是px
			height: {
				type: String | Number,
				default: 44
			},
			// 导航栏标题，如设置为空字符，将会隐藏标题占位区域
			title: {
				type: String,
				default: ''
			},
			// 导航栏标题的最大宽度，内容超出会以省略号隐藏，单位rpx
			titleWidth: {
				type: String | Number,
				default: 250
			},
			// 标题的颜色
			titleColor: {
				type: String,
				default: '#606266'
			},
			// 导航栏标题字体大小，单位rpx，1.5.5起由32调整为44
			titleSize: {
				type: String | Number,
				default: 44
			},
			// 固定在顶部时的z-index值
			zIndex: {
				type: String | Number,
				default: 9999
			},
			// 导航栏背景设置(APP和小程序上包括状态栏的颜色)，见上方说明
			background: {
				type: Object,
				default () {
					return {
						background: '#ffffff'
					}
				}
			},
			// 导航栏是否固定在顶部	
			isFixed: {
				type: Boolean,
				default: true
			},
			// 导航栏标题字体是否加粗
			titleBold: {
				type: Boolean,
				default: false
			},
			// 沉浸式，允许fixed定位后导航栏塌陷，仅fixed定位下生效
			immersive: {
				type: Boolean,
				default: false
			},
			// 导航栏底部是否显示下边框，如定义了较深的背景颜色，可取消此值
			borderBottom: {
				type: Boolean,
				default: true
			},
			// 自定义返回逻辑方法，如传入，点击返回按钮执行函数，否则正常返回上一页，注意模板中不需要写方法参数的括号
			customBack: {
				type: Function
			}
		},
		data() {
			return {
				imgBaseUrl: this.imgBaseUrl,
				dwidth: 0,
				dheight: 0,
			}
		},
		computed: {
			...mapState(['menuButtonInfo']),
		},
		created() {
			// console.log(this.menuButtonInfo)
			this.dwidth = (this.menuButtonInfo && this.menuButtonInfo.width) ? this.menuButtonInfo.width : 88
			this.dheight = (this.menuButtonInfo && this.menuButtonInfo.height) ? this.menuButtonInfo.height : 32
		},
		methods: {
			goBack() {
				// 如果自定义了点击返回按钮的函数，则执行，否则执行返回逻辑
				if (typeof this.customBack === 'function') {
					// 在微信，支付宝等环境(H5正常)，会导致父组件定义的customBack()函数体中的this变成子组件的this
					// 通过bind()方法，绑定父组件的this，让this.customBack()的this为父组件的上下文
					this.customBack.bind(this.$u.$parent.call(this))();
				} else {
					// console.log(222)
					// uni.navigateBack();
					uni.navigateBack({
						delta: 1
					})
				}
			},
			goHome() {
				uni.switchTab({
					url: this.homeUrl
				})
				
			},
			IsPageBack(){
				return getCurrentPages().length > 1
			}
		},
	}
</script>

<style lang="scss">
	.slot-wrap {
		display: flex;
		align-items: center;
		/* 如果您想让slot内容占满整个导航栏的宽度 */
		/* flex: 1; */
		/* 如果您想让slot内容与导航栏左右有空隙 */
		padding: 0 30rpx;

		.back {
			border-radius: 40rpx;
			background-color: rgba($color: #000000, $alpha: 0.2);
			display: flex;
			justify-content: space-between;
			padding: 10rpx 20rpx;
			border: 1px solid transparent;
			align-items: center;

			.lines {
				width: 1rpx;
				height: 100%;
				background-color: #FFFFFF;
			}
		}

		.backBlack {
			border-radius: 40rpx;
			background-color: #FFFFFF;
			display: flex;
			justify-content: space-between;
			padding: 10rpx 20rpx;
			border: 1px solid #f7f7f7;
			align-items: center;

			.lines {
				width: 1rpx;
				height: 100%;
				background-color: #CCCCCC;
			}
		}

	}
</style>
