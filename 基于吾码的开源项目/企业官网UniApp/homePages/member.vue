<template>
  <view class="template-vip">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed customBack :bottomShadow="false" backgroundColor="#FFFFFF">
      <view slot="back" class='tn-custom-nav-bar__back'
        @click="goBack">
        <text class='icon tn-icon-left-arrow'></text>
      </view>
      <view class="tn-flex tn-flex-col-center tn-flex-row-center ">
        <text class="tn-text-bold tn-text-xl tn-color-black">会员权益</text>
      </view>
    </tn-nav-bar>

    <view class="tn-margin-top" :style="{paddingTop: vuex_custom_bar_height + 'px'}">
      
      
      <!-- 已开通-->
      <!-- <view class="tn-margin">
        <view class="button-vip tn-flex tn-flex-row-between tn-flex-col-center tn-shadow-blur" style="background: linear-gradient(-120deg, #3E445A, #31374A, #2B3042, #262B3C);">
          
          <view class="tn-margin-left">
            <view class='title tn-text-bold tn-text-xl' style="color: #F1C68E;">
              至尊 
              <text style="font-style:italic;padding-left: 6rpx;">VIP</text>
            </view>
            <view class='tn-color-white tn-text-sm tn-padding-top-sm'>广州图鸟科技有限公司</view>
          </view>
          <view class="tn-margin-right">
            <tn-button shape="round" backgroundColor="#F1C68E" fontColor="#634738" padding="10rpx 0" width="160rpx" shadow>
              <text class="tn-text-bold">续 费</text>
            </tn-button>
          </view>
          
        </view>
      </view>  -->
      
      <!-- 未开通-->
      <view class="tn-margin">
        <view class="button-vip tn-flex tn-flex-row-between tn-flex-col-center tn-shadow-blur" style="background: linear-gradient(-120deg, #3E445A, #31374A, #2B3042, #262B3C);">
          <view class="tn-margin-left">
            <view class="tn-flex tn-flex-col-center" style="color: #F1C68E;margin-top: -20rpx;">
              <text class="tn-text-bold tn-text-xl">至尊</text>
              <text class="tn-icon-vip-text tn-text-center" style="font-size: 92rpx;"></text>
            </view>
            <view class='tn-color-white tn-text-sm'>尊享图鸟UI所有开源项目源码</view>
          </view>
          <view class="">
            <tn-button shape="round" backgroundColor="#F1C68E00" fontColor="#F1C68E" padding="10rpx 0" width="260rpx" shadow>
              <text class="tn-text-bold tn-text-xl">899￥/终身</text>
            </tn-button>
          </view>
          
        </view>
      </view>
      
      <view class="tn-site-shadow" style="border-radius: 10rpx;overflow: hidden;margin: 50rpx 30rpx 30rpx 30rpx;">
        
        <view class="tn-flex tn-flex-row-between tn-padding tn-text-center tn-bg-brown--light">
          <view class="tn-flex-1">
            <view class="tn-text-bold tn-text-lg">
              开源项目
            </view>
            <view class="tn-text-sm tn-color-gray--dark">
              不喜勿喷
            </view>
          </view>
          <view class="tn-flex-1">
            <view class="tn-text-bold tn-text-lg">
              普通用户
            </view>
            <view class="tn-text-sm tn-color-gray--dark">
              免费开源
            </view>
          </view>
          <view class="tn-flex-1">
            <view class="tn-text-bold tn-text-lg">
              至尊VIP
            </view>
            <view class="tn-text-sm tn-color-gray--dark">
              会员福利
            </view>
          </view>
        </view>
        
        <view class="tn-flex tn-flex-row-between tn-flex-col-center tn-strip-bottom-min tn-padding-sm" v-for="(item, index) in setList" :key="index" @click="tn(item.url)">
          <view class="tn-flex-1 tn-text-center">
            <view class="">
              {{ item.title }}
            </view>
            <!-- <view class="tn-color-gray tn-text-xs">
              {{ item.title2 }}
            </view> -->
          </view>
          <view class="tn-flex-1">
            <view class="">
              {{ item.common }}
            </view>
            <view class="">
              {{ item.common2 }}
            </view>
          </view>
          <view class="tn-flex-1">
            <view class="">
              {{ item.vip }}
            </view>
            <view class="">
              {{ item.vip2 }}
            </view>
          </view>
        </view>
        
      </view>
      
      <!-- 悬浮按钮-->
      <view class="tn-flex  tn-footerfixed">
        <view class="tn-flex-1 justify-content-item tn-margin-sm tn-text-center">
          <tn-button shape="round" backgroundColor="tn-bg-blue" padding="40rpx 0" width="60%" shadow fontBold open-type="contact">
            <text class="tn-color-white">前往咨询</text>
          </tn-button>
        </view>
      </view>
      
    </view>
    
    
  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  export default {
    name: 'TemplateVip',
    mixins: [template_page_mixin],
    data(){
      return {
        setList: [
        	{
        		title: "图鸟UI",
            title2: "UI组件",
            common: "免费商用",
            common2: "插件市场获取",
            vip: "免费商用",
            vip2: "会员群直接获取"
        	},
        	{
        		title: "图鸟VUE3 ",
            title2: "UI组件",
        		common: "免费商用",
        		common2: "插件市场获取",
        		vip: "免费商用",
        		vip2: "会员群直接获取"
        	},
        	{
        		title: "圈子博客",
            title2: "纯前端模板",
        		common: "免费商用",
        		common2: "插件市场获取",
        		vip: "免费商用",
        		vip2: "会员群直接获取"
        	},
          {
          	title: "简约商圈",
            title2: "纯前端模板",
          	common: "免费商用",
          	common2: "插件市场获取",
          	vip: "免费商用",
          	vip2: "会员群直接获取"
          },
        	{
        		title: "凶姐壁纸",
            title2: "纯前端模板",
        		common: "免费商用",
        		common2: "插件市场获取",
        		vip: "免费商用",
        		vip2: "会员群直接获取"
        	},
          {
          	title: "名片资讯",
            title2: "纯前端模板",
          	common: "无",
          	common2: "",
          	vip: "会员专属",
          	vip2: "会员群直接获取"
          },
          {
          	title: "酷炫官网",
            title2: "纯前端模板",
          	common: "无",
          	common2: "",
          	vip: "会员专属",
          	vip2: "会员群直接获取"
          }
        ]
      }
    },
    methods: {
      
    }
  }
