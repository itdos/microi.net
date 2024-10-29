<template>
	<view class="container">
		<view class="view-top" :style="{paddingTop:barHeight+'rpx'}">
			<view class="head">
				<text>通讯录</text>
				<!-- <image src="../../static/img/add.png"></image> -->
			</view>
			<view class="search">
				<u-search @click="goSearch" :disabled="true" bg-color="#E9EAEC" height="76" search-icon="/static/img/search.png" placeholder="搜索联系人" shape="square" :show-action="false"></u-search>
			</view>
			<view class="item-list">
				<view class="item" style="border-bottom: 1rpx solid #efefef;" @click="goLXR">
					<view class="item_left">
						<image src="../../static/img/tx_lianxiren.png"></image>
						<text>联系人</text>
					</view>
					<image class="item_right" src="../../static/img/fanhui.png"></image>
				</view>
				<view class="item" @click="goBumen">
					<view class="item_left">
						<image src="../../static/img/tx_bumen.png"></image>
						<text>部门</text>
					</view>
					<image class="item_right" src="../../static/img/fanhui.png"></image>
				</view>
			</view>
		</view>
		<view class="view-bottom skeleton"  :style="{paddingBottom:barHeight-30 +'px'}">
			<view class="lxr-list">
				<view class="title">
					<view class="tab"></view>
					<text>联系人</text>
				</view>
				<scroll-view style="height:88%;" scroll-y class="item-list" @scrolltolower="handleScroll">
					<view class="item" v-for="(item,index) in lxrList" :key="index" @click="goDetail(item)"> 
						<view class="item_left">
							<image class="skeleton-rect" :src="item.Avatar"></image>
							<view class="user">
								<text class="username skeleton-rect">{{item.Name}}
									<text class="deptName">{{item.DeptName?' '+ item.DeptName:''}}</text>
								</text>
								<text class="userCompany skeleton-rect">{{item.Phone || ''}}</text>
							</view>
						</view>
						<!-- <image class="item_right" src="../../static/img/guanzhu.png"></image> -->
					</view>
					
					<view style="padding: 30rpx 0;">
						<u-loadmore :status="status" :icon-type="iconType" :load-text="loadText" @loadmore="loadmore" />
					</view>
					
				</scroll-view>
			</view>
		</view>
		<u-toast ref="uToast" />
		
		
		<tabbar></tabbar>
	</view>
</template> 

<script>
	import tabbar from '@/components/itdos_tabbar.vue'
	export default {
		components:{
			tabbar
		},
		data() {
			return {
				keyword:'',
				scrollTop: 0,
				old: {
					scrollTop: 0
				},
				botHeight:0,
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
				barHeight:0,
			};
		},
		methods:{
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
					_Keyword: '',
					DeptId: '',
					State: 1,
				}
				
				var res = await this.$u.api.GetSysUser(params)
				if (!res) return;				
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
			},
			goSearch(){
				this.$Router.push({
					name:'lxr-list'
				})
			},
			goBumen(){
				this.$Router.push({
					name:'bm-list'
				})
				// this.$refs.uToast.show({
				// 	title: '敬请期待！',
				// 	type: 'default'
				// })
			}
		},
		mounted() {
			this.botHeight = this.$store.state.tabbarHeight + this.$store.state.systemInfo.statusBarHeight - 15
			this.barHeight = this.$store.state.navbarHeight + 20
			
			this.getLXR()
			
		},
		onLoad(){
			// #ifdef MP-WEIXIN
			uni.showShareMenu({
				withShareTicket:true,
				menus:["shareAppMessage","shareTimeline"]
			})
			// #endif
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

<style lang="scss">
.container{
	width: 100%;
	height:100vh;
	background-color: #FFFFFF;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	.view-top{
		height: 600rpx;
		padding:0 30rpx 0 30rpx;
		.head{
			display: flex;
			align-items: center;
            justify-content: space-between;
			font-size: 38rpx;
			font-weight: bold;
			color: #22306D;
			padding-bottom: 37rpx;
			padding-left: 10rpx;
			padding-right: 10rpx;
			margin-top: 100rpx;
			image{
				width: 42rpx;
				height: 42rpx;
			}
		}
		.search{
			padding-bottom: 32rpx;
		}
		.item-list{
			display: flex;
			align-items: center;
            flex-direction: column;
			.item{
				width: 100%;
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 23rpx 0;
				.item_left{
					display: flex;
					align-items: center;
					color: #000000;
					font-size: 34rpx;
					image{
						width: 72rpx;
						height: 72rpx;
						margin-right: 33rpx;
					}
				}
				.item_right{
					width: 24rpx;
					height: 24rpx;
				}
			}
		}
	}
	.view-bottom{
		padding:41rpx 30rpx 0 30rpx;
		height: calc(100vh - 272px);
		border-top: 10px solid #F5F7F9;
		.lxr-list{
			display: flex;
			align-items: center;
			flex-direction: column;
			height: 100%;
			justify-content: space-between;
			.title{
				width: 100%;
				display: flex;
				align-items: center;
				justify-content: flex-start;
				color: #000000;
				font-size: 34rpx;
				font-weight: bold;
				padding-bottom: 24rpx;
				.tab{
					width:6rpx;
					height: 32rpx;
					background-color: #3F5CD9;
					border-radius: 50rpx;
					margin-right: 30rpx;
				}
			}
			.item-list{
				width: 100%;
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
							.deptName{
								font-size:24rpx;
								color:#3F5CD9;
							}
						}
					}
					.item_right{
						width: 36rpx;
						height: 36rpx;
					}
				}
			}
		}
	}
}
</style>
