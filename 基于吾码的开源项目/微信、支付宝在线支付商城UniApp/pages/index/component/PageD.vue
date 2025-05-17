<template>
  <view class="pagesD tn-safe-area-inset-bottom">
    <!-- 顶部自定义导航 -->
    <!-- <tn-nav-bar :isBack="false" :bottomShadow="false" backgroundColor="none">
      <view class="custom-nav tn-flex tn-flex-col-center tn-flex-row-left" @click="tn('')">
        <view class="custom-nav__back">
          <view class="tn-icon-notice tn-color-gray" style="font-size: 50rpx;">
          </view>
        </view>
      </view>
    </tn-nav-bar> -->

    <view class="tn-margin-left tn-margin-right" :style="{paddingTop: vuex_custom_bar_height + 5 + 'px'}">
      <view class="">

        <!-- 图标logo/头像 -->
        <view class="tn-flex tn-flex-row-between tn-flex-col-center tn-margin-bottom"  @click="V8.NavigateTo('/pages/set/set', true)">
          <view class="justify-content-item">
            <view class="tn-flex tn-flex-col-center tn-flex-row-left">
              <view class="logo-pic tn-shadow">
                <view class="logo-image">
                  <view class="tn-shadow-blur"
                    style="background-image:url('/static/img/002.png');width: 110rpx;height: 110rpx;background-size: cover;overflow: hidden;">
                  </view>
                </view>
              </view>
              <view class="tn-padding-right">
                <view class="tn-padding-right tn-padding-left-sm">
                  <text class="tn-color-white tn-text-xl tn-text-bold">游客</text>
                </view>
				<!-- @click="copyUid" -->
                <view class="tn-padding-right tn-padding-top-xs tn-padding-left-sm tn-text-ellipsis" >
                  <text class="tn-color-gray">uid: 0000000</text>
                  <!-- <text class="tn-color-blue--disabled tn-padding-left-xs tn-text-sm tn-icon-copy"></text> -->
                </view>
              </view>

            </view>
          </view>
		   <!-- @click="V8.NavigateTo('/pages/set/set', true)" -->
          <view class="justify-content-item">
            <view class="tn-icon-install tn-color-gray" style="font-size: 50rpx;opacity: 0.5;">
            </view>
          </view>
        </view>

        <!-- 没有授权，则显示这个授权按钮-->
        <!-- <view class="tn-flex tn-flex-row-between" @click="tn('')">
          <view class="tn-flex-1 justify-content-item tn-margin-xs tn-text-center">
            <tn-button shape="round" backgroundColor="#FFFFFF10" fontColor="#ffffff" padding="40rpx 0" width="50%">
              <text class="tn-icon-wechat tn-padding-right-xs tn-text-xl"></text>
              <text class="">授权登录</text>
            </tn-button>
          </view>
        </view> -->

      </view>

      <view class="tn-margin-top-xl tn-padding-top-lg">
        <view class="button-number tn-flex tn-flex-row-between tn-flex-col-center tn-shadow-blur">
			 <!-- @click="tn('../member/member')" -->
          <view class="tn-margin-left" @click="V8.NavigateTo('/pages/member/member')">
            <view class="tn-flex tn-flex-col-center" style="color: #F1C68E;margin-top: -20rpx;">
              <text class="tn-text-bold tn-text-xl">至尊</text>
              <text class="tn-icon-vip-text tn-text-center" style="font-size: 92rpx;"></text>
            </view>
            <view class='tn-color-white tn-text-sm'>开通VIP，加快进入元宇宙</view>
          </view>
          <view class="tn-margin-right">
			  <!-- tn('../member/member') -->
            <tn-button shape="round" backgroundColor="#F1C68E" fontColor="#634738" padding="10rpx 0" width="160rpx"
              shadow @click="V8.NavigateTo('/pages/member/member')">
              <text class="tn-text-bold">开 通</text>
            </tn-button>
          </view>

          <view class="tnwave waveAnimation">
            <view class="waveWrapperInner bgTop">
              <view class="wave waveTop" style="background-image: url('/static/img/wave-2.png')">
              </view>
            </view>
            <view class="waveWrapperInner bgMiddle">
              <view class="wave waveMiddle"
                style="background-image: url('/static/img/wave-2.png')"></view>
            </view>
            <view class="waveWrapperInner bgBottom">
              <view class="wave waveBottom"
                style="background-image: url('/static/img/wave-1.png')"></view>
            </view>
          </view>

        </view>
      </view>


      <!-- 方式12 start-->
      <view class="box-shadow tn-margin-top-lg tn-padding-bottom-sm">

        <view class="tn-flex tn-flex-row-center tn-radius tn-padding-top">
          <view class="tn-padding-sm tn-margin-xs tn-radius" @click="V8.NavigateTo('/pages/order/order', true)">
            <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
              <view class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
                style="background-color: #1DC06933;">
                <view class="tn-icon-order-fill tn-color-teal"></view>
              </view>
              <view class="tn-text-center">
                <text class="tn-text-ellipsis tn-color-white">全部订单</text>
              </view>
            </view>
          </view>
          
          <!-- <view class="tn-padding-sm tn-margin-xs tn-radius" @click="navAddress">
            <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
              <view class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-bg-blue--light">
                <view class="tn-icon-map tn-color-white"></view>
              </view>
              <view class="tn-text-center">
                <text class="tn-text-ellipsis tn-color-white">收货地址</text>
              </view>
            </view>
          </view> -->
          <view class="tn-padding-sm tn-margin-xs tn-radius" @click="V8.NavigateTo('/pages/address/address', true)">
            <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
              <view class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
                style="background-color: #24BA9733;">
                <view class="tn-icon-location-fill tn-color-cyan"></view>
              </view>
              <view class="tn-text-center">
                <text class="tn-text-ellipsis tn-color-white">收货地址</text>
              </view>
            </view>
          </view>
		  <!-- tn('../member/member') -->
		  <view class="tn-padding-sm tn-margin-xs tn-radius" @click="V8.NavigateTo('/pages/member/member')">
		    <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
		      <view class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
		        style="background-color: #CCA22033;">
		        <view class="tn-icon-vip-fill tn-color-orangeyellow"></view>
		      </view>
		      <view class="tn-text-center">
		        <text class="tn-text-ellipsis tn-color-white">会员权益</text>
		      </view>
		    </view>
		  </view>
		  <!-- tn('../help/help')  -->
          <view class="tn-padding-sm tn-margin-xs tn-radius" @click="V8.NavigateTo('/pages/help/help')">
            <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
              <view class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
                style="background-color: #CC5A3633;">
                <view class="tn-icon-help-fill tn-color-orangered"></view>
              </view>
              <view class="tn-text-center">
                <text class="tn-text-ellipsis tn-color-white">常见问题</text>
              </view>
            </view>
          </view>

        </view>
      </view>


      <!-- 更多信息-->
      <view class="box-shadow tn-margin-top tn-padding-top-sm tn-padding-bottom-sm">
        <tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30" backgroundColor="#FFFFFF00"
          @click="copySource">
          <view class="tn-flex tn-flex-col-center">
            <view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-color-white">
              <view class="tn-icon-plane-fill"></view>
            </view>
            <view class="tn-margin-left-sm tn-flex-1 tn-color-white">开源地址</view>
            <view class="tn-color-gray--dark tn-icon-right"></view>
          </view>
        </tn-list-cell>
        <!-- <tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30" backgroundColor="#FFFFFF00"
          @click="tn('/minePages/public')">
          <view class="tn-flex tn-flex-col-center">
            <view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-color-white">
              <view class="tn-icon-bookmark-fill"></view>
            </view>
            <view class="tn-margin-left-sm tn-flex-1 tn-color-white">关注我们</view>
            <view class="tn-color-gray--dark tn-icon-right"></view>
          </view>
        </tn-list-cell> -->
        <!--        <tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30" backgroundColor="#FFFFFF00" @click="tn('/pageA/help/help')">
          <view class="tn-flex tn-flex-col-center">
            <view
              class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-color-white">
              <view class="tn-icon-message-fill"></view>
            </view>
            <view class="tn-flex tn-flex-row-between" style="width: 100%;">
              <view class="tn-margin-left-sm">常见问题</view>
              <view class="tn-color-gray--dark tn-icon-right"></view>
            </view>
          </view>
        </tn-list-cell> -->
      </view>

      <view class="box-shadow tn-margin-top tn-margin-bottom-lg tn-padding-top-sm tn-padding-bottom-sm">
        <!-- <tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30" backgroundColor="#FFFFFF00">
          <button class="tn-flex tn-flex-col-center tn-button--clear-style" open-type="contact">
            <view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-color-white">
              <view class="tn-icon-service-fill"></view>
            </view>
            <view class="tn-flex tn-flex-row-between" style="width: 100%;">
              <view class="tn-margin-left-sm tn-color-white">在线客服</view>
              <view class="tn-color-gray--dark tn-icon-right"></view>
            </view>
          </button>
        </tn-list-cell> -->
		 <!-- open-type="feedback" -->
        <tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30" backgroundColor="#FFFFFF00">
          <button class="tn-flex tn-flex-col-center tn-button--clear-style" @click="V8.NavigateTo('/pages/feedback/feedback')">
            <view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-color-white">
              <view class="tn-icon-topics-fill"></view>
            </view>
            <view class="tn-flex tn-flex-row-between" style="width: 100%;">
              <view class="tn-margin-left-sm tn-color-white">问题反馈</view>
              <view class="tn-color-gray--dark tn-icon-right"></view>
            </view>
          </button>
        </tn-list-cell>
        <!-- <tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30" backgroundColor="#FFFFFF00"
          @click="callPhoneNumber" data-number="18266666666">
          <view class="tn-flex tn-flex-col-center">
            <view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-color-white">
              <view class="tn-icon-phone-fill"></view>
            </view>
            <view class="tn-margin-left-sm tn-flex-1 tn-color-white">技术热线</view>
            <view
              class="tn-margin-left-sm tn-text-sm tn-padding-left-xs tn-padding-right-xs tn-color-gray--dark tn-round">
              188****8888</view>
          </view>
        </tn-list-cell> -->
      </view>

    </view>

    <view class="tn-text-center tn-margin-top-xl tn-padding-bottom-xl">
      <view @click="navTuniaoUI" style="opacity: 0.5;">
        <text class="tn-color-blue--dark tn-padding-xs">{{CompanyName}}</text>
        <text class="tn-color-gray">提供技术支持</text>
      </view>
      <!-- <button class=" tn-button--clear-style" open-type="feedback">
    		<view class="tn-margin tn-text-center">
    			<text>UI期待你的需求</text>
    			<text class="tn-color-blue">留言</text>
    		</view>
    	</button> -->
    </view>
    
    <!-- 这个是图鸟UI响应用户需求，推出的一个uni_modules组件，插件市场点击右上角，导入即可 https://ext.dcloud.net.cn/plugin?id=10172 -->
    <wx-user-info-modal
          v-model="showAuthorizationModal"
          @updated="updatedUserInfoEvent"
    ></wx-user-info-modal>

    <view class='tn-tabbar-height'></view>
    <view class="bg-tabbar-shadow"></view>

  </view>
