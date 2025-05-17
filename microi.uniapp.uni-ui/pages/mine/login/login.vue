<template>
  <view class="container">
	  <view class="topbg"></view>
    <view class="logo-container uni-common-mb" v-if="logoUrl">
      <image class="logo" :src="logoUrl" mode="aspectFit" :style="{height: SysConfig.SysLogoHeight +'px'}"></image>
    </view>
    <!-- <view class="title uni-h3">{{ SysConfig.CompanyName }}</view> -->
    <view class="example">
      <!-- 基础表单校验 -->
      <uni-forms ref="valiForm" :rules="rules" :model="valiFormData" labelWidth="80px">
        <uni-forms-item label="账号" required name="account">
          <uni-easyinput v-model="valiFormData.account" placeholder="请输入账号" confirm-type="go" @confirm="submit" />
        </uni-forms-item>
        <uni-forms-item label="密码" required name="password">
          <uni-easyinput v-model="valiFormData.password" placeholder="请输入密码" type="password" confirm-type="go" @confirm="submit" />
        </uni-forms-item>
        <uni-forms-item label="验证码" :required="SysConfig.EnableCaptcha == 1 ? true : false" name="code" v-if="SysConfig.EnableCaptcha">
          <uni-easyinput v-model="valiFormData.code" placeholder="请输入验证码" type="text" >
            <template #right>
              <image class="img" style="width: 120px;height: 40px;" @click="GetCaptcha()" :src="valiFormData._CaptchaSrc"></image>
            </template>
          </uni-easyinput>
        </uni-forms-item>
      </uni-forms>
      <button type="primary" @click="submit('valiForm')" class="rounded-full">登录</button>
      <view class="uni-common-mt" v-if="Microi.OsClient == 'iTdos'">
        <button type="warn" @click="Microi.RouterPush('/pages/mine/serverConfig/index')">修改服务器配置</button>
      </view>
    </view>
    <view class="footer">
      © {{ SysConfig.CompanyName }}
    </view>
  </view>
</template>

<script setup>
import { ref, inject, watch, computed } from 'vue'
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
const Microi = inject('Microi'); // 使用注入Microi实例
const valiForm = ref(null)
const valiFormData = ref({
  account: '',
  password: '',
  code: '',
  _CaptchaSrc: '',
  _CaptchaId: ''
})
const SysConfig = ref({}) // 系统配置
const logoUrl = computed(() => {
  if (SysConfig.value.LogoUrl == '') {
    return ''
  }
  return SysConfig.value.FileServer + SysConfig.value.SysLogo
})
const bgImageUrl = computed(() => {
  if (SysConfig.value.LoginBgImg == '') {
    return ''
  }
  return SysConfig.value.FileServer + SysConfig.value.LoginBgImg
})
const bgImageStyle = computed(() => {
  if (bgImageUrl.value) {
    return {
      backgroundImage: `url(${bgImageUrl.value})`
    }
  }
  return {
    background: 'linear-gradient(to bottom right, #7dc3b7 0%, #4178c6 100%)'
  }
})

if (!Microi.SysConfig || Object.keys(Microi.SysConfig).length === 0) {
  Microi.Init({
  TokenCallback : function(){
    try{
      console.log('TokenCallback',Microi.SysConfig)
      SysConfig.value = Microi.SysConfig;
      if (SysConfig.value.EnableCaptcha == 1) {
        GetCaptcha()
      }
    }catch(e){
      console.error(e)
    }
  }
}) // 初始化
} else {
  SysConfig.value = Microi.SysConfig;
}

const rules = ref({
  account: {
    rules: [{
      required: true,
      errorMessage: '请输入账号'
    }]
  },
  password: {
    rules: [{
      required: true,
      errorMessage: '请输入密码'
    }]
  },
  code: {
    rules: [{
      required: true,
      errorMessage: '请输入验证码'
    }]
  }
})
const submit = () => {
  valiForm.value.validate().then(res => {
    Microi.Login({
      Account: res.account,
      Pwd: res.password,
      _CaptchaId: valiFormData.value._CaptchaId,
      _CaptchaValue: valiFormData.value.code
    }).then(res => {
      if (res.Code == 1) {
        Microi.Tips('登录成功');
        uni.setStorageSync('RoleLimits',res.Data._RoleLimits)
        // 获取上一个页面路径
        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2]; // 获取上一个页面
        console.log(prevPage,'prevPage')
        if (prevPage) {
          // 如果上一页是登录页面，跳转到首页
          if (prevPage.route === 'pages/mine/login/login') {
            uni.redirectTo({
              url: '/pages/naviBar/home/index'
            });
          } else {
            // 如果不是登录页面，返回上一个页面
            uni.navigateBack({
              delta: 1
            });
          }
        } else {
          // 如果没有上一个页面，跳转到首页
          uni.redirectTo({
            url: '/pages/naviBar/home/index'
          });
        }
      } else {
        if (SysConfig.value.EnableCaptcha == 1) {
          GetCaptcha()
        }
        Microi.Tips(res.Msg, false);
      }
    }).catch(err => {
      console.log('登录失败', err);
    })
  }).catch(err => {
    console.log('err', err);
  })
}
// 获取验证码
const GetCaptcha = () => {
  Microi.GetCaptcha().then(res => {
    valiFormData.value._CaptchaSrc = res.CaptchaSrc;
    valiFormData.value._CaptchaId = res.CaptchaId;
  }).catch(err => {
    console.log('获取验证码失败', err);
  })
}

</script>

<style scoped>
.container{
  position: relative;
  background-size: cover;
  background-position: center;
  width: 100%;
  min-height: 100vh;
  background-repeat: no-repeat;
  display: flex;
  flex-direction: column;
  /* justify-content: center; */
  align-items: center;
  
  /* background: linear-gradient(to bottom right, #7dc3b7 0%, #4178c6 100%); */
}
.topbg { 
	position: absolute;
	top:0;
	left:0;
	height:35%;
	width:100%;
	background: linear-gradient(to right, #3892fa 0%, #71c8fe 100%);
	z-index: -1;
}
.example {
  padding: 70px 30px;
  background-color: #fff;
  width: 90%;
  border-radius: 35px;
  box-shadow: 0 25rpx 25rpx #fafafa;
}
.title{
  text-align: center;
  margin: 20rpx;
  color: white;
}
.logo-container{
  margin-top: 100px;
}
.footer {
  position: absolute; /* 绝对定位 */
  bottom: 0; /* 底部对齐 */
  width: 100%; /* 宽度占满容器 */
  text-align: center;
  padding: 20px 0;
  font-size: 14px;
  color: #666;
}
</style>