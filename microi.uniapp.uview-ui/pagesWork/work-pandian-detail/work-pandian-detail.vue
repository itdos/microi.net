<template>
	<view style="width: 100vw;height: 100vh;overflow: hidden;">
		<u-navbar :is-back="true" title="盘点详情" title-color="#171717" title-size="34" :title-bold="true">
			<view class="slot-wrap" style="justify-content: flex-end;">
				<!-- <u-image width="40rpx" height="40rpx" src="/static/img/work/shaixuan.png" mode="">
				</u-image> -->
			</view>
		</u-navbar>
		<view class="work-page">
			<view class="sticky_box">
				<!-- <u-tabs :list="typeList" name="Name"  :is-scroll="true" :showBar="true"
					:activeItemStyle="activeStyle" :current="current" @change="tabsChange"></u-tabs> -->
				<view class="tabs-item" @click="tabsChange(index)" :class="current==index?'active':''" v-for="(item,index) in typeList" :key="index">
					<text>{{item.name}}</text>
					<text>{{item.count}}</text>
					<view class="tabs-bar"></view>
				</view>
			</view>
			<!-- <u-table v-show="showTable">
				<u-tr class="u-tr">
					<u-th class="u-th">资产RFID</u-th>
					<u-th class="u-th">资产名称</u-th>
					<u-th class="u-th">盘点状态</u-th>
				</u-tr>
				<u-tr class="u-tr" v-for="(item,index) in trueList" :key="index">
					<u-td class="u-td">{{item.ZichanRFID || '/'}}</u-td>
					<u-td class="u-td">{{item.ZichanMC}}</u-td>
					<u-td class="u-td"><text :style="[getState(item.PandianZT)]">{{item.PandianZT}}</text></u-td>
				</u-tr>
			</u-table> -->
			<scroll-view class="work-list" scroll-y  @scrolltolower="handleScroll">
				<view class="work-form" v-if="trueList&&trueList.length>0">
					<view class="work-item" v-for="(item,index) in trueList" :key="index">
						<view class="work-item-header">
							<span>{{item.ZichanMC}}</span>
						</view>
						<view class="work-item-main">
							<view class="work-item-cont">
								<text style="margin-right: 10rpx;">RFID编码：</text>  {{item.ZichanRFID || ''}}
							</view>
							<view class="work-item-cont">
								<text style="margin-right: 10rpx;">资产规格：</text>  {{item.ZichanGG || ''}}
							</view>
							<view class="work-item-cont">
								<text style="margin-right: 10rpx;">品牌：</text>  {{item.Pinpai || ''}}
							</view>
						</view>
					</view>
				</view>
				<view v-else class="nolist">
					<u-image width="280rpx" height="222rpx" src="/static/img/work/noList.png" mode=""></u-image>
					<view class="nolist-txt">
						暂无数据
					</view>
				</view>
				
				<view style="padding: 30rpx 0;" v-if="trueList&&trueList.length>0">
					<u-loadmore :status="status" :icon-type="iconType" :load-text="loadText" @loadmore="loadmore" />
				</view>
			</scroll-view>
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
			getState() {
				return state => {
					let color = state == '已盘点' ? 'green' : state == '盘盈' ? 'red' : 'blue'
					return {
						color
					}
				}
			}
		},
		components: {
			navbar,
		},
		data() {
			return {
				activeStyle: {
					color: '#3F5CD9',
					fontWeight: 'bold'
				},
				typeList:[
					{name:'未盘数',PandianZT:'盘亏',count:0},
					{name:'已盘数',PandianZT:'已盘点',count:0},
					{name:'盘盈数',PandianZT:'盘盈',count:0},
				],
				current:0,
				
				pageSize: 10,
				pageIndex: 1,
				status: 'loadmore',
				iconType: 'flower',
				loadText: {
					loadmore: '上拉或点击加载更多',
					loading: '努力加载中',
					nomore: '实在没有了'
				},
				barHeight: 0,
				
				panDianId:'',
				
				trueList:[],
				showTable:false,
			}
		},
		methods: {
			tabsChange(index){
				this.current = index
				this.handleGetDetail()
			},
			async handleGetDetail(){
				let payload = {
					ApiEngineKey:'pan_dian_result',
					PanDianRWId:this.panDianId
				}
				let res = await this.$u.api.ApiEngineRun(payload)
				if(!res.data.Data) return 
				
				// console.log()
				let { LessList,LessCount,FinishList,FinishCount,MoreCount,MoreList } = res.data.Data
				this.typeList[0].count = LessCount
				this.typeList[1].count = FinishCount
				this.typeList[2].count = MoreCount
				if(this.typeList[this.current].PandianZT == '盘亏'){
					this.trueList = LessList
				}else if(this.typeList[this.current].PandianZT == '已盘点'){
					this.trueList = FinishList
				}else if(this.typeList[this.current].PandianZT == '盘盈'){
					this.trueList = MoreList
				}
				setTimeout(_=>{
					this.showTable = true;
				},1000)
			},
			
			
			handleScroll(){}
		},
		onLoad() {
			this.panDianId = this.$Route.query.panDianId
			
			console.log(this.$Route.query)
			this.handleGetDetail()
		},
		mounted() {
			this.barHeight = this.$store.state.navbarHeight + this.$store.state.systemInfo.statusBarHeight
		},
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
	.search{
		padding: 30rpx;
	}
	.work-page {
		height: 90vh;
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	
		.sticky_box {
			width: 100%;
			height: 100rpx;
			display: flex;
			// padding-right: 80rpx;
			position: relative;
			// z-index: 1;
			background-color: #FFFFFF;
			overflow-y: hidden;
			overflow-x: auto;
			white-space: nowrap;
			.tabs-item {
				width:33.3%;
				display: flex;
				flex-direction: column;
				align-items: center;
				// margin-right: 80rpx;
				// height: 100%;
				// line-height: 100rpx;
				font-size: 28rpx;
				color: #000;
				position: relative;
				
				text{
					padding:5rpx 0;
				}
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
				padding-bottom: 230rpx;
				height: auto;
				overflow: hidden;
				padding: 30rpx 30rpx 0;
	
				.work-item {
					padding: 40rpx 30rpx;
					background-color: #fff;
					margin-bottom: 22rpx;
					&-header{
						padding-bottom: 15rpx;
						border-bottom:1rpx solid #f7f7f7;
						margin-bottom: 10rpx;
						font-size:32rpx;
					}
					&-time {
						display: flex;
						justify-content: flex-start;
						align-items: center;
						font-size: 24rpx;
						color: #9B9B9B;
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
			
			.nolist{
				padding: 209rpx 235rpx;
				display: flex;
				flex-direction: column;
				justify-content: center;
				align-items: center;
				&-txt{
					margin-top: 31rpx;
					font-size: 28rpx;
					color: #000;
					text{
						color: #3F5CD9;
					}
				}
			}
		}
	}
	.btn-view{
		width:100%;
		height:10vh;
		background-color:#FFFFFF;
		position: fixed;
		left: 0;
		bottom: 0;
		text-align:center;
		.sumbit-btn{
			background-color: #3F5CD9;
			color:#fff;
			width:70%;
			height:5vh;
			line-height: 5vh;
			margin-left: 15%;
			margin-top:1vh;
			border-radius:10rpx;
		}
	}
</style>
