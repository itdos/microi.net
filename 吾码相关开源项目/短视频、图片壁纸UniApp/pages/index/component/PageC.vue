<template>
	<view class="page-c">

		<!-- 顶部自定义导航 -->
		<!---->
		<tn-nav-bar :isBack="false" :bottomShadow="false" backgroundColor="none">
			<view class="custom-nav tn-flex tn-flex-col-center tn-flex-row-left" @click="tn('/minePages/message')">
				<view class="custom-nav__back">
					<text class="tn-text-bold tn-text-xl tn-color-black">近期热门</text>
				</view>
			</view>
		</tn-nav-bar>

		<!-- 卡片轮播-->
		<!-- @click="tn('/pageA/details/details?ContentId=' + item.Id, item.Id)"
			此组件暂时做不了骨架屏，因为图片有重新定位计算，建议使用默认的5张lading图片-->
		<view class="swiper tn-margin-left tn-margin-right" 
			:style="{paddingTop: vuex_custom_bar_height + 10 +'px', height:(Microi.ClientType == 'APP' ? '99vh' : '89vh')}">
			<tn-stack-swiper :list="ContentList" @CallbackClick="GotoDetail" direction="vertical" height="100%"
				@change="SwiperChange"
				:switchRate="20" :scaleRate="0.05" :translateRate="7.2"></tn-stack-swiper>
		</view>

		<!-- 两个按钮，有需要直接显示出来即可-->
		<view class="tn-footerfixed" v-if="false">
			<view class="tn-flex">
				<!-- @click="tn('')" -->
				<view class="tn-flex-1 tn-padding-sm tn-radius justify-content-item" >
					<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
						<view class="icon4__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur"
							style="margin-left: -150rpx;opacity: 0.8;">
							<view class="tn-icon-like-lack tn-cool-color-icon4 tn-bg-blue"></view>
						</view>
						<!-- <view class="tn-color-gray--dark tn-text-center">
							<text class="tn-text-ellipsis tn-text-sm">收 藏</text>
						</view> -->
					</view>
				</view>
				<!-- @click="tn('')" -->
				<view class="tn-flex-1 tn-padding-sm tn-radius justify-content-item" >
					<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
						<!-- <view class="icon4__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur">
							<view class="tn-icon-download tn-cool-color-icon4 tn-bg-purplered"></view>
						</view> -->
						<!-- <view class="tn-color-gray--dark tn-text-center">
							<text class="tn-text-ellipsis tn-text-sm">下 载</text>
						</view> -->
					</view>
				</view>
			</view>
		</view>


		<!-- <view class='tn-tabbar-height'></view> -->
		<!-- <tn-skeleton :show="showSkeleton"></tn-skeleton> -->
	</view>
</template>

