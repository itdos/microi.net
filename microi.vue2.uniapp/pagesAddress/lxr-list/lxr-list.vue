<template>
	<view class="lianxiren">
		<u-navbar :is-back="true" title="联系人" title-size="34" :border-bottom="false" :title-bold="true" title-color="#000">
		</u-navbar>
		<view class="search" :style="{top:barHeight+'px'}">
			<u-search bg-color="#E9EAEC" height="76" search-icon="/static/img/search.png" placeholder="搜索联系人" 
			v-model="keyword" shape="square" :show-action="false" @search="getLXR" :clearabled="false"></u-search>
		</view>
		<scroll-view :style="{paddingTop:barHeight-25+'px'}" scroll-y @scrolltolower="handleScroll">
			<!-- <view class="atten" v-if="attenList&&attenList.length>0">
				<view class="atten-top">
					<u-image width="36rpx" height="36rpx" src="/static/img/guanzhu.png" mode=""></u-image>
				</view>
				<view class="item-list">
					<view class="item" v-for="(item,index) in attenList" :key="index" @click="goDetail(item)">
						<view class="item_left">
							<image :src="item.Avatar"></image>
							<view class="user">
								<text class="username">{{item.Name}}</text>
								<text class="userCompany">{{item.DeptName || ''}}</text>
							</view>
						</view> -->
						<!-- <image class="item_right" src="../../static/img/guanzhu.png"></image> -->
					<!-- </view>
				</view>
			</view> -->
			
			<view class="search-list">
				<view class="search-list-top">
				</view>
				<view class="item-list">
					<view class="item" v-for="(item,index) in lxrList" :key="index" @click="goDetail(item)">
						<view class="item_left">
							<image :src="item.Avatar"></image>
							<view class="user">
								<text class="username">{{item.Name}}</text>
								<text class="userCompany">{{item.DeptName || ''}}</text>
							</view>
						</view>
						<!-- <image class="item_right" src="../../static/img/guanzhu.png"></image> -->
					</view>
				</view>
			</view>
			
			<view style="padding: 30rpx 0;">
				<u-loadmore :status="status" :icon-type="iconType" :load-text="loadText" @loadmore="loadmore" />
			</view>
		</scroll-view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				keyword:'',
				barHeight:0,
				pageSize: 10,
				pageIndex: 1,
				choiceShow:false,
				status: 'loadmore',
				iconType: 'flower',
				loadText: {
					loadmore: '上拉或点击加载更多',
					loading: '努力加载中',
					nomore: '实在没有了'
				},
				lxrList:[],
				attenList:[]
			}
		},
		methods: {
			handleScroll(e){
				this.loadmore()
			},
			async loadmore(){
				this.status = 'loading';
				this.pageIndex = ++this.pageIndex;
				
				var params = {
					_PageSize: this.pageSize,
					_PageIndex: this.pageIndex,
					_Keyword: '',
					DeptId: '',
					State: 1,
				}
				
				var res = await this.$u.api.GetSysUser(params)
				
				if (res.data.Code == 1){
					res.data.Data.map(item=>{
						item.Avatar = this.$util.GetServerPath(item.Avatar,'/static/img/my/toux.png')
						this.lxrList.push(item)
					})
					
					if (res.data.DataCount <= this.lxrList.length) this.status = 'nomore';
					else this.status = 'loading';
				} else {
					this.$refs.uToast.show({
						title: res.data.Msg,
						type: 'error'
					})
				}
				
			},
			async getLXR(){
				var params = {
					_PageSize: this.pageSize,
					_PageIndex: this.pageIndex,
					_Keyword: this.keyword,
					DeptId: '',
					State: 1,
				}
				
				var res = await this.$u.api.GetSysUser(params)
				
				if (res.data.Code == 1){
					this.lxrList = res.data.Data
					this.lxrList.map(item=>{
						item.Avatar = this.$util.GetServerPath(item.Avatar,'/static/img/my/toux.png')
					})
				} else {
					this.$refs.uToast.show({
						title: res.data.Msg,
						type: 'error'
					})
				}
				
			},
			goDetail(item){
				// console.log(item)
				this.$u.vuex('vuex_person',item)
				this.$Router.push({
					name:'personal'
				})
			},
			goLXR(){
				this.$Router.push({
					name:'lxr-list'
				})
			}
		},
		mounted() {
			this.barHeight = this.$store.state.navbarHeight + this.$store.state.systemInfo.statusBarHeight
			this.getLXR()
		},
		onShareAppMessage(res) { //发送给朋友
			// return {
			// 	title: this.title,
			// 	imageUrl: this.thumb,
			// }
		},
		onShareTimeline(res) { //分享到朋友圈
			// return {
			// 	title: this.title,
			// 	imageUrl: this.thumb,
			// }
		}
	}
</script>

<style lang="scss" scoped>
.lianxiren{
	width: 100%;
	height:100vh;
	background-color: #FFFFFF;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}
.search{
	padding: 0 30rpx;
	margin-bottom: 30rpx;
	position: fixed;
	z-index: 999;
	width: 100%;
	background: #fff;
	// height: 92rpx;
}
.search-list,
.atten{
	&-top{
		width: 100%;
		height: 60rpx;
		background-color: #F5F7F9;
		display: flex;
		justify-content: flex-start;
		align-items: center;
		padding-left: 30rpx;
	}
}
.atten .item:last-child{
	border-bottom: none;
}
.item-list{
	width: 100%;
	padding: 0 30rpx;
	.item{
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 23rpx 0;
		border-bottom: 1rpx solid #efefef;
		.item_left{
			display: flex;
			align-items: center;
			color: #000000;
			font-size: 34rpx;
			image{
				width: 72rpx;
				height: 72rpx;
				margin-right: 33rpx;
				border-radius: 8rpx;
			}
			.user{
				display: flex;
				flex-direction: column;
				.username{
					color: #000000;
					font-size: 32rpx;
				}
				.userCompany{
					color: #BEC1CC;
					font-size: 24rpx;
					margin-top: 16rpx;
				}
			}
		}
		.item_right{
			width: 36rpx;
			height: 36rpx;
		}
	}
	
}

</style>
