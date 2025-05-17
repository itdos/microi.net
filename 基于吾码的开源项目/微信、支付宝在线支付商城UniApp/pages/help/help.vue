<template>
  <view class="template-help tn-safe-area-inset-bottom">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed alpha customBack>
      <view slot="back" class='tn-custom-nav-bar__back'
        @click="goBack">
        <text class='icon tn-icon-left-arrow'></text>
      </view>
    </tn-nav-bar>

    <view class="tn-margin-bottom-xl tn-padding-bottom tn-color-white" :style="{paddingTop: vuex_custom_bar_height + 10 + 'px'}">
      
      <view class="tn-flex tn-flex-row-between tn-padding tn-strip-bottom-min tn-margin-top-xs">
        <view class="justify-content-item">
          <view class="tn-text-bold tn-text-xl">
            常见问题
          </view>
        </view>
      </view>
      <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding tn-margin-top-xs" v-for="(item, index) in helpList" :key="index" @click="tn('/minePages/default')">
        <view class="justify-content-item">
          <view class="tn-text-df">
            {{ item.title }}
          </view>
        </view>
        <view class="justify-content-item tn-text-lg tn-color-gray">
          <view class="tn-icon-right"></view>
        </view>
      </view>
      
      <!-- <view class="tn-flex tn-flex-row-between tn-padding tn-strip-bottom-min tn-margin-top-xl">
        <view class="justify-content-item">
          <view class="tn-text-bold tn-text-xl">
            登录问题
          </view>
        </view>
      </view>
      <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding tn-margin-top-xs" v-for="(item, index) in helpList" :key="index" @click="tn('/minePages/default')">
        <view class="justify-content-item">
          <view class="tn-text-df">
            {{ item.title }}
          </view>
        </view>
        <view class="justify-content-item tn-text-lg tn-color-gray">
          <view class="tn-icon-right"></view>
        </view>
      </view>
      
      <view class="tn-flex tn-flex-row-between tn-padding tn-strip-bottom-min tn-margin-top-xl">
        <view class="justify-content-item">
          <view class="tn-text-bold tn-text-lg">
            其他问题
          </view>
        </view>
      </view>
      <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding tn-margin-top-xs" v-for="(item, index) in helpList" :key="index" @click="tn('/minePages/default')">
        <view class="justify-content-item">
          <view class="tn-text-df">
            {{ item.title }}
          </view>
        </view>
        <view class="justify-content-item tn-text-lg tn-color-gray">
          <view class="tn-icon-right"></view>
        </view>
      </view> -->
      
    </view>
    
    
  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  export default {
    name: 'TemplateHelp',
    mixins: [template_page_mixin],
    data(){
      return {
        helpList: [
        	{
        		title: "不登录游戏客也能购买虚拟物品吗？",
        		name: "",
        	},
        	{
        		title: "注册帐号收不到验证码？",
				name: "",
        	},
        	{
        		title: "无法修改密码？",
				name: "",
        	},
          {
          	title: "无法授权登录？",
            name: "",
          },
        	{
        		title: "忘记密码？",
				name: "",
        	},
          {
          	title: "手机登录无法收到验证码",
            name: "",
          }
        ]
      }
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
      border-bottom: 1rpx solid #F8F9FB08;
    }
    
    .tn-strip-top {
     width: 100%;
     border-top: 20rpx solid #F8F9FB08;
    }
     /* 间隔线 end*/
</style>
