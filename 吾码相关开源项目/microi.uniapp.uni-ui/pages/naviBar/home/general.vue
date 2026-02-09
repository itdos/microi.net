<template>
  <view class="container-general">
		<!-- 加载状态显示 -->
		<view v-if="loading" class="skeleton-container">
			<view class="skeleton-search"></view>
			<view class="skeleton-tabs">
				<view class="skeleton-tab" v-for="i in 4" :key="i"></view>
			</view>
			<view class="skeleton-section">
				<view class="skeleton-title"></view>
				<view class="skeleton-items">
					<view class="skeleton-item" v-for="i in 4" :key="i"></view>
				</view>
			</view>
			<view class="skeleton-section">
				<view class="skeleton-title"></view>
				<view class="skeleton-items">
					<view class="skeleton-item" v-for="i in 4" :key="i"></view>
				</view>
			</view>
		</view>
		
		<!-- 内容区域 -->
		<view v-else>
			<view class="search-entry" @tap="goToSearch">
				<view class="search-placeholder">
					<uni-icons type="search" size="20" color="#999"></uni-icons>
					<text class="search-text">搜索功能/菜单</text>
				</view>
			</view>
		<view class="workData-content" v-if="data.Tabs.length > 0">
			<view v-for="i in data.Tabs" :key="i.Id" class="workData-item" @tap.stop="navDemoPage(i)">
				<image v-if="i.Icon && i.Url !='scanCode'" class="item-img" :src="i.Icon" />
				<view class="item-icon" v-if="i.Url =='scanCode'">
					<uni-icons type="scan" size="30" color="#333"></uni-icons>
				</view>
				<view class="item-ti tle tn-mt-xs"> {{i.Name}}</view>
			</view>
		</view>
		<uni-section title="常用功能" type="line" titleFontSize="30" v-if="data.Tuij_ico && data.Tuij_ico.length > 0" >
		  <view class="example">
		    <view class="workData-container" v-if="data.Tuij_ico">
		      <view v-for="i in data.Tuij_ico" :key="i.Id" class="workData-item" @tap.stop="work(i)">
		      	<image v-if="i.Icon" class="item-img" :src="i.Icon" />
		      	<view class="item-ti tle tn-mt-xs"> {{i.Name}}</view>
		      </view>
		    </view>
		  </view>
		</uni-section>
		<!-- <view class="uni-panel">
				<view class="uni-panel-h">
					<view class="uni-panel-text uni-flex">
						<view class="uni-flex-shrink-0" style="padding-right: 2%;">公告: </view>
						<view class="uni-flex-item notice">
							<swiper circular="true" vertical="true" autoplay="true" interval="3000" duration="1000" v-if="data.Notice">
							    <swiper-item class="w24" v-for="k in data.Notice.Data" :key="k.Id" @click="Notice(k.Id)">
							       {{k.Biaoti}}
							    </swiper-item>
							</swiper>
						</view>
						<uni-icons type="right" ></uni-icons>
					</view>
				</view>
			</view> -->
		<view class="uni-panel" v-for="(item, index) in data.Daiban" :key="index">
				<view class="uni-panel-h" @click="Microi.RouterPush(item.url, true)">
					<text class="uni-panel-text">{{item.name}}</text>
					<uni-badge class="uni-badge-left-margin" size="normal" :text="item.count" />
				</view>
			</view>
		<uni-section title="数字简报" type="circle" titleFontSize="30" v-if="data.Jianbao.length > 0">
			<template v-slot:right>
					<text class="gray">当月</text>
			</template>
		  <view class="example">
		    <view class="workData-container" v-if="data.Jianbao">
		      <view v-for="i in data.Jianbao" :key="i.Text" class="workData-item">
		      	<view class="item-tit tn-mt-xs w30 gray"> {{i.Num}}</view>
		      	<view class="item-ti tn-mt-xs"> {{i.Text}}</view>
		      </view>
		    </view>
		  </view>
		</uni-section>
		<uni-section title="排行榜" type="square" titleFontSize="30" v-if="data.Paihang" >
		  <view class="example">
			  <view class="flex-row paihang-fenlei text-center">
				  <view class="flex-grow-1">获客</view>
				  <view class="flex-grow-1">拜访</view>
				  <view class="flex-grow-1">业绩</view>
				  <view class="flex-grow-1">回款</view>
			  </view>
		    <view class="paihang-content">
		      <view v-for="i,k in data.Paihang" :key="i.Name" class="flex-row" style="margin:0 0 10rpx;">
				  <view class="flex-grow-0 flex-y-center paixu flex-x-center">{{k+1}}</view>
				  <view class="flex-grow-0"><image src="/static/img/sex1.png" /></view>
				  <view class="flex-grow-1 flex-y-center tit">{{i.Name}}</view>
				  <view class="flex-grow-0 flex-y-center">已完成：{{i.Num}}单</view>
		      </view>
		    </view>
		  </view>
		</uni-section>
	</view>
   
  </view>
	<!-- <view class="uni-tabbar-height"></view>
	<tab-bar :current="currentBar" backgroundColor="#fff" color="#333" tintColor="rgba(57, 121, 240, 1)"></tab-bar> -->
