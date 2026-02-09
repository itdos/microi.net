<template>
  <view class="pagesA tn-safe-area-inset-bottom">

    <!-- 顶部自定义导航 -->
    <tn-nav-bar :isBack="false" :bottomShadow="false" backgroundColor="#FFFFFF00">
      <view class="custom-nav tn-flex tn-flex-col-center tn-flex-row-left">
        <view class="custom-nav__logo" @click="tn('')">
          <!-- <view class="tn-icon-menu-grille tn-color-white"></view> -->
          <text class="tn-color-white tn-text-bold" style="font-size: 56rpx;">在线商城</text>
        </view>
        <view class="tn-margin-top-sm">
          <text class="tn-color-white tn-margin-left">综合电商平台</text>
        </view>
      </view>
    </tn-nav-bar>

    <view class="tn-margin-bottom-xl" :style="{paddingTop: vuex_custom_bar_height + 20 + 'px'}">

      <swiper class="card-swiper" :circular="true" :autoplay="true" duration="500" interval="12000"
        previous-margin="80rpx" next-margin="80rpx" @change="cardSwiper">
        <swiper-item v-for="(item,index) in swiperList" :key="index" :class="cardCur==index?'cur':''" @click="tn(item.Lianjie)">
          <view class="swiper-item image-banner">
            <image :src="V8.FileServer + item.YulanT" mode="aspectFill"></image>
          </view>

          <view class="swiper-item-text">
            <view class="tn-padding-sm">
              <view class="tn-text-lg tn-color-white tn-padding-top-xs">{{item.Biaoti}}</view>
              <view class="tn-text-sm tn-text-bold tn-color-white tn-padding-top-sm" style="opacity: 0.5;">{{item.ZibiaoT}}
              </view>
            </view>

          </view>

        </swiper-item>
      </swiper>
      <view class="indication">
        <block v-for="(item,index) in swiperList" :key="index">
          <view class="spot" :class="cardCur==index?'active':''"></view>
        </block>
      </view>


      <!-- 顶部自定义导航 -->
      <view class="" style="width: 100vw;">
        <tn-sticky :offsetTop="0" :customNavHeight="vuex_custom_bar_height">
          <view class="tn-flex tn-flex-col-between tn-flex-col-center tn-padding-top tn-padding-bottom"
            style="background-color: #FFFFFF00;">
            <view class="justify-content-item" style="width: 87vw;overflow: hidden;">
              <tn-tabs :list="scrollList" :current="current" :isScroll="true" activeColor="#FFF"
                inactiveColor="#FFFFFF80" :bold="true" :fontSize="32" :badgeOffset="[20, 50]" @change="tabChange"
                backgroundColor="#FFFFFF00" :height="70"></tn-tabs>
            </view>
            <view class="justify-content-item" style="width: 13vw;overflow: hidden;">
              <picker @change="bindPickerChange" :value="index" :range="array">
                <view class="tn-color-white tn-round" style="font-size: 45rpx;margin-top: -5rpx;margin-left: 15rpx;">
                  <text class="tn-icon-sequence-vertical tn-padding-xs"></text>
                </view>
              </picker>
            </view>


          </view>
        </tn-sticky>
      </view>


      <view class="">

        <!-- 数字模型 start-->
        <view class="tn-flex tn-flex-wrap" style="padding: 0 15rpx;">
          <block v-for="(item, index) in content" :key="index">
            <view class="" style="width: 50%;" @click="tn('../product/product?Id=' + item.Id)">

              <view class="product-content">
                <view class="image-pic"
                  :style="'background-image:url(' + V8.FileServer + (item.YulanT2 || item.YulanT) + ');background-size: cover;background-position: center;'">
                  <view class="image-product">
                    <view class="tn-text-df"
                      style="width: 100%;height: 200rpx;background: linear-gradient(0deg, rgba(0,0,0,0.3), rgba(0,0,0,0));position: absolute;bottom: 0;border-radius: 0 0 12rpx 12rpx;">
                      <view class="tn-padding-top-xl tn-padding-left tn-padding-right tn-color-white clamp-text-1"
                        style="font-size: 30rpx;">{{ item.ShangpinMC }}</view>
                      <view
                        class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding-left tn-padding-right tn-padding-top-xs">
                        <view class="justify-content-item tn-flex tn-flex-col-center tn-color-white"
                          style="margin-left: -6rpx;">
                          <text class="tn-text-lg">￥</text>
                          <text class="tn-padding-right-sm tn-text-lg tn-text-bold" style="font-size: 50rpx;">{{ item.ShangpinJG }}</text>
                          <!-- <text class="tn-text-sm"> 66 人购买</text> -->
                        </view>
                        <view class="justify-content-item tn-flex tn-flex-col-center">
                          <!-- <text class="tn-color-white tn-text-sm"> 12 人购买</text> -->
                          <tn-button size="sm" shape="icon" backgroundColor="#000000" fontColor="tn-color-white"
                            padding="10rpx 0 0 0" shadow>
                            <text class="tn-icon-buy tn-text-lg"></text>
                          </tn-button>
                        </view>
                      </view>
                    </view>
                  </view>
                </view>
              </view>

            </view>
          </block>
        </view>
        <!-- 数字模型 end-->

      </view>

      <!-- <view class="" v-if="current==1">

        <view class="" style="padding: 15vh 20rpx;opacity: 0.6;">
          <view class="tn-text-center" style="font-size: 260rpx;padding-top: 30rpx;">
            <text class="tn-icon-ghost-fill tn-color-gray--light"></text>
          </view>
          <view class="tn-color-gray--disabled tn-text-center tn-text-lg">内容被幽灵卷走了，嘤嘤嘤</view>
        </view>

      </view> -->


     <!-- <view class="" v-if="current==2">

        <view class="" style="padding: 15vh 20rpx;opacity: 0.6;">
          <view class="tn-text-center" style="font-size: 260rpx;padding-top: 30rpx;">
            <text class="tn-icon-ghost-fill tn-color-gray--light"></text>
          </view>
          <view class="tn-color-gray--disabled tn-text-center tn-text-lg">暂无数据</view>
        </view>

      </view> -->

    </view>

    <view class='tn-tabbar-height'></view>
    <view class="bg-tabbar-shadow"></view>
  </view>
