<template>
  <view class="tn-safe-area-inset-bottom">
    <!-- 顶部自定义导航 -->
    <tn-nav-bar fixed alpha customBack>
      <view slot="back" class='tn-custom-nav-bar__back'
        @click="goBack">
        <text class='icon tn-icon-left'></text>
        <text class='icon tn-icon-home-capsule-fill'></text>
      </view>
    </tn-nav-bar>

    <view class="tn-margin-top" :style="{paddingTop: vuex_custom_bar_height + 'px'}">
      <!-- 这个是图鸟UI响应用户需求，推出的一个uni_modules组件，插件市场点击右上角，导入即可 https://ext.dcloud.net.cn/plugin?id=10172 -->
      <wx-user-info-modal
            v-model="showAuthorizationModal"
            @updated="updatedUserInfoEvent"
      ></wx-user-info-modal>
      
      <view class="tn-flex tn-flex-row-between tn-strip-bottom tn-padding" @tap.stop="openAuthorizationModal">
        <view class="justify-content-item">
          <view class="tn-text-bold tn-text-lg">
            不许凶我吖
          </view>
          <view class="tn-color-gray tn-padding-top-xs">
            静下心来，做好图鸟
          </view>
        </view>
        <view class="justify-content-item tn-text-lg tn-color-grey">
          <view class="logo-pic tn-shadow">
            <view class="logo-image">
              <view class="tn-shadow-blur" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1664005699053-assets/web-upload/8645ea3a-e0a9-4422-8364-cc5ede305c9f.jpeg');width: 80rpx;height: 80rpx;background-size: cover;">
              </view>
            </view>
          </view>
        </view>
      </view>
      
      <!-- <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding" @click="showModal1">
        <view class="justify-content-item">
          <view class="tn-text-bold tn-text-lg">
            用户昵称
          </view>
          <view class="tn-color-gray tn-padding-top-xs">
            不许凶我
          </view>
        </view>
        <view class="justify-content-item tn-text-lg tn-color-grey">
          <view class="tn-icon-right tn-padding-top"></view>
        </view>
      </view> -->
      
      <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding" @click="showModal2">
        <view class="justify-content-item">
          <view class="tn-text-bold tn-text-lg">
            绑定手机号
          </view>
          <view class="tn-color-gray tn-padding-top-xs">
            13911111193
          </view>
        </view>
        <view class="justify-content-item tn-text-lg tn-color-grey">
          <view class="tn-icon-right tn-padding-top"></view>
        </view>
      </view>
      
      <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding" @click="showModal3">
        <view class="justify-content-item">
          <view class="tn-text-bold tn-text-lg">
            姓名
          </view>
          <view class="tn-color-gray tn-padding-top-xs">
            未填写
          </view>
        </view>
        <view class="justify-content-item tn-text-lg tn-color-grey">
          <view class="tn-icon-right tn-padding-top"></view>
        </view>
      </view>
      <picker @change="bindPickerChange" :value="index" :range="array">
        <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding" >
          <view class="justify-content-item">
            <view class="tn-text-bold tn-text-lg">
              性别
            </view>
            <view class="tn-color-gray tn-padding-top-xs">
              
                <view class="tn-color-gray">{{array[index]}}</view>
            </view>
          </view>
          <view class="justify-content-item tn-text-lg tn-color-grey">
            <view class="tn-icon-right tn-padding-top"></view>
          </view>
        </view>
      </picker>
      <picker @change="bindDateChange" mode="date" :value="date" :start="startDate" :end="endDate">
        <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding">
          <view class="justify-content-item">
            <view class="tn-text-bold tn-text-lg">
              生日
            </view>
            <view class="tn-color-gray tn-padding-top-xs">
              {{date}}
            </view>
          </view>
          <view class="justify-content-item tn-text-lg tn-color-grey">
            <view class="tn-icon-right tn-padding-top"></view>
          </view>
        </view>
      </picker>
      <picker @change="bindPickerChange1" :value="index1" :range="array1">
        <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding">
          <view class="justify-content-item">
            <view class="tn-text-bold tn-text-lg">
              职业
            </view>
            <view class="tn-color-gray tn-padding-top-xs">
              {{array1[index1]}}
            </view>
          </view>
          <view class="justify-content-item tn-text-lg tn-color-grey">
            <view class="tn-icon-right tn-padding-top"></view>
          </view>
        </view>
      </picker>
      <tn-modal v-model="show1" :custom="true" :showCloseBtn="true">
        <view class="custom-modal-content">
          <view class="">
            <view class="tn-text-lg tn-text-bold tn-color-purplered tn-text-center tn-padding">修改昵称</view>
            <view class="tn-bg-gray--light" style="border-radius: 10rpx;padding: 20rpx 30rpx;margin: 50rpx 0 60rpx 0;">
            	<input placeholder="不许凶我" name="input" placeholder-style="color:#AAAAAA" maxlength="20"></input>
            </view>
          </view>
          <view class="tn-flex-1 justify-content-item tn-margin-sm tn-text-center">
            <tn-button backgroundColor="#3668FC" padding="40rpx 0" width="60%" fontBold>
              <text class="tn-color-white">保 存</text>
            </tn-button>
          </view>
        </view>
      </tn-modal>
      
      <tn-modal v-model="show2" :custom="true" :showCloseBtn="true">
        <view class="custom-modal-content">
          <view class="">
            <view class="tn-text-lg tn-text-bold tn-color-purplered tn-text-center tn-padding">变更手机号码</view>
            <view class="tn-bg-gray--light tn-color-gray" style="border-radius: 10rpx;padding: 20rpx 30rpx;margin: 50rpx 0 60rpx 0;">
              13911111193
            </view>
          </view>
          <view class="tn-flex-1 justify-content-item tn-margin-sm tn-text-center">
            <tn-button backgroundColor="#3668FC" padding="40rpx 0" width="60%" fontBold>
              <text class="tn-color-white">获取手机号</text>
            </tn-button>
            <!-- <tn-button backgroundColor="#3668FC" padding="40rpx 0" width="60%" shadow fontBold open-type="getPhoneNumber">
              <text class="tn-color-white">获取手机号</text>
            </tn-button> -->
            <view class="tn-padding-top-sm">因为获取手机号api收费了，所以这里注释掉，需要的自行展示出来即可</view>
          </view>
        </view>
      </tn-modal>
      
      <tn-modal v-model="show3" :custom="true" :showCloseBtn="true">
        <view class="custom-modal-content">
          <view class="">
            <view class="tn-text-lg tn-text-bold tn-color-purplered tn-text-center tn-padding">请输入真实姓名</view>
            <view class="tn-bg-gray--light" style="border-radius: 10rpx;padding: 20rpx 30rpx;margin: 50rpx 0 60rpx 0;">
              <input placeholder="请填写姓名" name="input" placeholder-style="color:#AAAAAA" maxlength="20"></input>
            </view>
          </view>
          <view class="tn-flex-1 justify-content-item tn-margin-sm tn-text-center">
            <tn-button backgroundColor="#3668FC" padding="40rpx 0" width="60%" fontBold>
              <text class="tn-color-white">保 存</text>
            </tn-button>
          </view>
        </view>
      </tn-modal>
      
    </view>
    
    
  </view>