</template>

<script setup>
import { ref, inject, onMounted, watch, computed } from 'vue'
import { onLoad, onShow, onHide } from '@dcloudio/uni-app';
import { scanCodeH5 } from '@/utils';
import dayjs from 'dayjs';

const Microi = inject('Microi'); // 使用注入Microi实例
const V8 = inject('V8'); // 使用注入V8实例
const userInfo = ref(Microi.GetCurrentUser()) // 用户信息
const keyword = ref('') // 搜索关键字
const info = ref([])
const loading = ref(true) // 添加加载状态

const data = ref({
	Tabs: [],
	Notice: [],
	Daiban: [],
	Tuij_ico: [],
	Jianbao: [],
	Daiban: []
}) // 搜索关键字
const currentBar = ref(0) // 当前tab索引

// 获取数据
const getData = async () => {
	console.log('getData 开始执行')
	loading.value = true
	
	// 尝试从 uni 缓存获取数据
	try {
		const cacheData = uni.getStorageSync('index_data')
		if (cacheData) {
			data.value = typeof cacheData === 'string' ? JSON.parse(cacheData) : cacheData
			// 如果有缓存数据，先显示缓存数据并结束加载状态
			loading.value = false
		}
	} catch (error) {
		console.error('缓存读取错误:', error)
	}

	// 异步加载新数据，不阻塞UI渲染
	setTimeout(() => loadServerData(), 100);
}

// 从服务器加载数据
const loadServerData = async () => {
	try {
		const res = await Microi.ApiEngine.Run('mobile_index_data', {
			UserId: userInfo.value?.Id
		})
		
		if (res.Code == 1) {
			// 保存到 uni 缓存
			try {
				uni.setStorageSync('index_data', res.Data)
				// 记录缓存时间
				uni.setStorageSync('index_data_time', Date.now())
			} catch (error) {
				console.error('缓存写入错误:', error)
			}
			
			data.value = res.Data
		}
	} catch (error) {
		console.error('API 请求错误:', error)
	} finally {
		// 无论成功失败，都结束加载状态
		loading.value = false
	}
}
const goToSearch = () => {
	Microi.RouterPush('/pages/naviBar/search/index',true);
}
// 点击主菜单显示子菜单
const navDemoPage = (item) => {
	// 如果是扫码页面，则不跳转
	if (item.Url == 'scanCode') {
		changeScan()
	} else {
    Microi.RouterPush(item.Url,true);
	}
}
const work = (item) => {
	var url = '/pages/workbench/work-list/index?MenuId='+item.Guid+'&MenuName='+item.Name;
    Microi.RouterPush(url,true);
}
// 扫码 - 乐歌跳转到检查提报页面
const changeScan = async () => {
	const code = await scanCodeH5()
 	const res = await Microi.ApiEngine.Run('CheckPlan_ScanIn',{
		ScanInfo : code,
		UserId : Microi.GetCurrentUser().Id
	})
	if (res.Code == 1) {
		const { MessionId, checkMession } = res
		if (checkMession.length == 0) return
		const data = checkMession.filter(item => item?.Id == MessionId)[0]
		uni.setStorageSync('checkPlanDetail', JSON.stringify(data))
  	Microi.RouterPush('/pages/tools/loctek/checkPlan/detail')
	} else {
		Microi.Tips(res.Msg, false)
	}
}
// 点击公告跳转详情页
const Notice = (Id) => {
	var url = `/pages/workbench/work-detail/index?DiyTableId=${data.value.Notice.DiyTableId}&Id=${Id}&MenuId=${data.value.Notice.MenuId}`;
    Microi.RouterPush(url,true);
}

onLoad (() => {
	uni.$on('clickTabbar', (index) => {
		currentBar.value = index;
	});
})

onShow (() => {
	// 立即显示缓存数据，然后异步更新
	try {
		const cacheData = uni.getStorageSync('index_data')
		if (cacheData) {
			data.value = typeof cacheData === 'string' ? JSON.parse(cacheData) : cacheData
			loading.value = false
		}
	} catch (error) {
		console.error('缓存读取错误:', error)
	}
	
	getData()
})
onHide (() => {
	// 组件或页面隐藏时，可以移除监听，避免内存泄漏
	// uni.$off('testParam');
})
defineExpose({
  getData
})
</script>

<style lang="scss" scoped>
/* 骨架屏样式 */
.skeleton-container {
  padding: 20rpx;
}

.skeleton-search {
  height: 80rpx;
  background: #f0f0f0;
  border-radius: 10rpx;
  margin-bottom: 30rpx;
  animation: v-bind('useLightMode ? "none" : "skeleton-loading 1.5s infinite"');
}

.skeleton-tabs {
  display: flex;
  justify-content: space-between;
  margin-bottom: 30rpx;
}

.skeleton-tab {
  width: 22%;
  height: 120rpx;
  background: #f0f0f0;
  border-radius: 10rpx;
  animation: v-bind('useLightMode ? "none" : "skeleton-loading 1.5s infinite"');
}

