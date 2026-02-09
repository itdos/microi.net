<template>
  <view class="pagesB tn-safe-area-inset-bottom">

    <swiper class="card-swiper" :current="cardCur" :circular="true" :autoplay="false" duration="500" interval="18000"
      @change="cardSwiper" :style="{paddingTop: vuex_custom_bar_height - 50  + 'px'}">
      <swiper-item v-for="(item,index) in swiperList" :key="index" :class="cardCur==index?'cur':''">
		   <!-- @click="tn('../series/series')" -->
        <view class="swiper-item image-banner">
          <!-- <image class="" :src="item.url" mode="heightFix" v-if="item.type=='image'" ></image> -->

          <view class="box">
            <view class="cube">
              <view class="front" style="background-image: linear-gradient(45deg, #f43f3b, #ec008c);opacity: 0.2;">
              </view>
              <view class="back" style="background-image: linear-gradient(45deg, #ff7612, #ff571c);opacity: 0.2;">
              </view>
              <view class="left" style="background-image: linear-gradient(45deg, #7FD02B, #9ddb47);opacity: 0.2;">
              </view>
              <view class="right" style="background-image: linear-gradient(45deg, #9000ff, #5e00ff);opacity: 0.2;">
              </view>
              <view class="top" style="background-image: linear-gradient(45deg, #6F68DF, #ec008c);opacity: 0.2;"></view>
              <view class="bottom" style="background-image: linear-gradient(45deg, #0070FF, #19CF8A);opacity: 0.2;">
              </view>

              <view class="in-front"
                style="background-image:url('/static/img/2222.png');width: 200rpx;height: 200rpx;background-size: cover;overflow: hidden;">
              </view>
              <view class="in-back"
                style="background-image:url('/static/img/3333.png');width: 200rpx;height: 200rpx;background-size: cover;overflow: hidden;">
              </view>
              <view class="in-left"
                style="background-image:url('/static/img/5555.png');width: 200rpx;height: 200rpx;background-size: cover;overflow: hidden;">
              </view>
              <view class="in-right"
                style="background-image:url('/static/img/4444.png');width: 200rpx;height: 200rpx;background-size: cover;overflow: hidden;">
              </view>
              <view class="in-top"
                style="background-image:url('/static/img/1111.png');width: 200rpx;height: 200rpx;background-size: cover;overflow: hidden;">
              </view>
              <view class="in-bottom"
                style="background-image:url('/static/img/6666.png');width: 200rpx;height: 200rpx;background-size: cover;overflow: hidden;">
              </view>
            </view>
          </view>


        </view>
        <view class="swiper-item-text tn-text-center">
          <view class="tn-padding-top-xs tn-color-white" style="opacity: 0.6;">
            <text class="tn-icon-copy tn-padding-right-xs"></text>
            {{item.name}}
            <text class="tn-icon-copy tn-padding-left-xs"></text>
          </view>
        </view>

      </swiper-item>
    </swiper>


    <view class="indication">
      <block v-for="(item,index) in swiperList" :key="index">
        <view class="spot tn-text-center tn-padding-top tn-shadow-blur tn-color-white"
          :class="cardCur==index?'active':''" @tap.stop="handleSwiperClick(index)">
          <view class="tn-text-xxl icon-text" :class="'tn-icon-'+ item.icon"></view>
          <!-- <view class="">{{item.text}}</view> -->
          <view class="tn-text-sm tn-padding-top-sm">{{item.get}}</view>
        </view>
      </block>
      <view class="indication-bg"
        style="background-image:url('/static/img/black-bg.png');opacity: 0.08;">
      </view>
    </view>

    <!-- 悬浮按钮-->
    <view class="tn-flex tn-footerfixed" @click="showModal1">
      <view class="tn-flex-1 justify-content-item tn-margin-sm tn-text-center">
        <tn-button shape="round" backgroundColor="#FFFFFF10" padding="40rpx 0" width="50%"
          >
          <text class="tn-color-white">立 即 合 成</text>
        </tn-button>
      </view>
    </view>
    
    <tn-modal v-model="show1" :custom="true" :showCloseBtn="false">
      <view class="custom-modal-content" @click="tn('../box/box')">
        <view class="tn-flex-1 justify-content-item tn-text-center">
          <tn-button backgroundColor="#16171D" padding="40rpx 0" width="100%" fontBold>
            <text class="tn-color-white">霸气十连 269￥</text>
          </tn-button>
        </view>
        <view class="tn-flex-1 justify-content-item tn-margin-top-lg tn-text-center">
          <tn-button backgroundColor="#16171D" padding="40rpx 0" width="100%" fontBold>
            <text class="tn-color-white">一发入魂  29￥</text>
          </tn-button>
        </view>
      </view>
    </tn-modal>

    <view class="tn-tabbar-height"></view>
    <view class="bg-tabbar-shadow"></view>

  </view>
</template>

