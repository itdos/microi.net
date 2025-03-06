<template>
	<view style="width: 100vw;height: 100vh;overflow: hidden;">
		<!-- <navbar title="客户管理" :is-black="true" :title-size="34" :title-color="'#171717'" :title-bold="true" :border-bottom="true"></navbar> -->
		<u-navbar :is-back="true" :title="title" title-color="#171717" title-size="34" :title-bold="true">
			<view class="slot-wrap" style="justify-content: flex-end;">
				<!-- <u-image width="40rpx" height="40rpx" src="/static/img/work/shaixuan.png" mode=""> --> <!-- @click="choiceShow=true" -->
				<!-- </u-image> -->
			</view>
		</u-navbar>
	
		<view class="work-page">
			<view class="sticky_box">
				<u-tabs :list="typeList1" :bar-width="100" name="TableChildSysMenuName" :is-scroll="true" :showBar="true" :activeItemStyle="activeStyle" :current="current" @change="tabsChange"></u-tabs>
			</view>
			
			<scroll-view class="work-list" scroll-y :style="{paddingBottom:barHeight+'px'}" @scrolltolower="handleScroll">
				<view class="work-form" v-if="trueList&&trueList.length>0">
					<view class="work-item" v-for="(item,index) in trueList" :key="index" @click="goDetail(index)">
						<view class="work-item-main">
							<view v-for="(val,key,i) in item" :key="key">
								<view class="work-item-cont" v-if="key!='最新时间' && key!='创建人'">
									<text style="margin-right: 10rpx;">{{key}}</text> : {{val}}
								</view>
							</view>
							
						</view>
						<view class="work-item-person" v-if="item['创建人']">
							<u-image style="margin-right: 16rpx;" width="25rpx" height="25rpx"
								src="/static/img/work/person.png" mode=""></u-image>
							{{item['创建人']}}
						</view>
						<view class="work-item-time">
							<u-image style="margin-right: 16rpx;" width="25rpx" height="25rpx"
								src="/static/img/work/upt-time.png" mode=""></u-image>
							{{item['最新时间']}}
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
						暂无数据，<text>去创建</text>
					</view>
				</view>
				
				<view style="padding: 30rpx 0;" v-if="trueList&&trueList.length>0">
					<u-loadmore :status="status" :icon-type="iconType" :load-text="loadText" @loadmore="loadmore" />
				</view>
			</scroll-view>
		</view>
		
		<!-- 筛选条件弹窗 -->
		<u-popup v-model="choiceShow" mode="right">
			<view class="choice">
				11111
			</view>
		</u-popup>
		
		<view class="work-list-add">
			<u-image width="36rpx" height="36rpx" src="/static/img/work/addlist.png" mode=""></u-image>
		</view>
	
		<u-toast ref="uToast" />
		
	</view>
</template>

