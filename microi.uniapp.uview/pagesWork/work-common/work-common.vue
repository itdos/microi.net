<template>
	<view style="background-color: #F5F7F9;min-height: 100vh;">
		<u-navbar :is-back="true" title="编辑常用" title-color="#171717" title-size="34" :title-bold="true" :custom-back="goBack">
			<view class="slot-wrap" style="justify-content: flex-end;">
				<view class="check" @click="save">
					完成
				</view>
			</view>
		</u-navbar>
		
		<view class="common">
			<view class="common-title">
				<u-section title="常用功能" :right="false" font-size="32" line-color="#3F5CD9" :paddingLeft="34"></u-section>
			</view>	
			<view class="common-item" v-for="(item,index) in commonList" :key="index" @click="delList(item,index)">
				<image style="width: 67rpx;height: 67rpx;" :src="item.Icon" mode=""></image>
				<text>{{item.Name}}</text>
				<image class="right" style="width: 32rpx;height: 32rpx;" src="/static/img/work/del-icon.png" mode=""></image>
			</view>
		</view>
		
		<view class="common">
			<view class="common-title">
				<u-section title="所有功能" :right="false" font-size="32" line-color="#3F5CD9" :paddingLeft="34"></u-section>
			</view>	
			<view class="common-list" v-for="(item,index) in allList" :key="index">
				<!-- <view class="common-list-title">{{item.Name}}</view> -->
				<view style="margin-bottom: 40rpx;padding: 0 34rpx;">
					{{item.Name}}
				</view>
				<view class="common-item" v-for="(itemAll,indexAll) in item._Child" :key="indexAll" @click="addList(itemAll,indexAll)">
					<image style="width: 67rpx;height: 67rpx;" :src="itemAll.Icon" mode=""></image>
					<text>{{itemAll.Name}}</text>
					<image class="right" style="width: 32rpx;height: 32rpx;" src="/static/img/work/all-icon.png" mode=""></image>
				</view>
			</view>
			
		</view>
		
		<u-modal v-model="show" :content="content" :show-cancel-button="true" confirm-color="#3F5CD9" @confirm="back"></u-modal>
		<u-toast ref="uToast" />
	</view>
</template>

<script>
	export default {
		data() {
			return {
				commonList:[
					
				],
				allList:[],
				oldList:[],
				show:false,
				content:'您的编辑还未保存，是否确认离开？'
			}
		},
		methods: {
			delList(item,index){
				this.commonList.splice(index,1)
			},
			addList(chooseItem,index){
				if (this.commonList.length==11){
					this.$refs.uToast.show({
						title: '最多添加11个！',
						type: 'warning'
					})
				}else{
					let findIndex = this.commonList.findIndex(item => {
						return chooseItem == item
					})
					
					if (findIndex > -1) {
						this.$refs.uToast.show({
							title: '已经添加常用！',
							type: 'warning'
						})
					} else {
						this.commonList.push(chooseItem)
					}
				}
				
				
			},
			async getSysList(){
				uni.showLoading({
					title:'正在加载中...'
				})
				var params = {
					OsClient: this.$config.osClient
				}
				this.allList = []
				var self = this
				
				var res = await this.$u.api.GetSysMenuStep(params)
				
				if (res.data.Code==1){
					uni.hideLoading()
					var list = res.data.Data
					
					list.map(item=>{
						if (item._Child&&item.Display&&item.Name!='首页'&&item.Name!='系统引擎'&&item.Name!='系统管理'){
							item.Icon = self.$util.GetServerPath(item.Icon,'/static/img/icon/icon1.png')
							self.allList.push(item)
						}
					})
					self.allList.map(item=>{
						var aa = []
						for (var i=0;i<item._Child.length;i++){
							if (item._Child[i].Display==true){
								item._Child[i].Icon = self.$util.GetServerPath(item._Child[i].Icon,'/static/img/icon/icon1.png')
								aa.push(item._Child[i])
							}
						}
						item._Child=aa
					})
				}else{
					uni.hideLoading()
					self.$refs.uToast.show({
						title: res.Msg,
						type: 'error'
					})
				}
					
				
			},
			// 返回之前的判断
			goBack(){
				if (this.ArrayIsEqual(this.oldList,this.commonList)){
					uni.navigateBack({})
				}else{
					this.show = true
				}
			},
			//判断2个数组是否相等
			ArrayIsEqual(arr1,arr2){
				if(arr1.length!=arr2.length){
					return false;
				}else{//长度相同
					for(let i in arr1){//循环遍历对比每个位置的元素
						if(arr1[i]!=arr2[i]){//只要出现一次不相等，那么2个数组就不相等
							return false;
						}
					}//for循环完成，没有出现不相等的情况，那么2个数组相等
					return true;
				}
			},
			back(){
				uni.navigateBack({})
			},
			// 保存编辑
			save(){
				this.oldList = this.commonList
				this.$refs.uToast.show({
					title: '保存成功！',
					type: 'success'
				})
			}
		},
		onLoad() {
			this.commonList.map(item=>{
				this.oldList.push(item)
			})
		},
		mounted() {
			this.getSysList()
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
.check{
	width: 90rpx;
	height: 48rpx;
	border-radius: 7rpx;
	background-color: #3F5CD9;
	color: #fff;
	font-size: 28rpx;
	display: flex;
	justify-content: center;
	align-items: center;
}
.common{
	width: 92%;
	height: auto;
	margin: 30rpx;
	background-color: #fff;
	border-radius: 5rpx;
	padding: 40rpx 0 20rpx 0;
	.common-title{
		font-size: 32rpx;
		color: #171717;
		font-weight: bold;
		margin-bottom: 34rpx;
		margin-left: -4rpx;
	}
	.common-item{
		width: 20%;
		display: inline-flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		margin-bottom: 50rpx;
		position: relative;
		text{
			font-size: 24rpx;
			margin-top: 10rpx;
			white-space: nowrap;
			word-break: break-all;
			overflow: hidden;
			text-overflow: ellipsis;
			width: 100%;
			text-align: center;
		}
		.right{
			position: absolute;
			top: -16rpx;
			right: 20rpx;
		}
	}
}
.common-list{
	&-title{
		padding: 0 34rpx 34rpx 34rpx;
	}
}
</style>
