<template>
	<view class="template-index tn-safe-area-inset-bottom">

		<!-- 安卓酷炫顶部自定义导航，为什么要分成安卓和苹果的导航？你试试就知道为什么了，很多骚操作在苹果不生效 -->
		<view v-if="isAndroid" class=""
			style="width: 100%;height: 220rpx;background: linear-gradient(0deg, rgba(255,255,255,0), rgba(0,0,0,0.16));position: fixed;top: 0;z-index: 1;">
			<tn-nav-bar fixed :isBack="false" :bottomShadow="false" backgroundColor="#FFFFFF00">
				<view class="custom-nav tn-flex tn-flex-col-center tn-flex-row-left">
					<!-- 图标logo -->
					 <!-- @click="tn('/homePages/about')" -->
					<view class="custom-nav__back">
						<!-- 图片模式-->
						<!-- https://resource.tuniaokj.com/images/logo/logo2.png -->
						<view class="logo-pic tn-shadow-blur"
							:style="{backgroundImage: `url(${Microi.FileServer + '/huayu/img/upload/logo.jpeg'})`}">
							<view class="logo-image">
							</view>
						</view>
						<!-- 如果有图片那就放图片，如果没有，那就删掉上面的放字体icon -->
						<!-- <view class="tn-icon-left"></view> -->
					</view>
					<!-- 搜索框 -->
					<view v-if="false" class="custom-nav__search tn-flex tn-flex-col-center tn-flex-row-center"
						@click="tn('/homePages/search')">
						<view class="custom-nav__search__box tn-flex tn-flex-col-center tn-flex-row-left"
							style="background-color: rgba(230,230,230,0.3);">
							<!-- <view class="custom-nav__search__icon tn-icon-search tn-color-white"></view>
              <view class="custom-nav__search__text tn-padding-left-xs tn-color-white">搜索 图鸟模板</view> -->
							<view class="tn-color-white" style="width: 100%;">
								<tn-notice-bar :list="searlist" mode="vertical" leftIconName="search"
									:duration="6000"></tn-notice-bar>
							</view>
						</view>
					</view>
				</view>
			</tn-nav-bar>
		</view>


		<!-- 苹果简单顶部自定义导航 -->
		<view v-else class="">

			<tn-nav-bar fixed :isBack="false" :bottomShadow="false" backgroundColor="#FFFFFF00">
				<view class="custom-nav tn-flex tn-flex-col-center tn-flex-row-left">
					<!-- 图标logo -->
					<!-- @click="tn('/homePages/about')" -->
					<view class="custom-nav__back" >
						<!-- 图片模式-->
						<!-- background-image:url('https://resource.tuniaokj.com/images/logo/logo2.png') -->
						<view class="logo-pic tn-shadow-blur"
							:style="{backgroundImage: `url(${Microi.FileServer + '/huayu/img/upload/logo.jpeg'})`}">
							<view class="logo-image">
							</view>
						</view>
						<!-- 如果有图片那就放图片，如果没有，那就删掉上面的放字体icon -->
						<!-- <view class="tn-icon-left"></view> -->
					</view>
					<!-- 搜索框 -->
					<view v-if="false" class="custom-nav__search tn-flex tn-flex-col-center tn-flex-row-center"
						@click="tn('/homePages/search')">
						<view class="custom-nav__search__box tn-flex tn-flex-col-center tn-flex-row-left"
							style="background-color: rgba(230,230,230,0.3);">
							<!-- <view class="custom-nav__search__icon tn-icon-search tn-color-white"></view>
              <view class="custom-nav__search__text tn-padding-left-xs tn-color-white">搜索 图鸟模板</view> -->
							<view class="tn-color-white" style="width: 100%;">
								<tn-notice-bar :list="searlist" mode="vertical" leftIconName="search"
									:duration="6000"></tn-notice-bar>
							</view>
						</view>
					</view>
				</view>
			</tn-nav-bar>
		</view>

		<!-- 轮播banner-->
		<swiper class="card-swiper" @click="tn('')" :circular="true" :autoplay="true" duration="500" interval="8000"
			@change="cardSwiper">
			<swiper-item v-for="(item,index) in LunbotuList" :key="index" :class="cardCur==index?'cur':''">
				<view class="swiper-item image-banner">
					 <!-- v-if="item.type=='image'" -->
					<image :src="Microi.FileServer + item.Tupian" mode="aspectFill"></image>
				</view>
				<view class="swiper-item-text">
					<view class="tn-text-bold tn-color-white" style="font-size: 90rpx;">{{item.Biaoti}}</view>
					<view class="tn-color-white tn-padding-top" style="font-size: 30rpx;">{{item.FubiaoT}}</view>
					<!-- <view class="tn-text-sm tn-text-bold tn-color-white tn-padding-top-sm tn-padding-bottom-sm">
						{{111}}
					</view> -->
				</view>
			</swiper-item>
		</swiper>
		<view class="indication">
			<block v-for="(item,index) in LunbotuList.length" :key="index">
				<view class="spot" :class="cardCur==index?'active':''"></view>
			</block>
		</view>


		<!-- 通知-->
		<view class="tn-bg-white tn-margin-top" style="border-radius: 20rpx;">
			<tn-notice-bar :list="OutSideNoticeList" mode="vertical" leftIconName="notice"></tn-notice-bar>
		</view>

		<!-- 金刚区 start-->
		<view class="tn-flex tn-padding-top tn-margin-bottom tn-margin-top-xs">
			<!-- @click="tn('/homePages/brand')" -->
			<view class="tn-flex-1 tn-radius"  style="width: 20%;"
				@click="Microi.Tips('即将上线！')">
				<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
					<view
						class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur tn-bg-blue tn-color-white">
						<view class="tn-icon-plant-fill"></view>
					</view>
					<view class="tn-color-gray--dark tn-text-center tn-text-df">
						<text class="tn-text-ellipsis">品牌介绍</text>
					</view>
				</view>
			</view>
			<!-- @click="tn('/homePages/cooperate')" -->
			<view class="tn-flex-1 tn-radius"  style="width: 20%;"
				@click="Microi.Tips('即将上线！')">
				<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
					<view
						class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur tn-bg-cyan tn-color-white">
						<view class="tn-icon-trusty-fill"></view>
					</view>
					<view class="tn-color-gray--dark tn-text-center tn-text-df">
						<text class="tn-text-ellipsis">合作共赢</text>
					</view>
				</view>
			</view>
			<!-- @click="tn('/homePages/group')" -->
			<view class="tn-flex-1 tn-radius"  style="width: 20%;"
				@click="Microi.Tips('即将上线！')">
				<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
					<view
						class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur tn-bg-red tn-color-white">
						<view class="tn-icon-flower-fill"></view>
					</view>
					<view class="tn-color-gray--dark tn-text-center tn-text-df">
						<text class="tn-text-ellipsis">话题社区</text>
					</view>
				</view>
			</view>
			<!-- @click="tn('/commPages/nav')" -->
			<view class="tn-flex-1 tn-radius"  style="width: 20%;"
				@click="Microi.Tips('即将上线！')">
				<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
					<view
						class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur tn-bg-orange tn-color-white">
						<view class="tn-icon-discover-fill"></view>
					</view>
					<view class="tn-color-gray--dark tn-text-center tn-text-df">
						<text class="tn-text-ellipsis">案例欣赏</text>
					</view>
				</view>
			</view>
			<!-- <view class="tn-flex-1 tn-radius" @click="tn('')" style="width: 20%;">
        <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
          <view class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur tn-bg-purple tn-color-white">
            <view class="tn-icon-menu-circle-fill"></view>
          </view>  
          <view class="tn-color-gray--dark tn-text-center tn-text-df">
            <text class="tn-text-ellipsis">敬请期待</text>
          </view>
        </view>
      </view> -->
		</view>
		<!-- 金刚区 end-->


		<!-- 胶囊banner -->
		<!-- @click="tn('/homePages/member')" -->
		<!-- @click="tn('/minePages/order')" -->
		<view class="tn-flex tn-flex-wrap tn-padding-xs tn-margin-top" 
			@click="Microi.Tips('即将上线！')"
			>
			<view class="" style="width: 100%;">
				<view class="image-piccapsule tn-shadow-blur"
					:style="{backgroundImage: 'url(' + Microi.FileServer + '/huayu/img/upload/初始化空层.png' + ')'}">
					<view class="image-capsule">
					</view>
				</view>
			</view>
		</view>

		<!-- 标题-->
		<view class="tn-flex tn-flex-row-between tn-flex-col-center tn-margin-top" @click="tn('')">
			<view class="justify-content-item tn-margin tn-text-bold tn-text-xl blue-title">
				热门案例
			</view>
			<!-- <view class="justify-content-item tn-margin-right tn-text-df tn-color-gray">
				<text class="tn-padding-xs">更多</text>
				<text class="tn-icon-right"></text>
			</view> -->
		</view>

		<!-- 热图推荐-->
		<view class="tn-flex tn-margin-left tn-margin-right tn-margin-top tn-margin-bottom-xl"
			>
			<view class="tn-flex-2"
				@click="tn('/discoveryPages/case?Id=' + TopList.CaseList[0].Id)">
				<view class="image-pic tn-margin-right tn-shadow-blur"
					:style="{backgroundImage: 'url(' + Microi.FileServer + TopList.CaseList[0].YulanT + ')'}"
					style="background-size: cover;background-position: center center;">
					<view class="image-tuniao1">
					</view>
				</view>
			</view>
			<view class="tn-flex-1">
				<view class="image-pic tn-shadow-blur"
					@click="tn('/discoveryPages/case?Id=' + TopList.CaseList[1].Id)"
					:style="{backgroundImage: 'url(' + Microi.FileServer + TopList.CaseList[1].YulanT + ')'}"
					style="background-size: cover;background-position: center center;">
					<view class="image-tuniao2">
					</view>
				</view>
				<view class="image-pic tn-margin-top tn-shadow-blur"
					@click="tn('/discoveryPages/case?Id=' + TopList.CaseList[2].Id)"
					:style="{backgroundImage: 'url(' + Microi.FileServer + TopList.CaseList[2].YulanT + ')'}"
					style="background-size: cover;background-position: center center;">
					<view class="image-tuniao2">
					</view>
				</view>
			</view>
		</view>
		
		<!-- 标题-->
		<view class="tn-flex tn-flex-row-between tn-flex-col-center tn-margin-top" @click="tn('')">
			<view class="justify-content-item tn-margin tn-text-bold tn-text-xl blue-title">
				热门产品
			</view>
			<!-- <view class="justify-content-item tn-margin-right tn-text-df tn-color-gray">
				<text class="tn-padding-xs" @click="Microi.NavigateTo('', false)">更多</text>
				<text class="tn-icon-right"></text>
			</view> -->
		</view>
		
		<!-- 热图推荐-->
		<view class="tn-flex tn-margin-left tn-margin-right tn-margin-top tn-margin-bottom-xl"
			>
			<view class="tn-flex-2">
				<view class="image-pic tn-margin-right tn-shadow-blur"
					@click="tn('/commPages/product?Id=' + TopList.ProductList[0].Id)"
					:style="{backgroundImage: 'url(' + Microi.FileServer + TopList.ProductList[0].FengmianT + ')'}"
					style="background-size: cover;background-position: center center;">
					<view class="image-tuniao1">
					</view>
				</view>
			</view>
			<view class="tn-flex-1">
				<view class="image-pic tn-shadow-blur"
					@click="tn('/commPages/product?Id=' + TopList.ProductList[1].Id)"
					:style="{backgroundImage: 'url(' + Microi.FileServer + TopList.ProductList[1].FengmianT + ')'}"
					style="background-size: cover;background-position: center center;">
					<view class="image-tuniao2">
					</view>
				</view>
				<view class="image-pic tn-margin-top tn-shadow-blur"
					@click="tn('/commPages/product?Id=' + TopList.ProductList[2].Id)"
					:style="{backgroundImage: 'url(' + Microi.FileServer + TopList.ProductList[2].FengmianT + ')'}"
					style="background-size: cover;background-position: center center;">
					<view class="image-tuniao2">
					</view>
				</view>
			</view>
		</view>

		<!-- 标题-->
		<view class="tn-flex tn-flex-row-between tn-flex-col-center tn-margin-top" @click="tn('')">
			<view class="justify-content-item tn-margin tn-text-bold tn-text-xl blue-title">
				关于我们
			</view>
			<!-- <view class="justify-content-item tn-margin-right tn-text-df tn-color-gray">
				<text class="tn-padding-xs">更多</text>
				<text class="tn-icon-right"></text>
			</view> -->
		</view>

		<!-- 功能入口-->
		<view
			class="tn-info__container tn-flex tn-flex-wrap tn-flex-col-center tn-flex-row-between tn-margin-left tn-margin-right">
			<block v-for="(item, index) in tuniaoData" :key="index"
				>
				<!-- 
				@click="tn(item.url)" 
				@click="Microi.Tips('即将上线！')"
				-->
				<view
					@click="tn(item.url)"
					class="tn-info__item tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between tn-color-white tn-shadow-blur"
					:style="'background-color:'+ item.color +';'" >
					<view class="tn-info__item__left tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-left">
						<!-- <view class="tn-info__item__left--icon tn-flex tn-flex-col-center tn-flex-row-center">
              <view :class="[`tn-icon-${item.icon}`]"></view>
            </view> -->
						<view class="tn-info__item__left__content">
							<view class="tn-info__item__left__content--title tn-text-bold" style="font-size: 38rpx;">
								{{ item.title }}</view>
							<view class="tn-info__item__left__content--data tn-padding-top-xs">
								{{ item.value }}
								<text class="tn-icon-right tn-padding-left-xs"></text>
							</view>
						</view>
					</view>
					<view class="tn-info__item__right">
						<view class="tn-info__item__right--icon">
							<view :class="[`tn-icon-${item.icon}`]"></view>
						</view>
					</view>
					<view class="tn-info__item__bottom">
						<view class='name tn-text-sm tn-color-gray' style="margin-left: -10rpx;">
							<text class="tn-icon-code tn-padding-right-xs" style="opacity: 0;"></text>
						</view>
					</view>
				</view>
			</block>
		</view>

		<view class='tn-tabbar-height'></view>

	</view>
