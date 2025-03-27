<template>
	<view class="index">

		<!-- 二级页面 -->
		<view v-if="tabberPageLoadFlag[0]" :style="{
        display: currentTabbarIndex === 0 ? '' : 'none'
      }">
			<scroll-view class="custom-tabbar-page" scroll-y enable-back-to-top :lower-threshold="100"
				@scrolltolower="tabbarPageScrollLower">
				<page-a ref="pageA"></page-a>
			</scroll-view>
		</view>
		<view v-if="tabberPageLoadFlag[1]" :style="{
        display: currentTabbarIndex === 1 ? '' : 'none'
      }">
			<scroll-view class="custom-tabbar-page" scroll-y enable-back-to-top @scrolltolower="tabbarPageScrollLower">
				<!-- <page-b ref="pageB"></page-b> -->
				<short-video ref="shortVideo" :PageType="'List'"></short-video>
			</scroll-view>
		</view>
		<view v-if="tabberPageLoadFlag[2]" :style="{
        display: currentTabbarIndex === 2 ? '' : 'none'
      }">
			<scroll-view class="custom-tabbar-page" scroll-y enable-back-to-top @scrolltolower="tabbarPageScrollLower">
				<page-c ref="pageC"></page-c>
			</scroll-view>
		</view>
		<view v-if="tabberPageLoadFlag[3]" :style="{
        display: currentTabbarIndex === 3 ? '' : 'none'
      }">
			<scroll-view class="custom-tabbar-page" scroll-y enable-back-to-top @scrolltolower="tabbarPageScrollLower">
				<!-- <page-d ref="pageD"></page-d> -->
				<!-- <page-d ref="pageD" v-if="Microi.ClientTpe == 'WeChat' && !Microi.SysConfig.MiniProgramVideo"></page-d> -->
				<!-- <short-video ref="shortVideo"></short-video> -->
				<page-b ref="pageB"></page-b>
			</scroll-view> 
		</view>
		<view v-if="tabberPageLoadFlag[4]" :style="{
        display: currentTabbarIndex === 4 ? '' : 'none'
      }">
			<scroll-view class="custom-tabbar-page" scroll-y enable-back-to-top @scrolltolower="tabbarPageScrollLower">
				<page-e ref="pageE"></page-e>
			</scroll-view>
		</view>

		<!-- 底部导航栏 -->
		<view class="tabbar">
			<!--by itdos.com 新增毛玻璃-->
			<view style="
				backdrop-filter: blur(0.625rem);
				-webkit-backdrop-filter: blur(0.625rem);
				background-color: rgba(255, 255, 255, 0.7);
				position: absolute;
				left: 0;
				top: 0;
				width: 100%;
				height: 100%;">
			</view>
			<view class="action" @tap.stop="changeTabbar(0)">
				<view class="bar-icon">
					<!-- <view class="tn-icon-home-smile tn-color-gray--dark">
          </view> -->
					<image class="" :src="`/static/tabbar/tn-tabbar0${currentTabbarIndex === 0 ? '-curnew' : ''}.png`">
					</image>
				</view>
				<view class="" :class="[currentTabbarIndex === 0 ? 'tn-color-blue' : 'tn-color-gray']">首页</view>
			</view>
			<view class="action" @tap.stop="changeTabbar(1)">
				<view class="bar-icon">
					<!-- <view class="tn-icon-discover tn-color-gray--dark">
          </view>  -->
					<image class="" :src="`/static/tabbar/tn-tabbar1${currentTabbarIndex === 1 ? '-curnew' : ''}.png`">
					</image>
				</view>
				<view class="" :class="[currentTabbarIndex === 1 ? 'tn-color-blue' : 'tn-color-gray']">短视频</view>
			</view>

			<!-- <view class="action bar-center">
        <view class="bar-circle tn-shadow-blur">
          <view class="tn-icon-camera-fill tn-color-white">
          </view>
        </view>
        <view class="tn-color-gray">发布</view>
      </view> -->

			<view class="action bar-center" @tap.stop="changeTabbar(2)">
				<view class="nav-index-button">
					<view class="nav-index-button__content">
						<view class="nav-index-button__content--icon tn-flex tn-flex-row-center tn-flex-col-center">
							<!-- <view class="tn-icon-logo-tuniao"></view> -->
							<view class="bar-circle">
								<image class="" :src="Microi.FileServer + Microi.AppLogo"
									:style="'transform: rotate('+ rotates +'deg);'" 
									></image>
								<!-- <image class="" src="/static/img/logo-2023-11-24.jpeg"></image> -->
							</view>
						</view>
					</view>

					<view class="nav-index-button__meteor">
						<view class="nav-index-button__meteor__wrapper">
							<view v-for="(item,index) in 6" :key="index" class="nav-index-button__meteor__item"
								:style="{transform: `rotateX(${-60 + (30 * index)}deg) rotateZ(${-60 + (30 * index)}deg)`}">
								<view class="nav-index-button__meteor__item--pic"></view>
							</view>
						</view>
					</view>
				</view>
				<!-- <view class="tn-color-gray">每日优选</view> -->
			</view>

			<view class="action" @tap.stop="changeTabbar(3)">
				<view class="bar-icon">
					<!-- <view class="tn-icon-image-text tn-color-gray--dark">
          </view> -->
					<image class="" :src="`/static/tabbar/tn-tabbar2${currentTabbarIndex === 3 ? '-curnew' : ''}.png`">
					</image>
				</view>
				<view class="" :class="[currentTabbarIndex === 3 ? 'tn-color-blue' : 'tn-color-gray']">广场</view>
			</view>
			<view class="action" @tap.stop="changeTabbar(4)">
				<view class="bar-icon">
					<!-- <view class="tn-icon-my tn-color-gray--dark">
          </view> -->
					<image class="" :src="`/static/tabbar/tn-tabbar3${currentTabbarIndex === 4 ? '-curnew' : ''}.png`">
					</image>
				</view>
				<view class="" :class="[currentTabbarIndex === 4 ? 'tn-color-blue' : 'tn-color-gray']">我的</view>
			</view>
		</view>
	</view>
