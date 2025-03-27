<template>
  <view class="tn-safe-area-inset-bottom">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed alpha customBack>
      <view slot="back" class='tn-custom-nav-bar__back'
        @click="goBack">
        <text class='icon tn-icon-left'></text>
        <text class='icon tn-icon-home-capsule-fill'></text>
      </view>
    </tn-nav-bar>
    
    <view class="tn-color-white">
      <!-- <view class="icon15__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur button-3" @tap="showLandscape">
        <view class="tn-icon-level"></view>
      </view> -->
      <!-- <view class="icon15__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur button-2" @click="tn('/pageA/author/author')">
        <view class="tn-icon-my"></view>
      </view> -->
      <!-- 点击一下，然后变成上传的图，主要是用于对比上传的图和生成的图-->
      <view class="icon15__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur button-1" @click="tn('')">
        <view class="tn-icon-iot-fill"></view>
      </view>
    </view> 
    
    <view class="tn-margin" :style="{paddingTop: vuex_custom_bar_height + 10 + 'px'}">
      <!-- 比例图文 start-->
      <view class="tn-flex tn-flex-wrap tn-padding-bottom">
        <view class="" style="width: 100%;">
          <view class="img-shadow">
            <view class="image-picbook" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1663570648149-assets/web-upload/767ea598-7700-4b91-8a1f-dde40dd0a671.jpeg');">
              <view class="image-book">
              </view>
            </view> 
          </view>
        </view>  
      </view>
      <!-- 比例图文 end-->
    </view>
    
    
    <!-- 底部tabbar start-->
    <view class="tabbar footerfixed dd-glass tn-color-white" style="border-radius: 100rpx;">
      <view class="action">
        <view class="bar-icon">
          <view class="tn-icon-delete">
          </view>
          <!-- <image class="" src='https://resource.tuniaokj.com/images/tabbar/a1.png'></image> -->
        </view>
        <view class="">删除记录</view>
      </view>
      <view class="action">
        <view class="bar-icon">
          <view class="tn-icon-download">
          </view>
          <!-- <image class="" src='https://resource.tuniaokj.com/images/tabbar/k2.png'></image> -->
        </view>
        <view class="">下载原图</view>
      </view>
      <view class="action">
        <view class="bar-icon">
          <view class="tn-icon-rocket">
          </view>
          <!-- <image class="" src='https://resource.tuniaokj.com/images/tabbar/i2.png'></image> -->
        </view>
        <view class="">发布广场</view>
      </view>
      <view class="action">
        <view class="bar-icon">
          <view class="tn-icon-circle-arrow">
          </view>
          <!-- <image class="" src='https://resource.tuniaokj.com/images/tabbar/d2.png'></image> -->
        </view>
        <view class="">重新创作</view>
      </view>
    </view>
    
    <!-- 压屏窗-->
    <tn-landscape :show="show1" @close="closeLandscape" closePosition="bottom" :closeSize="60">
      <view class="tn-color-white" style="width: 100vw;">
        
        <view class="" style="margin: 120rpx 60rpx;">
          <view class="tn-flex tn-flex-col-top">
        
            <view class="">
              <view class="logo-pic tn-shadow">
                <view class="logo-image">
                  <view class="tn-shadow-blur" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1664005699053-assets/web-upload/8645ea3a-e0a9-4422-8364-cc5ede305c9f.jpeg');width: 100rpx;height: 100rpx;background-size: cover;">
                  </view>
                </view>
              </view>
              <view class="tn-icon-sex-male" style="position: absolute;margin: -105rpx 0 0 72rpx;border-radius: 100rpx;background-color: #FFFFFF;color: #FF71D2;padding: 5rpx;"></view>
            </view>
            <view class="tn-padding-left-sm tn-padding-top-xs" style="width: 100%;">
              <view class="tn-flex tn-flex-row-between tn-flex-col-between">
                <view class="justify-content-item">
                  <text class="tn-text-lg tn-text-bold">不许凶我</text>
                  <text class="tn-padding-left-sm tn-padding-right-xs">天使座</text>
                  <text class="tn-icon-con-virgo"></text>
                </view>
                <!-- <view class="justify-content-item tn-round tn-text-xs tn-bg-orangered--light tn-color-orangered" style="padding: 5rpx 15rpx;">
                  <text class="tn-icon-warning-fill tn-padding-right-xs"></text> 举报
                </view> -->
              </view>
              <view class="tn-padding-top-xs">
                <view class="">
                  <text class="tn-text-df tn-color-gray--light">2022-12-30 16:23</text>
                </view>
              </view>
            </view>
          </view>
        
          
          <view class="tn-flex tn-flex-row-between tn-flex-col-between tn-margin-top-xl tn-text-justify">
            <text class="">人生就是这样，得意淡然，失意坦然；喜而不狂，忧而不伤</text>
          </view>
        </view>
  
        
      </view>
    </tn-landscape>
    
  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  export default {
    name: 'TemplateResult',
    mixins: [template_page_mixin],
    data(){
      return {
        show1: false,
        }
    },
    methods: {
      // 跳转
      tn(e) {
        uni.navigateTo({
          url: e,
        });
      },
      
      // 弹出压屏窗
      showLandscape() {
        this.openLandscape()
      },
      // 打开压屏窗
      openLandscape() {
        this.show1 = true
      },
      // 关闭压屏窗
      closeLandscape() {
        this.show1 = false
      },
    }
  }
