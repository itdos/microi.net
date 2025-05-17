<template>
  <view class="template-login">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed alpha customBack>
      <view slot="back" class='tn-custom-nav-bar__back'
        @click="goBack">
        <text class='icon tn-icon-left'></text>
        <text class='icon tn-icon-home-capsule-fill'></text>
      </view>
    </tn-nav-bar>
    
    <view class="login">
      <!-- 顶部背景图片-->
      <!-- <view class="login__bg login__bg--top">
        <image class="bg" src="https://tnuiimage.tnkjapp.com/login/2/login-top2.png" mode="widthFix"></image>
      </view> -->

      <view class="login__wrapper">
        <view class="tn-margin-left tn-margin-right tn-text-bold tn-color-white" style="font-size: 40rpx;">
          欢迎来到元宇宙
        </view>
       <view class="tn-margin tn-color-gray--dark tn-text-sm">
          开启您的元宇宙
        </view>
        
        <!-- 登录/注册切换 -->
        <!-- <view class="login-sussuspension login__mode tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-center">
          <view class="login__mode__item tn-flex-1" :class="[{'login__mode__item--active': currentModeIndex === 0}]" @tap.stop="modeSwitch(0)">
            登录
          </view>
          <view class="login__mode__item tn-flex-1" :class="[{'login__mode__item--active': currentModeIndex === 1}]" @tap.stop="modeSwitch(1)">
            注册
          </view>
          <view class="login__mode__slider tn-cool-bg-color-15--reverse" :style="[modeSliderStyle]"></view>
        </view> -->
        
        <!-- 输入框内容-->
        <view class="login__info tn-flex tn-flex-direction-column tn-flex-col-center tn-flex-row-center">
          <!-- 登录 -->
          <block v-if="currentModeIndex === 0">
            <view class="login__info__item__input tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-left">
              <view class="login__info__item__input__left-icon">
                <view class="tn-icon-phone"></view>
              </view>
              <view class="login__info__item__input__content">
                <input maxlength="20" placeholder-class="input-placeholder" placeholder="请输入手机号" />
              </view>
            </view>
            
            <!-- <view class="login__info__item__input tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-left">
              <view class="login__info__item__input__left-icon">
                <view class="tn-icon-lock"></view>
              </view>
              <view class="login__info__item__input__content">
                <input maxlength="20" placeholder-class="input-placeholder" placeholder="请输入密码" />
              </view>
            </view> -->
			<view class="login__info__item__input tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-left">
			  <view class="login__info__item__input__left-icon">
			    <view class="tn-icon-safe"></view>
			  </view>
			  <view class="login__info__item__input__content login__info__item__input__content--verify-code">
			    <input placeholder-class="input-placeholder" placeholder="请输入验证码" />
			  </view>
			  <view class="login__info__item__input__right-verify-code" @tap.stop="getCode">
			    <tn-button backgroundColor="#FFFFFF" fontColor="#000000" size="sm" padding="5rpx 10rpx" width="100%" shape="round">{{ tips }}</tn-button>
			  </view>
			</view>
          </block>
          <!-- 注册 -->
          <block v-if="currentModeIndex === 1">
            <view class="login__info__item__input tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-left">
              <view class="login__info__item__input__left-icon">
                <view class="tn-icon-phone"></view>
              </view>
              <view class="login__info__item__input__content">
                <input maxlength="20" placeholder-class="input-placeholder" placeholder="请输入手机/账号" />
              </view>
            </view>
            
            <view class="login__info__item__input tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-left">
              <view class="login__info__item__input__left-icon">
                <view class="tn-icon-safe"></view>
              </view>
              <view class="login__info__item__input__content login__info__item__input__content--verify-code">
                <input placeholder-class="input-placeholder" placeholder="请输入验证码" />
              </view>
              <view class="login__info__item__input__right-verify-code" @tap.stop="getCode">
                <tn-button backgroundColor="#FFFFFF" fontColor="#000000" size="sm" padding="5rpx 10rpx" width="100%" shape="round">{{ tips }}</tn-button>
              </view>
            </view>
            
            <view class="login__info__item__input tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-left">
              <view class="login__info__item__input__left-icon">
                <view class="tn-icon-lock"></view>
              </view>
              <view class="login__info__item__input__content">
                <input :password="!showPassword" placeholder-class="input-placeholder" placeholder="请输入登录密码" />
              </view>
              <view class="login__info__item__input__right-icon" @click="showPassword = !showPassword">
                <view :class="[showPassword ? 'tn-icon-eye' : 'tn-icon-eye-hide']"></view>
              </view>
            </view>
          </block>
          
          <!-- 悬浮按钮-->
          <view class="tn-flex tn-footerfixed" v-if="currentModeIndex === 0">
            <view class="tn-flex-1 justify-content-item tn-margin-right tn-margin-left-xs tn-text-center">
              <tn-button backgroundColor="#FFFFFF " padding="40rpx 0" width="60%" :fontSize="28" fontColor="#000000" shape="round"  @click="tn('')">
                <text class="">登 录 / 注 册</text>
              </tn-button>
            </view>
          </view>
          
          <!-- 悬浮按钮-->
          <view class="tn-flex tn-footerfixed" v-if="currentModeIndex === 1">
            <view class="tn-flex-1 justify-content-item tn-margin-right tn-margin-left-xs tn-text-center">
              <tn-button backgroundColor="#FFFFFF " padding="40rpx 0" width="60%" :fontSize="28" fontColor="#000000" shape="round"  @click="tn('')">
                <text class="">注 册</text>
              </tn-button>
            </view>
          </view>
          
          <view v-if="currentModeIndex === 1" :class="[{'login__info__item__tips': currentModeIndex === 0}]">
            <view class="tn-flex tn-flex-row-between tn-padding-xl">
              <view class="" style="color: #FFFFFF80;" @tap.stop="modeSwitch(0)">已有账号？前往登录</view>
            </view>
          </view>
          <!-- <view v-if="currentModeIndex === 0" :class="[{'login__info__item__tips': currentModeIndex === 1}]">
            <view class="tn-flex tn-flex-row-between tn-padding-xl">
              <view class="tn-padding-right" style="color: #FFFFFF80;" @tap.stop="modeSwitch(1)">账号注册</view>
              <view class="tn-padding-left" style="color: #FFFFFF80;" @click="tn('../forget/forget')">忘记密码？</view>
            </view>
          </view> -->
          
        </view>
        
        <!-- 其他登录方式 -->
        <!-- <view class="login__way tn-flex tn-flex-col-center tn-flex-row-center">
          <view class="tn-padding-sm tn-margin-xs">
            <view class="login__way__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-color-teal--dark">
              <view class="tn-icon-wechat-fill"></view>
            </view>
          </view>
          <view class="tn-padding-sm tn-margin-xs">
            <view class="login__way__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-color-red">
              <view class="tn-icon-sina"></view>
            </view>
          </view>
          <view class="tn-padding-sm tn-margin-xs">
            <view class="login__way__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-color-blue">
              <view class="tn-icon-qq"></view>
            </view>
          </view>
        </view> -->
        
        
      </view>
      
      <!-- 底部背景图片-->
      <!-- <view class="login__bg login__bg--bottom">
        <image src="https://tnuiimage.tnkjapp.com/login/2/login-bottom2.png" mode="widthFix"></image>
      </view> -->
  
    </view>
    
    <!-- 验证码倒计时 -->
    <tn-verification-code
      ref="code"
      uniqueKey="login-demo-4"
      :seconds="60"
      @change="codeChange">
    </tn-verification-code>
  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  export default {
    name: 'login-demo-4',
    mixins: [template_page_mixin],
    data() {
      return {
        // 当前选中的模式
        currentModeIndex: 0,
        // 模式选中滑块
        modeSliderStyle: {
          left: 0
        },
        // 是否显示密码
        showPassword: false,
        // 倒计时提示文字
        tips: '获取验证码'
      }
    },
    watch: {
      currentModeIndex(value) {
        const sliderWidth = uni.upx2px(476 / 2)
        this.modeSliderStyle.left = `${sliderWidth * value}px`
      }
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
      // 获取验证码
      getCode() {
        if (this.$refs.code.canGetCode) {
          this.$t.message.loading('正在获取验证码')
          setTimeout(() => {
            this.$t.message.closeLoading()
            this.$t.message.toast('验证码已经发送')
            // 通知组件开始计时
            this.$refs.code.start()
          }, 2000)
        } else {
          this.$t.message.toast(this.$refs.code.secNum + '秒后再重试')
        }
      },
      // 获取验证码倒计时被修改
      codeChange(event) {
        this.tips = event
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
    
  }
  
  /* 悬浮 */
  /* .login-sussuspension{
    animation: suspension 3s ease-in-out infinite;
  }
  
  @keyframes suspension {
    0%, 100% {
      transform: translate(0 , 0);
    }
    50% {
      transform: translate(0rem , 1rem);
    }
  } */
  
  .login {
    position: relative;
    height: 100%;
    z-index: 1;
    
    /* 背景图片 start */
    &__bg {
      z-index: -1;
      position: fixed;
      
      &--top {
        top: 0;
        left: 0;
        right: 0;
        width: 100%;
        
        .bg {
          width: 750rpx;
          will-change: transform;
        }
      }
      
      &--bottom {
        bottom: -10rpx;
        left: 0;
        right: 0;
        width: 100%;
        // height: 144px;
        margin-bottom: env(safe-area-inset-bottom);
        
        image {
          width: 750rpx;
          will-change: transform;
        }
      }
    }
    /* 背景图片 end */
    
    /* 内容 start */
    &__wrapper {
      margin-top: 300rpx;
      width: 100%;
    }
    
    /* 切换 start */
    &__mode {
      position: relative;
      margin: 0 auto;
      width: 476rpx;
      height: 77rpx;
      margin-top: 100rpx;
      background-color: rgba(255,255,255,0.6);
      box-shadow: 0rpx 10rpx 50rpx 0rpx rgba(0, 3, 72, 0.1);
      border-radius: 39rpx;
      
      &__item {
        height: 77rpx;
        width: 100%;
        line-height: 77rpx;
        text-align: center;
        font-size: 31rpx;
        color: #080808;
        letter-spacing: 1em;
        text-indent: 1em;
        z-index: 2;
        transition: all 0.4s;
        
        &--active {
          font-weight: bold;
          color: #FFFFFF;
        }
      }
      
      &__slider {
        position: absolute;
        height: inherit;
        width: calc(476rpx / 2);
        border-radius: inherit;
        box-shadow: 0rpx 18rpx 72rpx 18rpx rgba(0, 195, 255, 0.1);
        z-index: 1;
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      }
    }
    /* 切换 end */
    
    /* 登录注册信息 start */
    &__info {
      margin: 80rpx 30rpx 10rpx 30rpx;
      padding-bottom: 0;
      border-radius: 20rpx;
      
      &__item {
        
        &__input {
          margin-top: 59rpx;
          width: 100%;
          height: 77rpx;
          border: 1rpx solid #E6E6E6;
          border-radius: 39rpx;
          
          &__left-icon {
            width: 10%;
            font-size: 44rpx;
            margin-left: 20rpx;
            color: #838383;
          }
          
          &__content {
            color: #FFFFFF;
            width: 80%;
            padding-left: 10rpx;
            
            &--verify-code {
              width: 56%;
            }
            
            input {
              font-size: 24rpx;
              // letter-spacing: 0.1em;
            }
          }
          
          &__right-icon {
            width: 10%;
            font-size: 44rpx;
            margin-right: 20rpx;
            color: #838383;
          }
          
          &__right-verify-code {
            width: 34%;
            margin-right: 20rpx;
          }
        }
        
        &__tips {
          margin: 30rpx 0;
          color: #AAAAAA;
        }
      }
    }
    /* 登录注册信息 end */
    
    /* 登录方式切换 start */
    &__way {
      margin: 0 auto;
      margin-top: 110rpx;
      
      &__item {
        &--icon {
          width: 85rpx;
          height: 85rpx;
          font-size: 80rpx;
          // border-radius: 100rpx;
          margin-bottom: 18rpx;
          position: relative;
          z-index: 1;
          
          // &::after {
          //   content: " ";
          //   position: absolute;
          //   z-index: -1;
          //   width: 100%;
          //   height: 100%;
          //   left: 0;
          //   bottom: 0;
          //   border-radius: inherit;
          //   opacity: 1;
          //   transform: scale(1, 1);
          //   background-size: 100% 100%;
          //   background-image: url(https://tnuiimage.tnkjapp.com/cool_bg_image/icon_bg5.png);
          // }
        }
      }
    }
    /* 登录方式切换 end */
    /* 内容 end */
    
  }
  
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
  
  /deep/.input-placeholder {
    font-size: 24rpx;
    color: #838383;
  }
  
</style>
