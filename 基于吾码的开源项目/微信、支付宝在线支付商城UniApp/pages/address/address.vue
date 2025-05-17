<template>
  <view class="template-address">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed alpha customBack>
      <view slot="back" class='tn-custom-nav-bar__back'
        @click="goBack">
        <text class='icon tn-icon-left'></text>
        <text class='icon tn-icon-home-capsule-fill'></text>
      </view>
    </tn-nav-bar>
    
    
    <view class="" :style="{paddingTop: vuex_custom_bar_height + 20 + 'px'}">
      <view class="box-shadow tn-flex tn-flex-row-between tn-flex-col-center tn-strip-bottom-min tn-padding tn-margin">
        <view class="justify-content-item tn-padding-right">
          <view class="tn-text-bold tn-text-lg tn-color-white">
            <text class="">付衣衣</text>
            <text class="tn-padding-left-sm">18219121111</text>
          </view>
          <view class="tn-color-gray tn-padding-top-xs">
            广东省广州市番禺区祈福新村129号
          </view>
        </view>
        <view class="justify-content-item tn-text-xl tn-color-gray" @click="tn('../edit/edit')">
          <view class="tn-icon-edit-write"></view>
        </view>
      </view>
      <view class="box-shadow tn-flex tn-flex-row-between tn-flex-col-center tn-strip-bottom-min tn-padding tn-margin">
        <view class="justify-content-item tn-padding-right">
          <view class="tn-text-bold tn-text-lg tn-color-white">
            <text class="">负壹壹</text>
            <text class="tn-padding-left-sm">18219121111</text>
          </view>
          <view class="tn-color-gray tn-padding-top-xs">
            广东省广州市番禺区祈福新村129号
          </view>
        </view>
        <view class="justify-content-item tn-text-xl tn-color-gray" @click="tn('../edit/edit')">
          <view class="tn-icon-edit-write"></view>
        </view>
      </view>
      <view class="box-shadow tn-flex tn-flex-row-between tn-flex-col-center tn-strip-bottom-min tn-padding tn-margin">
        <view class="justify-content-item tn-padding-right">
          <view class="tn-text-bold tn-text-lg tn-color-white">
            <text class="">付衣衣</text>
            <text class="tn-padding-left-sm">13688888888</text>
          </view>
          <view class="tn-color-gray tn-padding-top-xs">
            广东省广州市番禺区祈福新村不知道哪儿是收货地址的收货地址
          </view>
        </view>
        <view class="justify-content-item tn-text-xl tn-color-gray" @click="tn('../edit/edit')">
          <view class="tn-icon-edit-write"></view>
        </view>
      </view>
      
      <!-- 悬浮按钮-->
      <view class="tn-flex tn-footerfixed">
        <view class="tn-flex-1 justify-content-item tn-margin-left tn-margin-right-xs tn-text-center">
          <tn-button backgroundColor="#FFFFFF " padding="40rpx 0" width="100%" :fontSize="28" fontColor="#000000" shape="round" @click="tn('../edit/edit')">
            <text class="">新增地址</text>
          </tn-button>
        </view>
        <view class="tn-flex-1 justify-content-item tn-margin-right tn-margin-left-xs tn-text-center">
          <tn-button backgroundColor="#07C160 " padding="40rpx 0" width="100%" :fontSize="28" fontColor="#FFFFFF" shape="round" @click="navAddress">
            <text class="">微信导入</text>
          </tn-button>
        </view>
      </view>
      
      
    </view>
  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  export default {
    name: 'TemplateAddress',
    mixins: [template_page_mixin],
    data(){
      return {}
    },
    methods: {
      // 跳转
      tn(e) {
        uni.navigateTo({
          url: e,
        });
      },
      // 收货地址
      navAddress() {
        uni.chooseAddress({
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
  
  /* 页面阴影 start*/
  .box-shadow {
    border-radius: 15rpx;
    border: 1rpx solid #494B51;
    background-color: rgba(255, 255, 255, 0.08);
    // box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
  }
  
  /* 底部悬浮按钮 start*/
  .tn-tabbar-height {
  	min-height: 160rpx;
  	height: calc(180rpx + env(safe-area-inset-bottom) / 2);
    height: calc(180rpx + constant(safe-area-inset-bottom));
  }
  .tn-footerfixed {
    position: fixed;
    width: 100%;
    bottom: calc(80rpx + env(safe-area-inset-bottom));
    z-index: 1024;
    box-shadow: 0 1rpx 6rpx rgba(0, 0, 0, 0);
  
  }
  /* 底部悬浮按钮 end*/
  
</style>