</script>

<style lang="scss" scoped>
  /* 胶囊*/
  .tn-custom-nav-bar__back {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    justify-content: space-evenly;
    align-items: center;
    box-sizing: border-box;
    background-color: rgba(0, 0, 0, 0.15);
    border-radius: 1000rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.5);
    color: #FFFFFF;
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
      opacity: 0.7;
      background-color: #FFFFFF;
    }
  }  
  
  /* 页面阴影 start*/
  .img-shadow {
    border-radius: 15rpx;
    box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
  }
    
  .image-book{
    padding: 345rpx 0rpx;
    font-size: 16rpx;
    font-weight: 300;
    position: relative;
  }
  .image-picbook{
    background-size: cover;
    background-repeat:no-repeat;
    // background-attachment:fixed;
    background-position:top;
    border-radius: 10rpx;
    // clip-path: polygon(160rpx 0, 100% 0, 100% 100%, 0 100%, 0 60rpx,145rpx 50rpx);
  }
  /* 文章内容 end*/
  
  /* 图标容器15 start */
  .icon15 {
    &__item {
      width: 30%;
      
      border-radius: 10rpx;
      padding: 30rpx;
      margin: 20rpx 10rpx;
      transform: scale(1);
      transition: transform 0.3s linear;
      transform-origin: center center;
      
      &--icon {
        width: 100rpx;
        height: 100rpx;
        font-size: 50rpx;
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
  
  /* 按钮 */
  .button-1 {
    background-color: rgba(0, 0, 0, 0.15);
    position: fixed;
    /* bottom:200rpx;
      right: 20rpx; */
    top: 25%;
    right: 30rpx;
    z-index: 1001;
    border-radius: 100px;
  }
  .button-2 {
    background-color: rgba(0, 0, 0, 0.15);
    position: fixed;
    /* bottom:200rpx;
      right: 20rpx; */
    top: 35%;
    right: 30rpx;
    z-index: 1001;
    border-radius: 100px;
  }
  .button-3 {
    background-color: rgba(0, 0, 0, 0.15);
    position: fixed;
    /* bottom:200rpx;
      right: 20rpx; */
    top: 45%;
    right: 30rpx;
    z-index: 1001;
    border-radius: 100px;
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
    border: 6rpx solid rgba(255,255,255,0.25);
    box-shadow: 0rpx 0rpx 80rpx 0rpx rgba(0, 0, 0, 0.15);
    border-radius: 50%;
    overflow: hidden;
    // background-color: #FFFFFF;
  }
    
  /* 底部tabbar start*/
  /* 毛玻璃*/
  .dd-glass {
     width: 100%;
     backdrop-filter: blur(20rpx);
    -webkit-backdrop-filter: blur(20rpx);
  }
  
  .footerfixed{
   position: fixed;
   // margin: 20rpx;
   margin: 40rpx 5%;
   width: 90%;
   bottom: calc(env(safe-area-inset-bottom) / 2);;
   z-index: 999;
   background-color: rgba(0, 0, 0, 0.15);
   box-shadow: 0rpx 0rpx 30rpx 0rpx rgba(0, 0, 0, 0.07);
  }
  
  .tabbar {
    display: flex;
    align-items: center;
    min-height: 110rpx;
    justify-content: space-between;
  	padding: 0;
  	height: calc(110rpx + env(safe-area-inset-bottom) / 2);
  	// padding-bottom: calc(env(safe-area-inset-bottom) / 2);
  }
  
  .tabbar .action {
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
  }
  
  .tabbar .action .bar-icon {
  	width: 100rpx;
  	position: relative;
  	display: block;
  	height: auto;
  	margin: 0 auto 10rpx;
  	text-align: center;
  	font-size: 42rpx;
  }
  
  .tabbar .action .bar-icon image {
  	width: 50rpx;
  	height: 50rpx;
  	display: inline-block;
  }  
    
</style>