</template>

<script>
	import PageA from './component/PageA.vue'
	import PageB from './component/PageB.vue'
	import PageC from './component/PageC.vue'
	import PageD from './component/PageD.vue'
	import PageE from './component/PageE.vue' 
	// #ifdef APP
	// import ShortVideo from '@/pageA/nvueSwiper/index.nvue'  
	import ShortVideo from './component/ShortVideoApp.nvue'
	// import ShortVideo from './component/ShortVideoChunlei.nvue'
	// import ShortVideo from './component/index_copy.nvue'
	// import ShortVideo from './component/ShortVideo.nvue'
	// #endif
	// #ifndef APP
	import ShortVideo from './component/ShortVideo.nvue'
	// import ShortVideo from '@/pageA/nvueSwiper/nvueSwiper.nvue'
	// import ShortVideo from './component/ShortVideoChunlei.nvue'
	// #endif

	export default {
		components: {
			PageA,
			PageB,
			PageC,
			PageD,
			PageE,
			ShortVideo
		},
		onShow() {
		},
		data() {
			return {
				Microi: this.Microi, //可能是vue2的原因，这里一定要再声明一下？
				currentTabbarIndex: 0,
				// 自定义底栏对应页面的加载情况
				tabberPageLoadFlag: [],
				rotates: 0,//转轮旋转角度
			}
		},
		onLoad(options) {
			var self = this;
			const index = Number(options.index || 0)
			// 根据底部tabbar菜单列表设置对应页面的加载情况
			for (let i = 0; i < 5; i++) {
				this.tabberPageLoadFlag.push(i === index)
			}
			this.changeTabbar(index)
			//logo转圈动画
			setInterval(function(){
				self.rotates += 1;
				if(self.rotates >= 360){
					self.rotates = 0;
				}
			}, 15);
		},
		onReady() {
			
		},
		onShareAppMessage(e){
			debugger;
		},
		methods: {
			// 导航页面滚动到底部
			tabbarPageScrollLower(e) {
				if (this.currentTabbarIndex === 0) {
					this.$refs.pageA.GetContentList && this.$refs.pageA.GetContentList({
						PageIndexAdd : true
					})
				}else if (this.currentTabbarIndex === 1) {
					// this.$refs.pageB.GetContentList && this.$refs.pageB.GetContentList({
					// 	PageIndexAdd : true
					// })
				}
			},

			// 修改当前选中的tabbar
			changeTabbar(index) {
				if (this.currentTabbarIndex === index) return
				this._switchTabbarPage(index)
				this.currentTabbarIndex = index
			},

			// 切换导航页面
			_switchTabbarPage(index) {
				try {
					wx.vibrateShort();
				} catch (e) {}
				const selectPageFlag = this.tabberPageLoadFlag[index]
				if (selectPageFlag === undefined) {
					return
				}
				if (selectPageFlag === false) {
					this.tabberPageLoadFlag[index] = true
				}
			},


		}
	}