</script>

<style lang="scss" scoped>
    /* 胶囊*/
    .tn-custom-nav-bar__back {
      width: 60%;
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
      
    }


    /* 间隔线 start*/
    .tn-strip-bottom-min {
      width: 100%;
      border-bottom: 1rpx solid #F8F9FB;
    }
    
    .tn-strip-bottom {
     width: 100%;
     border-bottom: 20rpx solid rgba(241, 241, 241, 0.8);
    }
     /* 间隔线 end*/

  /* 页面阴影 start*/
  .tn-site-shadow {
    border-radius: 15rpx;
    box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
  }
  
  /* 用户头像 start */
  .logo-image {
    width: 110rpx;
    height: 110rpx;
    position: relative;
  }
  
  .logo-pic {
    background-size: cover;
    background-repeat: no-repeat;
    // background-attachment:fixed;
    background-position: top;
    border: 8rpx solid rgba(255,255,255,0.05);
    box-shadow: 0rpx 0rpx 80rpx 0rpx rgba(0, 0, 0, 0.15);
    border-radius: 50%;
    overflow: hidden;
    // background-color: #FFFFFF;
  }
  
  .button-vip {
    width: 100%;
    height: 150rpx;
    border-radius: 15rpx;
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
      background-image: url(https://resource.tuniaokj.com/images/cool_bg_image/icon_bg.png);
    }    
  }

  /* 底部悬浮按钮 start*/
  .tn-tabbar-height {
  	min-height: 100rpx;
  	height: calc(120rpx + env(safe-area-inset-bottom) / 2);
  }
  .tn-footerfixed {
    position: fixed;
    width: 100%;
    bottom: calc(30rpx + env(safe-area-inset-bottom));
    z-index: 1024;
    box-shadow: 0 1rpx 6rpx rgba(0, 0, 0, 0);
    
  }
  /* 底部悬浮按钮 end*/
  
</style>
