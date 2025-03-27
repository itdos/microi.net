<template>
	<!-- #ifndef MP-WEIXIN -->
	<view class="tn-safe-area-inset-bottom">
		<!-- 顶部自定义导航 -->
		<tn-nav-bar fixed customBack :bottomShadow="false" :backgroundColor="navBarBackgroundColor" id="navbar">
			<view slot="back" class='tn-custom-nav-bar__back' @click="goBack" :style="[navBarStyle]">
				<text class='icon tn-icon-left'></text>
				<text class='icon tn-icon-discover-fill'></text>
			</view>
			<view class="tn-flex tn-flex-col-center tn-flex-row-center" :style="[navBarStyle2]">
				<view class="tn-text-bold tn-text-xl">{{FenleiModel.Mingcheng || ''}}</view>
			</view>
		</tn-nav-bar>

		<swiper class="card-swiper" :circular="true" :autoplay="true" duration="500" interval="22000"
			@change="cardSwiper">
			<swiper-item v-for="(item,index) in swiperList" :key="index" :class="cardCur==index?'cur':''">
				<view class="swiper-item image-banner">
					<image :src="item.url" mode="aspectFill" v-if="item.type=='image'"></image>
				</view>
			</swiper-item>
		</swiper>
		<view class="indication">
			<block v-for="(item,index) in swiperList" :key="index">
				<view class="spot" :class="cardCur==index?'active':''"></view>
			</block>
		</view>

		<!-- 头部start-->
		<view class="shop-function tn-margin-bottom-xl" :style="{paddingTop: vuex_custom_bar_height + 'px'}">
			<view class="tn-flex tn-flex-row-between tn-flex-col-center tn-margin">
				<view class="justify-content-item">
					<view class="tn-flex tn-flex-col-center tn-flex-row-left">
						<view class="tn-color-white" style="width: 90vw;">
							<view class="tn-padding-right tn-text-xxl tn-text-bold">
								{{FenleiModel.Mingcheng || ''}}
							</view>
							<view class="tn-padding-right tn-padding-top-sm tn-text-ellipsis tn-text-sm">
								<text class="tn-padding-right-sm">{{FenleiModel.FenleiSM || ''}}</text>
							</view>
						</view>
					</view>
				</view>
				<!-- <view class="justify-content-item tn-flex-row-center">
          <view class="logo-pic tn-shadow">
            <view class="logo-image">
              <view class="tn-shadow-blur" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1668321603455-assets/web-upload/997b637d-3435-44ee-a7cd-dc6914126f99.jpeg');width: 100rpx;height: 100rpx;background-size: cover;">
              </view>
            </view>
          </view>
        </view> -->
			</view>
		</view>
		<!-- 头部 end-->

		<tn-modal v-model="show1" :custom="true">
			<view class="custom-modal-content">
				<image @tap="previewQRCodeImage" src='https://resource.tuniaokj.com/images/advertise/qrcode.jpg'
					mode='aspectFill' style="width: 100%;"></image>
				<view class="tn-text-center tn-padding-top">欢迎加入【图鸟UI】圈子群</view>
				<view class="tn-text-center tn-padding-top tn-text-lg">点击上图，可识别微信二维码</view>
			</view>
		</tn-modal>

		<view class="group-wrap tn-bg-white" id="page_tips">

			<!-- 悬浮按钮-->
			<!-- <view class="tn-flex tn-flex-row-between" style="padding: 60rpx 0 30rpx 0;">
        <view class="tn-flex-1 justify-content-item tn-margin-xs tn-text-center">
          <tn-button backgroundColor="#3668fc" padding="40rpx 0" width="90%" shadow fontBold @click="showModal">
            <text class="tn-icon-wechat tn-padding-right-xs tn-color-white"></text>
            <text class="tn-color-white">微 信</text>
          </tn-button>
        </view>
        <view class="tn-flex-1 justify-content-item tn-margin-xs tn-text-center">
          <tn-button backgroundColor="#fbbd12" padding="40rpx 0" width="90%" shadow fontBold open-type="share">
            <text class="tn-icon-send tn-padding-right-xs tn-color-white"></text>
            <text class="tn-color-white">分 享</text>
          </tn-button>
        </view>
      </view> -->


			<view v-if="!ContentListFirstLoading" class="" style="padding: 30rpx 20rpx;">
				<tn-waterfall ref="waterfall" v-model="ContentList" @finish="handleWaterFallFinish">
					<template v-slot:left="{ leftList }">
						<view v-for="(item, index) in leftList" :key="item.Id" class="product__item"
							@click="GotoDetail(item)">
							<view class="item__image" style="position: relative;">
								<tn-lazy-load :threshold="6000" height="100%" 
									:image="Microi.FileServer + item.YulanT"
									:index="item.Id"
									imgMode="widthFix"></tn-lazy-load>
								<view class="content-type-icon">
									<tn-tag shape="circle" size="sm" height="35rpx" width="auto"
										backgroundColor="tn-dynamic-bg-1" fontColor="tn-color-white">
										<text class="content-icon" :class="(item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo')
												? 'tn-icon-video-fill' : 'tn-icon-image-fill'"></text>
										{{item._WenjianDZLength || '..'}}
										<text class="content-icon" :class="'tn-icon-eye-fill'"
											style="margin-left: 5px;"></text>
										{{item.Hits || '0'}}
									</tn-tag>
								</view>
							</view>
							<!-- <view class="item__data">
                  <view class="item__title-container">
                    <text class="item__title tn-color-black">{{ item.title }}</text>
                  </view>
                  <view v-if="item.tags && item.tags.length > 0" class="item__tags-container">
                    <view v-for="(tagItem, tagIndex) in item.tags" :key="tagIndex" class="item__tag">{{ tagItem }}</view>
                  </view>
                </view> -->
						</view>
					</template>
					<template v-slot:right="{ rightList }">
						<view v-for="(item, index) in rightList" :key="item.Id" class="product__item"
							@click="GotoDetail(item)">
							<view class="item__image" style="position: relative;"> 
								<tn-lazy-load :threshold="6000" height="100%" 
									:image="'https://os.microios.com:1110/jsnzk-public' + item.YulanT"
									:index="item.Id"
									imgMode="widthFix"></tn-lazy-load>
								<view class="content-type-icon">
									<tn-tag shape="circle" size="sm" height="35rpx" width="auto"
										backgroundColor="tn-dynamic-bg-1" fontColor="tn-color-white">
										<text class="content-icon" :class="(item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo')
												? 'tn-icon-video-fill' : 'tn-icon-image-fill'"></text>
										{{item._WenjianDZLength || '..'}}
										<text class="content-icon" :class="'tn-icon-eye-fill'"
											style="margin-left: 5px;"></text>
										{{item.Hits || '0'}}
									</tn-tag>
								</view>
							</view>
							<!-- <view class="item__data">
                  <view class="item__title-container">
                    <text class="item__title tn-color-black">{{ item.title }}</text>
                  </view>
                  <view v-if="item.tags && item.tags.length > 0" class="item__tags-container">
                    <view v-for="(tagItem, tagIndex) in item.tags" :key="tagIndex" class="item__tag">{{ tagItem }}</view>
                  </view>
                </view> -->
						</view>
					</template>
				</tn-waterfall>
				<view @click="onReachBottom()" style="padding-bottom: 100rpx;padding-top: 100rpx;">
					<tn-load-more :status="loadStatus" :loadText="loadText"></tn-load-more>
				</view>
			</view>
			
			<view v-if="ContentListFirstLoading" class="">
				<view class="" style="padding: 6vh 20rpx;">
					<view class="tn-text-center" style="font-size: 200rpx;padding-top: 30rpx;">
						<text class="tn-icon-wea-wind tn-color-gray--light"></text>
					</view>
					<view class="tn-color-gray--disabled tn-text-center tn-text-lg">一大波内容正在路上</view>
				</view>
			</view>
			
		</view>
	</view>
	<!-- #endif -->
