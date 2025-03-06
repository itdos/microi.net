<template>
	<view>
		<view class="login-bg">
			<u-image width="100%" height="100%" src="/static/img/login/login-bg.png"></u-image>
			<u-image class="logo" width="350rpx" height="70rpx" src="/static/img/login/logo-nbcmc.png"></u-image>
			<u-
		</view>
		
		<view class="login-body">
			<view class="title">
				欢迎登录
			</view>
			<view class="phone">
				<u-image class="phone-icon" width="32rpx" height="32rpx" src="/static/img/login/phone.png"></u-image>
				<u-input class="phone-value" type="text" v-model="phone"  placeholder="请输入账号/手机号" :placeholderStyle="'font-size:28rpx;color:#BEC1CC'" />
			</view>
			<view class="password">
				<u-image class="password-icon" width="32rpx" height="32rpx" src="/static/img/login/pwd.png"></u-image>
				<u-input class="password-value" type="password" v-model="pwd"  placeholder="请输入密码" :placeholderStyle="'font-size:28rpx;color:#BEC1CC'" />
			</view>
			<view>
				<u-checkbox
					v-model="RememberPwd"
					@change="ChangeRememberPwd"
				>记住密码
				</u-checkbox> 
				
				<u-checkbox
					style="float: right;"
					v-model="AutoLogin"
					@change="ChangeAutoLogin"
				>自动登陆
				</u-checkbox>
			</view>
			<u-button :custom-style="loginBtn" @click="goLogin">
				登录
			</u-button>
			
			<!-- <view class="other">
				<u-divider fontSize="24">其它方式登录</u-divider>
				<view class="other_way">
					<u-image src="/static/img/login/wechat.png" width="70rpx" height="70rpx"></u-image>
				</view>
			</view> -->
			<view style="color:#ccc;text-align: center;margin-top: 100rpx;">
				v1.1.0
			</view>
		</view>
		
		<u-toast ref="uToast" />
	</view>
</template>

