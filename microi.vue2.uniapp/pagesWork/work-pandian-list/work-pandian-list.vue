<template>
	<view style="width: 100vw;height: 100vh;overflow: hidden;">
		<u-navbar :is-back="true" title="资产盘点" title-color="#171717" title-size="34" :title-bold="true">
			<view class="slot-wrap" style="justify-content: flex-end;">
				<!-- <u-image width="40rpx" height="40rpx" src="/static/img/work/shaixuan.png" mode="">
				</u-image> -->
			</view>
		</u-navbar>

		<view class="work-page">
			<!-- <view class="sticky_box">
				<u-tabs :list="typeList" :bar-width="100" name="Name" :is-scroll="true" :showBar="true"
					:activeItemStyle="activeStyle" :current="current" @change="tabsChange"></u-tabs>
			</view>
			<view class="all-lanmu">
				<u-image @click="lanmuShow=true" active-color="#3F5CD9" width="36rpx" height="36rpx"
					src="/static/img/work/all-lanmu.png" mode=""></u-image>
			</view> -->
			
			<view class="sticky_box">
				<view class="tabs-item" @click="handleChangeSelectTab('待盘点')" :class="selectTabs== '待盘点'?'active':''">
					<text>待盘点</text>
					<view class="tabs-bar"></view>
				</view>
				<view class="tabs-item" @click="handleChangeSelectTab('已盘点')" :class="selectTabs== '已盘点'?'active':''">
					<text>已盘点</text>
					<view class="tabs-bar"></view>
				</view>
			</view>
			<scroll-view class="work-list" scroll-y :style="{paddingBottom:barHeight+'px'}"
				@scrolltolower="handleScroll">
				<view class="work-form" v-if="!panDianList.length<=0">
					<view class="work-item" v-for="(item,index) in panDianList" :key="index" @click="handleToPanDian(item)">
						<view class="work-item-main">
							<view>
								<view class="work-item-cont">
									<text style="margin-right: 10rpx;">单据编号</text> : {{item.DanjuBH||''}}
								</view>
								<view class="work-item-cont">
									<text style="margin-right: 10rpx;">盘点任务名称</text> : {{item.PandianRWMC||''}}
								</view>
								<view class="work-item-cont">
									<text style="margin-right: 10rpx;">区域名称</text> : {{item.QuyuMC||''}}
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
									{{item.UserName||''}}
								</view>
							</view>
							<!-- <view>
								<u-button v-if="item.DanjuZT === '待盘点'||item.DanjuZT === '进行中'" type="primary"
									size="mini" @click="handleToPanDian(item)">去盘点</u-button>
								<u-button v-if="item.DanjuZT === '已盘点'" type="warning" size="mini"
									@click="$Router.push({name: 'workPandianDetail',params: {panDianId:item.Id}})">已盘点
								</u-button>
							</view> -->
						</view>
					</view>

				</view>
				<view v-else class="nolist">
					<u-image width="280rpx" height="222rpx" src="/static/img/work/noList.png" mode=""></u-image>
					<view class="nolist-txt">
						暂无数据
					</view>
				</view>

				<view style="padding: 30rpx 0;" v-if="!panDianList.length<=0">
					<u-loadmore :status="status" :icon-type="iconType" :load-text="loadText" @loadmore="loadmore" />
				</view>
			</scroll-view>
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
				typeList:[],
				activeStyle: {
					color: '#3F5CD9',
					fontWeight: 'bold'
				},
				barStyle: {
					backgroundColor: '#3F5CD9',
				},
				current: 0,
				currentX: 0,
				lanmuShow:false,
				choiceShow:false,
				selectTabs:'待盘点',
				
				pageSize: 10,
				pageIndex: 1,
				status: 'loadmore',
				iconType: 'flower',
				loadText: {
					loadmore: '上拉或点击加载更多',
					loading: '努力加载中',
					nomore: '实在没有了'
				},
				tableList:[],
				trueList:[],
				panDianList:[],
				
				MenuModel:'',
				DiyTableId:'',
			}
		},
		methods: {
			async getList(id){
				// uni.showLoading({
				// 	title: '正在获取列表...'
				// })
				//获取不显示字段
				let arr = JSON.parse(this.MenuModel.NotShowFields)
				//获取当前表的所有字段
				let data = await this.handleDiyField(id);
					
				let fieldList = []
					
				if (data) {
					fieldList = data.filter(item => {
						return arr.indexOf(item.Id) === -1
					})
					
					var aa = []
					this.tableList.forEach(table => {
						var bb = {}
						for (var key in table) {
							fieldList.map(async (item, index) => {
								if (item.Visible) {
									if (key == item.Name && index < 5) {
										if (item.Component == 'Department') {
											console.log('Department')
											//获取组织机构字段名称
											let res = await this.$u.api .GetSysDept({
													ids: JSON.parse(
														table[key])
											})
											if (res.data.Code != 1) return
											let name = res.data.Data.map(
												v => {
													return v.Name
												})
											bb[item.Label] = name.join('-')
										} else {
											bb[item.Label] = table[key]
										}
									}
								}
							})
						}
						this.$nextTick(() => {
							let val = {
								...table,
								bb
							}
							aa.push(val)
						})
					})
			
					this.trueList = aa
					this.$nextTick(_=>{
						this.panDianList = this.trueList.filter(item=>{
							return item.DanjuZT == this.selectTabs
						})
					})
				}
					
				uni.hideLoading()
			},
			// 根据当前表ID获取列表
			async handleDiyTableRow(id) {
				this.dataTableId = await this.handleDiyTableId(id)
				if (this.dataTableId) {
					var params = {
						TableId: this.dataTableId,
						_Keyword: '',
						_PageIndex: this.pageIndex,
						_PageSize: this.pageSize,
						_SysMenuId: id
					}
					var res = await this.$u.api.GetDiyTableRow(params)
					if (res.data.Code != 1) return
					if(this.pageIndex == 1){
						this.tableList = res.data.Data
					}else{
						this.tableList = this.tableList.concat(res.data.Data)
					}
					if (res.data.DataCount <= this.tableList.length) this.status = 'nomore';
					else this.status = 'loading';
				}
			},
			//获取当前表ID
			async handleDiyTableId(id) {
				var res = await this.$u.api.GetSysMenuModel({Id: id})
				if (res.data.Code != 1) return
				this.MenuModel = res.data.Data
				this.DiyTableId = res.data.Data.DiyTableId
				return this.DiyTableId
			},
			// 获取当前表的所有字段
			async handleDiyField(id) {
				if (this.dataTableId) {
					var res = await this.$u.api.GetDiyField({TableId: this.dataTableId})
					if (res.data.Code != 1) return
					return res.data.Data
				}
			},
			handleScroll(){
				this.loadmore()
			},
			loadmore(){
				if(this.status == 'nomore') return
				this.status = 'loading';
				this.pageIndex = ++this.pageIndex;
				this.handleInit()
			},
			tabsChange(index){
				this.status = 'loadmore'
				this.pageIndex = 1
				this.lanmuShow = false
				this.current = index
				
				this.handleInit()
			},
			handleChangeSelectTab(value){
				this.selectTabs = value 
				console.log(this.trueList,222)
				this.panDianList = this.trueList.filter(item=>{
					return item.DanjuZT == this.selectTabs
				})
			},
			async handleInit(){
				this.typeList = this.vuex_typeList
				await this.handleDiyTableRow(this.typeList[this.current].Id)
				await this.getList(this.typeList[this.current].Id)
			},
			goDetail(index) {
				this.$Router.push({
					name: 'workdetail',
					params: {
						tableId: this.DiyTableId,
						tableRowId: this.tableList[index].Id,
						index: index,
						menuId: this.typeList[this.current].Id
					}
				})
			},
			handleToPanDian(model) {
				if(model.DanjuZT === '待盘点'){
					this.$Router.push({
						name: 'workpandian',
						params: {
							tableId: this.DiyTableId,
							zhubiaoId: model.Id
						}
					})
				}else{
					this.$Router.push({
						name: 'workPandianDetail',
						params: {
							panDianId:model.Id,
						},
					})
				}
				
			},
		},
		onLoad() {
			this.handleInit()
		},
		onShow() {
			if (this.vuex_refresh) {
				this.handleInit()
				this.$u.vuex('vuex_refresh', false)
			}
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

	.work-page {
		height: 90vh;
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;

		.sticky_box {
			width: 100%;
			height: 80rpx;
			padding: 0 30rpx;
			// padding-right: 80rpx;
			position: relative;
			// z-index: 1;
			background-color: #FFFFFF;
			overflow-y: hidden;
			overflow-x: auto;
			white-space: nowrap;

			.tabs-item {
				width:50%;
				text-align: center;
				display: inline-block;
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
			
			.active{
				color: #3F5CD9;
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