</template>

<script>
	import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
	export default {
		name: 'TemplateWallpaper',
		mixins: [template_page_mixin],
		data() {
			return {
				Microi: this.Microi,
				ContentListFirstLoading: true,
				FenleiModel:{},
				ContentList: [],//{}, {}, {}, {}, {}, {}
				DefaultContentList: [],//{}, {}, {}, {}, {}, {}
				PageIndex : 1,
				PageCount : -1,
				show1: false,
				cardCur: 0,
				swiperList: [],

				/* 导航*/
				navBarRectInfo: {},
				navBarChangebaseLineHeight: 0,
				navBarStyle: {
					color: '#FFFFFF',
					opacity: 1,
					display: 'flex'
				},
				navBarStyle2: {
					color: 'rgba(255,255,255,0)',
					opacity: 1,
					display: 'flex'
				},
				navBarBackgroundColor: 'rgba(255, 255, 255, 0)',
				activeBgAnimation: {},

				/* 瀑布流*/
				loadText: {
					loadmore: '下拉加载更多内容',
					loading: '下波内容加载中...',
					nomore: '实再是没有了'
				},
				loadStatus: 'loadmore',
				NeirongFL : '',
			}
		},

		onLoad() {
			var self = this;
			//app取type：self.$mp.page.options.type  或者 self.$options.pageQuery.type
			//小程序取：self.$mp.query.type
			//self.$route.query.type 取不到
			self.NeirongFL = (self.$mp.query && self.$mp.query.type) || (self.$options.pageQuery && self.$options.pageQuery.type);
			if(!self.NeirongFL){
				self.Microi.Tips('参数错误！', false);
				return;
			}
			self.Microi.ApiEngine.Run('get_formdata_cache_anonymous', {
				FormEngineKey : 'diy_category',
				Key : self.NeirongFL
			}, function(result){
				if(self.Microi.CheckResult(result)){
					self.FenleiModel = result.Data;
					self.swiperList.push({
						id: 0,
						type: 'image',
						url: self.Microi.FileServer + self.FenleiModel.FengmianT,
					});
				}
			});
			self.GetContentList({
				ContentListFirstLoading: true
			});
			// this.getRandomData()
		},
		onReachBottom() {
			var self = this;
			// this.getRandomData()
			self.GetContentList({
				PageIndexAdd : true
			});
		},

		onReady() {
			this.$nextTick(() => {
				this.initNavBarRectInfo()
			})
		},
		onPageScroll() {
			this.updateNavBarRectInfo()
		},

		methods: {
			GotoDetail(item) {
				var self = this;
				if(item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo'){
					if(self.Microi.ClientType == 'APP'){
						self.tn('/pageA/nvueSwiper/index?ContentId=' + item.Id, item.Id)
					}
					else if(self.Microi.ClientType == 'H5'){
						self.tn('/pageA/nvueSwiper/nvueSwiper?ContentId=' + item.Id, item.Id)
					}
					else if(self.Microi.ClientType == 'WeChat'){
						//微信小程序需要判断是否已有视频资质
						if(self.Microi.SysConfig.MiniProgramVideo){
							self.tn('/pageA/nvueSwiper/nvueSwiper?ContentId=' + item.Id, item.Id)
						}else{
							self.tn('/pageA/details/details?ContentId=' + item.Id, item.Id)
						}
					}
				}else {
					self.tn('/pageA/details/details?ContentId=' + item.Id, item.Id)
				}
			},
			GetContentList(param, callback) {
				var self = this;
				//如果是首次加载、或整页刷新，将ContentListFirstLoading、PageIndex、PageCount还原为初始值
				if (param && param.ContentListFirstLoading) {
					self.ContentListFirstLoading = true;
					self.PageIndex = 1;
					self.PageCount = -1;
				}
				//如果到了最后一页
				if(self.PageIndex >= self.PageCount && self.PageCount != -1){
					self.loadStatus = 'nomore'
					return;
				}
				self.ContentList = [...self.DefaultContentList];
				this.loadStatus = 'loading'
				var _orderBy = '';
				if (self.current == 1) {
					_orderBy = 'Latest';
				} else if (self.current == 2) {
					_orderBy = 'Hottest';
				}
				var getParam = {
					_SortType: _orderBy,
					// _Where: [{ Name : 'NeirongFL', Value : self.NeirongFL, Type : '=' }]
					NeirongFL : self.NeirongFL
				};
				if(param && param.PageIndexAdd){
					self.PageIndex++;
				}
				getParam._PageIndex = self.PageIndex;
				self.Microi.ApiEngine.Run('get_content_list', getParam, function(result) {
					if (self.Microi.CheckResult(result)) {
						self.ContentList = result.Data;
						self.PageCount = result.PageCount;
					}
					//如果到了最后一页
					if(self.PageIndex >= self.PageCount && self.PageCount != -1){
						self.loadStatus = 'nomore'
					}
					self.ContentListFirstLoading = false;
					if (callback) {
						callback();
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

			// cardSwiper
			cardSwiper(e) {
				this.cardCur = e.detail.current
			},
			// 预览圈子管理员微信图片
			previewQRCodeImage() {
				wx.previewImage({
					urls: ['https://resource.tuniaokj.com/images/advertise/qrcode.jpg']
				})
			},
			// 弹出模态框
			showModal(event) {
				this.openModal()
			},
			// 打开模态框
			openModal() {
				this.show1 = true
			},
			// 初始化导航栏信息
			async initNavBarRectInfo() {
				const navBarRectInfo = await this._tGetRect('#navbar')
				const pageTipsRectInfo = await this._tGetRect('#page_tips')
				// console.log(navBarRectInfo, pageTipsRectInfo, navBarRectInfo?.top, pageTipsRectInfo?.top);
				if (!navBarRectInfo.hasOwnProperty('top') || !pageTipsRectInfo.hasOwnProperty('top')) {
					setTimeout(() => {
						this.initNavBarRectInfo()
					}, 10)
					return
				}
				this.navBarRectInfo = {
					top: navBarRectInfo.top
				}
				this.navBarChangebaseLineHeight = pageTipsRectInfo.top - navBarRectInfo.top
			},
			// 更新导航栏信息
			updateNavBarRectInfo() {
				this._tGetRect('#page_tips').then((res) => {
					const top = res?.top || 0
					if (!top) {
						return
					}
					const differHeight = top - this.navBarRectInfo.top
					const opacity = differHeight / this.navBarChangebaseLineHeight
					if (opacity < 0) {
						// this.navBarStyle.opacity = 1
						// this.navBarStyle.display = 'flex'
						this.navBarStyle.color = 'rgba(0, 0, 0, ${opacity})'
						this.navBarStyle2.color = 'rgba(0, 0, 0, ${opacity})'
						this.navBarBackgroundColor = `rgba(255, 255, 255, 1)`
					} else {
						// this.navBarStyle.opacity = 1 - opacity
						// this.navBarStyle.display = 'flex'
						this.navBarStyle.color = 'rgba(255, 255, 255, 1)'
						this.navBarStyle2.color = 'rgba(255, 255, 255, 0)'
						this.navBarBackgroundColor = `rgba(255, 255, 255, ${1 - opacity})`
					}

					// console.log(top, differHeight, opacity);
				})
			},
			/* 瀑布流*/
			// 获取随机数据
			getRandomData() {
				console.log(13);
				this.loadStatus = 'loading'
				for (let i = 0; i < 10; i++) {
					let index = this.$t.number.randomInt(0, this.data.length - 1)
					let item = JSON.parse(JSON.stringify(this.data[index]))
					item.id = this.$t.uuid()
					this.list.push(item)
				}
			},
			// 瀑布流加载完毕事件
			handleWaterFallFinish() {
				this.loadStatus = 'loadmore'
			},
		}
	}
</script>

<style lang="scss" scoped>
	.content-type-icon {
		position: absolute;
		right: 10rpx;
		top: 10rpx;
		width: auto;
		height: 35rpx;
		z-index: 1;
		line-height: 35rpx;
	
		.content-icon {
			font-size: 25rpx;
			color: #fff;
			margin-right: 5rpx;
			// box-shadow: 0px 0px 10px 0px #d5d5d5;
		}
	}
	/* 胶囊*/
	.tn-custom-nav-bar__back {
		width: 100%;
		height: 100%;
		position: relative;
		display: flex;
		justify-content: space-evenly;
		align-items: center;
		box-sizing: border-box;
		background-color: rgba(0, 0, 0, 0.03);
		border-radius: 1000rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.5);
		// color: #FFFFFF;
		font-size: 18px;

		.icon {
			display: block;
			flex: 1;
			margin: auto;
			text-align: center;
		}

		&:before {
			content: " ";
			width: 1rpx;
			height: 110%;
			position: absolute;
			top: 22.5%;
			left: 0;
			right: 0;
			margin: auto;
			transform: scale(0.5);
			transform-origin: 0 0;
			pointer-events: none;
			box-sizing: border-box;
			opacity: 0.05;
			background-color: #000000;
		}
	}

	/* 内容 start*/
	.tn-plan-content {
		&__item {
			display: inline-block;
			line-height: 45rpx;
			padding: 10rpx 30rpx;
			margin: 20rpx 20rpx 5rpx 0rpx;

			&--prefix {
				padding-right: 10rpx;
			}
		}
	}

	/* 内容 end*/

	/* 轮播视觉差 start */
	.card-swiper {
		height: 500rpx !important;
	}

	.card-swiper swiper-item {
		width: 750rpx !important;
		left: 0rpx;
		box-sizing: border-box;
		// padding: 0rpx 30rpx 90rpx 30rpx;
		overflow: initial;
	}

	.card-swiper swiper-item .swiper-item {
		width: 100%;
		display: block;
		height: 100%;
		transform: scale(1);
		transition: all 0.2s ease-in 0s;
		will-change: transform;
		overflow: hidden;
	}

	.card-swiper swiper-item.cur .swiper-item {
		transform: none;
		transition: all 0.2s ease-in 0s;
		will-change: transform;
	}

	.image-banner {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.image-banner image {
		width: 100%;
		height: 100%;
	}

	/* 轮播指示点 start*/
	.indication {
		z-index: 9999;
		width: 100%;
		height: 36rpx;
		position: absolute;
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		opacity: 0;
	}

	.spot {
		background-color: #FFFFFF;
		opacity: 0.6;
		width: 10rpx;
		height: 10rpx;
		border-radius: 20rpx;
		top: -60rpx;
		margin: 0 8rpx !important;
		position: relative;
	}

	.spot.active {
		opacity: 1;
		width: 30rpx;
		background-color: #FFFFFF;
	}

	/* 顶部店铺 */
	.shop-function {
		position: relative;
		z-index: 1;
		margin-top: -450rpx;
		padding-bottom: 110rpx;
		background-image: linear-gradient(rgba(255, 255, 255, 0.01), rgba(0, 0, 0, 0.4));
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
		border: 6rpx solid rgba(255, 255, 255, 0.25);
		box-shadow: 0rpx 0rpx 80rpx 0rpx rgba(0, 0, 0, 0.15);
		border-radius: 50%;
		overflow: hidden;
		// background-color: #FFFFFF;
	}

	/* 内容*/
	.group-wrap {
		position: relative;
		z-index: 1;
		// padding: 20rpx 30rpx;
		margin-top: -125rpx;
		margin-bottom: 40rpx;
		border-radius: 30rpx 30rpx 0 0;
	}

	/* 阴影 start*/
	.mould-shadow {
		border-radius: 15rpx;
		box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
	}

	.tn-tabbar-height {
		min-height: 20rpx;
		height: calc(40rpx + env(safe-area-inset-bottom) / 2);
	}

	/* 图标容器5 start */
	.icon5 {
		&__item {
			// width: 30%;
			background-color: #FFFFFF;
			border-radius: 10rpx;
			padding: 0rpx;
			margin: 0rpx;
			transform: scale(1);
			transition: transform 0.3s linear;
			transform-origin: center center;

			&--icon {
				width: 96rpx;
				height: 96rpx;
				border-radius: 50%;
				margin-bottom: 18rpx;
				position: relative;
				z-index: 1;
			}
		}
	}


	/* 瀑布流*/
	.product__item {
		background-color: #FFFFFF;
		overflow: hidden;
		margin: 0 10rpx;
		margin-bottom: 20rpx;
		// box-shadow: 0rpx 0rpx 30rpx 0rpx rgba(0, 0, 0, 0.07);

		.item {

			/* 图片 start */
			&__image {
				width: 100%;
				height: auto;
				background-color: #FFFFFF;
				border: 1rpx solid #F8F7F8;
				border-radius: 10rpx;
				overflow: hidden;
			}

			/* 图片 end */

			/* 内容 start */
			&__data {
				padding: 14rpx 0rpx;
			}

			/* 标题 start */
			&__title-container {
				text-align: justify;
				line-height: 38rpx;
				vertical-align: middle;
			}

			&__store-type {
				height: 28rpx;
				font-size: 20rpx;
				position: relative;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				padding: 4rpx;
				border-radius: 6rpx;
				white-space: nowrap;
				text-align: center;
				top: -2rpx;
				margin-right: 6rpx;
			}

			&__title {
				font-size: 30rpx;
			}

			/* 标题 end */

			/* 标签 start */
			&__tags-container {
				display: flex;
				flex-direction: row;
				flex-wrap: nowrap;
				align-items: center;
				justify-content: flex-start;
			}

			&__tag {
				margin: 10rpx;
				color: #7C8191;
				background-color: #F3F2F7;
				padding: 4rpx 14rpx 6rpx;
				border-radius: 10rpx;
				font-size: 20rpx;

				&:first-child {
					margin-left: 0rpx !important;
				}
			}

			/* 标签 end */
			/* 内容 end */
		}
	}
</style>