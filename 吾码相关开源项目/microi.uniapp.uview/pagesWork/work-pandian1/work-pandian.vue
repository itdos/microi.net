<template>
	<view style="width: 100vw;height: 100vh;overflow: hidden;">
		<u-navbar :is-back="true" title="盘点" title-color="#171717" title-size="34" :title-bold="true">
			<view class="slot-wrap" style="justify-content: flex-end;">
				<!-- <u-image width="40rpx" height="40rpx" src="/static/img/work/shaixuan.png" mode="">
				</u-image> -->
			</view>
		</u-navbar>

		<view class="search">
			<!-- <u-search :disabled="true" bg-color="#E9EAEC" height="76" search-icon="/static/img/search.png" placeholder="搜索盘点" shape="square" :show-action="false"></u-search> -->
			<u-input type="textarea" :value="value" maxlength="-1" :focus="showFocus" trim border
				@input="handleChangeValue" />
			
			<!-- <view class="sumbit-btn" style="width:20%;margin-left: 80%;" @click="handlePanDian">
				盘点
			</view> -->
		</view>

		<view class="work-page">
			<scroll-view class="work-list" scroll-y @scrolltolower="handleScroll">
				<view class="work-form" v-if="trueList&&trueList.length>0">
					<view class="work-item" v-for="(item,index) in trueList" :key="index">
						<view class="work-item-header">
							<span v-if="item.PanDianZT == '待盘点'" style="color:#2979FF;">{{item.PanDianZT}}</span>
							<span v-if="item.PanDianZT == '已盘点'" style="color:green;">{{item.PanDianZT}}</span>
							<span v-if="item.PanDianZT == '盘盈'" style="color:red;">{{item.PanDianZT}}</span>
						</view>
						<view class="work-item-main">
							<view v-for="(val,key,i) in item.tableModel" :key="key">
								<view class="work-item-cont" v-if="key!='最新时间' && key!='创建人'">
									<text style="margin-right: 10rpx;">{{key}}</text> : {{val}}
								</view>
							</view>

						</view>
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

		<view class="btn-view">
			<view class="sumbit-btn" @click="handleSumbit">
				提交
			</view>
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
		watch:{
			inputList(newVal,oldVal){		
				if(newVal==oldVal){
					setTimeout(async _=>{
						console.log('重新加载数据')
						// await this.handleList();
						// this.handleReset();
					},2000)
				}				
			}
		},
		data() {
			return {
				value: '',
				showFocus: true,
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


				DiyTableId: '',
				zhubiaoId: '',

				tableList: [],
				FieldList: [],
				typeList: [],
				trueList: [],

				inputList:[],
				scanLists: [],
				timer:null,
			}
		},
		methods: {
			async handleChangeValue(e) {
				this.value = e
				this.inputList = e.split('\n')
				this.handlePanDian()
				
				this.showFocus = false
				setTimeout(() => {
					this.showFocus = true
				}, 100)
			},
			async handlePanDian(){
				if(this.inputList.length<=0 || !this.value){
					return this.$refs.uToast.show({
						title: '请扫码',
						type: 'warning'
					})
				}
				let getId = this.trueList.map(item=>item.ZichanBH)  
				let newArr1 = this.inputList.filter(item=>getId.includes(item)) 
				let newArr2 = this.inputList.filter(item=>!getId.includes(item)) 
				newArr2 = Array.from(new Set(newArr2))
				console.log(newArr1,newArr2)
				
				this.trueList.forEach(i=>{
					newArr1.forEach(item=>{
						if(i.ZichanBH == item && i.PanDianZT != '盘盈'){
							i.PanDianZT = '已盘点'
						}
					})
				})
				
				newArr2.forEach(item=>{
					this.handlAddList(item)
				})
				
				this.$refs.uToast.show({
					title: '盘点完成',
					type: 'success'
				})
			},
			async handlAddList(val){
				let payload = {
					ApiEngineKey: 'pan_dian_zichan_ino',
					ZiChanBH: val
				}
				let res = await this.$u.api.ApiEngineRun(payload)
				if (!res.data.Data) return
				var tableModel = {}
				for (var key in res.data.Data) {
					this.FieldList.forEach((item,index) => {
						if (item.Visible) {
							if (key == item.Name && index < 5) {
								tableModel[item.Label] = res.data.Data[key]
							}
						}
					})
				}
				this.trueList.push({
					...res.data.Data,
					PanDianZT: '盘盈',
					tableModel
				})
			},
			async handleSumbit() {
				this.scanLists = this.trueList.map(item => {
					console.log(item.Id, 'item.Id')
					return {
						PandianQDID: item.PanDianZT == '盘盈' ? '' : item.Id,
						ZiChanGLID: item.PanDianZT == '盘盈' ? item.Id : item.ZichanID,
						PanDianZT: item.PanDianZT == '待盘点' ? '盘亏' : item.PanDianZT
					}
				})
				console.log(this.scanLists, 'scanLists')
				let payload = {
					ApiEngineKey: 'pan_dian_finish',
					PandianRWID: this.zhubiaoId,
					ResultList: this.scanLists
				}
				let res = await this.$u.api.ApiEngineRun(payload)
				if (res.data.Code == 1) {
					this.$refs.uToast.show({
						title: res.data.Msg,
						type: 'success'
					})
					setTimeout(() => {
						uni.navigateBack({
							delta: 1,
						})
						// #ifdef APP-PLUS
							plus.key.hideSoftKeybord()
						// #endif
					}, 1000)
				}
			},
			handleList() {
				uni.showLoading({
					title: '正在获取...'
				})
				var self = this
				this.handleDiyField(self.DiyTableId).then(res => {
					self.FieldList = res
					self.typeList = self.FieldList.map(item => {
						item.Config = JSON.parse(item.Config)
						// console.log(item.Config)
						return {
							TableChildTableId: item.Config.TableChildTableId ? item.Config
								.TableChildTableId : '',
							TableChildSysMenuId: item.Config.TableChildSysMenuId ? item.Config
								.TableChildSysMenuId : '',
							TableChildFkFieldName: item.Config.TableChildFkFieldName ? item.Config
								.TableChildFkFieldName : '',
							isShow: false,
						}
					})
					self.typeList = self.typeList.filter(item => {
						return item.TableChildTableId
					})
					console.log(self.typeList, 'typeList')
					if (self.typeList.length <= 0) {
						return
					}
					self.handleDiyTableRow()
				})
			},
			handleDiyTableRow() {
				let self = this
				this.tableList = []
				self.typeList.map(async (item,index) => {
					if(index!=0)return
					// let key = 
					var params = {
						ModuleEngineKey: item.TableChildSysMenuId,
						_PageIndex: self.pageIndex,
						_PageSize: self.pageSize,
						_SearchEqual: {
							[item['TableChildFkFieldName']]: self.zhubiaoId
						}
					}
					var res = await this.$u.api.GetTableData(params)
					self.tableList = res.data.Data

					if (res.data.DataCount <= self.tableList.length) self.status = 'nomore';
					else self.status = 'loading';

					item.isShow = true
					self.handleTableRowModel()
				})
			},

			handleTableRowModel() {
				let self = this
				self.typeList.map(item => {
					console.log(item, 'item')
					if (item.isShow) {
						self.handleDiyField(item.TableChildTableId).then(res => {
							console.log(self.tableList, 111)
							self.FieldList = res
							let list = []
							if (self.tableList.length > 0) {
								self.tableList.forEach(table => {
									var tableModel = {}
									for (var key in table) {
										res.map((item, index) => {
											if (item.Visible) {
												if (key == item.Name && index < 5) {
													tableModel[item.Label] = table[key]
												}
											}
										})
									}

									let val = {
										...table,
										PanDianZT: '待盘点',
										tableModel
									}
									list.push(val)
								})
							}

							uni.hideLoading()

							self.trueList = list
							console.log(self.trueList, 'trueList')
						})
					}
				})
			},

			// 判断字段
			async handleDiyField(id) {
				var params = {
					TableId: id
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
			},
			handleScroll(e) {
				this.loadmore()
			},
			loadmore() {
				if (this.status == 'nomore') {
					return
				}
				console.log('loadmore', 111111111111)
				this.status = 'loading';
				this.pageIndex = ++this.pageIndex;
				this.handleList()
			}
		},
		onLoad() {
			this.DiyTableId = this.$Route.query.tableId
			this.zhubiaoId = this.$Route.query.zhubiaoId

			console.log(this.$Route.query)
			this.handleList()
			
			// #ifdef APP-PLUS
				plus.key.hideSoftKeybord()
			// #endif
			
			this.timer = setInterval(function(){
				uni.hideKeyboard();//隐藏软键盘
			},60);
		},
		mounted() {
			this.barHeight = this.$store.state.navbarHeight + this.$store.state.systemInfo.statusBarHeight
		},
		destroyed() {
			clearInterval(this.timer);        
			this.timer = null;
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

	.search {
		padding: 30rpx;
	}

	.work-page {
		height: 55vh;
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
				padding-bottom: 230rpx;
				height: auto;
				overflow: hidden;
				padding: 30rpx 30rpx 0;

				.work-item {
					padding: 40rpx 30rpx;
					background-color: #fff;
					margin-bottom: 22rpx;

					&-header {
						padding-bottom: 15rpx;
						border-bottom: 1rpx solid #f7f7f7;
						margin-bottom: 10rpx;
						font-size: 32rpx;
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

	.btn-view {
		width: 100%;
		height: 10vh;
		background-color: #FFFFFF;
		position: fixed;
		left: 0;
		bottom: 0;
		text-align: center;
		z-index:1000;

	}
	.sumbit-btn {
		background-color: #3F5CD9;
		color: #fff;
		width: 70%;
		height: 5vh;
		line-height: 5vh;
		margin-left: 15%;
		margin-top: 1vh;
		border-radius: 10rpx;
		text-align: center;
	}

	::v-deep textarea {
		height: 200rpx !important;
		overflow: auto;
		// position: unset;
	}
</style>
