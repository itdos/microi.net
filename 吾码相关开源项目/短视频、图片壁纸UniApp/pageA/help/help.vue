<template>
  <view class="tn-safe-area-inset-bottom">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed customBack :bottomShadow="false" backgroundColor="#FFFFFF">
      <view slot="back" class='tn-custom-nav-bar__back'
        @click="goBack">
        <text class='icon tn-icon-left-arrow'></text>
      </view>
      <view class="tn-flex tn-flex-col-center tn-flex-row-center ">
        <text class="tn-text-bold tn-text-xl tn-color-black">帮助中心</text>
      </view>
    </tn-nav-bar>

    <view class="tn-margin-bottom-xl" :style="{paddingTop: vuex_custom_bar_height + 'px'}">
      
      <view class="tn-flex tn-flex-row-between tn-padding tn-strip-bottom-min tn-margin-top-xs">
        <view class="justify-content-item">
          <view class="tn-text-bold tn-text-lg">
            常见问题
          </view>
        </view>
      </view>
      <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding tn-margin-top-xs" v-for="(item, index) in helpList" :key="index" @click="tn('/minePages/content')">
        <view class="justify-content-item">
          <view class="tn-text-df">
            {{ item.title }}
          </view>
        </view>
        <view class="justify-content-item tn-text-lg tn-color-grey">
          <view class="tn-icon-right"></view>
        </view>
      </view>
      
      <view class="tn-flex tn-flex-row-between tn-padding tn-strip-bottom-min tn-strip-top">
        <view class="justify-content-item">
          <view class="tn-text-bold tn-text-lg">
            登录问题
          </view>
        </view>
      </view>
      <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding tn-margin-top-xs" v-for="(item, index) in helpList" :key="index" @click="tn('/minePages/content')">
        <view class="justify-content-item">
          <view class="tn-text-df">
            {{ item.title }}
          </view>
        </view>
        <view class="justify-content-item tn-text-lg tn-color-grey">
          <view class="tn-icon-right"></view>
        </view>
      </view>
      
      <view class="tn-flex tn-flex-row-between tn-padding tn-strip-bottom-min tn-strip-top">
        <view class="justify-content-item">
          <view class="tn-text-bold tn-text-lg">
            其他问题
          </view>
        </view>
      </view>
      <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding tn-margin-top-xs" v-for="(item, index) in helpList" :key="index" @click="tn('/minePages/content')">
        <view class="justify-content-item">
          <view class="tn-text-df">
            {{ item.title }}
          </view>
        </view>
        <view class="justify-content-item tn-text-lg tn-color-grey">
          <view class="tn-icon-right"></view>
        </view>
      </view>
      
    </view>
    
    
    <!-- <view class="tn-footerfixed tn-flex tn-flex-row-between tn-flex-col-center tn-padding tn-safe-area-inset-bottom tn-bg-white">
      <view class="justify-content-item tn-padding-bottom" @click="tn('/pageB/chat/chatGPT')">
        <view class="tn-flex tn-flex-col-center tn-flex-row-left">
          <view class="user-pic">
            <view class="user-image">
              <view class="tn-shadow-blur" style="background-image:url('https://resource.tuniaokj.com/images/blogger/blogger_beibei.jpg');width: 100rpx;height: 100rpx;background-size: cover;">
              </view>
            </view>
          </view>
          <view class="tn-padding-right tn-color-black">
            <view class="tn-padding-right tn-padding-left-sm">
              <text class="tn-text-lg tn-text-bold">智能助手</text>
              <text class="tn-padding-left-sm">129号</text>
            </view>
            <view class="tn-padding-right tn-padding-top-xs tn-padding-left-sm tn-text-ellipsis">
              <text class="tn-color-black tn-text-bold">捉住那只猪科技有限公司</text>
            </view>
          </view>
        </view>
      </view>
      <view class="justify-content-item tn-flex-col-center tn-flex-row-center tn-text-center tn-padding-bottom"  @click="showModal">
        <view class="">
          <text class="tn-icon-wechat-fill tn-color-green--dark" style="font-size: 50rpx;"></text>
        </view>
        <view class="">
          <text class="tn-text-sm">作者微信</text>
        </view>
      </view>
    </view> -->
    
    <!-- <tn-modal v-model="show1" :custom="true">
      <view class="custom-modal-content">
        <image @tap="previewQRCodeImage" src='https://resource.tuniaokj.com/images/advertise/qrcode.jpg' mode='aspectFill' style="width: 100%;"></image>
        <view class="tn-text-center tn-padding-top">作者微信：tnkewo</view>
        <view class="tn-text-center tn-padding-top tn-text-lg">长按识别客服微信二维码</view>
      </view>
    </tn-modal> -->
    
        <view class='tn-tabbar-height'></view>
  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  export default {
    name: 'TemplateHelp',
    mixins: [template_page_mixin],
    data(){
      return {
        show1: false,
        helpList: [
        	{
        		title: "关于隐私授权",
        		name: "",
        	},
        	{
        		title: "图片版权问题",
            name: "",
        	},
        	{
        		title: "账号无法退出切换账号",
            name: "",
        	},
          {
          	title: "无法授权微信登录",
            name: "",
          },
        	{
        		title: "积分记录不见了",
            name: "",
        	},
          {
          	title: "智能ai创作等待时间过长",
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
      
      // 预览作者图片
      previewQRCodeImage() {
        wx.previewImage({
          urls: ['https://resource.tuniaokj.com/images/advertise/qrcode.jpg']
        })
      },
      
      // 弹出模态框
      showModal(event) {
        this.openModal()
      },
      // 打开模态框
      openModal() {
        this.show1 = true
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
      border-bottom: 1rpx solid #F8F9FB;
    }
    
    .tn-strip-top {
     width: 100%;
     border-top: 20rpx solid rgba(241, 241, 241, 0.8);
    }
     /* 间隔线 end*/
     
     
    /* 用户头像 start */
    .user-image {
      width: 90rpx;
      height: 90rpx;
      position: relative;
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
    
    /* 底部悬浮按钮 start*/
     .tn-tabbar-height {
       min-height: 120rpx;
       height: calc(140rpx + env(safe-area-inset-bottom) / 2);
       height: calc(140rpx + constant(safe-area-inset-bottom));
     }
    .tn-footerfixed {
      position: fixed;
      background-color: rgba(255,255,255,0.5);
      box-shadow: 0rpx 0rpx 30rpx 0rpx rgba(0, 0, 0, 0.07);
      bottom: 0;
      width: 100%;
      transition: all 0.25s ease-out;
      z-index: 100;
    } 
</style>