</template>

<script>
  import WxUserInfoModal from '@/uni_modules/tuniaoui-wx-user-info/components/tuniaoui-wx-user-info/tuniaoui-wx-user-info.vue'
  export default {
    components: { WxUserInfoModal },
    name: 'pagesD',
    data() {
      return {
        showAuthorizationModal: false,
		CompanyName : 'Microi.net',
      }
    },
    methods: {
      // 跳转
      tn(e) {
        uni.navigateTo({
          url: e,
        });
      },

      // 跳转到图鸟UI
      navTuniaoUI() {
        uni.navigateToMiniProgram({
          appId: 'wxf3d81a452b88ff4b'
        })
      },

      // 收货地址
      navAddress() {
        uni.chooseAddress({})
      },

      // 单纯短震动
      short() {
        wx.vibrateShort();
      },

      //拨打固定电话
      callPhoneNumber() {
        uni.makePhoneCall({
          phoneNumber: "18219128888",
        });
      },
      // 复制id
      copyUid() {
        wx.vibrateShort();
        uni.setClipboardData({
          data: "10262008",
        })
      },
      // 复制开源地址
      copySource() {
        wx.vibrateShort();
        uni.setClipboardData({
          data: "https://gitee.com/ITdos/microi.net/tree/master/%E5%9F%BA%E4%BA%8E%E5%90%BE%E7%A0%81%E7%9A%84%E5%BC%80%E6%BA%90%E9%A1%B9%E7%9B%AE",
        })
      },
      
      // 打开获取用户信息弹框
      openAuthorizationModal() {
        this.showAuthorizationModal = true
      },
            
      // 获取到的用户信息
      updatedUserInfoEvent(info) {
        console.log('获取到的用户信息', info)
      },   
    }
  }
