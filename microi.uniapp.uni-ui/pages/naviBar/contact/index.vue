<template>
  <view class="uni-container">
		<view v-if="Microi.OsClient == 'crm'">
			<view class="search-box">
				<view class="search-item uni-flex">
						<uni-easyinput prefixIcon="search" v-model="keyword" placeholder="搜索项目/名称" style="border:0;" @iconClick="getListData" @blur="getListData" @clear="onClear"></uni-easyinput>
				</view>
			</view>
		</view>
   <view class="uni-panel" v-for="(item, index) in list" :key="index">
		<view class="uni-panel-h" @click="Microi.RouterPush(item.url)">
			<text class="uni-panel-text">{{item.name}}</text>
			<text class="uni-panel-icon uni-icon">{{ item.count }}</text>
		</view>
	</view>
  </view>
</template>

<script setup>
import { ref, inject } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app';
const Microi = inject('Microi'); // 使用注入Microi实例
const userInfo = ref(Microi.GetCurrentUser()) // 用户信息
const keyword = ref('') // 搜索关键字
const list = ref([]) // 列表

// 获取数据
const getData = async () => {
  // const res = await Microi.ApiEngine.Run('get_index_data')
  var todoCountResult = await Microi.FormEngine.GetTableData({
	  FormEngineKey : 'WF_Work',
	  _Where:[{Name:'WorkState',Value:'Todo',Type:'='},{Name:'ReceiverId',Value:userInfo.value.Id,Type:'='}]
	});
	
}
const getListData = () => {}
const onClear = () => {}
// 点击主菜单显示子菜单
const navDemoPage = (item) => {
	Microi.RouterPush(item.Url,true);
}
onShow (() => {
  getData()
})
</script>

<style>
	@import '../../../common/uni-nvue.css';
	.search-box { 
		padding:1% 2%;
		background-color: #fff;
	}
	.search-btn{
	  margin-left: 20rpx;
	}
	.workData-container{
		background-color: #fff;
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-start;
		padding: 50rpx 20rpx;
		font-size: 24rpx;
		margin:0 0 1%;
	}
	.workData-item{
	  margin: 10rpx 1%;
	  text-align: center;
	  width: 23%;
	}
	.item-img{
	  width: 60rpx;
	  height: 60rpx;
	  padding:30rpx;
	  border-radius: 100rpx;
	  background-color: #f4f6fa;
	  margin:0 0 15rpx;
	}
</style>