<template>
  <view class="pagesC tn-safe-area-inset-bottom">

    <!-- 顶部自定义导航 -->
    <tn-nav-bar :isBack="false" :bottomShadow="false" backgroundColor="#16171D00">
      <view class="" style="width: 70vw;overflow: hidden;margin-top: 6rpx;">
        <tn-tabs :list="scrollList" :current="current" @change="tabChange" activeColor="#FFF" inactiveColor="#FFFFFF80"
          :bold="true" :fontSize="36"></tn-tabs>
      </view>
    </tn-nav-bar>

    <view class="tn-margin-bottom-xl" :style="{paddingTop: vuex_custom_bar_height + 20 + 'px'}">

      <view class="" v-if="current==0">

        <!-- 数字模型 start-->
        <view class="tn-flex tn-flex-wrap" style="margin: 0 15rpx;">
          <block v-for="(item, index) in content" :key="index">
            <view class="" style="width: 50%;" @click="tn('../product/product')">
              <view class="product-content">
                <view class="image-pic" :style="'background-image:url(' + item.mainImage + ')'">
                  <view class="image-product">
                  </view>
                </view>

                <view class="tn-text-justify tn-padding-top-sm tn-padding-left-sm tn-padding-right-sm tn-padding-top">
                  <text class="tn-color-white">{{ item.desc }}</text>
                </view>

                <view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding-sm">
                  <view class="justify-content-item tn-flex tn-flex-col-center tn-color-gray"
                    style="margin-left: -6rpx;">
                    <text class="tn-text-lg">￥</text>
                    <text class="tn-padding-right-sm tn-text-lg">{{ item.price }}</text>
                    <!-- <text class="tn-color-gray tn-text-sm"> 66 人购买</text> -->
                  </view>
                  <view class="justify-content-item tn-flex tn-flex-col-center">
                    <text class="tn-color-gray tn-text-sm"> {{ item.number }} 人购买</text>
                  </view>
                </view>
              </view>
            </view>
          </block>
        </view>
        <!-- 数字模型 end-->

      </view>

      <view class="" v-if="current==1">
        <view class="" style="padding: 15vh 20rpx;opacity: 0.6;">
          <view class="tn-text-center" style="font-size: 260rpx;padding-top: 30rpx;">
            <text class="tn-icon-ghost-fill tn-color-gray--light"></text>
          </view>
          <view class="tn-color-gray--disabled tn-text-center tn-text-lg">内容被幽灵卷走了</view>
        </view>
      </view>

      <view class="" v-if="current==2">
        <view class="" style="padding: 15vh 20rpx;opacity: 0.6;">
          <view class="tn-text-center" style="font-size: 260rpx;padding-top: 30rpx;">
            <text class="tn-icon-ghost-fill tn-color-gray--light"></text>
          </view>
          <view class="tn-color-gray--disabled tn-text-center tn-text-lg">内容真被幽灵卷走了</view>
        </view>
      </view>
      <view class="" v-if="current==3">
        <view class="" style="padding: 15vh 20rpx;opacity: 0.6;">
          <view class="tn-text-center" style="font-size: 260rpx;padding-top: 30rpx;">
            <text class="tn-icon-ghost-fill tn-color-gray--light"></text>
          </view>
          <view class="tn-color-gray--disabled tn-text-center tn-text-lg">内容真被幽灵卷走了，嘤</view>
        </view>
      </view>
      <view class="" v-if="current==4">
        <view class="" style="padding: 15vh 20rpx;opacity: 0.6;">
          <view class="tn-text-center" style="font-size: 260rpx;padding-top: 30rpx;">
            <text class="tn-icon-ghost-fill tn-color-gray--light"></text>
          </view>
          <view class="tn-color-gray--disabled tn-text-center tn-text-lg">内容真被幽灵卷走了，嘤嘤</view>
        </view>
      </view>
      <view class="" v-if="current==5">
        <view class="" style="padding: 15vh 20rpx;opacity: 0.6;">
          <view class="tn-text-center" style="font-size: 260rpx;padding-top: 30rpx;">
            <text class="tn-icon-ghost-fill tn-color-gray--light"></text>
          </view>
          <view class="tn-color-gray--disabled tn-text-center tn-text-lg">内容真被幽灵卷走了，嘤嘤嘤</view>
        </view>
      </view>
      <view class="" v-if="current==6">
        <view class="" style="padding: 15vh 20rpx;opacity: 0.6;">
          <view class="tn-text-center" style="font-size: 260rpx;padding-top: 30rpx;">
            <text class="tn-icon-ghost-fill tn-color-gray--light"></text>
          </view>
          <view class="tn-color-gray--disabled tn-text-center tn-text-lg">内容真被幽灵卷走了，嘤嘤嘤嘤</view>
        </view>
      </view>

    </view>

    <view class='tn-tabbar-height'></view>
    <view class="bg-tabbar-shadow"></view>
  </view>