<script>
	export default {
		name: 'PagesC',
		data() {
			return {
				Microi : this.Microi,
				showSkeleton:true,
				ContentList: [{
					image : this.Microi.FileServer + this.Microi.AppLogo,
				},{
					image : this.Microi.FileServer + this.Microi.AppLogo,
				},{
					image : this.Microi.FileServer + this.Microi.AppLogo,
				},{
					image : this.Microi.FileServer + this.Microi.AppLogo,
				},{
					image : this.Microi.FileServer + this.Microi.AppLogo,
				}],
				DefaultContentList: [{
					image : this.Microi.FileServer + this.Microi.AppLogo,
				},{
					image : this.Microi.FileServer + this.Microi.AppLogo,
				},{},{
					image : this.Microi.FileServer + this.Microi.AppLogo,
				},{
					image : this.Microi.FileServer + this.Microi.AppLogo,
				},{
					image : this.Microi.FileServer + this.Microi.AppLogo,
				}],
				autoplay: false
			}
		},
		onReady() {
			this.$nextTick(() => {
				this.initSwiperContainer()
			})
		},
		onShow() {
			this.autoplay = true
		},
		onHide() {
			this.autoplay = false
		},
		mounted() {
			var self = this;
			self.GetContentList();
		},
		methods: {
			SwiperChange(index){
				var self = this;
				
			},
			GotoDetail(item) {
				var self = this;
				var urlParam = `?ContentId=${item.Id}&PageType=Detail&SortType=Hottest`;
				if(item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo'){
					
					if(self.Microi.ClientType == 'APP'){
						// self.tn('/pageA/nvueSwiper/index?ContentId=' + item.Id, item.Id) 
						self.tn(`/pages/index/component/ShortVideoAppDetail${urlParam}`)
					}
					else if(self.Microi.ClientType == 'H5'){
						// self.tn('/pageA/nvueSwiper/nvueSwiper?ContentId=' + item.Id, item.Id)
						self.tn(`/pages/index/component/ShortVideo${urlParam}`)
					}
					else if(self.Microi.ClientType == 'WeChat'){
						//微信小程序需要判断是否已有视频资质
						if(self.Microi.SysConfig.MiniProgramVideo){
							// self.tn('/pageA/nvueSwiper/nvueSwiper?ContentId=' + item.Id, item.Id)
							self.tn(`/pages/index/component/ShortVideo${urlParam}`)
						}else{
							// self.tn('/pageA/details/details?ContentId=' + item.Id, item.Id)
							self.tn(`/pageA/details/details${urlParam}`)
						}
					}
				}else {
					// self.tn('/pageA/details/details?ContentId=' + item.Id, item.Id)
					self.tn(`/pageA/details/details${urlParam}`)
				}
			},
			GetContentList() {
				var self = this;
				self.showSkeleton = true;
				self.ContentList = [...self.DefaultContentList];
				self.Microi.ApiEngine.Run('get_everyday_good_list', {}, function(result) {
					if (self.Microi.CheckResult(result)) {
						result.Data.forEach(item => {
							item.image = self.Microi.FileServer + item.YulanT;
						});
						self.ContentList = result.Data;
						self.showSkeleton = false;
					}
				})
			},
			// 跳转
			tn(e, id) {
				var self = this;
				if (id) {
					uni.setStorageSync("ContentId", id);
				}
				uni.navigateTo({
					url: e,
				});
			},
			// 初始化轮播图容器
			initSwiperContainer() {
				// 获取底部tabbar信息
				this._tGetRect('.tabbar').then((res) => {
					if (!res.height) {
						setTimeout(() => {
							this.initSwiperContainer()
						}, 10)
						return
					}
					// 获取系统信息
					const systemInfo = uni.getSystemInfoSync()
					this.swiperContainerHeight = systemInfo.safeArea.height - res.height - 10
				})
			}
		}
	}
</script>

<style lang="scss" scoped>
	.page-c {
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
		min-height: 120rpx;
		height: calc(140rpx + env(safe-area-inset-bottom) / 2);
		height: calc(140rpx + constant(safe-area-inset-bottom));
	}

	/* 卡片轮播图 start */
	.swiper {
		border-radius: 10rpx;
		overflow: hidden;
	}

	/* 轮播图 end */

	/* 底部固定按钮*/
	.tn-footerfixed {
		position: fixed;
		width: 100%;
		// bottom: calc(200rpx + env(safe-area-inset-bottom));
		top: 200rpx;
		z-index: 1024;
	}

	/* 图标容器4 start */
	.tn-cool-color-icon4 {
		// background-image: -webkit-linear-gradient(135deg, #ED1C24, #FECE12);
		// background-image: linear-gradient(135deg, #ED1C24, #FECE12);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		text-fill-color: transparent;
	}

	.icon4 {
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
				width: 110rpx;
				height: 110rpx;
				font-size: 55rpx;
				border-radius: 50%;
				margin-bottom: 18rpx;
				position: relative;
				z-index: 1;
				background-color: rgba(255, 255, 255, 0.8);
				backdrop-filter: blur(20rpx);
				-webkit-backdrop-filter: blur(20rpx);
				box-shadow: 0rpx 0rpx 30rpx 0rpx rgba(0, 0, 0, 0.07);
			}
		}
	}
</style>