.skeleton-section {
  margin-bottom: 30rpx;
}

.skeleton-title {
  height: 40rpx;
  width: 200rpx;
  background: #f0f0f0;
  border-radius: 6rpx;
  margin-bottom: 20rpx;
  animation: v-bind('useLightMode ? "none" : "skeleton-loading 1.5s infinite"');
}

.skeleton-items {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.skeleton-item {
  width: 22%;
  height: 120rpx;
  background: #f0f0f0;
  border-radius: 10rpx;
  margin-bottom: 20rpx;
  animation: v-bind('useLightMode ? "none" : "skeleton-loading 1.5s infinite"');
}

@keyframes skeleton-loading {
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    opacity: 0.6;
  }
}
</style>

<style lang="scss" scoped>
	@import '../../../common/uni-nvue.css';
	page { 
		background: linear-gradient(to bottom, #bbdcf9 0%, #f3f5f4 500rpx);
	}
	.container-general {
		padding: 20rpx;
		background: linear-gradient(to bottom, #bbdcf9 0%, #f3f5f4 500rpx);
		min-height: 80vh;
	}
	.search-btn{
	  margin-left: 20rpx;
	}
	.workData-content{
		// display: flex;
		// flex-wrap: wrap;
		// justify-content: flex-start;
		padding:  20rpx;
		min-height:200rpx;
		font-size: 24rpx;
		margin:0 0 1%;
		display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-gap: 10px;
	}
	.workData-container{
		/* display: flex;
		flex-wrap: wrap;
		justify-content: flex-start; */
		padding:  20rpx;
		font-size: 24rpx;
		display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-gap: 10px;
	}
	.workData-item{
		margin: 10rpx 1%;
		text-align: center;
		// width: 23%;
		// display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		color:#000;
	}
	.item-img{
	  width: 80rpx;
	  height: 80rpx;
	  padding:10rpx;
	  margin:0 0 15rpx;
	}
	.notice { width:100%;height:38rpx; overflow: hidden;margin-top:-4rpx; }
	.notice swiper-item{
		height: 38rpx;
		line-height: 38rpx;
		overflow: hidden;
	}
	.item-icon{
		width: 60rpx;
	  height: 60rpx;
	  padding:30rpx;
	  border-radius: 100rpx;
	  background-color: #f4f6fa;
	  margin:0 auto 15rpx;
	}
	.item-tit {
		font-size: 36rpx;
		font-weight: 600;
		color:#111;
		margin:0 0 10rpx;
	}
	.item-ti{
		font-size: 26rpx;
		color: #555;
		font-weight: 400;
	}
	.uni-panel { 
		border-radius: 20rpx;
		margin: 0 0 20rpx;
		overflow: hidden;
	}
	.paihang-fenlei {
		margin:20rpx 30rpx 0;
		line-height: 54rpx;
		background-color: #fafafa;
		border: #ddd 1rpx solid;
	}
	.paihang-fenlei .flex-grow-1 {
		border-left: #ddd 1rpx solid;
	}
	.paihang-fenlei .flex-grow-1:nth-child(1){
		border-left:0;
	}
	.paihang-content {
		margin:15rpx 30rpx;
		padding:10rpx 0 20rpx;
		.paixu {
			width:40rpx;
			height:40rpx;
			line-height: 40rpx;
			border:#888 1rpx solid;
			border-radius: 40rpx;
			margin:18rpx 10rpx 0 0;
		}
		.tit {
			font-size: 26rpx;
			color:#000;
			margin:0 10rpx 0 0;
			margin-left:15rpx; 
		}
		image {
			margin: 10rpx;
			width:60rpx;
			height: 60rpx;
			border-radius: 60rpx;
		}
		.flex-row{
			padding:0 5%;
			border-radius: 10rpx;
		}
		.flex-row:nth-child(1) .db { background-color: #e99a03; }
		.flex-row:nth-child(2) .db { background-color: #05cf6e; }
		.flex-row:nth-child(3) .db { background-color: #2692dd; }
		.flex-row:nth-child(4) .db { background-color: #f3a847;
		}
		.flex-row:nth-child(1){ background: #ffebd3;color:#e99a03;}
		.flex-row:nth-child(1) .paixu { border-color: #e99a03; }
		.flex-row:nth-child(2){ background: #ccf4e9;color:#05cf6e;}
		.flex-row:nth-child(2) .paixu { border-color: #05cf6e; }
		.flex-row:nth-child(3){ background: #dbeefb;color:#2692dd;}
		.flex-row:nth-child(3) .paixu { border-color: #2692dd; }
	}
	.search-entry {
	  margin: 20rpx 0;
	  background-color: #fff;
	  border-radius: 20rpx;
	  padding: 10rpx 30rpx;
	  transition: all 0.3s ease;
	}

	.search-entry:active {
	  background-color: #EBEBEB;
	}

	.search-placeholder {
	  display: flex;
	  align-items: center;
	  gap: 12rpx;
	}

	.search-text {
	  font-size: 28rpx;
	  color: #999;
	}
</style>