</template>

<script>
	export default {
		name: 'Home',
		data() {
			return {
				Microi: this.Microi,
				LunbotuList:[],
				TopList:{
					ProductList : [{},{},{}],
					CaseList : [{},{},{}],
				},
				cardCur: 0,
				isAndroid: true,
				OutSideNoticeList: [
				],

				searlist: [
					'搜索 登录注册模板',
					'搜索 新建表单模板',
					'搜索 对话聊天模板',
					'搜索 个人中心模板'
				],

				tuniaoData: [{
						title: '企业文化',
						icon: 'image-text-fill',
						color: '#5177EE',
						value: '查看详情',
						url: '/homePages/culture'
					},
					{
						title: '发展历程',
						icon: 'calendar-fill',
						color: '#19cf8a',
						value: '查看详情',
						url: '/homePages/history'
					},
					{
						title: '集体相册',
						icon: 'image-fill',
						color: '#5F4FD9',
						value: '查看详情',
						url: '/homePages/photo'
					},
					{
						title: '宣传短片',
						icon: 'theme-fill',
						color: '#954FF6',
						value: '查看详情',
						url: '/homePages/video'
					},
					{
						title: '荣誉证书',
						icon: 'trophy-fill',
						color: '#F33F5A',
						value: '查看详情',
						url: '/homePages/honor'
					},
					{
						title: '公司地址',
						icon: 'location-fill',
						color: '#FF7043',
						value: '查看详情',
						url: '/homePages/map'
					}
				],
			}
		},
		created() {
			var self = this;
			const systemInfo = uni.getSystemInfoSync()
			if (systemInfo.system.toLocaleLowerCase().includes('ios')) {
				this.isAndroid = false
			} else {
				this.isAndroid = true
			}
			self.GetIndexLunbotu();
			self.GetNoticeOutside();
			self.GetIndexTop();
		},
		methods: {
			GetIndexTop(){
				var self = this;
				self.Microi.ApiEngine.Run('get_index_top', {
				}, function(result){
					if(self.Microi.CheckResult(result)){
						result.Data.ProductList.forEach(item => {
							if(!item.FengmianT){
								item.FengmianT = self.Microi.AppLogo;
							}
						});
						result.Data.CaseList.forEach(item => {
							if(!item.YulanT){
								item.YulanT = self.Microi.AppLogo;
							}
						});
						
						self.TopList = result.Data;
					}
				});
			},
			GetIndexLunbotu(){
				var self = this;
				self.Microi.ApiEngine.Run('get_slideshow', {
					_Type : 'Index'
				}, function(result){
					if(self.Microi.CheckResult(result)){
						self.LunbotuList = result.Data;
					}
				});
			},
			GetNoticeOutside(){
				var self = this;
				self.Microi.ApiEngine.Run('get_notice_outside', {
				}, function(result){
					if(self.Microi.CheckResult(result)){
						var list = [];
						result.Data.forEach(item => {
							list.push(item.Biaoti);
						});
						self.OutSideNoticeList = list;
					}
				});
			},
			// cardSwiper
			cardSwiper(e) {
				this.cardCur = e.detail.current
			},
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
	.template-index {
		max-height: 100vh;
	}

	.tn-tabbar-height {
		min-height: 100rpx;
		height: calc(120rpx + env(safe-area-inset-bottom) / 2);
	}

	/* 阴影*/
	.home-shadow {
		box-shadow: 0rpx 0rpx 80rpx 0rpx rgba(0, 0, 0, 0.07);
	}

	/* 自定义导航栏内容 start */
	.custom-nav {
		height: 100%;

		&__back {
			margin: auto 5rpx;
			font-size: 40rpx;
			margin-right: 10rpx;
			margin-left: 30rpx;
			flex-basis: 5%;
		}

		&__search {
			flex-basis: 60%;
			width: 100%;
			height: 100%;

			&__box {
				width: 100%;
				height: 70%;
				padding: 10rpx 0;
				margin: 0 30rpx;
				border-radius: 60rpx 60rpx 0 60rpx;
				font-size: 24rpx;
			}

			&__icon {
				padding-right: 10rpx;
				margin-left: 20rpx;
				font-size: 30rpx;
			}

			&__text {
				// color: #AAAAAA;
			}
		}
	}

	.logo-image {
		width: 65rpx;
		height: 65rpx;
		position: relative;
	}

	.logo-pic {
		background-size: cover;
		background-repeat: no-repeat;
		// background-attachment:fixed;
		background-position: top;
		border-radius: 50%;
	}

	/* 自定义导航栏内容 end */


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

	.card-swiper swiper-item .swiper-item-text {
		margin-top: -300rpx;
		text-align: center;
		width: 100%;
		display: block;
		height: 50%;
		border-radius: 10rpx;
		transform: translate(100rpx, 0rpx) scale(0.9, 0.9);
		transition: all 0.6s ease 0s;
		will-change: transform;
		overflow: hidden;
	}

	.card-swiper swiper-item.cur .swiper-item-text {
		margin-top: -300rpx;
		width: 100%;
		transform: translate(0rpx, 0rpx) scale(0.9, 0.9);
		transition: all 0.6s ease 0s;
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
	}

	.spot {
		background-color: #FFFFFF;
		opacity: 0.4;
		width: 10rpx;
		height: 10rpx;
		border-radius: 20rpx;
		top: -60rpx;
		margin: 0 8rpx !important;
		position: relative;
	}

	.spot.active {
		opacity: 0.6;
		width: 30rpx;
		background-color: #FFFFFF;
	}

	/* 资讯主图 start*/
	.image-article {
		border-radius: 8rpx;
		width: 220rpx;
		height: 120rpx;
		position: relative;
	}

	.image-pic {
		// border: 1rpx solid #F8F7F8;
		background-size: cover;
		background-repeat: no-repeat;
		// background-attachment:fixed;
		background-position: top;
		border-radius: 10rpx;
	}

	/* 文字截取*/
	.clamp-text-1 {
		-webkit-line-clamp: 1;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		text-overflow: ellipsis;
		overflow: hidden;
	}

	.clamp-text-2 {
		-webkit-line-clamp: 2;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		text-overflow: ellipsis;
		overflow: hidden;
	}

	.blue-title::before {
		content: "";
		position: absolute;
		display: block;
		width: 80rpx;
		height: 26rpx;
		background: #269EFC;
		margin-top: 24rpx;
		margin-left: 75rpx;
		opacity: 0.3;
		z-index: -1;
		border-radius: 4rpx;
	}


	.icon12 {
		&__item {
			transform: scale(1);
			transition: transform 0.3s linear;
			transform-origin: center center;

			&--icon {
				width: 100rpx;
				height: 100rpx;
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
					background-image: url(https://resource.tuniaokj.com/images/cool_bg_image/icon_bg2.png);


				}
			}
		}
	}


	/* 热门图片 start*/
	.image-tuniao1 {
		padding: 164rpx 0rpx 162rpx 0rpx;
		font-size: 40rpx;
		font-weight: 300;
		position: relative;
	}

	.image-tuniao2 {
		padding: 74rpx 0rpx;
		font-size: 40rpx;
		font-weight: 300;
		position: relative;
	}

	.image-tuniao3 {
		padding: 90rpx 0rpx;
		font-size: 40rpx;
		font-weight: 300;
		position: relative;
	}

	.image-pic {
		background-size: cover;
		background-repeat: no-repeat;
		// background-attachment:fixed;
		background-position: top;
		border-radius: 10rpx;
	}

	/* 胶囊banner*/
	.image-capsule {
		padding: 100rpx 0rpx;
		font-size: 40rpx;
		font-weight: 300;
		position: relative;
	}

	.image-piccapsule {
		background-size: cover;
		background-repeat: no-repeat;
		// background-attachment:fixed;
		background-position: top;
		border-radius: 20rpx 20rpx 0 0;
	}

	/* 工作区展示 start */
	.tn-info {

		&__container {
			margin-top: 10rpx;
			margin-bottom: 50rpx;
		}

		&__item {
			width: 47.7%;
			margin: 15rpx 0rpx 30rpx 0rpx;
			padding: 40rpx 30rpx;
			border-radius: 10rpx;


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
				background-image: url(https://resource.tuniaokj.com/images/cool_bg_image/2.png);
			}

			&__left {

				&--icon {
					width: 80rpx;
					height: 80rpx;
					border-radius: 50%;
					font-size: 40rpx;
					margin-right: 20rpx;
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
						background-image: url(https://resource.tuniaokj.com/images/cool_bg_image/icon_bg5.png);
					}
				}

				&__content {
					font-size: 25rpx;

					&--data {
						color: rgba(255, 255, 255, 0.5);
						margin-top: 5rpx;
						// font-weight: bold;
					}
				}
			}

			&__right {
				&--icon {
					position: absolute;
					right: 0rpx;
					top: 50rpx;
					font-size: 100rpx;
					width: 108rpx;
					height: 108rpx;
					text-align: center;
					line-height: 60rpx;
					opacity: 0.15;
				}
			}

			&__bottom {
				box-shadow: 0rpx 0rpx 30rpx 0rpx rgba(0, 0, 0, 0.12);
				border-radius: 0 0 10rpx 10rpx;
				position: absolute;
				width: 85%;
				line-height: 15rpx;
				left: 50%;
				bottom: -15rpx;
				transform: translateX(-50%);
				z-index: -1;
				text-align: center;
			}
		}
	}

	/* 工作区展示 end */
</style>