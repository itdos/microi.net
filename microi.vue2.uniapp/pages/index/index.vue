<template>
	<view style="main">
		<view class="banner">
			<u-image width="750rpx" height="257rpx" src="/static/images/home/banner.jpg" mode=""></u-image>
		</view>
		
		<view>
			<view class="work">
				<view class="left">
					<u-image width="188rpx" height="134rpx" src="/static/images/home/index1.jpg" mode=""></u-image>
				</view>
				<view class="right">
					<u-image width="188rpx" height="134rpx" src="/static/images/home/index2.jpg" mode=""></u-image>
				</view>
			</view>
			<view class="work">
				<view class="left" @click="goPunchCard">
					<u-image width="188rpx" height="134rpx" src="/static/images/home/index3.jpg" mode=""></u-image>
				</view>
				<view class="right" @click="goNingBaoLi">
					<u-image width="188rpx" height="134rpx" src="/static/images/home/index4.jpg" mode=""></u-image>
				</view>
			</view>
		</view>

		<view class="home" style="padding-top:40rpx;">
			<view class="daiban">
				<view class="left">
					<u-image width="100rpx" height="100rpx" src="/static/images/home/daiban1.png" mode="" style="border-radius:6rpx;"></u-image>
					<view>
						<text>{{TotalCount||0}}</text>
						待办事项
					</view>
				</view>
				<view class="right">
					<u-image width="100rpx" height="100rpx" src="/static/images/home/daiban2.png" mode="" style="border-radius:6rpx;"></u-image>
					<view>
						<text>{{TotalCount||0}}</text>
						待办任务
					</view>
				</view>
			</view>
		</view>
		
		<view style="padding-top:50rpx;">
			<u-image width="750rpx" height="352rpx" src="/static/images/home/bottom.jpg" mode=""></u-image>
		</view>
		
		<tabbar></tabbar>
	</view>
</template>