</template>

<script>
  import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
  import WxUserInfoModal from '@/uni_modules/tuniaoui-wx-user-info/components/tuniaoui-wx-user-info/tuniaoui-wx-user-info.vue'
  export default {
    components: { WxUserInfoModal },
    name: 'TemplateSet',
    mixins: [template_page_mixin],
    data(){
      return {
        showAuthorizationModal: false,
        show1: false,
        show2: false,
        show3: false,
        index: 0,
        array: ['女', '男', '保密'],
        date: '2000-01-29',
        index1: 1,
        array1: ['计算机/电子', '高级UI设计', '会计/金融', '政府/非盈利组织/其他'],
      }
    },
    computed: {
        startDate() {
            return this.getDate('start');
        },
        endDate() {
            return this.getDate('end');
        }
    },
    methods: {
      // 跳转
      tn(e) {
      	uni.navigateTo({
      		url: e,
      	});
      },
      
      // 弹出模态框
      showModal1(event) {
        this.openModal1()
      },
      // 打开模态框
      openModal1() {
        this.show1 = true
      },
      
      // 弹出模态框
      showModal2(event) {
        this.openModal2()
      },
      // 打开模态框
      openModal2() {
        this.show2 = true
      },
      
      // 弹出模态框
      showModal3(event) {
        this.openModal3()
      },
      // 打开模态框
      openModal3() {
        this.show3 = true
      },
      
      bindPickerChange: function(e) {
        this.index = e.detail.value
      },
      
      bindPickerChange1: function(e) {
        this.index1 = e.detail.value
      },
      
      bindDateChange: function(e) {
          this.date = e.detail.value
      },
      
      getDate(type) {
          const date = new Date();
          let year = date.getFullYear();
          let month = date.getMonth() + 1;
          let day = date.getDate();
      
          if (type === 'start') {
              year = year - 60;
          } else if (type === 'end') {
              year = year + 2;
          }
          month = month > 9 ? month : '0' + month;
          day = day > 9 ? day : '0' + day;
          return `${year}-${month}-${day}`;
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
      
      &:before {
        content: " ";
        width: 1rpx;
        height: 110%;
        position: absolute;
        top: 22.5%;
        left: 0;
        right: 0;
        margin: auto;
        transform: scale(0.5);
        transform-origin: 0 0;
        pointer-events: none;
        box-sizing: border-box;
        opacity: 0.7;
        background-color: #FFFFFF;
      }
    }

  /* 授权 */
    .login-page {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    }

    /* 授权按钮 */
    .submit-btn {
      width: 100%;
      background-color: #05C160;
      color: #FFFFFF;
      margin-top: 60rpx;
      border-radius: 10rpx;
      padding: 25rpx;
      font-size: 32rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 30rpx;
    }

    /* 间隔线 start*/
    .tn-strip-bottom-min {
      width: 100%;
      border-bottom: 1rpx solid #F8F9FB;
    }
    
    .tn-strip-bottom {
     width: 100%;
     border-bottom: 20rpx solid rgba(241, 241, 241, 0.8);
    }
     /* 间隔线 end*/


  /* 用户头像 start */
  .logo-image {
    width: 80rpx;
    height: 80rpx;
    position: relative;
  }

  .logo-pic {
    background-size: cover;
    background-repeat: no-repeat;
    // background-attachment:fixed;
    background-position: top;
    border: 2rpx solid rgba(255,255,255,0.05);
    box-shadow: 0rpx 0rpx 80rpx 0rpx rgba(0, 0, 0, 0.15);
    border-radius: 50%;
    overflow: hidden;
    // background-color: #FFFFFF;
  }


  /* 底部悬浮按钮 start*/
  .tn-tabbar-height {
  	min-height: 100rpx;
  	height: calc(120rpx + env(safe-area-inset-bottom) / 2);
  }
  .tn-footerfixed {
    position: fixed;
    width: 100%;
    bottom: calc(30rpx + env(safe-area-inset-bottom));
    z-index: 1024;
    box-shadow: 0 1rpx 6rpx rgba(0, 0, 0, 0);
    
  }
  /* 底部悬浮按钮 end*/
  
</style>
