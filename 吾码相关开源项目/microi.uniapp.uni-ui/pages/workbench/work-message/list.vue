<template>
  <view class="uni-container">
    <view class="mine" v-if="!isLogin">
      <button class="mine-item" type="primary" @click="goLogin">登录</button>
    </view>
    <view class="mine" v-if="isLogin && data.length > 0">
		<view v-for="i,k in data" :key="k" class="flex-row" @click="onClick(i)">
			<view class="flex-grow-1 Biaoti">
				<view class="w28 black">{{i.Biaoti}}</view>
				<view class="w24 gray" v-if="i.Neirong">{{i.Neirong}}</view>
				<view class="w22 gray">{{i.CreateTime}}</view>
			</view>
			<view class="flex-grow-0 flex-y-center red w24 arr">
				<view v-if="i.Zhuangtai === 0">●</view>
			</view>
		</view>
	</view>
	<uni-load-more :status="status" :content-text="contentText" />
    <!-- <view class="uni-tabbar-height"></view> -->
    <!-- <tab-bar :current="currentBar" backgroundColor="#fff" color="#333" tintColor="rgba(57, 121, 240, 1)"></tab-bar> -->
  </view>
</template>

<script setup>
import { ref, inject, reactive } from 'vue'
import { GetServerPath } from '@/utils'
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
const Microi = inject('Microi'); // 使用注入Microi实例
const userInfo = ref(Microi.GetCurrentUser()) // 用户信息
const currentBar = ref(2) // 当前tab索引
// 是否登录
const isLogin = ref(Microi.IsLogin())
const FenleiID = ref('') // 分类ID
const data = ref({
	Tabs: []
}) 
const status = ref('more')
const contentText = ref({
    contentdown: '查看更多',
    contentrefresh: '加载中',
    contentnomore: '没有更多'
})
// 分页数据
const pageData = reactive({
  pageIndex: 1,
  pageSize: 10,
  totalPage: 0
})
// 获取数据
const getData = async () => {
	Microi.ShowLoading('加载中···')
	// if(localStorage.getItem("message_list")){
	// 	data.value = JSON.parse(localStorage.getItem("message_list"));
	// }
  const res = await Microi.ApiEngine.Run('mobile_message_list',{
	  UserId: userInfo.value?.Id,
	  FenleiID: FenleiID.value,
		PageIndex: pageData.pageIndex,
		PageSize: pageData.pageSize
  });
  
	if (res.Code == 1) {
		localStorage.setItem("message_list", JSON.stringify(res.Data));
		var datas = res.Data
		pageData.totalPage = Math.ceil(res.DataCount / pageData.pageSize)
		if (pageData.pageIndex == 1) {
			data.value = datas
        status.value = 'onmore'
      } else {
        data.value = data.value.concat(datas)
        if (data.length < pageData.pageSize) {
          status.value = 'nomore'
        }
      }
	}
	Microi.HideLoading();
}
// 跳转登录页
const goLogin = () => {
  // 关闭所有页面跳转登录页
  uni.reLaunch({
    url: '/pages/mine/login/login'
  })
}
// 退出登录

const onClick = (item) => {
  if (!Microi.IsLogin()) {
    uni.showToast({
      title: '请先登录',
      icon: 'none'
    })
    return
  } else {
			// 将消息变成已读,记录点击次数,并跳转到详情页
			Microi.FormEngine.UptFormData({//注意有个await
				FormEngineKey : 'Diy_Notice',//表名或表Id，不区分大小写
				Id : item.Id,
				_RowModel : {
					Zhuangtai : 1,
					Hits : item.Hits + 1,
				}
			});
    Microi.RouterPush(item.MobileGoUrl)
  }
}
onShow (() => {
	getData();
})
onLoad((options) => {
	FenleiID.value = options.FenleiID || ''
  uni.$on('clickTabbar', (index) => {
    currentBar.value = index
	});
})
// 下拉刷新
onPullDownRefresh (() => {
  pageData.pageIndex = 1
  getData()
  setTimeout(function() {
    uni.stopPullDownRefresh()
    console.log('stopPullDownRefresh')
  }, 1000)
})
// 上啦加载
onReachBottom(() => {
  console.log('onReachBottom',pageData)
  if (pageData.pageIndex < pageData.totalPage) {
    status.value = 'loading'
    pageData.pageIndex++
    getData()
  } else {
    status.value = 'nomore'
  }
})
</script>

<style scoped>
.uni-container {
	background-color: #f6f6f6;
	min-height: 100vh;
}
.title {
	background-color: #fafafa;
	border-bottom: #eee 1rpx solid;
	padding:30rpx 20rpx 40rpx;
}
.mine {
	padding: 20rpx 20rpx 0;
}
.mine .flex-row {
	color:#666;
	background-color: #fff;
	border-radius: 10rpx;
	padding:20rpx 25rpx;
	margin:20rpx 0;
	box-shadow: 0 0 6rpx #eee;
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
</style>