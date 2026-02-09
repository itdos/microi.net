<template>
	<view style="width: 100vw;height: 100vh;overflow: hidden;">
		<u-navbar :is-back="true" :title="title" title-color="#171717" title-size="34" :title-bold="true">
			<view class="slot-wrap" style="justify-content: flex-end;">
				<u-image width="40rpx" height="40rpx" src="/static/img/work/shaixuan.png" mode="">
				</u-image>
			</view>
		</u-navbar>

		<view class="work-page">
			<view class="sticky_box">
				<u-tabs :list="typeList" :bar-width="100" name="Name" :is-scroll="true" :showBar="true"
					:activeItemStyle="activeStyle" :current="current" @change="tabsChange"></u-tabs>
			</view>
			<view class="all-lanmu">
				<u-image @click="lanmuShow=true" active-color="#3F5CD9" width="36rpx" height="36rpx"
					src="/static/img/work/all-lanmu.png" mode=""></u-image>
			</view>

			<view v-for="(item,index) in childList" :key="index">
				<u-tabs :list="item.sonList" name="Name" :is-scroll="true" :showBar="false"
					:activeItemStyle="activeStyle" :current="currentX" @change="sonChange($event,item.sonList)">
				</u-tabs>
			</view>
			<!-- <scroll-view class="work-list" scroll-y :style="{paddingBottom:barHeight+'px'}"
				@scrolltolower="handleScroll">
				<view class="work-form" v-if="trueList&&trueList.length>0">
					<view class="work-item" v-for="(item,index) in trueList" :key="index" @click="handleDetail(index)">
						<view class="work-item-main">
							<view v-for="(val,key,i) in item.bb" :key="key">
								<view class="work-item-cont" v-if="key!='最新时间' && key!='创建人'">
									<text style="margin-right: 10rpx;">{{key}}</text> : {{val||''}}
								</view>
							</view>
						</view>
						<view class="work-item-btm">
							<view>
								<view class="work-item-person">
									<u-image style="margin-right: 16rpx;" width="25rpx" height="25rpx"
										src="/static/img/work/person.png" mode=""></u-image>
									{{item.CreateTime || item.UpdateTime}}
								</view>
								<view class="work-item-time">
									<u-image style="margin-right: 16rpx;" width="25rpx" height="25rpx"
										src="/static/img/work/upt-time.png" mode=""></u-image>
									{{item.UserName}}
								</view>
							</view>
							<view>
								<u-button v-if="item.DanjuZT === '待盘点'||item.DanjuZT === '进行中'" type="primary"
									size="mini" @click="handleToPanDian(item)">去盘点</u-button>
								<u-button v-if="item.DanjuZT === '已盘点'" type="warning" size="mini"
									@click="$Router.push({name: 'workPandianDetail',params: {panDianId:item.Id}})">已盘点
								</u-button>
							</view>
						</view>
					</view>

				</view>
				<view v-else class="nolist">
					<u-image width="280rpx" height="222rpx" src="/static/img/work/noList.png" mode=""></u-image>
					<view class="nolist-txt">
						暂无数据，<text @click="$Router.push({name: 'workadd',params: {TableId:DiyTableId}})">去创建</text>
					</view>
				</view>

				<view style="padding: 30rpx 0;" v-if="trueList&&trueList.length>0">
					<u-loadmore :status="status" :icon-type="iconType" :load-text="loadText" @loadmore="loadmore" />
				</view>
			</scroll-view> -->
		</view>
		
		<view class="table-view">
			<u-table>
				<u-tr class="u-tr">
					<u-th v-for="(item,index) in trueList" :key="index" class="u-th">{{item}}</u-th>
				</u-tr>
				<block v-if="typeList[current].Name == '资产报表'">
					<u-tr class="u-tr" v-for="(item,index) in tableList" :key="index">
						<u-td class="u-td">{{item.ZichanBH || '/'}}</u-td>
						<u-td class="u-td">{{item.XulieH || '/'}}</u-td>
						<u-td class="u-td">{{item.ZichanMC || '/'}}</u-td>
						<u-td class="u-td">{{item.ZichanLY || '/'}}</u-td>
						<u-td class="u-td">{{item.ZichanJZ || '/'}}</u-td>
						<u-td class="u-td">{{item.ZichanJG || '/'}}</u-td>
						<u-td class="u-td">{{item.ZichanGG || '/'}}</u-td>
						<u-td class="u-td">{{item.Pinpai || '/'}}</u-td>
						<u-td class="u-td">{{item.JiliangDW || '/'}}</u-td>
						<u-td class="u-td">{{item.ZichanZT || '/'}}</u-td>
						<u-td class="u-td">{{item.CunfangKW || '/'}}</u-td>
						<u-td class="u-td">{{item.ApplyCount || '/'}}</u-td>
						<u-td class="u-td">{{item.ReturnCount || '/'}}</u-td>
						<u-td class="u-td">{{item.BorrowCount || '/'}}</u-td>
						<u-td class="u-td">{{item.BackCount || '/'}}</u-td>
					</u-tr>
				</block>
				<block v-if="typeList[current].Name == '耗材报表'">
					<u-tr class="u-tr" v-for="(item,index) in tableList" :key="index">
						<u-td class="u-td">{{item.HaocaiMC || '/'}}</u-td>
						<u-td class="u-td">{{item.HaocaiBM || '/'}}</u-td>
						<u-td class="u-td">{{item.GuigeXH || '/'}}</u-td>
						<u-td class="u-td">{{item.Pinpai || '/'}}</u-td>
						<u-td class="u-td">{{item.DangqianKW || '/'}}</u-td>
						<u-td class="u-td">{{item.RukuCount || '/'}}</u-td>
						<u-td class="u-td">{{item.ChukuCount || '/'}}</u-td>
						<u-td class="u-td">{{item.DangqianKC || '/'}}</u-td>
						<u-td class="u-td">{{item.KucunZJE || '/'}}</u-td>
					</u-tr>
				</block>
			</u-table>
		</view>
		
		

		<!-- 栏目分类弹窗 -->
		<u-popup v-model="lanmuShow" mode="top" length="100%">
			<view class="lanmu-show">
				<u-image class="lanmu-del" width="48rpx" height="48rpx" src="/static/img/work/del.svg"
					@click="lanmuShow=false" mode=""></u-image>
				<view class="lanmu-title">
					栏目分类
				</view>
				<view class="lanmu-tips">选择你想快速查看的栏目</view>
				<view class="lanmu-item" v-for="(item,index) in typeList" :key="index" @click="tabsChange(index)">
					<view class="lanmu-cont">
						{{item.Name}}
					</view>
				</view>
				<view class="lanmu-bg">

				</view>
			</view>
		</u-popup>

		<!-- 筛选条件弹窗 -->
		<u-popup v-model="choiceShow" mode="right">
			<view class="choice">
				11111
			</view>
		</u-popup>

		<view class="work-list-add">
			<u-image @click="$Router.push({name: 'workadd',params: {TableId:DiyTableId}})" width="36rpx" height="36rpx"
				src="/static/img/work/addlist.png" mode=""></u-image>
		</view>

		<u-toast ref="uToast" />
	</view>
