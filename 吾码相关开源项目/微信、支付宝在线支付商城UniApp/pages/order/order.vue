<template>
  <view class="template-order tn-safe-area-inset-bottom">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed customBack :bottomShadow="false" backgroundColor="#16171D">
      <view slot="back" class='tn-custom-nav-bar__back' @click="goBack">
        <text class='icon tn-icon-left-arrow'></text>
      </view>
      <view class="tn-flex tn-flex-col-center tn-flex-row-center">
        <text class="tn-text-xl tn-color-white">全部订单</text>
      </view>
    </tn-nav-bar>
    
    <view class="top-fixed" :style="{paddingTop: vuex_custom_bar_height + 10 +'px'}" style="background-color:#16171D;">
      <tn-tabs :list="fixedList" :current="current" :isScroll="false" inactiveColor="#FFFFFF80" activeColor="#FFFFFF" bold="true" backgroundColor="#16171D" :fontSize="32" :badgeOffset="[20, 50]" @change="tabChange"></tn-tabs>
    </view>
    
    
    <view class="" :style="{paddingTop: vuex_custom_bar_height + 60 +'px'}">
      <view v-for="(item,index) in OrderList" :key="index" class="order__item"  @click="V8.NavigateTo('/pages/order/order-info?Id=' + item.Id)">
        <view class="order__item__head tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
          <view class="order__item__head__title">
            <text class="">订单编号：{{ item.OutTradeNo }}</text>
            <text class="tn-icon-copy tn-text-sm tn-padding-left-sm" style="opacity: 0.5;"></text>
          </view>
        </view>
        
        <view class="order__item__content tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-between">
          <view class="tn-flex tn-flex-nowrap tn-flex-direction-row tn-flex-col-center tn-flex-row-left">
            <view class="order__item__content__image">
              <image src="/static/img/5555.png" mode="aspectFill"></image>
            </view>
            <!-- <view class="order__item__content__image">
              <image src="/static/img/5555.png" mode="aspectFill"></image>
            </view> -->
            <!-- <view class="order__item__content__image">
              <image src="/static/img/5555.png" mode="aspectFill"></image>
            </view> -->
            <view class="order__item__content__title">
              {{ item.Subject }}
            </view>
          </view>
          <view class="order__item__content__info tn-flex tn-flex-direction-column tn-flex-col-center tn-flex-row-center">
            <view class="order__item__content__info__price">
              <text class="order__item__content__info__price--unit">￥</text>
              <text class="order__item__content__info__price__value--integer">{{ item.TotalAmount }}</text>
              <!-- <text class="order__item__content__info__price__value--decimal">.00</text> -->
            </view>
            <view class="order__item__content__info__count">
              <text>共1件</text>
            </view>
          </view>
        </view>
        
        <view class="order__item__operation tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-between">
          <view class="order__item__operaation__left tn-text-sm" style="opacity: 0.5;">
            <text class="tn-icon-time tn-padding-right-xs"></text>
            <text class="">{{item.DingdanSJ}}</text>
          </view>
          <view class="order__item__operation__right tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-right">
            <view class="order__item__operation__right__button">
              <tn-button backgroundColor="#FFFFFF" padding="10rpx 18rpx" height="auto" width="100%" :fontSize="22" :plain="true" fontColor="#FFFFFF" shape="round" @click="tn('')">
                再次购买
              </tn-button>
            </view>
          </view>
        </view>
      </view>
    </view>
    
   
    <view class='tn-tabbar-height'></view>

  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  export default {
    name: 'TemplateOrder',
    mixins: [template_page_mixin],
    data() {
      return {
        
        current: 0,
        fixedList: [
          {name: '全部'},
          {name: '未付款'},
          {name: '已付款'},
          {name: '已完成'},
          {name: '已取消'},
        ],
        OrderList : [],
        cardCur: 0,
        swiperList: [{
          id: 0,
          type: 'image',
          title: '免费开源',
          name: '商业合作请联系作者',
          text: '微信：tnkewo',
          url: '/static/img/2222.png',
        }, {
          id: 1,
          type: 'image',
          title: '图鸟南南',
          name: '欢迎加入东东们',
          text: '如果你也有不错的作品',
          url: 'https://cdn.nlark.com/yuque/0/2023/jpeg/280373/1684559618695-assets/web-upload/1eb6456a-4796-40e6-8058-f21127a8e751.jpeg',
        }],
      }
    },
	onShow() {
		this.GetMyOrderList();
	},
    methods: {
		GetMyOrderList(){
			var self = this;
			if(self.BtnLoading){
				return;
			}
			var zhuangtai = '';
			if(this.current){
				zhuangtai = this.fixedList[this.current].name;
			}
			self.V8.ApiEngine.Run('get-myorder-list', {
				Zhuangtai : zhuangtai
			}, function(result) {
				if (self.V8.CheckResult(result)){
					self.OrderList = result.Data;
				}
			})
		},
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
      
      // cardSwiper
      cardSwiper(e) {
        this.cardCur = e.detail.current
      },
    }
  }
</script>

<style lang="scss" scoped>
  .template-order {
  }

  /* 底部安全边距 start*/
  .tn-tabbar-height {
    min-height: 40rpx;
    height: calc(60rpx + env(safe-area-inset-bottom) / 2);
    height: calc(60rpx + constant(safe-area-inset-bottom));
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
    border-radius: 100rpx;
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
  
  .top-fixed{
    position: fixed;
    top: 0;
    width: 100%;
    transition: all 0.25s ease-out;
    z-index: 100;
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
    
    /* 订单内容 start */
    &__item {
      color: #FFFFFF;
      margin: 30rpx;
      padding: 36rpx 26rpx;
      border-radius: 15rpx;
      border: 1rpx solid #494B51;
      background-color: rgba(255, 255, 255, 0.08);
      border-radius: 15rpx;
      // box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
      
      &:first-child {
        margin-top: 40rpx;
      }
      
      &:last-child {
        margin-bottom: 0;
      }
      
      /* 头部 start */
      &__head {
        
        &__title {
          font-weight: bold;
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
        margin-top: 20rpx;
        
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