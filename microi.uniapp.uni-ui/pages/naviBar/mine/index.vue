<template>
  <view class="uni-container">
    <view class="title uni-flex uni-flex-align-center">
      <view class="avatar">
        <image v-if="userInfo.Avatar" :src="GetServerPath(userInfo.Avatar)" mode="aspectFill"></image>
        <image v-else src="/static/img/mrtx.png" mode="aspectFill"></image>
      </view>
      <view class="info">
        <view class="name uni-common-mt uni-common-mb-xs">{{ userInfo.Name }}</view>
        <view class="uni-flex uni-flex-wrap">
          <view class="uni-common-mr-xs uni-common-mb-xs">
            <uni-tag :text="userInfo.DeptName" type="success" />
          </view>
          <view v-for="role in Roles" :key="role.Id" class="uni-common-mr-xs uni-common-mb-xs">
            <uni-tag :text="role.Name" type="primary" />
          </view>
        </view>
      </view>
      <view v-if="!isLogin">
        <button class="mine-item" type="primary" size="mini" @click="goLogin">登录</button>
      </view>
    </view>
    <view class="mine" v-if="isLogin">
      <view v-for="i,k in data.Tabs" :key="i.Name" class="flex-row uni-flex-align-center" @click="onClick(i)" style="margin:0 0 10rpx;">
        <view class="flex-grow-0 icon"><image :src="i.Icon" /></view>
        <view class="flex-grow-1 flex-y-center tit w28">{{i.Name}}</view>
        <!-- <view class="flex-grow-0 flex-y-center gray w24">{{i.Text}}</view> -->
        <uni-icons type="right" ></uni-icons>
      </view>
      <view class="text-center">
        <view class="loginout" @click="exit">退出登录</view>
      </view>
    </view>
    <!-- <view class="uni-common-mt" v-if="Microi.OsClient == 'iTdos'">
      <button type="warn" @click="Microi.RouterPush('/pages/mine/serverConfig/index')">修改服务器配置</button>
    </view> -->
    <!-- <button  class="uni-common-mt" type="warn" @click="Microi.RouterPush('/pages/workbench/map/index')">地图</button> -->
    <view class="uni-tabbar-height"></view>
    <tab-bar :current="currentBar" backgroundColor="#fff" color="#333" tintColor="rgba(57, 121, 240, 1)"></tab-bar>
  </view>
</template>

<script setup>
import { ref, inject } from 'vue'
import { GetServerPath, getCurrentVersion } from '@/utils'
import { onLoad, onShow } from '@dcloudio/uni-app';
const Microi = inject('Microi'); // 使用注入Microi实例
// 是否登录
const isLogin = ref(Microi.IsLogin())
const userInfo = ref(Microi.GetCurrentUser()) // 用户信息
const currentBar = ref(3) // 当前tab索引
const Roles = ref(userInfo.value?._Roles) // 角色列表s
const data = ref({
	Tabs: []
}) 
let version = getCurrentVersion()
// 获取数据
const getData = async () => {
  if (Microi.OsClient == 'loctek') return
  
  // 尝试从 uni 缓存获取数据
  try {
    const cacheData = uni.getStorageSync('mine_data')
    if (cacheData) {
      data.value = typeof cacheData === 'string' ? JSON.parse(cacheData) : cacheData
    }
  } catch (error) {
    console.error('缓存读取错误:', error)
  }
  
  // 从服务器获取数据
  try {
    const res = await Microi.ApiEngine.Run('mobile_mine_data', {
      UserId: userInfo.value?.Id
    });
    
    if (res.Code == 1) {
      // 保存到 uni 缓存
      try {
        uni.setStorageSync('mine_data', res.Data)
      } catch (error) {
        console.error('缓存写入错误:', error)
      }
      
      data.value = res.Data;
    }
  } catch (error) {
    console.error('API 请求错误:', error)
  }
}
// 跳转登录页
const goLogin = () => {
  // 关闭所有页面跳转登录页
  uni.reLaunch({
    url: '/pages/mine/login/login'
  })
}
// 退出登录
const exit = () => {
  Microi.SetToken('');
  Microi.SetCurrentUser('');
  uni.reLaunch({
    url: '/pages/mine/login/login'
  })
}
const onClick = (item) => {
  if (item.Name == '当前版本') {
    uni.showToast({
      title: '当前版本：' + version,
      icon: 'none'
    })
    return
  }
  if (!item.Url) return
  if (!Microi.IsLogin()) {
    uni.showToast({
      title: '请先登录',
      icon: 'none'
    })
    return
  } else {
    Microi.RouterPush(item.Url)
  }
}
onShow (() => {
  userInfo.value = Microi.GetCurrentUser()
  isLogin.value = Microi.IsLogin()
	getData();
})
onLoad(() => {
  uni.$on('clickTabbar', (index) => {
    currentBar.value = index
	});
})
</script>

<style scoped>
.title {
	background-color: #fafafa;
	border-bottom: #eee 1rpx solid;
	padding:30rpx 20rpx 40rpx;
}
.avatar{
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  overflow: hidden;
  margin: 10rpx 20rpx;
}
image{
  width: 100%;
  height: 100%;
}
.icon { 
	width: 50rpx;
	height: 50rpx;
	margin:8rpx 40rpx 0 20rpx;
}
.mine {
	padding: 20rpx 20rpx 0;
}
.mine .flex-row {
	margin:10rpx 0;
	color:#666;
	padding:15rpx 25rpx 15rpx 15rpx;
	border-bottom: #eee 1rpx solid;
}
.mine .text {
	padding:0 20rpx;
}
.loginout {
	display: inline-block;
	padding:0 10rpx 10rpx;
	border-bottom: #ddd 1rpx solid;
	margin:50rpx 0 0;
	color:#666;
}
</style>