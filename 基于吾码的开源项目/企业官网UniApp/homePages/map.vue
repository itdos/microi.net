<template>
  <view class="template-content">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed alpha customBack>
      <view slot="back" class='tn-custom-nav-bar__back'
        @click="goBack">
        <text class='icon tn-icon-left'></text>
        <text class='icon tn-icon-home-capsule-fill'></text>
      </view>
    </tn-nav-bar>
    
    
    <view class="">
      <view class="shop-shadow tn-margin tn-color-black tn-bg-white map-footerfixed" @click="openLocation">
        <view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding-top-xs tn-padding-bottom-xs">
          <view class="justify-content-item">
            <view class="tn-flex tn-flex-col-center tn-flex-row-left">
              <view class="tn-padding tn-color-black">
                <view class="tn-padding-right-sm tn-text-lg tn-text-bold">
                  广州图鸟科技有限公司 · 图鸟国际
                </view>
                <view class="tn-padding-right tn-padding-top-xs tn-text-ellipsis tn-text-xs tn-color-gray">
                  <text class="">距离你12.8km</text>
                  <text class="tn-padding-left-xs">驾车24分钟</text>
                  <text class="tn-padding-left-xs">公交地铁2小时</text>
                </view>
              </view>
            </view>
          </view>
          <view class="tn-flex justify-content-item tn-flex-row-center tn-padding-right-xs">
            <view class="tn-bg-gray--light tn-padding-xs tn-margin-sm tn-color-black tn-round">
              <text class="tn-icon-location-fill" style="font-size: 60rpx;"></text>
            </view>
          </view>
        </view>
      </view>
      <map class="map tn-shadow-blur" :latitude="latitude" :longitude="longitude" :markers="covers" @click="openLocation" :enable-scroll="false" :enable-zoom="false">
      </map>
    </view>
  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  export default {
    name: 'TemplateContent',
    mixins: [template_page_mixin],
    data(){
      return {
        id:0, // 使用 marker点击事件 需要填写id
        title: 'map',
        latitude: 22.961836,
        longitude: 113.330067,
        /* covers: [{
        	latitude: 22.961836,
        	longitude: 113.330067,
        	iconPath: 'https://cdn.nlark.com/yuque/0/2023/png/280373/1675936271542-assets/web-upload/8f3d0a29-cad4-4e4d-995b-0e08467dff02.png'
        }]*/
      }
    },
    methods: {
      openLocation() {
        wx.vibrateShort();
        uni.openLocation({
          longitude: 113.3298396012573,
          latitude: 22.961803525530176,
          name: '祈福新村',
          address: '祈福新村'
        })
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
  
  .map {
    // width: calc(100vw - 60rpx);
    width: 100vw;
    height: 100vh;
    // border-radius: 8rpx;
    // border: 1rpx solid #F8F7F8;
    // margin: 30rpx 30rpx 100rpx 30rpx;
  }  
  
  /* 底部固定按钮*/
  .map-footerfixed {
    position: fixed;
    width: calc(100vw - 60rpx);
    bottom: calc(130rpx + env(safe-area-inset-bottom));
    z-index: 1024;
  }
  /* 阴影 start*/
  .shop-shadow {
    border-radius: 15rpx;
    box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
  }
  
</style>
