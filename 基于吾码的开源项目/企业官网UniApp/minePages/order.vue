<template>
  <view class="template-order">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed customBack :bottomShadow="false" backgroundColor="#FFFFFF">
      <view slot="back" class='tn-custom-nav-bar__back'
        @click="goBack">
        <text class='icon tn-icon-left-arrow'></text>
      </view>
      <view class="tn-flex tn-flex-col-center tn-flex-row-center ">
        <text class="tn-text-bold tn-text-xl tn-color-black">产品订单</text>
      </view>
    </tn-nav-bar>
    
    <view class="order--wrap" :style="{top: vuex_custom_bar_height + 20 +'px'}">
      <!-- 顶部标签 -->
      <view class="tn-bg-white">
        <tn-tabs-swiper class="order__tabs tn-text-xl" ref="tabs" activeColor="#3165CC" inactiveColor="#080808" :list="list" :current="tabsIndex" :isScroll="false" @change="tabsChange"></tn-tabs-swiper>
      </view>
      
      <!-- 标签内容 -->
      <swiper class="order__swiper" :style="{top: `${swiperTop}px`, height: `${swiperHeight}px`}" :current="swiperIndex" @transition="swiperTransition" @animationfinish="swiperAnimationFinish">
        
        <swiper-item class="order__swiper__item">
          <scroll-view :style="{height: `${swiperHeight}px`}" scroll-y>
            <view v-for="(item,index) in 6" :key="index" class="order__item"  @click="tn('/discoveryPages/form')">
              <view class="order__item__head tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
                <view class="order__item__head__title">
                  <text class="tn-text-bold">订单编号：SF009098765798</text>
                  <text class="tn-color-blue--disabled tn-padding-left-xs tn-text-df tn-icon-copy"></text>
                </view>
                <view class="tn-color-gray">
                  已完成
                </view>
              </view>
              
              <view class="order__item__content tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-center">
                <view class="order__item__content__image">
                  <image src="https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1664005699066-assets/web-upload/f7a37b29-506a-4e79-937f-826334902bb4.jpeg" mode="aspectFill"></image>
                </view>
                <view class="order__item__content__title">
                  图鸟官方设计 酷炫效果展示 让用户眼前一亮的赶脚
                </view>
                <view class="order__item__content__info tn-flex tn-flex-direction-column tn-flex-col-center tn-flex-row-center">
                  <view class="order__item__content__info__price">
                    <text class="order__item__content__info__price--unit">￥</text>
                    <text class="order__item__content__info__price__value--integer">1000</text>
                    <text class="order__item__content__info__price__value--decimal">.00</text>
                  </view>
                  <!-- <view class="order__item__content__info__count">
                    <text>共1件</text>
                  </view> -->
                </view>
              </view>
              
              <view class="order__item__operation tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-between">
                <view class="order__item__operaation__left">
                  <text class="order__item__operaation__left--text tn-color-gray">2023-12-12 16:12:28</text>
                </view>
                <view class="order__item__operation__right tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-right">
                  <view class="order__item__operation__right__button">
                    <tn-button shadow shape="round" fontColor="tn-color-white" backgroundColor="tn-bg-blue" :fontSize="24" height="auto" padding="10rpx 18rpx">再次购买</tn-button>
                  </view>
                </view>
              </view>
            </view>
            <view class="tn-padding-bottom"></view>
          </scroll-view>
        </swiper-item>
        
        <swiper-item class="order__swiper__item">
          <scroll-view :style="{height: `${swiperHeight}px`}" scroll-y>
            <view v-for="(item,index) in 6" :key="index" class="order__item">
              <view class="order__item__head tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
                <view class="order__item__head__title">订单编号：SF009098765798</view>
              </view>
              
              <view class="order__item__content tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-between">
                <view class="tn-flex tn-flex-nowrap tn-flex-direction-row tn-flex-col-center tn-flex-row-left">
                  <view class="order__item__content__image">
                    <image src="https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1664005699053-assets/web-upload/8645ea3a-e0a9-4422-8364-cc5ede305c9f.jpeg" mode="aspectFill"></image>
                  </view>
                  <view class="order__item__content__image">
                    <image src="https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1664005699069-assets/web-upload/20b02200-47de-4a03-8dd0-6fe8aa575e36.jpeg" mode="aspectFill"></image>
                  </view>
                </view>
                <view class="order__item__content__info tn-flex tn-flex-direction-column tn-flex-col-center tn-flex-row-center">
                  <view class="order__item__content__info__price">
                    <text class="order__item__content__info__price--unit">￥</text>
                    <text class="order__item__content__info__price__value--integer">2000</text>
                    <text class="order__item__content__info__price__value--decimal">.00</text>
                  </view>
                  <!-- <view class="order__item__content__info__count">
                    <text>共2件</text>
                  </view> -->
                </view>
              </view>
              
              <view class="order__item__operation tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-between">
                <view class="order__item__operaation__left">
                  <text class="order__item__operaation__left--text tn-color-gray">2023-12-12 16:12:28</text>
                </view>
                <view class="order__item__operation__right tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-right">
                  <view class="order__item__operation__right__button">
                    <tn-button shadow shape="round" fontColor="tn-color-white" backgroundColor="tn-bg-purplered" :fontSize="24" height="auto" padding="10rpx 18rpx">立即支付</tn-button>
                  </view>
                </view>
              </view>
            </view>
            <view class="tn-padding-bottom"></view>
          </scroll-view>
        </swiper-item>
        
        <swiper-item class="order__swiper__item">
          <scroll-view :style="{height: `${swiperHeight}px`}" scroll-y>
            <view v-for="(item,index) in 6" :key="index" class="order__item">
              <view class="order__item__head tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
                <view class="order__item__head__title">订单编号：SF009098765798</view>
              </view>
              
              <view class="order__item__content tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-between">
                <view class="tn-flex tn-flex-nowrap tn-flex-direction-row tn-flex-col-center tn-flex-row-left">
                  <view class="order__item__content__image">
                    <image src="https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1664015047073-assets/web-upload/e0cc8735-6391-4332-b8c9-8ada419b3a43.jpeg" mode="aspectFill"></image>
                  </view>
                  <view class="order__item__content__image">
                    <image src="https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1664015047018-assets/web-upload/b675a4eb-6423-46e3-96f5-687236021df2.jpeg" mode="aspectFill"></image>
                  </view>
                  <view class="order__item__content__image">
                    <image src="https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1664015047023-assets/web-upload/147b0b7f-8253-4b92-bc1d-e28db7f54096.jpeg" mode="aspectFill"></image>
                  </view>
                </view>
                <view class="order__item__content__info tn-flex tn-flex-direction-column tn-flex-col-center tn-flex-row-center">
                  <view class="order__item__content__info__price">
                    <text class="order__item__content__info__price--unit">￥</text>
                    <text class="order__item__content__info__price__value--integer">4000</text>
                    <text class="order__item__content__info__price__value--decimal">.00</text>
                  </view>
                  <!-- <view class="order__item__content__info__count">
                    <text>共4件</text>
                  </view> -->
                </view>
              </view>
              
              <view class="order__item__operation tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-between">
                <view class="order__item__operaation__left">
                  <text class="order__item__operaation__left--text tn-color-gray">2023-12-12 16:12:28</text>
                </view>
                <view class="order__item__operation__right tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-right">
                  <view class="order__item__operation__right__button">
                    <tn-button shadow shape="round" fontColor="tn-color-white" backgroundColor="tn-bg-orange" :fontSize="24" height="auto" padding="10rpx 18rpx">确认完成</tn-button>
                  </view>
                </view>
              </view>
            </view>
            <view class="tn-padding-bottom"></view>
          </scroll-view>
        </swiper-item>
        
        <swiper-item class="order__swiper__item">
          <scroll-view :style="{height: `${swiperHeight}px`}" scroll-y>
            <view v-for="(item,index) in 6" :key="index" class="order__item">
              <view class="order__item__head tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
                <view class="order__item__head__title">订单编号：SF009098765798</view>
              </view>
              
              <view class="order__item__content tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-between">
                <view class="tn-flex tn-flex-nowrap tn-flex-direction-row tn-flex-col-center tn-flex-row-left">
                  <view class="order__item__content__image">
                    <image src="https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1664015047529-assets/web-upload/af73d987-7e47-4ab9-8cc7-9ced5611552c.jpeg" mode="aspectFill"></image>
                  </view>
                  <view class="order__item__content__image">
                    <image src="https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1664015223233-assets/web-upload/1f3e6f2a-96eb-4796-818e-e94ec06d8872.jpeg" mode="aspectFill"></image>
                  </view>
                  <view class="order__item__content__image">
                    <image src="https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1664015223286-assets/web-upload/a389d645-024b-4804-9515-cf1cc6e8b5c0.jpeg" mode="aspectFill"></image>
                  </view>
                </view>
                <view class="order__item__content__info tn-flex tn-flex-direction-column tn-flex-col-center tn-flex-row-center">
                  <view class="order__item__content__info__price">
                    <text class="order__item__content__info__price--unit">￥</text>
                    <text class="order__item__content__info__price__value--integer">5000</text>
                    <text class="order__item__content__info__price__value--decimal">.00</text>
                  </view>
                  <!-- <view class="order__item__content__info__count">
                    <text>共5件</text>
                  </view> -->
                </view>
              </view>
              
              <view class="order__item__operation tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-between">
                <view class="order__item__operaation__left">
                  <text class="order__item__operaation__left--text tn-color-gray">2023-12-12 16:12:28</text>
                </view>
                <view class="order__item__operation__right tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-right">
                  <view class="order__item__operation__right__button">
                    <tn-button shadow shape="round" fontColor="tn-color-white" backgroundColor="tn-bg-blue" :fontSize="24" height="auto" padding="10rpx 18rpx">再次购买</tn-button>
                  </view>
                </view>
              </view>
            </view>
            <view class="tn-padding-bottom"></view>
          </scroll-view>
        </swiper-item>
        
      </swiper>
    </view>

    
    
  </view>