</template>

<script>
  export default {
    name: 'PageC',
    data() {
      return {
        current: 0,
        scrollList: [{
            name: '推荐'
          },
          {
            name: '模型'
          },
          {
            name: '凶姐'
          },
          {
            name: '图鸟'
          },
          {
            name: '手办'
          },
          {
            name: '版权'
          },
          {
            name: '其他'
          }
        ], 
        content: [{
            price: '29',
            number: '12',
            desc: '凶姐到此一游',
            mainImage: '/static/img/2222.png',
          },
          {
            price: '38',
            number: '26',
            desc: '凶姐到此一游',
            mainImage: '/static/img/3333.png',
          },
          {
            price: '29',
            number: '48',
            desc: '凶姐到此一游',
            mainImage: '/static/img/5555.png',
          },
          {
            price: '59',
            number: '129',
            desc: '凶姐到此一游',
            mainImage: '/static/img/4444.png',
          },
          {
            price: '38',
            number: '9',
            desc: '凶姐到此一游',
            mainImage: '/static/img/1111.png',
          },
          {
            price: '79',
            number: '108',
            desc: '凶姐到此一游',
            mainImage: '/static/img/6666.png',
          },
          {
            price: '59',
            number: '21',
            desc: '凶姐到此一游',
            mainImage: '/static/img/7777.png',
          },
          {
            price: '69',
            number: '62',
            desc: '凶姐到此一游',
            mainImage: '/static/img/1515.png',
          },
          {
            price: '59',
            number: '26',
            desc: '凶姐到此一游',
            mainImage: '/static/img/1212.png',
          },
          {
            price: '38',
            number: '10',
            desc: '凶姐到此一游',
            mainImage: '/static/img/8888.png',
          },
          {
            price: '79',
            number: '33',
            desc: '凶姐到此一游',
            mainImage: '/static/img/1414.png',
          },
          {
            price: '59',
            number: '1',
            desc: '凶姐到此一游',
            mainImage: '/static/img/1313.png',
          },
          {
            price: '69',
            number: '23',
            desc: '凶姐到此一游',
            mainImage: '/static/img/1010.png',
          },
          {
            price: '59',
            number: '8',
            desc: '凶姐到此一游',
            mainImage: '/static/img/9999.png',
          }
        ],
      }
    },

    methods: {
      // tab选项卡切换
      tabChange(index) {
        this.current = index
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
  .pagesC {
    max-height: 100vh;
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

  /* 底部安全边距 start*/
  .tn-tabbar-height {
    min-height: 60rpx;
    height: calc(80rpx + env(safe-area-inset-bottom) / 2);
    height: calc(80rpx + constant(safe-area-inset-bottom));
  }


  /* 数字模型 start*/
  .product-content {
    // box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
    border-radius: 15rpx;
    background-color: rgba(255, 255, 255, 0.08);
    border: 1rpx solid #494B51;
    margin: 15rpx;
  }

  .image-product {
    height: 327rpx;
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