</template>

<script>
  export default {
    name: 'PageA',
    data() {
      return {
		  ProductType : 0,
		  DataLoading:true,
        cardCur: 0,
        swiperList: [],
        current: 0,
        scrollList: [{
            name: '合成材料'
          },
          {
            name: '实物'
          },
          // {
          //   name: '合成'
          // }
        ],
        // 筛选
        index: 1,
        array: ['价格从低到高', '价格从高到低'],
        content: [],
      }
    },
	/**
	 * 不触发
	 */
	onLoad() {
	},
	/**
	 * 只有这一个会触发
	 */
	created() {
		var self = this;
		// self.Microi.ApiEngine.Run('get_otc_lunbotu', {}, function(result) {
		// 	if (self.Microi.CheckResult(result))
		// 		self.swiperList = result.Data;
		// })
		self.Init();
	},
	/**
	 * 不触发
	 */
	onShow() {
	},
    methods: {
		Init(){
			var self = this;
			self.GetProductList();
			self.GetSlideshowList();
		},
		GetProductList(isTips){
			var self = this;
			self.content = [];
			self.DataLoading = true;
			self.V8.ApiEngine.Run('get-product-list', {
				ProductType : self.ProductType,
				// _OrderBy : self.SearchParam.OrderBy,
				// _Zhidingwo : self.SearchParam.Zhidingwo,
				// _MairuJFType : self.SearchParam.MairuJFType,
			}, function(result) {
				if (self.V8.CheckResult(result)){
					self.content = result.Data;
					if(isTips){
						self.V8.Tips('刷新成功！')
					}
				}
				self.DataLoading = false;
			})
		},
		GetSlideshowList(){
			var self = this;
			self.V8.ApiEngine.Run('get-slideshow-list', {
			}, function(result) {
				if (self.V8.CheckResult(result)){
					self.swiperList = result.Data;
				}
			})
		},
      // cardSwiper
      cardSwiper(e) {
        this.cardCur = e.detail.current
      },
      // tab选项卡切换
      tabChange(index) {
		  var self = this;
        this.current = index
		self.ProductType = index;
		self.GetProductList();
      },
      // 筛选
      bindPickerChange: function(e) {
        this.index = e.detail.value
		self.GetProductList();
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
  .pagesA {
    max-height: 100vh;
  }

  /* 底部安全边距 start*/
  .tn-tabbar-height {
    min-height: 60rpx;
    height: calc(80rpx + env(safe-area-inset-bottom) / 2);
    height: calc(80rpx + constant(safe-area-inset-bottom));
  }

  /* 底部tabbar假阴影 start*/
  .bg-tabbar-shadow {
    // background-image: repeating-linear-gradient(to top, rgba(0,0,0,0.1) 10rpx, rgba(255,255,255,0) , rgba(255,255,255,0));
    box-shadow: 0rpx 0rpx 220rpx 0rpx rgba(0, 0, 0, 0.55);
    position: fixed;
    bottom: -100rpx;
    height: 100rpx;
    width: 100vw;
    z-index: 1;
  }

  /* 自定义导航栏内容 start */
  .custom-nav {
    height: 100%;

    &__logo {
      margin: auto 5rpx;
      font-size: 50rpx;
      margin-right: 10rpx;
      margin-left: 30rpx;
      flex-basis: 5%;
    }
  }

  /* 自定义导航栏内容 end */


  /* 轮播图片入口 start*/
  .card-swiper {
    height: 25vh !important;
  }

  .card-swiper swiper-item {
    width: 590rpx !important;
    // left: 60rpx;
    box-sizing: border-box;
    padding: 0rpx 0rpx 90rpx 0rpx;
    overflow: initial;
  }

  .card-swiper swiper-item .swiper-item {
    width: 100%;
    display: block;
    height: 100%;
    border-radius: 20rpx;
    transform: scale(0.87);
    transition: all 0.2s ease-in 0s;
    overflow: hidden;
  }

  .card-swiper swiper-item.cur .swiper-item {
    transform: none;
    transition: all 0.2s ease-in 0s;
  }

  .card-swiper swiper-item .swiper-item-text {
    background-color: rgba(0, 0, 0, 0.55);
    position: absolute;
    bottom: 0;
    width: 100%;
    display: block;
    height: 140rpx;
    border-radius: 20rpx;
    transform: translate(0rpx, -120rpx) scale(0.8, 0.8);
    transition: all 0.6s ease 0s;
    overflow: hidden;
    opacity: 0;
  }

  .card-swiper swiper-item.cur .swiper-item-text {
    width: 100%;
    transform: translate(0rpx, -100rpx) scale(0.92, 0.92);
    transition: all 0.6s ease 0s;
    opacity: 1;
  }

  .image-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0rpx 30rpx 60rpx 0rpx rgba(116, 10, 250, 0.08);
  }

  .image-banner image {
    width: 100%;
    height: 100%;
  }

  /* 轮播指示点 start*/
  .indication {
    z-index: 99;
    width: 100%;
    height: 36rpx;
    position: absolute;
    display: flex;
    margin-top: -50rpx;
    flex-direction: row;
    align-items: center;
    justify-content: center;
  }

  .spot {
    background-color: #FFFFFF40;
    opacity: 0.4;
    width: 10rpx;
    height: 10rpx;
    border-radius: 20rpx;
    margin: 0 8rpx !important;
    position: relative;
  }

  .spot.active {
    opacity: 1;
    width: 60rpx;
    background-color: #FFFFFF40;
  }

  /* 数字模型 start*/
  .product-content {
    // box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
    border-radius: 15rpx;
    background-color: rgba(255, 255, 255, 0.08);
    border: 1rpx solid #494B51;
    margin: 15rpx 15rpx;
  }

  .image-product {
    height: 300rpx;
    font-size: 16rpx;
    font-weight: 300;
    position: relative;
  }

  .image-pic {
    background-size: cover;
    background-repeat: no-repeat;
    // background-attachment:fixed;
    background-position: top;
    border-radius: 15rpx;
  }

  /* 数字模型 end*/
</style>