</template>

<script>
  import templatePageMixin from '@/libs/mixin/template_page_mixin.js'
  
  export default {
    name: 'TemplateOrder',
    mixins: [templatePageMixin],
    data() {
      return {
        list: [
          {name: '全部'},
          {name: '待支付'},
          {name: '进行中', count: 6},
          {name: '已完成'}
        ],
        tabsIndex: 0,
        swiperIndex: 0,
        swiperTop: 0,
        swiperHeight: 0
      }
    },
    onLoad() {
      
    },
    onReady() {
      this.$nextTick(() => {
        this.updateSwiperInfo()
      })
    },

    methods: {
      
      // 跳转
      tn(e) {
        uni.navigateTo({
          url: e,
        });
      },
      
      // 切换模式
      modeSwitch(index) {
        this.currentModeIndex = index
        this.showPassword = false
      },
      
      // 计算可滑动区域的高度信息
      updateSwiperInfo() {
        // 获取可滑动菜单的信息
        this._tGetRect('.order__tabs').then(res => {
          if (!res) {
            setTimeout(() => {
              this.updateSwiperInfo()
            }, 10)
            return
          }
          const systemInfo = uni.getSystemInfoSync()
          this.swiperTop = res.bottom - this.vuex_custom_bar_height
          this.swiperHeight = systemInfo.safeArea.height - res.bottom + systemInfo.statusBarHeight
        })
      },
      // 标签栏值发生改变
      tabsChange(index) {
        this.swiperIndex = index
      },
      // swiper-item位置发生改变
      swiperTransition(event) {
        this.$refs.tabs.setDx(event.detail.dx)
      },
      // swiper动画结束
      swiperAnimationFinish(event) {
        const current = event.detail.current
        this.$refs.tabs.setFinishCurrent(current)
        this.swiperIndex = current
        this.tabsIndex = current
      }
    }
  }