</script>

<style lang="scss" scoped>
  .pagesD {
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


  /* 自定义导航栏内容 start */
  .custom-nav {
    height: 100%;

    &__back {
      margin: auto 5rpx;
      font-size: 40rpx;
      margin-right: 10rpx;
      flex-basis: 5%;
      width: 100rpx;
      position: absolute;
    }
  }

  /* 自定义导航栏内容 end */

  /* 用户头像 start */
  .logo-image {
    width: 110rpx;
    height: 110rpx;
    position: relative;
    overflow: hidden;
    border-radius: 50%;
  }

  .logo-pic {
    background-size: cover;
    background-repeat: no-repeat;
    // background-attachment:fixed;
    background-position: top;
    border: 8rpx solid rgba(255, 255, 255, 0.05);
    box-shadow: 0rpx 0rpx 80rpx 0rpx rgba(0, 0, 0, 0.15);
    border-radius: 50%;
    overflow: hidden;
    // background-color: #FFFFFF;
  }

  /* 页面阴影 start*/
  .box-shadow {
    border-radius: 15rpx;
    border: 1rpx solid #494B51;
    background-color: rgba(255, 255, 255, 0.08);
    // box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
  }

  /* 页面阴影 end*/

  /* 图标容器12 start */
  .icon12 {
    &__item {
      width: 30%;
      background-color: #FFFFFF;
      border-radius: 10rpx;
      padding: 30rpx;
      margin: 20rpx 10rpx;
      transform: scale(1);
      transition: transform 0.3s linear;
      transform-origin: center center;

      &--icon {
        width: 100rpx;
        height: 100rpx;
        font-size: 50rpx;
        border-radius: 20rpx;
        margin-bottom: 38rpx;
        position: relative;
        z-index: 1;

        &::after {
          content: " ";
          position: absolute;
          z-index: -1;
          width: 100%;
          height: 100%;
          left: 0;
          bottom: 0;
          border-radius: inherit;
          opacity: 1;
          transform: scale(1, 1);
          background-size: 100% 100%;

        }
      }
    }
  }

  /* 图标容器1 start */
  .icon1 {
    &__item {
      // width: 30%;
      background-color: #FFFFFF;
      border-radius: 10rpx;
      padding: 30rpx;
      margin: 20rpx 10rpx;
      transform: scale(1);
      transition: transform 0.3s linear;
      transform-origin: center center;

      &--icon {
        width: 40rpx;
        height: 40rpx;
        font-size: 40rpx;
        border-radius: 50%;
        position: relative;
        z-index: 1;

        &::after {
          content: " ";
          position: absolute;
          z-index: -1;
          width: 100%;
          height: 100%;
          left: 0;
          bottom: 0;
          border-radius: inherit;
          opacity: 1;
          transform: scale(1, 1);
          background-size: 100% 100%;
          // background-image: url(https://resource.tuniaokj.com/images/cool_bg_image/icon_bg.png);
        }
      }
    }
  }

  /* 图标容器1 end */


  /* 背景波浪高度 */
  .button-number {
    width: 100%;
    height: 150rpx;
    border-radius: 15rpx;
    position: relative;
    z-index: 1;
    border: 1rpx solid #494B51;
    background: linear-gradient(-120deg, #3E445A1A, #31374A1A, #2B30421A, #262B3C1A);
  }

  /* 动态背景波浪*/
  @keyframes move_wave {
    0% {
      transform: translateX(0) translateZ(0) scaleY(1)
    }

    50% {
      transform: translateX(-25%) translateZ(0) scaleY(1)
    }

    100% {
      transform: translateX(-50%) translateZ(0) scaleY(1)
    }
  }

  .tnwave {
    overflow: hidden;
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    top: 0;
    margin: auto;
    z-index: -1;
    border-radius: 15rpx;
  }

  .waveWrapperInner {
    position: absolute;
    width: 100%;
    overflow: hidden;
    height: 100%;
  }

  .wave {
    position: absolute;
    left: 0;
    width: 200%;
    height: 100%;
    background-repeat: repeat no-repeat;
    background-position: 0 bottom;
    transform-origin: center bottom;
  }

  .bgTop {
    opacity: 0.1;
  }

  .waveTop {
    background-size: 50% 45px;
  }

  .waveAnimation .waveTop {
    animation: move_wave 4s linear infinite;
  }

  .bgMiddle {
    opacity: 0.2;
  }

  .waveMiddle {
    background-size: 50% 40px;
  }

  .waveAnimation .waveMiddle {
    animation: move_wave 3.5s linear infinite;
  }

  .bgBottom {
    opacity: 0.3;
  }

  .waveBottom {
    background-size: 50% 35px;
  }

  .waveAnimation .waveBottom {
    animation: move_wave 2s linear infinite;
  }
  
</style>