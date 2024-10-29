<template>
	<view>
		<u-navbar :is-back="true" :title="title" title-color="#fff" title-size="34" :border-bottom="false" 
		:background="background" :immersive="true" back-icon-color="#fff" :title-bold="true">
			<!-- <view class="slot-wrap" style="justify-content: flex-end;">
				<u-image v-if="showEdit" width="40rpx" height="40rpx" src="/static/img/work/edit.png" mode=""  @click="handleToEdit">
				</u-image>
			</view> -->
		</u-navbar>
		
		<view class="work-detail">
			<view class="banner" :style="{paddingTop:titleHeight+'px'}">
				<text>{{formTitle}}</text>
				
				<view class="banner-right" @click="goZibiao" v-if="isZib">
					<u-image style="position: relative;top: 6rpx;" width="30rpx" height="30rpx" src="/static/img/work/zibiao.png" mode=""></u-image>
					<text>查看子表</text>
				</view>
			</view>
			
			<view class="work-list" :style="{top:barHeight+'px',paddingBottom:barHeight+'px'}">
				<scroll-view scroll-y style="height: 100%;width: 100%;padding-top: 22rpx;padding-bottom: 50rpx;">
					<view class="work-item" v-for="(item,key,index) in formTrue" :key="index">
						<view :class="JSON.stringify(item).length<20?'work-item-body':'work-item-body1'">
							<view class="work-item-key">
								{{key}}
							</view>
							<view class="work-item-cont" v-if="key.includes('图片')">
								<u-image width="50%" height="100rpx" :src="item"></u-image>
							</view>
							<view class="work-item-cont" v-else v-html="$util.IsNull(item)?'':item">
							</view>
							
						</view>
					</view>
				</scroll-view>
			</view>
			
		</view>
		
		<!-- <view class="work-bottom">
			<view class="work-bottom-left" @click="goBefore">
				上一条
			</view>
			<view class="work-bottom-right" @click="goAfter">
				下一条
			</view>
		</view> -->
		
		<u-toast ref="uToast" />
	</view>
</template>

