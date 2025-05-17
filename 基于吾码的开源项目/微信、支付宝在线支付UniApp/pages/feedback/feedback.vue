<template>
  <view class="template-edit">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed customBack :bottomShadow="false" backgroundColor="#16171D">
      <view slot="back" class='tn-custom-nav-bar__back'
        @click="goBack">
        <text class='icon tn-icon-left-arrow'></text>
      </view>
      <!-- <view class="tn-flex tn-flex-col-center tn-flex-row-center ">
        <text class="tn-text-bold tn-text-xl tn-color-black">新增收货地址</text>
      </view> -->
    </tn-nav-bar>
    
    
    <view class="tn-color-white" :style="{paddingTop: vuex_custom_bar_height + 20 + 'px'}">
      <!-- <view class="tn-text-center tn-padding-bottom">
        <view class="tn-icon-map-fill" style="font-size: 120rpx;"></view>
        <view class="tn-text-lg tn-padding-top" style="opacity: 0.5;">新增收货地址！</view>
      </view> -->
      
      <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding">
        <view class="justify-content-item">
          <view class="tn-text-bold tn-text-lg">
            您的称呼 <text class="tn-color-orange tn-padding-left-xs">*</text>
          </view>
          <view class="tn-color-gray tn-padding-top-xs tn-color-white">
            <input placeholder="请输入您的称呼" name="input" placeholder-style="color:#AAAAAA" value=""></input>
          </view>
        </view>
        <view class="justify-content-item tn-text-xl tn-color-gray">
          <view class="tn-icon-my tn-padding-top"></view>
        </view>
      </view>
      
      <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding">
        <view class="justify-content-item">
          <view class="tn-text-bold tn-text-lg">
            手机号码 <text class="tn-color-orange tn-padding-left-xs">*</text>
          </view>
          <view class="tn-color-gray tn-padding-top-xs tn-color-white">
            <input placeholder="请输入手机号码" name="input" placeholder-style="color:#AAAAAA" value=""></input>
          </view>
        </view>
        <view class="justify-content-item tn-text-xl tn-color-gray">
          <view class="tn-icon-phone tn-padding-top"></view>
        </view>
      </view>
	  
      
      <!-- <view class="">
        <tn-picker mode="region" v-model="show" :areaCode='["44", "4401", "440106"]'  @confirm="confirmPicker"></tn-picker>
      </view> -->
      
      <!-- <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding" @tap="showPicker">
        <view class="justify-content-item">
          <view class="tn-text-bold tn-text-lg">
            地区信息 <text class="tn-color-orange tn-padding-left-xs">*</text>
          </view>
          <view class="tn-color-gray tn-padding-top-xs">
            {{ result }}
          </view>
        </view>
        <view class="justify-content-item tn-text-lg tn-color-gray">
          <view class="tn-icon-right tn-padding-top"></view>
        </view>
      </view> -->
      
      <view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding">
        <view class="tn-flex justify-content-item">
          <view class="tn-text-bold tn-text-lg">
            反馈内容 <text class="tn-color-orange tn-padding-left-xs">*</text>
          </view>
        </view>
        <!-- <view class="tn-flex justify-content-item tn-color-gray">
          200字内
        </view> -->
      </view>
      
      <view class="box-shadow tn-padding" style="border-radius: 10rpx;margin: 0rpx 30rpx 30rpx 30rpx;">
        <textarea maxlength="500" placeholder="请填写反馈内容" placeholder-style="color:#AAAAAA" style="height: 300rpx;width: 100%;"></textarea>
      </view>
      
      <!-- <view class="tn-text-bold tn-text-lg tn-padding tn-text-justify tn-strip-top">
        <text>补充相关要求</text>
        <text class="tn-text-sm tn-padding-left-xs" style="opacity: 0.5;">为你提供更好的服务</text>
      </view>
      
      
      
      
      
      <picker @change="bindPickerChange" :value="index" :range="array">
        <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding">
          <view class="justify-content-item">
            <view class="tn-text-bold tn-text-lg">
              指定发货方式 <text class="tn-color-orange tn-padding-left-xs">*</text>
            </view>
            <view class="tn-color-gray tn-padding-top-xs" v-if="index===99">
              请选择
            </view>
            <view class="tn-color-gray tn-padding-top-xs" v-else>
              {{array[index]}}
            </view>
          </view>
          <view class="justify-content-item tn-text-lg tn-color-gray">
            <view class="tn-icon-right tn-padding-top"></view>
          </view>
        </view>
      </picker>
      
      <picker @change="bindDateChange" :value="index1" :range="array1">
        <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding">
          <view class="justify-content-item">
            <view class="tn-text-bold tn-text-lg">
              期望收货时间 <text class="tn-color-orange tn-padding-left-xs">*</text>
            </view>
            <view class="tn-color-gray tn-padding-top-xs" v-if="index1===99">
              请选择
            </view>
            <view class="tn-color-gray tn-padding-top-xs" v-else>
              {{array1[index1]}}
            </view>
          </view>
          <view class="justify-content-item tn-text-lg tn-color-gray">
            <view class="tn-icon-right tn-padding-top"></view>
          </view>
        </view>
      </picker> -->
      
      
      <!-- 悬浮按钮-->
      <view class="tn-flex tn-footerfixed">
        <view class="tn-flex-1 justify-content-item tn-margin-right tn-margin-left-xs tn-text-center">
          <tn-button backgroundColor="#FFFFFF " padding="40rpx 0" width="60%" :fontSize="28" fontColor="#000000" shape="round" @click="">
            <text class="">提 交</text>
          </tn-button>
        </view>
      </view>
      
      
      
    </view>
  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  export default {
    name: 'TemplateEdit',
    mixins: [template_page_mixin],
    data(){
      return {
        show: false,
        index: 99,
        array: ['暂无要求', '快递送货上门', '物流送货上门-包卸货', '物流送货上门-不包卸货', '物流站点自提', '买家上门自提'],
        
        index1: 99,
        array1: ['暂无要求', '紧急采购（3天）', '正常采购（一周）', '非紧急采购（协商时间）'],
        
        result: '请选择收货地区',
        areaCode: [],
        
      }
    },
    methods: {
      // 跳转
      tn(e) {
      	uni.navigateTo({
      		url: e,
      	});
      },
      
      bindPickerChange: function(e) {
        this.index = e.detail.value
      },
      bindDateChange: function(e) {
        this.index1 = e.detail.value
      },
      
      // 打开Picker
      openPicker() {
        this.show = true
      },
      // 弹出Picker
      showPicker(event) {
        this.openPicker()
      },
      // 切换默认地区
      defaultRegionChange(event) {
        if (event.index === 0) {
          this.defaultRegion = ['广东省','广州市','天河区']
          this.areaCode = []
        } else if (event.index === 1) {
          this.defaultRegion = []
          this.areaCode = ['44','4401','440111']
        }
        this.openPicker()
      },
      // 切换点击遮罩关闭
      maskCloseableChange(event) {
        this.maskCloseable = event.index === 0 ? true : false
        this.openPicker()
      },
      
      // 点击确认按钮
      confirmPicker(event) {
        this.result = `${event.province.label}-${event.city.label}-${event.area.label}`
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
  
  /* 页面阴影 start*/
  .box-shadow {
    border-radius: 15rpx;
    border: 1rpx solid #494B51;
    background-color: rgba(255, 255, 255, 0.08);
    // box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
  }
  
    /* 间隔线 start*/
    .tn-strip-bottom-min {
      width: 100%;
      border-bottom: 1rpx solid #F8F9FB08;
    }
    
    .tn-strip-top {
     width: 100%;
     border-top: 20rpx solid #F8F9FB08;
    }
     /* 间隔线 end*/
   
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