<script>
	export default {
		data() {
			return {
				title: '子表',
				typeList: [],
				current: 0,
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
				choiceShow:false,
				status: 'loadmore',
				iconType: 'flower',
				loadText: {
					loadmore: '上拉或点击加载更多',
					loading: '努力加载中',
					nomore: '实在没有了'
				},
				barHeight:0,
				idList:{
					TableId:'',
					SysMenuId:'',
					zhubiaoName:'',
				},
				num:0,
				typeList1:[],
				LoadedData : false,
			}
		},
		methods: {
			showChoice() {
				this.$refs.choicePup.showPopup()
			},
			closeChoice(e) {
				this.$refs.choicePup.closePopup()
			},
			// tabs通知swiper切换
			tabsChange(index) {
				this.status = 'loadmore'
				this.pageIndex = 1
				this.lanmuShow = false
				this.current = index
				
				this.trueList = []
		
				this.getDiyTableRow()
			},
			// 获取列表
			getDiyTableRow() {
				var self = this
				self.LoadedData = false;
				this.tableList = []
				
				let queue = self.typeList.map(async item=>{
					var em = item.TableChildFkFieldName
					var params = {
						TableId: item.TableChildTableId,
						_Keyword: '',
						_PageIndex: self.pageIndex,
						_PageSize: self.pageSize,
						_SysMenuId: item.TableChildSysMenuId,
						_Search: {}
					}
					params._Search[em] = self.zhubiaoId
					
					var res = await this.$u.api.GetDiyTableRow(params)
					
					if (res.data.Code == 1) {
						
						item.isShow = true
						self.tableList.push(res.data.Data)
						
						return res.data
					}else{
						this.$refs.uToast.show({
							title: res.data.Msg,
							type: 'error'
						})
					}
					
				})
				
				Promise.all(queue).then(result => {
					var aalist = []
					self.typeList.map(item=>{
						if (item.isShow==true){
							aalist.push(item)
						}
					})
					self.typeList1 = aalist
					
					var aa = []
					self.getDiyField(self.typeList[self.current].TableChildTableId).then(res=>{
						
						if (self.tableList.length>0){
							self.tableList[self.current].forEach(table => {
								// console.log()
								var bb = {}
								for (var key in table) {
									res.map(async (item,index) => {
										if (item.Visible) {
											if (key == item.Name) {// && index<5
												if (item.Component == 'Department') {
													//获取组织机构字段名称
													let res = await self.$u.api.GetSysDept({
															ids: JSON.parse(table[key])
														})
													if (res.data.Code != 1)return
													let name = res.data.Data.map(v => {return v.Name})
												
													bb[item.Label] = name.join('-')
												} else {
													bb[item.Label] = table[key]
												}
											}
										}
									})
								}
							
								bb['创建人'] = table.UserName
							
								if (self.$util.IsNull(table.UpdateTime)) {
									bb['最新时间'] = table.CreateTime
								} else {
									bb['最新时间'] = table.UpdateTime
								}
							
								aa.push(bb)
							})
						}
						
						uni.hideLoading()
						
						self.trueList = aa
						self.$nextTick(function(){
							self.LoadedData = true;
						});
					})
					
				});
			
			},
			// 判断字段
			async getDiyField(id) {
				
				var params = {
					TableId: id
				}
				
				var res = await this.$u.api.GetDiyField(params)
				
				if (res.data.Code==1){
					return res.data.Data
				}else{
					this.$refs.uToast.show({
						title: res.data.Msg,
						type: 'error'
					})
				}
				
			},
			// 获取子表数据列表
			getList(){
				uni.showLoading({
					title:'正在获取...'
				})
				var self = this
				this.getDiyField(self.DiyTableId).then(res=>{
					self.FieldList = res
					self.FieldList.map(item=>{
						item.Config = JSON.parse(item.Config)
					})
					
					self.FieldList.map(item=>{
						if (!self.$util.IsNull(item.Config.TableChildTableId)){
							self.typeList.push(item.Config)
						}
					})
					
					self.getDiyTableRow()
					
				})
			},
			goDetail(index){
				// console.log('tableId==>',this.DiyTableId)
				// console.log('tableRowId==>',this.tableList[index].Id)
				this.$Router.push({
					name:'workdetail',
					params:{
						tableId:this.typeList[this.current].TableChildTableId,
						tableRowId:this.tableList[this.current][index].Id,
						index:index,
						menuId:this.typeList[this.current].TableChildSysMenuId,
						zhubiaoId:this.tableList[this.current][index].ZhubiaoID,
						em:this.typeList[this.current].TableChildFkFieldName
					}
				})
			},
			handleScroll(e) {
				// console.log(e)
				this.loadmore()
			},
			async loadmore(){
				// console.log(111111111111)
				var self = this
				this.status = 'loading';
				this.pageIndex = ++this.pageIndex;
				var em = self.typeList[self.current].TableChildFkFieldName
				var params = {
					TableId: self.typeList[self.current].TableChildTableId,
					_Keyword: '',
					_PageIndex: self.pageIndex,
					_PageSize: self.pageSize,
					_SysMenuId: self.typeList[self.current].TableChildSysMenuId,
					_Search: {}
				}
				params._Search[em] = self.zhubiaoId
				
				var res = await this.$u.api.GetDiyTableRow(params)
				
				if (res.data.Code == 1) {
					
					var list = res.data.Data
					var aa = []
					
					if (res.data.Data.length==0){
						self.status = 'nomore'
						
					}else{
						if (res.data.DataCount <= self.tableList[self.current].length) ;
						else self.status = 'loading';
					}
					
					if (list.length>0){
						
						self.getDiyField(self.typeList[self.current].TableChildTableId).then(res=>{
							
							list.forEach(table => {
								self.tableList[self.current].push(table)
								// console.log()
								var bb = {}
								for (var key in table) {
									res.map(item => {
										if (key == item.Name) {
											bb[item.Label] = table[key]
										}
									})
								}
							
								bb['创建人'] = table.UserName
							
								if (self.$util.IsNull(table.UpdateTime)) {
									bb['最新时间'] = table.CreateTime
								} else {
									bb['最新时间'] = table.UpdateTime
								}
							
								aa.push(bb)
							})
							
							uni.hideLoading()
							
							self.trueList.push(aa)
						})
					}
				}else{
					this.$refs.uToast.show({
						title: res.data.Msg,
						type: 'error'
					})
				}
			},
		
		},
		onLoad() {
			this.DiyTableId = this.$Route.query.tableId
			this.zhubiaoId = this.$Route.query.zhubiaoId
			
			this.getList()
			
		},
		mounted() {
			this.barHeight = this.$store.state.navbarHeight + this.$store.state.systemInfo.statusBarHeight
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
		
		.lanmu-bg{
			width: 100%;
			height: 35%;
			position: absolute;
			left: 0;
			bottom: 0;
			background-image: linear-gradient(to top,#3F5CD9 -110%,#fff);
		}
	}
	
	.choice{
		width: 500rpx;
	}
	.work-list-add{
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