</script>

<style lang="scss" scoped>
	.index {
		width: 100%;
		height: 100vh;
		position: relative;

		.custom-tabbar-page {
			width: 100%;
			// height: calc(100vh - 110rpx);
			height: 100vh;
			box-sizing: border-box;
			padding-bottom: 0rpx;
			padding-bottom: calc(0rpx + constant(safe-area-inset-bottom));
			padding-bottom: calc(0rpx + env(safe-area-inset-bottom));
		}


		/* 底部导航 statr */
		.tabbar {
			width: 100%;
			height: 110rpx;
			height: calc(110rpx + constant(safe-area-inset-bottom));
			height: calc(110rpx + env(safe-area-inset-bottom));
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			background-color: transparent;
			// background-color: rgba(255, 255, 255, 0.95);
			z-index: 998;
			padding-bottom: calc(constant(safe-area-inset-bottom));
			padding-bottom: calc(env(safe-area-inset-bottom));
			display: flex;
			align-items: center;
			justify-content: space-between;
			box-shadow: 0rpx 0rpx 30rpx 0rpx rgba(0, 0, 0, 0.07);

			.action {
				font-size: 22rpx;
				position: relative;
				flex: 1;
				text-align: center;
				padding: 0;
				display: block;
				height: auto;
				line-height: 1;
				margin: 0;
				overflow: initial;

				.bar-icon {
					width: 100rpx;
					position: relative;
					display: block;
					height: auto;
					margin: 0 auto 10rpx;
					text-align: center;
					font-size: 42rpx;

					image {
						width: 55rpx;
						height: 55rpx;
						display: inline-block;
					}
				}

				.bar-circle {
					border-radius: 50%;
					box-shadow: 0 0 20px 0px rgba(67, 142, 219, 0.5);
					position: relative;
					display: block;
					margin: 0rpx auto 0rpx;
					text-align: center;
					font-size: 52rpx;
					line-height: 90rpx;
					width: 100rpx !important;
					height: 100rpx !important;
					overflow: hidden;

					image {
						width: 100rpx;
						height: 100rpx;
						display: inline-block;
						margin: 0rpx auto 0rpx;
					}
				}
			}

			.bar-center {
				//logo停止上下动画
				// animation: suspension 3s ease-in-out infinite;

				.nav-index-button {
					//logo停止上下动画
					// animation: suspension 3s ease-in-out infinite;
					z-index: 999999;


					&__content {
						position: absolute;
						width: 100rpx;
						height: 100rpx;
						top: 50%;
						left: 50%;
						transform: translate(-50%, -50%);

						&--icon {
							width: 100rpx;
							height: 100rpx;
							font-size: 60rpx;
							border-radius: 50%;
							margin-bottom: 18rpx;
							position: relative;
							z-index: 1;
							transform: scale(0.85);

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
								// background-image: url(https://resource.tuniaokj.com/images/cool_bg_image/icon_bg6.png);
							}
						}
					}

					&__meteor {
						position: absolute;
						top: 50%;
						left: 50%;
						width: 100rpx;
						height: 100rpx;
						transform-style: preserve-3d;
						transform: translate(-50%, -50%) rotateY(75deg) rotateZ(10deg);

						&__wrapper {
							width: 100rpx;
							height: 100rpx;
							transform-style: preserve-3d;
							animation: spin 20s linear infinite;
						}

						&__item {
							position: absolute;
							width: 100rpx;
							height: 100rpx;
							border-radius: 1000rpx;
							left: 0;
							top: 0;

							&--pic {
								display: block;
								width: 100%;
								height: 100%;
								background: url(https://os.microios.com:1110/jsnzk-public/jsnzk/img/upload/arc2.png) no-repeat center center;
								background-size: 100% 100%;
								animation: arc 4s linear infinite;
							}
						}
					}
				}
			}
		}

		/* 底部导航 end */
	}

	@keyframes suspension {

		0%,
		100% {
			transform: translateY(0);
		}

		50% {
			transform: translateY(-0.6rem);
		}
	}

	@keyframes spin {
		0% {
			transform: rotateX(0deg);
		}

		100% {
			transform: rotateX(-360deg);
		}
	}

	@keyframes arc {
		to {
			transform: rotate(360deg);
		}
	}
</style>