<script>
	import tabbar from '@/components/itdos_tabbar.vue'
	import zzxCalendar from "@/components/zzx-calendar/zzx-calendar.vue"
	export default {
		components: {
			tabbar,
			zzxCalendar
		},
		data() {
			return {
				barHeight: 0,
				botHeight: 0,
				weeks: ['日', '一', '二', '三', '四', '五', '六'],
				richengList: [],
				pageSize: 10,
				pageIndex: 1,
				TotalCount: 0,
				choiceShow: false,
				status: 'loadmore',
				iconType: 'flower',
				loadText: {
					loadmore: '上拉或点击加载更多',
					loading: '努力加载中',
					nomore: '实在没有了'
				},
			}
		},

		methods: {
			datechange(e) {
				console.log(e);

			},
			handleScroll(e) {
				this.loadmore()
			},
			//获取前五天时间
			GetDateStr(AddDayCount) {
				var dd = new Date();
				dd.setDate(dd.getDate() + AddDayCount); //获取AddDayCount天后的日期  
				var m = dd.getMonth() + 1;
				var d = dd.getDate();
				var w = dd.getDay()

				var str = {
					date: d,
					month: m,
					week: w,
				}
				return str;
			},

			async handleWorkList() {
				const params = {
					WorkType: 'Todo',
					_PageIndex: this.pageIndex,
					_PageSize: this.pageSize,
					_Keyword: ''
				}
				const res = await this.$u.api.GetWFWork(params)
				if (!res) return
				this.TotalCount = res.data.DataCount
				res.data.Data = res.data.Data.map(item => {
					return {
						date: new Date(item.CreateTime.replace(/-/g, '/')).getDate(),
						week: '周' + this.weeks[new Date(item.CreateTime.replace(/-/g, '/')).getDay()],
						list: [{
							title: item.FlowTitle,
							time: item.CreateTime
						}],
						today: this.datesAreOnSameDay(new Date(), new Date(item.CreateTime))
					}
				})
				this.richengList = res.data.Data


				if (res.data.DataCount <= this.richengList.length) this.status = 'nomore';
				else this.status = 'loading';
			},
			loadmore() {
				if (this.status == 'nomore') return
				this.status = 'loading';
				this.pageIndex = ++this.pageIndex;
				this.handleWorkList()
			},
			datesAreOnSameDay(first, second) {
				return first.getFullYear() === second.getFullYear() &&
			  first.getMonth() === second.getMonth() &&
					first.getDate() === second.getDate();
			},
			goPunchCard() {
				this.$Router.push({
					name: 'punchcard'
				})
			},
			goMyCard() {
				this.$Router.push({
					name: 'mycard'
				})
			},
			goNingBaoLi() { //跳转宁宝里小程序
				uni.navigateToMiniProgram({
				  appId: 'wxbaa2bbad9c8a6885',  //跳转的小程序的aooId
				  path: 'pages/index/index', //如果这里不填，默认是跳转到对方小程序的主页面
				  extraData: {    //需要传给对方小程序的数据
					'data1': 'test'
				  },
				  success(res) {
					// 打开成功
				  }
				})
			},
		},
		mounted() {
			this.barHeight = this.$store.state.navbarHeight + 42
			this.botHeight = this.$store.state.systemInfo.statusBarHeight + this.$store.state.navbarHeight + 40
		},
		onShow() {
			if (this.richengList == false) {
				this.handleWorkList()
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
	.home {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
	}
	
	.work {
		background-color: #fff;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 115rpx;
		border-bottom: 6rpx solid #F8F9FF;
		
		.left {
			width:257rpx;
			padding:60rpx 0;
			border-right: 6rpx solid #F8F9FF;
		}
	}

	.daiban {
		background-color: #fff;
		border-bottom: 14rpx solid #F8F9FF;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 60rpx 66rpx 90rpx 64rpx;

		.left,
		.right {
			display: flex;
			justify-content: flex-start;
			align-items: center;

			view {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				font-size: 28rpx;
				color: #AEAEAE;
				margin-left: 35rpx;

				text {
					font-size: 54rpx;
					font-weight: bold;
					color: #000;
				}
			}
		}
	}

	.date {
		height: 100%;

		.date-top {
			display: flex;
			justify-content: space-between;
			align-items: center;
			width: 100%;
			height: 89rpx;
			padding: 0 36rpx;
			font-size: 32rpx;
			border-bottom: 1px solid #efefef;
		}

		.date-item {
			padding: 24rpx 20rpx 18rpx 37rpx;
			display: flex;
			justify-content: space-between;
			align-items: flex-start;

			.left-date {
				display: flex;
				flex-direction: column;
				align-items: center;
				font-size: 20rpx;
				color: #000;

				text {
					font-size: 34rpx;
					font-weight: bold;
				}
			}

			.right-list {
				width: 88%;
				min-height: 100rpx;

				&-item {
					padding: 17rpx 25rpx;
					width: 100%;
					height: auto;
					background-color: #E1E9FC;
					display: flex;
					flex-direction: column;
					color: #3F5CD9;
					font-size: 20rpx;
					margin-bottom: 18rpx;

					text {
						font-size: 24rpx;
						font-weight: bold;
						margin-bottom: 6rpx;
					}
				}
			}

			.today {
				color: #3F5CD9;
			}

			.today-line {
				width: 102%;
				height: 1rpx;
				background-color: #D52426;
				position: relative;
				left: -2%;
				bottom: -50rpx;

				.yuan {
					width: 8rpx;
					height: 8rpx;
					background-color: #D52426;
					border-radius: 50%;
					position: absolute;
					left: 0;
					top: -4rpx;
				}
			}
		}

		.date-item:last-child {
			margin-bottom: 200rpx;
		}

		.wrc {
			padding: 6rpx 0;
			width: 100%;
			height: auto;
			display: flex;
			justify-content: flex-start;
			align-items: flex-start;
			color: #9C9C9C;
			font-size: 24rpx;
			margin-bottom: 18rpx;

			.wrc-yuan {
				width: 14rpx;
				height: 14rpx;
				background-color: #E6E6E6;
				border-radius: 50%;
				margin-right: 14rpx;
				margin-top: 12rpx;
			}

			.wrc-right {
				display: flex;
				flex-direction: column;
				align-items: flex-start;
				justify-content: flex-start;

				text {
					font-size: 20rpx;
					margin-top: 6rpx;
				}
			}
		}
	}
</style>
