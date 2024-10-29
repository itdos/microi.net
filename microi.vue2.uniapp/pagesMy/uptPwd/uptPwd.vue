<template>
	<view style="height: 100vh;background-color: #f7f7f7;">
		<u-navbar :is-back="true" :title="title" title-color="#171717" title-size="34" :title-bold="true"></u-navbar>
		
		<view class="uptpwd">
			<view class="upt-item">
				<view class="upt-item-left">
					旧密码：
				</view>
				<u-input class="upt-input" :password-icon="false" type="password" v-model="oldPWD" placeholder="请输入" placeholder-style="color: #cfcfcf;font-weight: normal;" />
			</view>
			<view class="upt-item">
				<view class="upt-item-left">
					新密码：
				</view>
				<u-input class="upt-input" type="password" v-model="newPWD" placeholder="请输入" placeholder-style="color: #cfcfcf;font-weight: normal;" />
			</view>
			<view class="upt-item">
				<view class="upt-item-left">
					重复新密码：
				</view>
				<u-input class="upt-input" type="password" v-model="renewPWD" placeholder="请输入" placeholder-style="color: #cfcfcf;font-weight: normal;" />
			</view>
			
		</view>
		<view style="padding: 0 30rpx;">
			<u-button :custom-style="loginBtn" > <!-- @click="goUpt" -->
				确认修改
			</u-button>
		</view>
		
		<u-toast ref="uToast" />
	</view>
</template>

<script>
	export default {
		data() {
			return {
				title:'修改密码',
				oldPWD:'',
				newPWD:'',
				renewPWD:'',
				userInfo:{},
				loginBtn:{
					width: '100%',
					height: '100rpx',
					borderRadius: '8rpx',
					backgroundColor: '#3F5CD9',
					color: '#fff',
					fontSize: '32rpx',
					textAlign: 'center',
					lineHeight: '100rpx',
					marginTop: '80rpx',
				},
			}
		},
		methods: {
			async goUpt(){
				var params = this.userInfo
				
				params._IsAdmin = ''
				params._Roles = ''
				params._RoleLimits = ''
				params.Pwd = this.newPWD
				
				if (!this.newPWD){
					this.$refs.uToast.show({
						title: '新密码不能为空！',
						type: 'error'
					})
				}else if(!this.renewPWD){
					this.$refs.uToast.show({
						title: '重复新密码不能为空！',
						type: 'error'
					})
				}else if(this.renewPWD!==this.newPWD){
					this.$refs.uToast.show({
						title: '两次新密码不一致！',
						type: 'error'
					})
				}else{
					
					var res = await this.$u.api.UptSysUser(params)
					
					if (res.data.Code==1&&res.data.Data.Pwd){
						this.$refs.uToast.show({
							title: '修改成功！',
							type: 'success'
						})
						uni.navigateBack({
							
						})
					}else if (res.data.Code==1&&!res.data.Data.Pwd){
						this.$refs.uToast.show({
							title: '请确认您是否有修改权限！',
							type: 'error'
						})
					}else{
						this.$refs.uToast.show({
							title: '修改失败！',
							type: 'error'
						})
					}
					
				}
				
			}
		},
		mounted() {
			// this.oldPWD = this.vuex_userInfo.Pwd
			this.userInfo = this.vuex_userInfo
		}
	}
</script>

<style lang="scss" scoped>
.uptpwd{
	margin-top: 20rpx;
}
.upt-item{
	padding: 20rpx 40rpx;
	display: flex;
	justify-content: flex-start;
	align-items: center;
	font-size: 30rpx;
	color: #22306D;
	background-color: #fff;
	font-weight: bold;
	border-bottom: 1rpx solid #f7f7f7;
	.upt-item-left{
		width: 300rpx;
	}
	.upt-input{
		width: 100%;
		font-weight: normal;
	}
}
</style>