<script>
  export default {
    name: 'PagesB',
    data() {
      return {
        show1: false,
        cardCur: 2,
        swiperList: [{
          id: 0,
          type: 'image',
          name: '136人合成成功',
          get: '未合成',
          icon: 'cube',//fireworks
        }, {
          id: 1,
          type: 'image',
          name: '58人合成成功',
          get: '未合成',
          icon: 'cube',
        }, {
          id: 2,
          type: 'image',
          name: '39人合成成功',
          get: '未合成',
          icon: 'cube',
        }, {
          id: 3,
          type: 'image',
          name: '19人合成成功',
          get: '未合成',
          icon: 'cube',
        }, {
          id: 4,
          type: 'image',
          name: '10人合成成功',
          get: '未合成',
          icon: 'cube',
        }],
      }
    },
    methods: {
      // cardSwiper
      cardSwiper(e) {
        this.cardCur = e.detail.current
      },
      // swiper点击事件
      handleSwiperClick(index) {
        this.cardCur = index
      },
      // 跳转
      tn(e) {
        uni.navigateTo({
          url: e,
        });
      },
      
      // 弹出模态框
      showModal1(event) {
		  var self = this;
		  self.V8.Tips('材料不足！', false);
		  return;
        this.openModal1()
      },
      // 打开模态框
      openModal1() {
        this.show1 = true
      },
    }
  }
</script>

<style lang="scss" scoped>
  .pagesB {
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

  /* 立方体1 */
  @keyframes rotate {
    0% {
      transform: rotateX(0deg) rotateY(0deg);
    }

    100% {
      transform: rotateX(360deg) rotateY(360deg);
    }
  }

  .box {
    margin: 0 275rpx 0 275rpx;
    perspective: 130px;
  }

  .cube {
    width: 100px;
    height: 100px;
    position: relative;
    transform: rotateX(-41deg) rotateY(-63deg);
    transform-style: preserve-3d;
    animation: rotate 20s infinite linear;
  }

  .cube>view {
    width: 100px;
    height: 100px;
    text-align: center;
    line-height: 200px;
    font-size: 40px;
    font-weight: bold;
    color: #FFFFFF;
    background: #16171D33;
    border: 1px solid #FFFFFF;
    border-radius: 30rpx;
    position: absolute;
    top: 0;
    left: 0;
    transition: transform 5s ease-in;
  }

  .front {
    transform: translateZ(100px) scale(0.5);
  }

  .back {

    transform: translateZ(-100px) rotateY(-180deg) scale(0.5);
  }

  .left {
    transform: translateX(-100px) rotateY(-90deg) scale(0.5);
  }

  .right {
    transform: translateX(100px) rotateY(90deg) scale(0.5);
  }

  .top {
    transform: translateY(-100px) rotateX(90deg) scale(0.5);
  }

  .bottom {
    transform: translateY(100px) rotateX(-90deg) scale(0.5);
  }



  .in-front {
    transform: translateZ(65px);
  }

  .in-back {
    transform: translateZ(-65px) rotateY(180deg);
  }

  .in-left {
    transform: translateX(65px) rotateY(90deg);
  }

  .in-right {
    transform: translateX(-65px) rotateY(-90deg);
  }

  .in-top {
    transform: translateY(65px) rotateX(90deg);
  }

  .in-bottom {
    transform: translateY(-65px) rotateX(-90deg);
  }

  /* 视觉差轮播*/
  .card-swiper {
    height: 80vh !important;
  }

  .card-swiper swiper-item {
    width: 750rpx !important;
    left: 0rpx;
    box-sizing: border-box;
    overflow: initial;
  }

  .card-swiper swiper-item .swiper-item {
    margin-top: 20vh;
    width: 750rpx;
    height: 750rpx;
    border-radius: 0rpx;
    transform: translate(0rpx, 0rpx) scale(0.8);
    transition: all 0.2s ease-in 0s;
    will-change: transform;
    overflow: hidden;
    opacity: 1;
  }

  .card-swiper swiper-item.cur .swiper-item {
    transform: translate(0rpx, 0rpx) scale(1, 1);
    transition: all 0.2s ease-in 0s;
    will-change: transform;
    opacity: 1;
  }

  .card-swiper swiper-item .swiper-item-text {
    margin-top: -6vh;
    width: 100%;
    // height: 100%;
    display: block;
    border-radius: 10rpx;
    transform: scale(0.7, 0.7);
    transition: all 0.4s ease 0s;
    will-change: transform;
    overflow: hidden;
    opacity: 0;
  }

  .card-swiper swiper-item.cur .swiper-item-text {
    margin-top: -6vh;
    transform: scale(1);
    transition: all 0.4s ease 0s;
    will-change: transform;
    opacity: 1;
  }

  .image-banner {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .image-banner image {
    width: 400rpx;
    height: 400rpx;
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

  .indication-bg {
    background-repeat: no-repeat;
    background-size: cover;
    position: absolute;
    top: -68vh;
    ;
    left: 0;
    z-index: -1;
    width: 100%;
    height: 270rpx
  }

  .spot {
    opacity: 1;
    width: 100rpx;
    height: 80rpx;
    border-radius: 20rpx;
    margin: 20rpx 15rpx !important;
    left: 0rpx;
    right: 0;
    top: -63vh;
    position: relative;
  }

  .spot.active .icon-text {
    transform: scale(1.8);
    margin-bottom: 18rpx;
    opacity: 1;
  }

  /* 底部悬浮按钮*/
  .tn-footerfixed {
    position: fixed;
    width: 100%;
    bottom: 15vh;
    z-index: 9999;
    box-shadow: 0 1rpx 6rpx rgba(0, 0, 0, 0);
  }
  
</style>