<script>
	export default {
		data() {
			return {
				title:'详情',
				background:{
					background:'transparent'
				},
				barHeight:0,
				titleHeight:0,
				tableId:'',
				tableRowId:'',
				formTitle:'',
				FieldList:[],
				formObj:{},
				formTrue:{},
				isZib:false,
				tableRowIndex:0,
				menuId:'',
				em:'',
				
				showEdit:true,
			}
		},
		methods: {
			async getDiyTableModel(){
				var params = {
					Id: this.tableId
				}
				
				var res = await this.$u.api.GetDiyTableModel(params)
				
				if (res.data.Code==1){
					this.formTitle = res.data.Data.Description
				}else {
					this.$refs.uToast.show({
						title: res.data.Msg,
						type: 'error'
					})
				}
				
			},
			// 获取所有字段
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
			// 获取列表显示字段，匹配设定id
			getList() {
				uni.showLoading({
					title: '正在获取数据...'
				})
				var self = this
		
				this.getDiyTableRowModel().then(item => {
					self.formObj = item
					
					self.getDiyField(self.tableId).then(async res => {
						
						let val = await this.$u.api.GetFormData({
							Id: this.menuId ,
							TableName: "Sys_Menu"	
						})
						
						let arr = JSON.parse(val.data.Data.NotShowFields)
						self.FieldList = res.filter(item => {
							return arr.indexOf(item.Id) === -1
						})
						
						self.FieldList.map(item=>{
							item.Config = JSON.parse(item.Config)
						})
						// console.log(self.formObj,111111)
						var bb = {}
						for (var key in self.formObj) {
							self.FieldList.map(async (item,index) => {
								if(item.Visible){
									if (key == item.Name) {// && index<5
										// console.log(item.Name,item.Label,self.formObj[key],'name')
										if(item.Label.includes('图片')){
											bb[item.Label] = this.$util.GetServerPath(JSON.parse(self.formObj[key])[0].Path,'/static/img/my/toux.png')
										}else if(item.Component == 'Department'){
											//获取组织机构字段名称
											let res = await self.$u.api.GetSysDept({
												ids : JSON.parse(self.formObj[key])
											})
											if(res.data.Code != 1) return
											let name = res.data.Data.map(v=>{
												return v.Name
											})
											bb[item.Label] = name.join('-')
										}else{
											bb[item.Label] = self.formObj[key]
										}
									}
								}
							})
						}
						self.$nextTick(()=>{
							self.formTrue = bb
						})
						
						uni.hideLoading()
					})
					
				})
				
			
			},
			async getDiyTableRowModel(){
				var params = {
					TableId: this.tableId,
					_TableRowId: this.tableRowId
				}
				
				var res = await this.$u.api.GetDiyTableRowModel(params)
			
				if (res.data.Code==1){
					if(res.data.Data.ZichanZT == '使用中'||res.data.Data.ZichanZT == '报废中'){
						this.showEdit = false
					}
					return res.data.Data
				}else{
					this.$refs.uToast.show({
						title: res.data.Msg,
						type: 'error'
					})
				}
					
			},
			goZibiao(){
				// console.log(1111111111111111111111111)
				this.$Router.push({
					name:'work-child-list',
					params:{
						tableId:this.tableId,
						zhubiaoId:this.formObj.Id
					}
				})
			},
			// 判断是否还有子表
			isZibiao(){
				var self = this
				this.getDiyField(self.tableId).then(res=>{
					var list =  []
					var listA = []
					list = res
					list.map(item=>{
						item.Config = JSON.parse(item.Config)
						if (!self.$util.IsNull(item.Config.TableChildTableId)){
							listA.push(item.Config)
						}
					})
					listA.map(item=>{
						var em = item.TableChildFkFieldName
						var params = {
							TableId: item.TableChildTableId,
							_Keyword: '',
							_PageIndex: 1,
							_PageSize: 1,
							_SysMenuId: item.TableChildSysMenuId,
							_Search: {}
						}
						params._Search[em] = self.formObj.Id
						
						self.getDiyTableRow(params).then(aa=>{
							if (aa.DataCount>0){
								self.isZib = true
							}
						})
						
					})
				})
			},
			async getDiyTableRow(params) {
				
				var res = await this.$u.api.GetDiyTableRow(params)
				
				if (res.data.Code == 1) {
					return res.data
				}else{
					this.$refs.uToast.show({
						title: res.data.Msg,
						type: 'error'
					})
				}
				
			},
			// 上一条
			goBefore(){
				var self = this
				if (this.tableRowIndex==0){
					this.$refs.uToast.show({
						title: '已经是第一条！',
						type: 'warning'
					})
				}else{
					if (this.$util.IsNull(this.zhubiaoId)){
						var params = {
							TableId: this.tableId,
							_Keyword: '',
							_PageIndex: this.tableRowIndex,
							_PageSize: 1,
							_SysMenuId: this.menuId
						}
					}else{
						var params = {
							TableId: this.tableId,
							_Keyword: '',
							_PageIndex: this.tableRowIndex,
							_PageSize: 1,
							_SysMenuId: this.menuId,
							_Search: {}
						}
						params._Search[this.em] = this.zhubiaoId
					}
					
					
					this.getDiyTableRow(params).then(res=>{
						if (res.Code == 1) {
							console.log(res.Data)
							self.tableRowId = res.Data[0].Id
							self.tableRowIndex -= 1 
							self.getList()
							self.isZibiao()
						}
					})
				}
			},
			// 下一条
			goAfter(){
				var self = this
				var aa = parseInt(this.tableRowIndex) + 2
				console.log(aa)
				if (this.$util.IsNull(this.zhubiaoId)){
					var params = {
						TableId: this.tableId,
						_Keyword: '',
						_PageIndex: aa,
						_PageSize: 1,
						_SysMenuId: this.menuId
					}
				}else{
					var params = {
						TableId: this.tableId,
						_Keyword: '',
						_PageIndex: aa,
						_PageSize: 1,
						_SysMenuId: this.menuId,
						_Search: {}
					}
					params._Search[this.em] = this.zhubiaoId
				}
				
				this.getDiyTableRow(params).then(res=>{
					if (res.Code == 1) {
						if (res.Data.length==0){
							self.$refs.uToast.show({
								title: '已经是最后一条！',
								type: 'warning'
							})
						}else{
							self.tableRowId = res.Data[0].Id
							self.tableRowIndex = parseInt(self.tableRowIndex) + 1
							self.getList()
							self.isZibiao()
						}
						
					}
				})
			},
			handleToEdit(){
				this.$Router.push({
					name: 'workadd',
					params: {
						TableId: this.tableId,
						TableRowId: this.tableRowId
					}
				})
			},
		},
		mounted() {
			this.barHeight = this.$store.state.navbarHeight + this.$store.state.systemInfo.statusBarHeight + 69.5
			this.titleHeight = this.$store.state.navbarHeight + this.$store.state.systemInfo.statusBarHeight + 28
			
			this.getDiyTableModel()
			this.getList()
			this.isZibiao()
		},
		onLoad() {
			// console.log(this.$Route.query)
			this.tableId = this.$Route.query.tableId
			this.tableRowId = this.$Route.query.tableRowId
			this.tableRowIndex = this.$Route.query.index
			this.menuId = this.$Route.query.menuId
			this.zhubiaoId = this.$Route.query.zhubiaoId
			this.em = this.$Route.query.em
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
.banner{
	height: 429rpx;
	width: 100%;
	background-color: #3F5CD9;
	padding: 170rpx 0 0 40rpx;
	font-size: 36rpx;
	color: #fff;
	display: flex;
	justify-content: space-between;
	
	.banner-right{
		font-size: 28rpx;
		color: #C3CEFF;
		display: flex;
		justify-content: center;
		margin-right: 50rpx;
		padding-top: 6rpx;
		text{
			margin-left: 9rpx;
		}
	}
}
.work-detail{
	height: 100vh;
	position: relative;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}
.work-list{
	width: 100%;
	height: 100%;
	border-radius: 62rpx 62rpx 0 0;
	position: absolute;
	background-color: #fff;
	overflow: hidden;
	.work-item{
		padding: 44rpx 40rpx;
		border-bottom: 1rpx solid #E6E6E6;
		.work-item-body{
			display: flex;
			justify-content: space-between;
			align-items: center;
			.work-item-key{
				color: #171717;
			}
		}
		.work-item-body1{
			display: block;
			.work-item-key{
				color: #171717;
				margin-bottom: 38rpx;
			}
		}
	}
	.work-item:last-child{
		margin-bottom: 280rpx;
	}
}
.work-bottom{
	width: 100%;
	height: 210rpx;
	background-color: #FFFFFF;
	box-shadow: 0 -4rpx 9rpx rgba($color: #5B5B5B, $alpha: 0.1);
	position: absolute;
	bottom: 0;
	left: 0;
	padding: 42rpx 30rpx 0 30rpx;
	display: flex;
	justify-content: space-between;
	view{
		width: 50%;
		height: 90rpx;
		display: flex;
		justify-content: center;
		align-items: center;
		font-size: 32rpx;
		color: #fff;
	}
	&-left{
		border-radius: 8rpx 0 0 8rpx;
		background-color: #8098FF;
	}
	&-right{
		border-radius: 0 8rpx 8rpx 0;
		background-color: #3F5CD9;
	}
}
</style>
