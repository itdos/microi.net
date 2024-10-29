<template>
	<view>
		<!-- :style="{marginTop:navHeight+'px'}" -->
		<view class="work-title" :style="{paddingTop:navHeight+125+'rpx',height:150+navHeight+'rpx'}">
			<text>工作台</text>
			<!-- <u-image width="40rpx" height="40rpx" src="/static/img/work/search.png" mode=""></u-image> -->
		</view>

		<view class="work-banner" :style="{paddingTop:190+navHeight+'rpx'}">
			<u-swiper :list="list" height="232" mode="rect"></u-swiper>
			<!-- <u-image width="100%" src="/static/img/work/banner.png" mode=""></u-image> -->
		</view>

		<view class="commonly-use">
			<view v-if="changyongList" class="common-item" v-for="(item,index) in changyongList" :key="index">
				<u-image width="80rpx" height="80rpx" :src="item.Icon" mode=""></u-image>
				<text>{{item.Name}}</text>
			</view>
			<!-- <view class="common-item" @click="goCommon">
				<u-image width="80rpx" height="80rpx" src="/static/img/work/add.png" mode=""></u-image>
				<text>添加常用</text>
			</view> -->
			<view class="common-item" @click="goPunchCard">
				<u-image width="80rpx" height="80rpx" src="/static/img/work/add.png" mode=""></u-image>
				<text>签到打卡</text>
			</view>
		</view>

		<view style="padding: 0 30rpx;">
			<u-section title="全部应用" :right="false" font-size="34" line-color="var(--itdos-color)" :paddingLeft="38">
			</u-section>
		</view>

		<view class="work-list">
			<view class="common-item" v-for="(item,index) in sysList" :key="index" @click="goDetail(item)">
				<u-image width="80rpx" height="80rpx" :src="item.Icon" mode=""></u-image>
				<text>{{item.Name}}</text>
			</view>
		</view>

		<u-toast ref="uToast" />

		<tabbar></tabbar>
	</view>
</template>

<script>
	import tabbar from '@/components/itdos_tabbar.vue'
	export default {
		components: {
			tabbar
		},
		data() {
			return {
				navHeight: '',
				sysList: [],
				changyongList: [],
				list: [{
						image: '/static/img/work/banner.png',
					},
					{
						image: '/static/img/work/banner.png',
					},
					{
						image: '/static/img/work/banner.png',
					}
				],
			}
		},
		methods: {
			logoTime() {
				console.log('长按------')
			},
			async getSysList() {
				var params = {
					OsClient: this.$config.osClient
				}
				this.sysList = []
				var res = await this.$u.api.GetSysMenuStep(params)
				if (!res) return;
				// if (!res) {
				// 	return this.$Router.replaceAll({
				// 		name: 'login'
				// 	})
				// }
				if (res.data.Code == 1) {
					var list = res.data.Data
					list.map(item => {
						if (item._Child && item.Display && item.Name != '首页' && item.Name != '系统引擎' && item.Name != '系统管理') {
							item.Icon = this.$util.GetServerPath(item.Icon, '/static/img/icon/icon1.png')
							this.sysList.push(item)
						}
					})
						
				} else {
					this.$refs.uToast.show({
						title: res.Msg,
						type: 'error'
					})
				}

			},
			goDetail(item) {
				// console.log(item._Child)
				var list = []


				// if(item.Name == '报表'){
				// 	item._Child.map(res=>{
				// 		if(res.Display==true){
				// 			list.push(res)
				// 		}
				// 	})
				// 	this.$u.vuex('vuex_typeList',list)
				// 	this.$Router.push({
				// 		name:'worktable',
				// 		params:{
				// 			title:item.Name
				// 		}
				// 	})
				// }else 
				if (item.Name == '资产盘点') {
					item._Child.map(res => {
						if (res.Display == true) {
							list.push(res)
						}
					})
					this.$u.vuex('vuex_typeList', list)
					this.$Router.push({
						name: 'workPandianList',
						params: {
							title: item.Name
						}
					})
				} else {
					item._Child.map(res => {
						if (res.Display == true) {
							list.push(res)
						}
					})
					this.$u.vuex('vuex_typeList', list)
					this.$Router.push({
						name: 'worklist',
						params: {
							title: item.Name
						}
					})
				}
			},
			goCommon() {
				this.$Router.push({
					name: 'work-common'
				})
			},
			goPunchCard() {
				this.$Router.push({
					name: 'punchcard'
				})
			},
		},
		mounted() {
			this.navHeight = this.$store.state.navbarHeight
		},
		async onShow() {
			if (this.sysList == false) {
				await this.getSysList()
				// this.$u.vuex('vuex_token', '')
				console.log(this.vuex_token,'token')
			}
		},
		
		onLoad() {

			// #ifdef MP-WEIXIN
			uni.showShareMenu({
				withShareTicket: true,
				menus: ["shareAppMessage", "shareTimeline"]
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

<style lang="scss" scoped>
	.work-title {
		position: fixed;
		z-index: 999;
		width: 100%;
		// height: 100rpx;
		background-color: #fff;

		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 40rpx;

		text {
			font-size: 38rpx;
			font-weight: bold;
			color: #22306D;
		}
	}

	.work-banner {
		margin-bottom: 67rpx;
		padding: 145rpx 30rpx 0 30rpx;
	}

	.commonly-use {
		padding-bottom: 34rpx;
	}

	.work-list {
		margin-top: 35rpx;
	}

	.commonly-use,
	.work-list {
		.common-item {
			width: 25%;
			display: inline-flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			margin-bottom: 50rpx;

			.common-item-icon {
				width: 80rpx;
				height: 80rpx;
				border-radius: 8rpx;
				background-color: #FFF1DC;
				display: flex;
				justify-content: center;
				align-items: center;
			}

			text {
				font-size: 24rpx;
				margin-top: 14rpx;
			}
		}
	}
</style>