<script>
	import qs from 'qs'
	export default {
		data() {
			return {
				RememberPwd : false,
				AutoLogin : false,
				phone:'',
				pwd:'',
				loginBtn:{
					width: '100%',
					height: '100rpx',
					borderRadius: '8rpx',
					backgroundColor: '#3F5CD9',
					color: '#fff',
					fontSize: '32rpx',
					textAlign: 'center',
					lineHeight: '100rpx',
					marginTop: '80rpx'
				},
			}
		},
		mounted() {
			var self = this;
			console.log('----login  mounted');
			// var rememberPwd = localStorage.getItem('RememberPwd');
			self.RememberPwd = wx.getStorageSync('RememberPwd') ? true : false;
			self.AutoLogin = wx.getStorageSync('AutoLogin') ? true : false;
			
			self.phone = wx.getStorageSync('LoginAccount');
			self.pwd = wx.getStorageSync('LoginPwd');
		},
		onLoad() {
			var self = this;
			console.log('----login  onLoad');
		},
		methods: {
			ChangeRememberPwd(val){
				var self = this;
				wx.setStorageSync('RememberPwd', val.value ? '1' : '0');
				if(!val.value){
					wx.setStorageSync('LoginAccount', '');
					wx.setStorageSync('LoginPwd', '');
				}
				// localStorage.setItem('RememberPwd', val.value);
			},
			ChangeAutoLogin(val){
				var self = this;
				// localStorage.setItem('AutoLogin', val.value);
				wx.setStorageSync('AutoLogin', val.value ? '1' : '0')
				if(val.value){
					self.RememberPwd = true;
					wx.setStorageSync('RememberPwd', '1');
				}
			},
			async goLogin(){
				var self = this
				uni.showLoading({
					title:'登录中...'
				})
				if (!this.phone){
					this.$refs.uToast.show({
						title: '账号不能为空',
						type: 'error'
					})
					uni.hideLoading()
					return
				}
				if (!this.pwd){
					this.$refs.uToast.show({
						title: '密码不能为空',
						type: 'error'
					})
					uni.hideLoading()
					return
				}
				var params = {
					Account: this.phone,
					Pwd: this.pwd,
					OsClient: this.$config.osClient
				}
				
				var res = await this.$u.api.GetLogin(params)
				if (res.data.Code==1){
					//如果记住密码
					if(wx.getStorageSync('RememberPwd') || wx.getStorageSync('AutoLogin')){
						wx.setStorageSync('LoginAccount', self.phone);
						wx.setStorageSync('LoginPwd', self.pwd);
					}else{
						wx.setStorageSync('LoginAccount', '');
						wx.setStorageSync('LoginPwd', '');
					}
					
					var user = res.data.Data
					user.Avatar = this.$util.GetServerPath(user.Avatar,'/static/img/my/toux.png')
					this.$u.vuex('vuex_userInfo',user)
					
					var token = 'Bearer ' + (res.header.Authorization || res.header.authorization);
					self.$u.vuex('vuex_token', token)
					wx.setStorageSync('authorization', token);
					wx.setStorageSync('authorization_time', self.$util.DateFormat(new Date(), 'yyyy-MM-dd HH:mm:ss'));
					
					uni.hideLoading()
					
					//#ifdef APP-PLUS
					this.handleGetNewVersion()
					//#endif 
					
					// #ifdef MP-WEIXIN 
					uni.switchTab({
						url:'/pages/index/index'
					})
					//#endif
				}else{
					
					uni.hideLoading()
					
					this.$refs.uToast.show({
						title: res.data.Msg,
						type: 'error'
					})
					
				}
				
			},
			
			handleGetNewVersion(){
				let self = this
				//#ifdef APP-PLUS
				let req = { 
					ModuleEngineKey: "842a2340-f69a-4c98-b3cd-7206a52be4c8",
					_PageIndex: 1,
					_PageSize: 1,
					ModuleName:'手机盘点软件'
				};
				plus.runtime.getProperty(plus.runtime.appid, async (wgtinfo) => {
					console.log('当前版本号：'+wgtinfo.version)
					let res = await self.$u.api.GetTableData(req)
					let list = res.data.Data[0]
					if(!list){
						uni.switchTab({
							url:'/pages/index/index'
						})
						return
					}
					var pkgUrl = this.$config.ImgBaseUrl +list.FilePath,
						version = list.Version
						
						console.log('接口返回版本号：'+ version)
						console.log('接口返回下载地址：'+ pkgUrl)
								
					if (version !== wgtinfo.version) {
						//有版本更新
						console.log('有版本更新')
								
						if (plus.os.name == "Android") {
							uni.showModal({ //提醒用户更新
								title: "更新提示",
								content: '发现新版本，请点击确定后去下载安装！',
								showCancel: false,
								success: (res) => {
									if (res.confirm) {
										uni.downloadFile({
											url: pkgUrl,
											success: (res) => {
												if (res
													.statusCode ===
													200) {
													console.log(
														'下载成功');
													plus.runtime
														.openFile(
															res
															.tempFilePath
														)
												}
											}
										});
								
									}
								}
							})
								
						}
					} else {
						uni.switchTab({
							url:'/pages/index/index'
						})
						console.log('已经是最新版本，暂无更新')
					}
									
				})
				//#endif 
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
.login-bg{
	width: 100%;
	height: 487rpx;
	position: relative;
	.logo{
		position: absolute;
		left: 55rpx;
		top: 190rpx;
	}
}
.login-body{
	width: 100%;
	height: auto;
	border-radius: 62rpx 62rpx 0 0;
	position: relative;
	top: -150rpx;
	background-color: #fff;
	padding: 92rpx 55rpx 92rpx 55rpx;
	
	.title{
		font-size: 38rpx;
		font-weight: bold;
		color: #22306D;
		margin-bottom: 60rpx;
	}
		
	.phone,.password{
		width: 100%;
		height: 100rpx;
		border-radius: 8rpx;
		background-color: #F6F7FB;
		display: flex;
		justify-content: left;
		align-items: center;
		padding: 0 48rpx;
		margin-bottom: 40rpx;
		
		&-icon{
			margin-right: 40rpx;
		}
		&-value{
			width: 100%;
		}
	}
	.forgetPwd{
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 10rpx;
		
		.forget{
			font-size: 24rpx;
			font-weight: bold;
			color: #BEC1CC;
		}
		.reg{
			font-size: 28rpx;
			font-weight: bold;
			color: #3F5CD9;
		}
	}
	.other {
		position: fixed;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 220rpx;

		.other_way {
			margin-top: 40rpx;
			display: flex;
			align-items: center;
			justify-content: center;
		}
	}
}
</style>
