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
    
    
    <view class="adver-wrap" :style="{paddingTop: vuex_custom_bar_height + 'px'}">
       <view class="tn-shadow tn-bg-white tn-margin">
         <view class="tn-text-center tn-color-blue" style="padding: 30rpx 0;">
           <text style="font-size: 110rpx;margin-left: -20rpx;">0</text>
           <text class="tn-text-lg tn-padding-left-xs" style="">积分</text>
         </view>
         <!-- <view class="tn-flex-1 justify-content-item tn-margin-xs tn-text-center tn-padding-top tn-padding-bottom-xl">
           <tn-button shape="round" :plain="true" backgroundColor="#3668fc" padding="40rpx 0" width="70%" shadow :fontSize="32" @click="tn('/pageB/edit/edit')">
             <text class="tn-color-blue--dark">发布日签 +20积分</text>
           </tn-button>
         </view> -->
       </view>
     </view>
     
     <view class="">
       <view class="">
         <view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding tn-margin tn-shadow tn-bg-white">
           <view class="justify-content-item">
             <view class="tn-flex tn-flex-col-center tn-flex-row-left">
               <view class="tn-margin-top-xs">
                 <view class="icon15__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur tn-bg-gray--light">
                   <view class="tn-icon-wechat-fill tn-color-gray"></view>
                 </view>
               </view>
               <view class="tn-padding-right tn-color-black" style="width: 400rpx;">
                 <view class="tn-padding-right tn-padding-left-sm tn-text-ellipsis tn-text-lg">
                   <text class="">分享微信好友</text>
                 </view>
                 <view class="tn-padding-right tn-padding-top-xs tn-text-sm tn-padding-left-sm tn-text-ellipsis tn-color-gray">
                   积分 +100
                 </view>
               </view>
             </view>
           </view>
           <view class="justify-content-item tn-flex-row-center">
             <view class="tn-bg-red--light tn-padding-xs tn-color-white tn-round tn-shadow-blur tn-text-sm">
               <text class="tn-padding-xs tn-color-red">做任务</text>
             </view>
           </view>
         </view>
         <!-- <view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding tn-margin tn-shadow tn-bg-white">
           <view class="justify-content-item">
             <view class="tn-flex tn-flex-col-center tn-flex-row-left">
               <view class="tn-margin-top-xs">
                 <view class="icon15__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur tn-bg-gray--light">
                   <view class="tn-icon-video-fill tn-color-gray"></view>
                 </view>
               </view>
               <view class="tn-padding-right tn-color-black" style="width: 400rpx;">
                 <view class="tn-padding-right tn-padding-left-sm tn-text-ellipsis tn-text-lg">
                   <text class="">阅读文章或视频</text>
                 </view>
                 <view class="tn-padding-right tn-padding-top-xs tn-text-sm tn-padding-left-sm tn-text-ellipsis tn-color-gray">
                   每次最高领取 100能量
                 </view>
               </view>
             </view>
           </view>
           <view class="justify-content-item tn-flex-row-center">
             <view class="tn-bg-red--light tn-padding-xs tn-color-white tn-round tn-shadow-blur tn-text-sm">
               <text class="tn-padding-xs tn-color-red">做任务</text>
             </view>
           </view>
         </view> -->
       </view>
       
     </view>
    
    <view class='tn-tabbar-height'></view>
    
  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  export default {
    name: 'TemplateTask',
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
  
  /* 图标容器15 start */
  .icon15 {
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
        width: 90rpx;
        height: 90rpx;
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
  
  
  /* 内容 */
   .adver-wrap {
     position: relative;
     z-index: 1;
     // padding: 20rpx 30rpx;
     // margin-top: -220rpx;  
     border-radius: 80rpx 80rpx 0 0;
   }
  
   
   .user-pic {
     background-size: cover;
     background-repeat: no-repeat;
     // background-attachment:fixed;
     background-position: top;
     border-radius: 50%;
     overflow: hidden;
     background-color: #FFFFFF;
   }
   
   
   /* 截图图片 start */
   .screenshot-img {
     z-index: -1;
     padding: 20rpx;
   
     image {
       width: 100%;
       display: block;
     }
   }
   
   
   
   /* 阴影 start*/
   .tn-shadow {
     border-radius: 15rpx;
     box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
   }
   
   /* 标题 start */
   .nav_title {
     -webkit-background-clip: text;
     color: transparent;
     
     &--wrap {
       position: relative;
       display: flex;
       height: 120rpx;
       align-items: center;
       justify-content: center;
       font-weight: bold;
       background-image: url(https://resource.tuniaokj.com/images/title_bg/title44.png);
       background-size: cover;
     }
   }
   /* 标题 end */
   /* 标题2 start */
   .nav_title2 {
     -webkit-background-clip: text;
     color: transparent;
     
     &--wrap {
       position: relative;
       display: flex;
       height: 120rpx;
       align-items: center;
       justify-content: center;
       font-weight: bold;
       // background-image: url(https://resource.tuniaokj.com/images/title_bg/title44.png);
       background-size: cover;
     }
   }
   /* 标题2 end */
   
  /* 店铺主图 start*/
   .image-article {
     border-radius: 16rpx;
     border: 1rpx solid #F8F7F8;
     width: 200rpx;
     height: 200rpx;
     position: relative;
   }
   
   .image-pic {
     background-size: cover;
     background-repeat: no-repeat;
     // background-attachment:fixed;
     background-position: top;
     border-radius: 20rpx;
   }
   
   .article-shadow {
     border-radius: 15rpx;
     box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
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
   
   /* 标签内容 start*/
   .tn-tag-content {
     &__item {
       display: inline-block;
       line-height: 35rpx;
       padding: 5rpx 25rpx;
   
       &--prefix {
         padding-right: 10rpx;
       }
     }
   }
</style>
