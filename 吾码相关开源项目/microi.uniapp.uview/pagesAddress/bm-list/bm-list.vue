<template>
	<view class="lianxiren">
		<u-navbar :is-back="true" title="部门机构" title-size="34" :border-bottom="false" :title-bold="true" title-color="#000">
		</u-navbar>
		<view class="search" :style="{top:barHeight+'px'}">
			<u-search bg-color="#E9EAEC" height="76" search-icon="/static/img/search.png" placeholder="搜索部门机构" 
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
					<block v-for="(item,index) in bmList" :key="index">
						<view class="item" @click="goDetail(item)">
							<view class="item_left">
								<view class="user">
									<text class="username">{{item.Name || ''}}</text>
									<!-- <text class="userCompany">{{item.Code || ''}}</text> -->
								</view>
							</view>
							<!-- <image class="item_right" src="../../static/img/fanhui.png"></image> -->
							<view class="item_right">
								<u-icon name="arrow-up" v-if="showChild" @click="showChild = !showChild"></u-icon>
								<u-icon name="arrow-down" v-else @click="showChild = !showChild"></u-icon>
							</view>
						</view>
						<view v-if="showChild" class="item" v-for="(val,ind) in item._Child" :key="ind">
							<view class="item_left">
								<view class="user" style="padding-left:20rpx;">
									<text class="username">{{val.Name || ''}}</text>
									<!-- <text class="userCompany">{{val.Code || ''}}</text> -->
								</view>
							</view>
							<!-- <view class="item_right">
								<u-icon name="arrow-down"></u-icon>
							</view> -->
						</view>
					</block>
				</view>
			</view>
			
			<view style="padding: 30rpx 0;" v-if="loadText"> 
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
				status: 'loadmore',
				iconType: 'flower',
				loadText: {
					loadmore: '上拉或点击加载更多',
					loading: 'Loading...',
					nomore: ''
				},
				bmList:[],
				showChild:true,
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
				this.getBuMen()
			},
			async getBuMen(){
				var params = {
					_PageSize: this.pageSize,
					_PageIndex: this.pageIndex,
					_Keyword: this.keyword,
					OsClient: 'zongxungz',
					State: 1
				}
				var res = await this.$u.api.GetSysDeptStep(params)
				this.bmList = res.data.Data
				
				if (res.data.DataCount <= this.bmList.length) this.status = 'nomore';
				else this.status = 'loading';
			},
			goDetail(){
				this.showChild = !this.showChild
			}
		},
		mounted() {
			this.barHeight = this.$store.state.navbarHeight + this.$store.state.systemInfo.statusBarHeight
			this.getBuMen()
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
