<template>
  <view class="uni-container">
    <view class="mine" v-if="!isLogin">
			<view class="bg-loctek" style="display: flex; flex-direction: column;">
        <image src="/static/image/none.gif" style="width: 543rpx; height: 407rpx; "></image>
      </view>
    </view>
    <view class="mine" v-if="isLogin && data.length>0">
		<view v-for="i,k in data" :key="k" class="flex-row uni-flex-align-center" @click="onClick('/pages/workbench/work-message/list?FenleiID='+i.Id)" style="margin:0 0 10rpx;">
			<view class="flex-grow-0 icon">
				<image :src="i.Icon" />
			</view>
			<view class="flex-grow-1 Biaoti">
				{{i.Mingcheng}}
				<!-- <view class="w28 black">{{i.Mingcheng}}</view> -->
				<!-- <view class="w22 gray">{{i.Tit}}</view> -->
			</view>
			<!-- <view v-if="i.Num>0" class="flex-grow-0 num">{{i.Num}}</view> -->
			<uni-badge :text="i.Num" size="normal"></uni-badge>
			<!-- <view class="flex-grow-0 flex-y-center gray w24 arr"> -->
				<!-- {{i.Text}} -->
				<uni-icons type="right" ></uni-icons>
			<!-- </view> -->
		</view>
	</view>
	<view v-else class="bg-loctek" style="display: flex; flex-direction: column;">
		<image src="/static/image/none.gif" style="width: 543rpx; height: 407rpx; "></image>
	</view>
    <view class="uni-tabbar-height"></view>
    <tab-bar :current="currentBar" backgroundColor="#fff" color="#333" tintColor="rgba(57, 121, 240, 1)"></tab-bar>
  </view>
</template>

<script setup>
import { ref, inject } from 'vue'
import { GetServerPath } from '@/utils'
import { onLoad, onShow } from '@dcloudio/uni-app';
const Microi = inject('Microi'); // 使用注入Microi实例
const userInfo = ref(Microi.GetCurrentUser()) // 用户信息
const currentBar = ref(2) // 当前tab索引
// 是否登录
const isLogin = ref(Microi.IsLogin())
const data = ref([]) 
// 获取数据
const getData = async () => {
  // 尝试从 uni 缓存获取数据
  try {
    const cacheData = uni.getStorageSync('message_data')
    if (cacheData) {
      data.value = typeof cacheData === 'string' ? JSON.parse(cacheData) : cacheData
    }
  } catch (error) {
    console.error('缓存读取错误:', error)
  }
  
  // 从服务器获取数据
  try {
    const res = await Microi.ApiEngine.Run('mobile_message_data', {
      UserId: userInfo.value?.Id
    });
    
    if (res.Code == 1) {
      // 保存到 uni 缓存
      try {
        uni.setStorageSync('message_data', res.Data)
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

const onClick = (url) => {
  if (!Microi.IsLogin()) {
    uni.showToast({
      title: '请先登录',
      icon: 'none'
    })
    return
  } else {
    Microi.RouterPush(url)
  }
}
onShow (() => {
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
	margin:0rpx 40rpx 0 20rpx;
}
.mine {
	padding: 20rpx 20rpx 0;
}
.mine .flex-row {
	margin:10rpx 0;
	color:#666;
	height: 120rpx;
	border-bottom: #eee 1rpx solid;
}
.mine .num { 
	background-color: #ff0000;
	color:#fff;
	text-align: center;
	border-radius: 30rpx;
	width: 44rpx;
	height: 44rpx;
	margin:30rpx 15rpx 0;
	line-height: 44rpx;
}
.mine .Biaoti {
	line-height: 42rpx;
	position: relative;
}
.mine .text {
	padding:0 20rpx;
}
.mine .arr {
	margin: -15rpx 10rpx 0 0;
}
.loginout {
	display: inline-block;
	padding:0 10rpx 10rpx;
	border-bottom: #ddd 1rpx solid;
	margin:50rpx 0 0;
	color:#666;
}
.bg-loctek{
  display: flex;
  justify-content: center;
  align-items: center;
  height: 90vh;
  background-color: #fff;
}
</style>