</script>

<style lang="scss" scoped>
  
  .template-order {
    background-color: #FFFFFF;
  }
  
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
  
  .order {
    &--wrap {
      position: fixed;
      left: 0;
      right: 0;
      width: 100%;
      background-color: inherit;
    }
    
    /* 导航栏 start */
    &__tabs {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      background-color: inherit;
    }
    /* 导航栏 end */
    
    /* swiper start */
    &__swiper {
      position: absolute;
      left: 0;
      right: 0;
      width: 100%;
      background-color: inherit;
      // padding: 0 16rpx;
    }
    /* swiper end */
    
    /* 订单内容 start */
    &__item {
      margin: 30rpx;
      padding: 36rpx 26rpx;
      background-color: #FFFFFF;
      border-radius: 15rpx;
      box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
      
      &:first-child {
        margin-top: 40rpx;
      }
      
      &:last-child {
        margin-bottom: 0;
      }
      
      /* 头部 start */
      &__head {
        
        &__title {
          padding-bottom: 10rpx;
          line-height: normal;
          
          &--right-icon {
            font-size: 24rpx;
            margin-left: 8rpx;
          }
        }
        
        &__status {
          font-size: 22rpx;
          color: #AAAAAA;
        }
      }
      /* 头部 end */
      
      /* 内容 start */
      &__content {
        
        margin-top: 20rpx;
        
        &__image {
          margin-right: 20rpx;
          
          image {
            width: 140rpx;
            height: 140rpx;
            border-radius: 10rpx;
          }
        }
        
        &__title {
          padding-right: 40rpx;
          display: -webkit-box;
          overflow: hidden;
          white-space: normal !important;
          text-overflow: ellipsis;
          word-wrap: break-word;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        
        &__info {
          
          &__price {
            &--unit {
              font-size: 20rpx;
            }
            &__value--integer, &__value--decimal {
              font-weight: bold;
            }
            &__value--decimal {
              font-size: 20rpx;
            }
          }
          
          &__count {
            color: #AAAAAA;
            font-size: 24rpx;
          }
        }
      }
      /* 内容 end */
      
      /* 操作按钮 start */
      &__operation {
        margin-top: 30rpx;
        
        &__right {
          &__button {
            margin-left: 10rpx;
          }
        }
      }
      /* 操作按钮 end */
    }
    /* 订单内容 end */
  }
  
  
</style>
