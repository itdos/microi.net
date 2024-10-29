<template>
	<view style="width: 100vw;height: 100vh;overflow: hidden;">
		<!-- <navbar title="客户管理" :is-black="true" :title-size="34" :title-color="'#171717'" :title-bold="true" :border-bottom="true"></navbar> -->
		<u-navbar :is-back="true" :title="title" title-color="#171717" title-size="34" :title-bold="true">
			<view class="slot-wrap" style="justify-content: flex-end;">
				<!-- <u-image width="40rpx" height="40rpx" src="/static/img/work/shaixuan.png" mode="">
					@click="choiceShow=true"
				</u-image> -->
			</view>
		</u-navbar>

		<view class="work-page">
			<view class="sticky_box">
				<!-- <view class="tabs-item" @click="tabsChange(index)" :class="current==index?'active':''" v-for="(item,index) in typeList" :key="index">
					<text>{{item.Name}}</text>
					<view class="tabs-bar"></view>
				</view> -->
				<!-- <u-tabs :list="typeList" name="Name" :is-scroll="true" :current="current" @change="tabsChange"></u-tabs> -->
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
			<!-- <u-tabs :list="sonList" name="Name" :is-scroll="true" :showBar="false" :activeItemStyle="activeStyle" :current="currentX" @change="sonChange"></u-tabs> -->
			<scroll-view class="work-list" scroll-y :style="{paddingBottom:barHeight+'px'}"
				@scrolltolower="handleScroll">
				<view class="work-form" v-if="trueList&&trueList.length>0">
					<view class="work-item" v-for="(item,index) in trueList" :key="index" @click="goDetail(index)">
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
									{{item.UserName||''}}
								</view>
							</view>
							<view>
								<!-- <u-button type="primary" size="mini" @click="handleDelList(item)">删除</u-button> -->
							</view>
						</view>
					</view>

				</view>
				<view v-else-if="!LoadedData" class="nolist">
					<u-image width="280rpx" height="222rpx" src="/static/img/work/noList.png" mode=""></u-image>
					<view class="nolist-txt">
						Loading...
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

		<view class="work-list-add" v-if="RoleAdd()">
			<u-image @click="$Router.push({name: 'workadd',params: {TableId:DiyTableId}})" width="36rpx" height="36rpx"
				src="/static/img/work/addlist.png" mode=""></u-image>
		</view>

		<u-toast ref="uToast" />
		
		<u-modal v-model="showModal" content="确认删除吗？" show-cancel-button ref="uModal" @confirm="confirmDel" @cancel="showModal=false"></u-modal>
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
				showModal:false,
				modelItem:{},
				
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
				DiyTableId: '',
				MenuModel: [],
				tableList: [],
				FieldList: [],
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
				sonList: [],
				childList: [],
				dataTableId: '',
				
				selectTabs:'待盘点',
				LoadedData : false,
			}
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
		methods: {
			init() {
				this.status = 'loadmore'
				this.pageIndex = 1
				this.lanmuShow = false
			},
			RoleAdd(){
				var slef = this;
				return false;
			},
			showChoice() {
				this.$refs.choicePup.showPopup()
			},
			closeChoice(e) {
				this.$refs.choicePup.closePopup()
			},
			sonChange(index, data) {
				console.log(index, data)
				this.init()
				this.currentX = index

				var aaIndex = 0

				this.childList.map((item, index) => {
					item.sonList.map(ite => {
						if (ite.Id == data.Id) {
							aaIndex = index
							// item.currentX = data.index
						}
					})
				})

				this.childList.splice(aaIndex + 1, this.childList.length - aaIndex)

				this.trueList = []
				this.getList(data[index].Id)
			},
			// tabs通知swiper切换
			tabsChange(index) {
				console.log(index, 'tabsChange')
				console.log(this.typeList[index].Id, 'tabsChange')
				this.status = 'loadmore'
				this.pageIndex = 1
				this.lanmuShow = false
				this.current = index

				this.trueList = []
				this.childList = []

				this.getList(this.typeList[index].Id)
			},
			// 获取tableid
			async getDiyTableId(id) {

				var params = {
					Id: id
				}
				var res = await this.$u.api.GetSysMenuModel(params)

				if (res.data.Code == 1) {
					this.MenuModel = res.data.Data
					var tableId = res.data.Data.DiyTableId

					if (tableId) {
						this.DiyTableId = tableId
						return tableId
					} else {
						var lists = this.getSonLanmu(id)
						console.log(lists, 'lists')
						this.childList.push({
							sonList: lists,
							currentX: 0
						})
						this.sonList = lists
						this.status = 'nomore'

						if (lists.length <= 0) return
						// this.getList(lists[0].Id)

						return false
					}
				} else {
					this.$refs.uToast.show({
						title: res.data.Msg,
						type: 'error'
					})
				}

			},
			// 当有子栏目的时候
			getSonLanmu(id) {
				var aa = this.test(this.typeList, id).filter(item => item.Display)
				// console.log(aa)
				return aa
			},
			test(array, id) {
				let result = []
				array.forEach(item => {
					if (item.Id == id && item._Child) {
						result = item._Child;
					} else if (item._Child) {
						this.test(item._Child)
					}
				})
				return result
			},
			// 获取列表
			async getDiyTableRow(id) {
				this.dataTableId = await this.getDiyTableId(id)

				if (this.dataTableId) {
					var params = {
						TableId: this.dataTableId,
						_Keyword: '',
						_PageIndex: this.pageIndex,
						_PageSize: this.pageSize,
						_SysMenuId: id
					}

					var res = await this.$u.api.GetDiyTableRow(params)

					if (res.data.Code == 1) {
						return res.data.Data
					} else {
						this.$refs.uToast.show({
							title: res.data.Msg,
							type: 'error'
						})
					}
				}
			},

			// 获取所有字段
			async getDiyField(id) {
				if (this.dataTableId) {
					var params = {
						TableId: this.dataTableId
					}

					var res = await this.$u.api.GetDiyField(params)

					if (res.data.Code == 1) {
						return res.data.Data
					} else {
						this.$refs.uToast.show({
							title: res.data.Msg,
							type: 'error'
						})
					}
				}
			},
			// 获取列表显示字段，匹配设定id
			getList(id) {
				// uni.showLoading({
				// 	title: '正在获取列表...'
				// })
				var self = this;
				self.LoadedData = false;
				
				this.getDiyTableRow(id).then(item => {
					self.tableList = item

					var arr1 = JSON.parse(self.MenuModel.TableDiyFieldIds)
					var arr2 = JSON.parse(self.MenuModel.NotShowFields)
					var arr = arr1.concat(arr2)

					console.log(arr2)
					var typeList = []
					self.getDiyField(id).then(async data => {

						self.FieldList = []

						if (data) {

							self.FieldList = data.filter(item => {
								return arr2.indexOf(item.Id) === -1
							})

							var aa = []
							self.tableList.forEach(table => {
								var bb = {}
								for (var key in table) {
									self.FieldList.map(async (item, index) => {
										if (item.Visible) {
											// 
											if (key == item.Name && index < 5) {
												if (item.Component ==
													'Department') {
													//获取组织机构字段名称
													// console.log(item,table[key])
													let res = await self.$u.api
														.GetSysDept({
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
								self.$nextTick(() => {
									let val = {
										...table,
										bb
									}
									aa.push(val)
								})
							})

							console.log(aa, 'trueList')

							self.trueList = aa;
							self.$nextTick(function(){
								self.LoadedData = true;
							});
						}else{
							self.LoadedData = true;
						}

						uni.hideLoading()

						// console.log(aa)
					})

				})
			},
			goDetail(index) {
				// console.log('tableId==>',this.DiyTableId)
				// console.log('tableRowId==>',this.tableList[index].Id)
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
			handleScroll(e) {
				console.log(this.status)
				if (this.status !== 'nomore') {
					this.loadmore()
				}
			},
			loadmore() {
				var self = this
				this.status = 'loading';
				this.childList = []
				this.pageIndex = ++this.pageIndex;
				var id = this.typeList[this.current].Id
				this.getDiyTableId(id).then(async function(data) {
					if (data === false) return
					var params = {
						TableId: data,
						_Keyword: '',
						_PageIndex: self.pageIndex,
						_PageSize: self.pageSize,
						_SysMenuId: id
					}

					var res = await self.$u.api.GetDiyTableRow(params)

					if (res.data.Code == 1) {
						if (res.data.DataCount <= self.tableList.length) self.status = 'nomore';
						else self.status = 'loading';


						var list = res.data.Data

						if (list.length > 0) {
							list.map(item => {
								self.tableList.push(item)
							})

							var arr1 = JSON.parse(self.MenuModel.TableDiyFieldIds)
							var arr2 = JSON.parse(self.MenuModel.NotShowFields)
							var arr = arr1.concat(arr2)

							// console.log(arr)

							self.getDiyField(id).then(async data => {
								self.FieldList = []

								if (data) {
									self.FieldList = data.filter(item => {
										return arr2.indexOf(item.Id) === -1
									})

									var aa = []
									self.tableList.forEach(table => {
										var bb = {}
										for (var key in table) {
											self.FieldList.map(async (item, index) => {
												if (item.Visible) {
													if (key == item.Name &&
														index < 5) {
														if (item.Component ==
															'Department') {
															//获取组织机构字段名称
															let res =
																await self.$u
																.api
																.GetSysDept({
																	ids: JSON
																		.parse(
																			table[
																				key
																			]
																		)
																})
															if (res.data
																.Code != 1)
																return
															let name = res.data
																.Data.map(
																	v => {
																		return v
																			.Name
																	})

															bb[item.Label] =
																name.join('-')
														} else {
															bb[item.Label] =
																table[key]
														}
													}
												}
											})
										}
										self.$nextTick(() => {
											let val = {
												...table,
												bb
											}
											aa.push(val)
										})
									})
									self.trueList = aa
								}
								uni.hideLoading()
							})

						}
					} else {
						this.$refs.uToast.show({
							title: res.data.Msg,
							type: 'error'
						})
					}
				});
			},
			handleToPanDian(model) {
				this.$Router.push({
					name: 'workpandian',
					params: {
						tableId: this.DiyTableId,
						zhubiaoId: model.Id
					}
				})
			},
			handleDelList(model){
				console.log(model)
				this.showModal = true 
				this.modelItem = model
			},
			async confirmDel(){
				let res = await this.$u.api.DelFormData({
					Id : this.modelItem.Id,
					TableId : this.dataTableId
				})
				if(res.data.Code != 1) return
				this.$refs.uToast.show({
					title: '删除成功！',
				})
				this.handleInit()
			},
			handleInit() {
				this.init()
				// console.log(this.$Route.query,'$Route.query')
				this.typeList = this.vuex_typeList
				this.title = this.$Route.query.title

				// if (this.title=='系统引擎'){
				// 	this.getSysMenuStep()
				// }else{
				this.getList(this.typeList[this.current].Id)
			},
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

	.work-page {
		height: 100vh;
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
