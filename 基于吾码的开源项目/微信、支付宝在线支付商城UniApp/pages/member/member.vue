<template>
  <view class="template-member">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed customBack :bottomShadow="false" backgroundColor="#16171D">
      <view slot="back" class='tn-custom-nav-bar__back'
        @click="goBack">
        <text class='icon tn-icon-left-arrow'></text>
      </view>
      <view class="tn-flex tn-flex-col-center tn-flex-row-center ">
        <text class="tn-text-bold tn-text-xl tn-color-white">会员权益</text>
      </view>
    </tn-nav-bar>

    <view class="tn-color-white" :style="{paddingTop: vuex_custom_bar_height + 10 +'px'}">
      
      <view class="box-shadow" style="border-radius: 10rpx;overflow: hidden;margin: 50rpx 30rpx 30rpx 30rpx;">
        
        <view class="tn-flex tn-flex-row-between tn-padding tn-text-center">
          <view class="tn-flex-1">
            <view class="tn-text-bold tn-text-lg">
              游客
            </view>
            <view class="tn-text-sm tn-color-gray tn-padding-top-xs" style="opacity: 0.5;">
              也能购买
            </view>
          </view>
          <view class="tn-flex-1">
            <view class="tn-text-bold tn-text-lg">
              普通用户
            </view>
            <view class="tn-text-sm tn-color-gray tn-padding-top-xs" style="opacity: 0.5;">
              已登录用户
            </view>
          </view>
          <view class="tn-flex-1">
            <view class="tn-text-bold tn-text-lg">
              至尊VIP
            </view>
            <view class="tn-text-sm tn-color-gray tn-padding-top-xs" style="opacity: 0.5;">
              积分双倍
            </view>
          </view>
        </view>
        
        <view class="tn-flex tn-flex-row-between tn-flex-col-center tn-strip-top-min tn-padding-sm" v-for="(item, index) in setList" :key="index" @click="tn(item.url)">
          <view class="tn-flex-1 tn-text-center">
            <view class="tn-text-center">
              {{ item.title }}
            </view>
            <view class="tn-color-gray tn-text-xs tn-text-center">
              {{ item.title2 }}
            </view>
          </view>
          <view class="tn-flex-1">
            <view class="tn-text-center">
              {{ item.common }}
            </view>
            <view class="tn-color-gray tn-text-xs tn-text-center">
              {{ item.common2 }}
            </view>
          </view>
          <view class="tn-flex-1">
            <view class="tn-text-center">
              {{ item.vip }}
            </view>
            <view class="tn-color-gray tn-text-xs tn-text-center">
              {{ item.vip2 }}
            </view>
          </view>
        </view>
        
      </view>
      
      <!-- 悬浮按钮-->
      <view class="tn-flex tn-footerfixed">
        <view class="tn-flex-1 justify-content-item tn-margin-right tn-margin-left-xs tn-text-center">
			
          <tn-button backgroundColor="#FFFFFF " padding="40rpx 0" width="60%" :fontSize="28" fontColor="#000000" shape="round" @click="VipStart()">
            <text class="">立即开通</text>
          </tn-button>
        </view>
      </view>
      
    </view>
    
    <view class='tn-tabbar-height'></view>
    
  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  export default {
    name: 'TemplateMember',
    mixins: [template_page_mixin],
    data(){
      return {
        setList: [
        	{
        		title: "虚拟材料",
				title2: "可直接购买",
				common: "订单记录",
				common2: "可查询历史订单",
				vip: "双倍积分",
				vip2: "更快合成"
        	},
        	{
        		title: "实物",
				title2: "可直接购买",
        		common: "订单记录",
        		common2: "管理收货地址",
        		vip: "双倍积分",
        		vip2: "更多特权"
        	}
        ]
      }
    },
    methods: {
      VipStart(){
		  var self = this;
		  
	  },
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
    .tn-strip-top-min {
      width: 100%;
      border-top: 1rpx solid #F8F9FB08;
    }
    
    .tn-strip-bottom {
     width: 100%;
     border-bottom: 20rpx solid #F8F9FB08;
    }
     /* 间隔线 end*/

  /* 页面阴影 start*/
  .box-shadow {
    border-radius: 15rpx;
    border: 1rpx solid #494B51;
    background-color: rgba(255, 255, 255, 0.08);
    // box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
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

  /* 底部安全边距 start*/
  .tn-tabbar-height {
  	min-height: 140rpx;
  	height: calc(160rpx + env(safe-area-inset-bottom) / 2);
    height: calc(160rpx + constant(safe-area-inset-bottom));
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
