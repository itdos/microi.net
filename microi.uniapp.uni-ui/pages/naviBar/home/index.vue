<template>
  <view class="container">
		<general ref="generalHome" />
  </view>
	<view class="uni-tabbar-height"></view>
	<tab-bar :current="currentBar" backgroundColor="#fff" color="#333" tintColor="rgba(57, 121, 240, 1)"></tab-bar>
</template>

<script setup>
import { ref, inject, onMounted, watch, nextTick } from 'vue'
import { onLoad, onShow, onHide } from '@dcloudio/uni-app';
import { scanCodeH5 } from '@/utils';
import dayjs from 'dayjs';
import general from './general.vue'

const Microi = inject('Microi'); // 使用注入Microi实例
const V8 = inject('V8'); // 使用注入V8实例
const userInfo = ref(Microi.GetCurrentUser()) // 用户信息
const keyword = ref('') // 搜索关键字
const info = ref([])
const data = ref({
	Tabs: [],
	Notice: [],
	Daiban: [],
	Tuij_ico: [],
	Jianbao: [],
	Daiban: []
}) // 搜索关键字
const currentBar = ref(0) // 当前tab索引

const generalHome = ref(null) // 通用首页实例

onLoad (() => {
	uni.$on('clickTabbar', (index) => {
		currentBar.value = index;
	});
	uni.$on('testParam', (data) => {
		// 使用nextTick确保模板完全渲染后再访问组件引用
		nextTick(() => {
			generalHome.value.getData()
		});
	});
})
onShow (() => {
})
onHide (() => {
	// 组件或页面隐藏时，可以移除监听，避免内存泄漏
	uni.$off('testParam');
})
</script>

<style lang="scss" scoped>
	page{
		background-color:#f3f5f4;
	}
	.container{
		max-width: 100%;
	}
	.search-box { 
		padding:3% 3% 0;
	}
	.search-btn{
	  margin-left: 20rpx;
	}
	.workData-content{
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-start;
		padding:  20rpx;
		min-height:200rpx;
		font-size: 24rpx;
		margin:0 0 1%;
	}
	.workData-container{
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-start;
		padding:  20rpx;
		font-size: 24rpx;
	}
	.workData-item{
		margin: 10rpx 1%;
		text-align: center;
		width: 23%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		color:#000;
	}
	.item-img{
	  width: 60rpx;
	  height: 60rpx;
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
		.flex-row:nth-child(1){ background: #ffebd3;color:#e99a03;}
		.flex-row:nth-child(1) .paixu { border-color: #e99a03; }
		.flex-row:nth-child(2){ background: #ccf4e9;color:#05cf6e;}
		.flex-row:nth-child(2) .paixu { border-color: #05cf6e; }
			.flex-row:nth-child(3){ background: #dbeefb;color:#2692dd;}
	.flex-row:nth-child(3) .paixu { border-color: #2692dd; }
}


</style>