</template>

<script>
	import navbar from '@/components/itdos_navbar.vue'
	import {
		mapState
	} from 'vuex'
	import qs from 'qs'
	export default {
		computed: {
			...mapState(['systemInfo', 'menuButtonInfo', 'navbarHeight', 'aijuColor', 'tabbarHeight']),
		},
		components: {
			navbar,
		},
		data() {
			return {
				title: '',
				typeList: [],
				current: 0,
				currentX: 0,
				activeStyle: {
					color: '#3F5CD9',
					fontWeight: 'bold'
				},
				barStyle: {
					backgroundColor: '#3F5CD9',
				},
				lanmuShow: false,
				childList: [],

				tableList: [],
				trueList: [],

				pageSize: 10,
				pageIndex: 1,
				choiceShow: false,
				status: 'loadmore',
				iconType: 'flower',
				loadText: {
					loadmore: '上拉或点击加载更多',
					loading: '努力加载中',
					nomore: '实在没有了'
				},
				barHeight: 0,
			}
		},
		methods: {
			tabsChange(index) {
				this.status = 'loadmore'
				this.pageIndex = 1
				this.lanmuShow = false
				this.current = index
				this.handleList(this.typeList[this.current].Name)
			},
			async handleList(Name) {
				let ApiEngineKey = ''
				if (Name == '资产报表') {
					ApiEngineKey = 'zichan_report'
				} else if (Name == '耗材报表') {
					ApiEngineKey = 'haocai_report'
				}
				let val = await this.$u.api.ApiEngineRun({
					ApiEngineKey,
					pageNumber: this.pageIndex,
					pageSize: this.pageSize
				})
				let {
					Code,
					Data,
					DataCount
				} = val.data
				if (Code !== 1) return
				if (this.pageIndex == 1) {
					this.tableList = Data
				} else {
					this.tableList = this.tableList.concat(Data)
				}
				if (Name == '资产报表') {
					this.trueList = [
						'资产编码',
						'序列号',
						'资产名称',
						'资产来源',
						'资产净值',
						'资产价格',
						'资产规格',
						'品牌',
						'计量单位',
						'资产状态',
						'存放库位',
						'领用次数',
						'退还次数',
						'借用次数',
						'归还次数',
					]
				} else if (Name == '耗材报表') {
					this.trueList = [
						'耗材名称',
						'耗材编码',
						'规格型号',
						'品牌',
						'当前库位',
						'入库数量',
						'出库数量',
						'当前库存',
						'库存总金额',
					]
				}
				console.log(this.tableList, 'tableList')
				if (this.pageIndex * this.pageSize >= DataCount) this.status = 'nomore';
				else this.status = 'loading';
			},
			handleDetail(index) {
				this.$Router.push({
					name: 'workdetail',
					params: {
						// tableId: this.DiyTableId,
						// tableRowId: this.tableList[index].Id,
						// index: index,
						// menuId: this.typeList[this.current].Id
					}
				})
			},
			handleScroll() {
				this.loadmore()
			},
			loadmore() {
				if (this.status == 'nomore') return
				this.status = 'loading';
				this.pageIndex = ++this.pageIndex;
				this.handleList(this.typeList[this.current].Name)
			},
		},
		mounted() {
			this.barHeight = this.$store.state.navbarHeight + this.$store.state.systemInfo.statusBarHeight

		},
		onLoad() {
			
			this.typeList = this.vuex_typeList
			this.title = this.$Route.query.title

			this.handleList(this.typeList[0].Name)
			
			// 进入当前页面 自动切换成固定横屏
			// #ifdef APP-PLUS
			plus.screen.lockOrientation("landscape-primary");
			// #endif
		},
		onUnload() {
			// 退出当前页面时 自动切换成竖屏
			// #ifdef APP-PLUS
			plus.screen.lockOrientation("portrait-primary");
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
	.slot-wrap {
		display: flex;
		align-items: center;
		/* 如果您想让slot内容占满整个导航栏的宽度 */
		flex: 1;
		/* 如果您想让slot内容与导航栏左右有空隙 */
		padding: 0 30rpx;
	}
	.table-view{
		width:96%;
		margin-left:2%;
		height:70vh;
		padding:0 30rpx;
		overflow: auto;
		u-table{
			width:100%;
			height:100%;
			overflow:auto;
		}
		.u-tr{
			overflow:auto;
			.u-th{
				width:160rpx;
				word-wrap: break-word;
			}
			.u-td{
				max-width:160rpx;
				word-wrap:break-word;
			}
		}
	}
	.work-page {
		height: 6vh;
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;

		.sticky_box {
			width: 100%;
			height: 80rpx;
			padding: 0 30rpx;
			padding-right: 80rpx;
			position: relative;
			// z-index: 1;
			background-color: #FFFFFF;
			overflow-y: hidden;
			overflow-x: auto;
			white-space: nowrap;

			.tabs-item {
				display: inline-block;
				margin-right: 80rpx;
				height: 100%;
				line-height: 80rpx;
				font-size: 28rpx;
				color: #000;
				position: relative;
			}

			.active .tabs-bar {
				width: 100%;
				height: 6rpx;
				border-radius: 3rpx;
				background-color: #3F5CD9;
				position: absolute;
				bottom: 0;
			}

		}

		.sticky_box::-webkit-scrollbar {
			display: none;
			/* Chrome Safari */
		}

		.all-lanmu {
			position: absolute;
			right: 0;
			width: 120rpx;
			height: 80rpx;
			display: flex;
			justify-content: flex-end;
			align-items: center;
			background-image: linear-gradient(to right,
					rgba(255, 255, 255, 0),
					rgba(255, 255, 255, 1),
					rgba(255, 255, 255, 1),
					rgba(255, 255, 255, 1));
			padding-right: 30rpx;
		}

		.work-list {
			height: 100%;
			width: 100%;
			flex: 1;
			overflow: auto;
			position: relative;
			background-color: #f7f7f7;

			.work-form {
				// margin-bottom: 200rpx;
				height: auto;
				overflow: hidden;
				padding: 30rpx 30rpx 0;

				.work-item {
					padding: 40rpx 30rpx;
					background-color: #fff;
					margin-bottom: 22rpx;

					&-time {
						display: flex;
						justify-content: flex-start;
						align-items: center;
						font-size: 24rpx;
						color: #9B9B9B;
					}

					&-btm {
						display: flex;
						justify-content: space-between;
						align-items: center;
					}

					&-person {
						display: flex;
						justify-content: flex-start;
						align-items: center;
						font-size: 24rpx;
						color: #9B9B9B;
						margin-top: 26rpx;
						margin-bottom: 10rpx;
					}

					&-cont {
						margin-bottom: 10rpx;
					}

					&-main {
						// height: 230rpx;
						overflow: hidden;
						text-overflow: ellipsis;
						display: -webkit-box;
						-webkit-line-clamp: 5;
						/* 行数 */
						-webkit-box-orient: vertical;
					}
				}
			}

			.nolist {
				padding: 209rpx 235rpx;
				display: flex;
				flex-direction: column;
				justify-content: center;
				align-items: center;

				&-txt {
					margin-top: 31rpx;
					font-size: 28rpx;
					color: #000;

					text {
						color: #3F5CD9;
					}
				}
			}
		}
	}

	.lanmu-show {
		padding: 0 10rpx;
		height: 100%;
		position: relative;

		.lanmu-item {
			width: 33%;
			height: 150rpx;
			display: inline-flex;
			justify-content: center;
			align-items: center;
			padding: 30rpx;
			vertical-align: top;

			.lanmu-cont {
				width: 100%;
				height: 100%;
				border: 1rpx solid #000;
				border-radius: 8rpx;
				display: flex;
				justify-content: center;
				align-items: center;
				font-size: 24rpx;
				padding: 0 12rpx;
			}
		}

		.lanmu-title {
			padding: 30rpx 0 0 30rpx;
			font-size: 38rpx;
			font-weight: bold;
			padding-top: 100rpx;
			color: #3F5CD9;
		}

		.lanmu-tips {
			color: #BEBFBF;
			font-size: 28rpx;
			font-weight: normal;
			margin-top: 10rpx;
			margin-bottom: 50rpx;
			padding-left: 30rpx;
		}

		.lanmu-del {
			position: absolute;
			right: 44rpx;
			top: 110rpx;
		}

		.lanmu-bg {
			width: 100%;
			height: 35%;
			position: absolute;
			left: 0;
			bottom: 0;
			background-image: linear-gradient(to top, #3F5CD9 -110%, #fff);
		}
	}

	.choice {
		width: 500rpx;
	}

	.work-list-add {
		width: 84rpx;
		height: 84rpx;
		border-radius: 50%;
		background-color: #3F5CD9;
		display: flex;
		justify-content: center;
		align-items: center;
		position: absolute;
		right: 41rpx;
		bottom: 188rpx;
		z-index: 999;
		box-shadow: 0rpx 4rpx 13rpx rgba($color: #3F5CD9, $alpha: 0.46);
	}
</style>
