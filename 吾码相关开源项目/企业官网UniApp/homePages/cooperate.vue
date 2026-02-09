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
    
    
    <!-- 页面内容 -->
    <view class="slideshow">
      <view class="slideshow-image" style="background-image: url('https://cdn.nlark.com/yuque/0/2023/jpeg/280373/1683640987969-assets/web-upload/5fa03ecb-aa74-4042-abe7-14c105231680.jpeg')"></view>
      <view class="slideshow-image" style="background-image: url('https://cdn.nlark.com/yuque/0/2023/jpeg/280373/1683641939234-assets/web-upload/8b473dd5-68ed-424a-a2ad-d345cf47f361.jpeg')"></view>
      <view class="slideshow-image" style="background-image: url('https://cdn.nlark.com/yuque/0/2023/jpeg/280373/1683640987853-assets/web-upload/b055c730-0394-4c5f-8bc3-a8baac6f616d.jpeg')"></view>
      <view class="slideshow-image" style="background-image: url('https://cdn.nlark.com/yuque/0/2023/jpeg/280373/1683641939404-assets/web-upload/d7d7600c-52be-4d73-833c-d2872e30ced0.jpeg')"></view>
    </view>
    
    <button class='' open-type="contact">
      <view class="wechat tnxuanfu">
        <view class="bg0 pa">
          <view class="bg1">
            <image src="https://resource.tuniaokj.com/images/my/my7.png" class="button-shop shadow"></image>
          </view>
        </view>
        <view class="hx-box pa">
          <view class="pr">
            <view class="hx-k1 pa0">
              <view class="span"></view>
            </view>
            <view class="hx-k2 pa0">
              <view class="span"></view>
            </view>
            <view class="hx-k3 pa0">
              <view class="span"></view>
            </view>
            <view class="hx-k4 pa0">
              <view class="span"></view>
            </view>
            <view class="hx-k5 pa0">
              <view class="span"></view>
            </view>
            <view class="hx-k6 pa0">
              <view class="span"></view>
            </view>
          </view>
        </view>
      </view>
    </button>
    
  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  export default {
    name: 'TemplateContent',
    mixins: [template_page_mixin],
    data(){
      return {}
    },
    methods: {
      // 跳转到
      navTuniaoUI(e) {
        wx.vibrateShort();
      }
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
  
   
   /* 相册 start*/
   .slideshow {
     top: 0;
     position: absolute;
     width: 100vw;
     height: 100vh;
     overflow: hidden;
     // background-color: #A5B4FF;
     z-index: -1;
   }
   
   .slideshow-image {
     position: absolute;
     width: 100%;
     height: 100%;
     background: no-repeat 50% 50%;
     background-size: cover;
     -webkit-animation-name: kenburns;
             animation-name: kenburns;
     -webkit-animation-timing-function: linear;
             animation-timing-function: linear;
     -webkit-animation-iteration-count: infinite;
             animation-iteration-count: infinite;
     -webkit-animation-duration: 16s;
             animation-duration: 16s;
     opacity: 1;
     transform: scale(1.2);
   }
   .slideshow-image:nth-child(1) {
     -webkit-animation-name: kenburns-1;
             animation-name: kenburns-1;
     z-index: 3;
   }
   .slideshow-image:nth-child(2) {
     -webkit-animation-name: kenburns-2;
             animation-name: kenburns-2;
     z-index: 2;
   }
   .slideshow-image:nth-child(3) {
     -webkit-animation-name: kenburns-3;
             animation-name: kenburns-3;
     z-index: 1;
   }
   .slideshow-image:nth-child(4) {
     -webkit-animation-name: kenburns-4;
             animation-name: kenburns-4;
     z-index: 0;
   }
   
   @-webkit-keyframes kenburns-1 {
     0% {
       opacity: 1;
       transform: scale(1.2);
     }
     1.5625% {
       opacity: 1;
     }
     23.4375% {
       opacity: 1;
     }
     26.5625% {
       opacity: 0;
       transform: scale(1);
     }
     100% {
       opacity: 0;
       transform: scale(1.2);
     }
     98.4375% {
       opacity: 0;
       transform: scale(1.2117647059);
     }
     100% {
       opacity: 1;
     }
   }
   
   @keyframes kenburns-1 {
     0% {
       opacity: 1;
       transform: scale(1.2);
     }
     1.5625% {
       opacity: 1;
     }
     23.4375% {
       opacity: 1;
     }
     26.5625% {
       opacity: 0;
       transform: scale(1);
     }
     100% {
       opacity: 0;
       transform: scale(1.2);
     }
     98.4375% {
       opacity: 0;
       transform: scale(1.2117647059);
     }
     100% {
       opacity: 1;
     }
   }
   @-webkit-keyframes kenburns-2 {
     23.4375% {
       opacity: 1;
       transform: scale(1.2);
     }
     26.5625% {
       opacity: 1;
     }
     48.4375% {
       opacity: 1;
     }
     51.5625% {
       opacity: 0;
       transform: scale(1);
     }
     100% {
       opacity: 0;
       transform: scale(1.2);
     }
   }
   @keyframes kenburns-2 {
     23.4375% {
       opacity: 1;
       transform: scale(1.2);
     }
     26.5625% {
       opacity: 1;
     }
     48.4375% {
       opacity: 1;
     }
     51.5625% {
       opacity: 0;
       transform: scale(1);
     }
     100% {
       opacity: 0;
       transform: scale(1.2);
     }
   }
   @-webkit-keyframes kenburns-3 {
     48.4375% {
       opacity: 1;
       transform: scale(1.2);
     }
     51.5625% {
       opacity: 1;
     }
     73.4375% {
       opacity: 1;
     }
     76.5625% {
       opacity: 0;
       transform: scale(1);
     }
     100% {
       opacity: 0;
       transform: scale(1.2);
     }
   }
   @keyframes kenburns-3 {
     48.4375% {
       opacity: 1;
       transform: scale(1.2);
     }
     51.5625% {
       opacity: 1;
     }
     73.4375% {
       opacity: 1;
     }
     76.5625% {
       opacity: 0;
       transform: scale(1);
     }
     100% {
       opacity: 0;
       transform: scale(1.2);
     }
   }
   @-webkit-keyframes kenburns-4 {
     73.4375% {
       opacity: 1;
       transform: scale(1.2);
     }
     76.5625% {
       opacity: 1;
     }
     98.4375% {
       opacity: 1;
     }
     100% {
       opacity: 0;
       transform: scale(1);
     }
   }
   @keyframes kenburns-4 {
     73.4375% {
       opacity: 1;
       transform: scale(1.2);
     }
     76.5625% {
       opacity: 1;
     }
     98.4375% {
       opacity: 1;
     }
     100% {
       opacity: 0;
       transform: scale(1);
     }
   }
     /* 相册 end*/
   
   /* 底部安全边距 start*/
   .tn-tabbar-height {
   	min-height: 20rpx;
   	height: calc(40rpx + env(safe-area-inset-bottom) / 2);
     height: calc(40rpx + constant(safe-area-inset-bottom));
   }
   
   
   /* 悬浮 */
   .tnxuanfu{
     animation: suspension 3s ease-in-out infinite;
   }
   
   @keyframes suspension {
     0%, 100% {
       transform: translateY(0);
     }
     50% {
       transform: translateY(-0.8rem);
     }
   }
   /* 悬浮按钮 */
   .button-shop {
     width: 90rpx;
     height: 90rpx;
     display: flex;
     flex-direction: row;
     position: fixed;
     /* bottom:200rpx;
       right: 20rpx; */
     left: 5rpx;
     top: 5rpx;
     z-index: 1001;
     border-radius: 100px;
     opacity: 0.9;
   }
   
   
   /* 按钮 */
   .wechat {
     bottom: 300rpx;
     right: 75rpx;
     position: fixed;
     z-index: 9999;
   }
   
   
   .pa,
   .pa0 {
     position: absolute
   }
   
   .pa0 {
     left: 0;
     top: 0
   }
   
   
   .bg0 {
     width: 100rpx;
     height: 100rpx;
     top: 50%;
     left: 50%;
     transform: translate(-50%, -50%);
   }
   
   .bg1 {
     width: 100%;
     height: 100%;
   }
   
   
   
   
   .hx-box {
     top: 50%;
     left: 50%;
     width: 100rpx;
     height: 100rpx;
     transform-style: preserve-3d;
     transform: translate(-50%, -50%) rotateY(75deg) rotateZ(10deg);
   }
   
   .hx-box .pr {
     width: 100rpx;
     height: 100rpx;
     transform-style: preserve-3d;
     animation: hxz 20s linear infinite;
   }
   
   @keyframes hxz {
     0% {
       transform: rotateX(0deg);
     }
   
     100% {
       transform: rotateX(-360deg);
     }
   }
   
   
   
   .hx-box .pr .pa0 {
     width: 100rpx;
     height: 100rpx;
     /* border: 4px solid #5ec0ff; */
     border-radius: 1000px;
   }
   
   .hx-box .pr .pa0 .span {
     display: block;
     width: 100%;
     height: 100%;
     background: url(https://resource.tuniaokj.com/images/cool_bg_image/arc4.png) no-repeat center center;
     background-size: 100% 100%;
     animation: hx 4s linear infinite;
   }
   
   @keyframes hx {
     to {
       transform: rotate(360deg);
     }
   }
   
   .hx-k1 {
     transform: rotateX(-60deg) rotateZ(-60deg)
   }
   
   .hx-k2 {
     transform: rotateX(-30deg) rotateZ(-30deg)
   }
   
   .hx-k3 {
     transform: rotateX(0deg) rotateZ(0deg)
   }
   
   .hx-k4 {
     transform: rotateX(30deg) rotateZ(30deg)
   }
   
   .hx-k5 {
     transform: rotateX(60deg) rotateZ(60deg)
   }
   
   .hx-k6 {
     transform: rotateX(90deg) rotateZ(90deg)
   }

</style>
