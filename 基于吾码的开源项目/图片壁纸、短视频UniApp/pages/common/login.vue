<template>
	<view class="template-login">
		<!-- 顶部自定义导航 -->
		<tn-nav-bar fixed alpha customBack>
			<view slot="back" class='tn-custom-nav-bar__back' @click="goBack">
				<text class='icon tn-icon-left'></text>
				<text class='icon tn-icon-home-capsule-fill'></text>
			</view>
		</tn-nav-bar>

		<view class="login">
			<!-- 顶部背景图片-->
			<view class="login__bg login__bg--top">
				<image class="bg" :src="Microi.FileServer + '/jsnzk/img/upload/login_top2.jpg'" mode="widthFix">
				</image>
			</view>
			<view class="login__bg login__bg--top">
				<image class="rocket rocket-sussuspension"
					:src="Microi.FileServer + '/jsnzk/img/upload/login_top3.png'" mode="widthFix"></image>
			</view>

			<view class="login__wrapper">
				<!-- 登录/注册切换 -->
				<view
					class="login__mode tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-center">
					<view class="login__mode__item tn-flex-1"
						:class="[{'login__mode__item--active': currentModeIndex === 0}]" @tap.stop="modeSwitch(0)">
						登录
					</view>
					<view class="login__mode__item tn-flex-1"
						:class="[{'login__mode__item--active': currentModeIndex === 1}]" @tap.stop="modeSwitch(1)">
						注册
					</view>

					<!-- 滑块-->
					<view class="login__mode__slider tn-cool-bg-color-15--reverse" :style="[modeSliderStyle]"></view>
				</view>

				<!-- 输入框内容-->
				<view class="login__info tn-flex tn-flex-direction-column tn-flex-col-center tn-flex-row-center">
					
					<!-- <button class="login__info__item__button tn-cool-bg-color-7--reverse" hover-class="tn-hover"
						style="margin-top: 30rpx;letter-spacing: normal;"
						:hover-stay-time="150"
						@getphonenumber="getUserPhoneNumber"
						open-type="getPhoneNumber"
						withCredentials="true"
						@tap="Microi.Loading('授权中...')"
						>
						小程序一键授权登录
					</button> -->
					<!-- v-if="currentModeIndex === 0" -->
					<!-- #ifdef MP-WEIXIN -->
					<tn-button 
						shape="round" backgroundColor="#1D2541" fontColor="#ffffff" padding="40rpx 70rpx" width="100%" shadow
						@getphonenumber="getUserPhoneNumber"
						open-type="getPhoneNumber"
						withCredentials="true"
						@tap="Microi.Loading('授权中...')"
						style="margin-top: 30rpx;margin-bottom: 10rpx;"
						>
					  <text class="tn-icon-phone-fill tn-padding-right-xs tn-text-xl"></text>
					  <text class="">
						  {{ currentModeIndex === 0 ? '手机号一键登录' : '手机号一键注册'}}
					  </text>
					</tn-button>
					<!-- #endif -->
					
					<!-- 登录 -->
					<block v-if="currentModeIndex === 0">
						<view
							class="login__info__item__input tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-left">
							<view class="login__info__item__input__left-icon">
								<view class="tn-icon-phone"></view>
							</view>
							<view class="login__info__item__input__content">
								<input v-model="Account" maxlength="20" placeholder-class="input-placeholder" placeholder="请输入登录手机号码" />
							</view>
						</view>

						<view
							class="login__info__item__input tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-left">
							<view class="login__info__item__input__left-icon">
								<view class="tn-icon-lock"></view>
							</view>
							<view class="login__info__item__input__content">
								<input  v-model="Pwd" :password="!showPassword" placeholder-class="input-placeholder"
									placeholder="请输入登录密码" />
							</view>
							<view class="login__info__item__input__right-icon" @click="showPassword = !showPassword">
								<view :class="[showPassword ? 'tn-icon-eye' : 'tn-icon-eye-hide']"></view>
							</view>
						</view>
					</block>
					<!-- 注册 -->
					<block v-if="currentModeIndex === 1">
						<view
							class="login__info__item__input tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-left">
							<view class="login__info__item__input__left-icon">
								<view class="tn-icon-phone"></view>
							</view>
							<view class="login__info__item__input__content">
								<input  v-model="Account" maxlength="20" placeholder-class="input-placeholder" placeholder="请输入注册手机号码" />
							</view>
						</view>

						<view
							class="login__info__item__input tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-left">
							<view class="login__info__item__input__left-icon">
								<view class="tn-icon-code"></view>
							</view>
							<view
								class="login__info__item__input__content login__info__item__input__content--verify-code">
								<input  v-model="SmsCaptchaValue" placeholder-class="input-placeholder" placeholder="请输入验证码" />
							</view>
							<view class="login__info__item__input__right-verify-code" @tap.stop="getCode">
								<tn-button backgroundColor="#01BEFF" fontColor="#FFFFFF" size="sm" padding="5rpx 10rpx"
									width="100%" shape="round">{{ tips }}</tn-button>
							</view>
						</view>

						<view
							class="login__info__item__input tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-left">
							<view class="login__info__item__input__left-icon">
								<view class="tn-icon-lock"></view>
							</view>
							<view class="login__info__item__input__content">
								<input  v-model="Pwd" :password="!showPassword" placeholder-class="input-placeholder"
									placeholder="请输入登录密码" />
							</view>
							<view class="login__info__item__input__right-icon" @click="showPassword = !showPassword">
								<view :class="[showPassword ? 'tn-icon-eye' : 'tn-icon-eye-hide']"></view>
							</view>
						</view>
						<view
							class="login__info__item__input tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-left">
							<view class="login__info__item__input__left-icon">
								<view class="tn-icon-lock"></view>
							</view>
							<view class="login__info__item__input__content">
								<input  v-model="Pwd2" :password="!showPassword" placeholder-class="input-placeholder"
									placeholder="请再次输入登录密码" />
							</view>
							<view class="login__info__item__input__right-icon" @click="showPassword = !showPassword">
								<view :class="[showPassword ? 'tn-icon-eye' : 'tn-icon-eye-hide']"></view>
							</view>
						</view>
					</block>

					<view v-if="currentModeIndex === 0"
						class="login__info__item__button tn-cool-bg-color-7--reverse" hover-class="tn-hover"
						:hover-stay-time="150"
						@click="Login()"
						>登录</view>
					<view v-if="currentModeIndex !== 0"
						class="login__info__item__button tn-cool-bg-color-7--reverse" hover-class="tn-hover"
						:hover-stay-time="150"
						@click="Reg()"
						>注册</view>
					
					
					<view v-if="currentModeIndex === 0" @click="Microi.Tips('工程师睡着了，这个功能还没开发好。')" class="login__info__item__tips">忘记密码?</view>
				</view>

				<!-- 其他登录方式 -->
				<view 
					v-if="currentModeIndex === 0"
					class="login__way tn-flex tn-flex-col-center tn-flex-row-center">
					<!-- <view class="tn-padding-sm tn-margin-xs">
						<button
							class="login__way__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur tn-bg-green tn-color-white"
							@getphonenumber="getUserPhoneNumber"
							open-type="getPhoneNumber"
							withCredentials="true"
							@tap="Microi.Loading('授权中...')">
							<view class="tn-icon-wechat-fill"></view>
						</button>
					</view> -->
					<!-- <view class="tn-padding-sm tn-margin-xs">
						<view
							class="login__way__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur tn-bg-red tn-color-white">
							<view class="tn-icon-sina"></view>
						</view>
					</view>
					<view class="tn-padding-sm tn-margin-xs">
						<view
							class="login__way__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur tn-bg-blue tn-color-white">
							<view class="tn-icon-qq"></view>
						</view>
					</view> -->
				</view>
			</view>


			<!-- 底部背景图片-->
			<view class="login__bg login__bg--bottom">
				<image :src="Microi.FileServer + '/jsnzk/img/upload/login_bottom_bg.jpg'" mode="widthFix"></image>
			</view>
		</view>

		<!-- 验证码倒计时 -->
		<tn-verification-code ref="code" uniqueKey="login-demo-1" :seconds="60" @change="codeChange">
		</tn-verification-code>
	</view>
</template>

<script>
	import {
		mapState
	} from 'vuex'
	import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
	export default {
		name: 'login-demo-1',
		mixins: [template_page_mixin],
		data() {
			return {
				Microi:this.Microi,
				// 当前选中的模式
				currentModeIndex: 0,
				// 模式选中滑块
				modeSliderStyle: {
					left: 0
				},
				// 是否显示密码
				showPassword: false,
				// 倒计时提示文字
				tips: '获取验证码',
				BtnLoading : false,
				Account:'',
				Pwd:'',
				Pwd2:'',
				SmsCaptchaValue:'',
			}
		},
		computed: {
			...mapState({
				CurrentUser: function() {
					return this.$MicroiStore.state.CurrentUser;
				},
				IsLogin: function() {
					return this.$MicroiStore.state.IsLogin;
				},
			}),
		},
		watch: {
			currentModeIndex(value) {
				const sliderWidth = uni.upx2px(476 / 2)
				this.modeSliderStyle.left = `${sliderWidth * value}px`
			}
		},
		methods: {
			async Login(){
				var self = this;
				if(!self.Account || !self.Pwd){
					self.Microi.Tips('帐号密码必填！', false);
					return;
				}
				self.BtnLoading = true;
				var result = await self.Microi.ApiEngine.Run('sysuser_login', {
					Account : self.Account,
					Pwd : self.Pwd
				});
				if(self.Microi.CheckResult(result)){
					// if(result.DataAppend && result.DataAppend.Token)
					{
						self.Microi.SetCurrentUser(result.Data);
						// self.Microi.SetToken(result.DataAppend.Token);
						self.$MicroiStore.commit('SetCurrentUser', result.Data);
						self.$MicroiStore.commit('SetIsLogin', true);
						setTimeout(function() {
							self.Microi.Tips('登录成功！', true);
						}, 500);
						uni.navigateBack();
					}
				}
				self.BtnLoading = false;
			},
			Reg(){
				var self = this;
				if(!self.Account || self.Account.length != 11){
					self.Microi.Tips('请输入正确的手机号码！', false)
					return;
				}
				if(!self.Pwd || !self.Pwd2){
					self.Microi.Tips('请输入密码！', false)
					return;
				}
				if(self.Pwd != self.Pwd2){
					self.Microi.Tips('两次密码输入不一致！', false)
					return;
				}
				self.BtnLoading = true;
				self.Microi.ApiEngine.Run('sysuser_reg', {
					Account : self.Account,
					Pwd : self.Pwd,
					_SmsCaptchaValue : self.SmsCaptchaValue,
					// Name : self.nickname,
					// ParentId : self.Yaoqingren.Id,
					// Avatar : self.Avatar,
				}, function(result){
					self.BtnLoading = false;
					if(self.Microi.CheckResult(result)){
						self.Microi.ConfirmTips('恭喜您，注册成功！', function(){
							self.currentModeIndex = 0;
						}, {
							OKText : '去登陆',
							ShowCancel : false,
						});
					}
				})
			},
			getUserPhoneNumber(event) {
				var self = this;
				//button返回的是 event.detail 等于 tn-button返回的 event
				var eventModel = event.detail || event;
				if (eventModel.errMsg !== 'getPhoneNumber:ok') {
					if (eventModel.errMsg == 'getPhoneNumber:fail user deny') {
						self.Microi.HideLoading();
						self.Microi.Tips('您拒绝了授权手机号，无法自动注册或自动登录！', false);
						return;
					}
					self.Microi.Tips(event.errMsg || event.detail.errMsg, false);
					self.Microi.HideLoading();
					return;
				}
				uni.login({
					provider: 'weixin',
					success(res) {
						var loginCode = res.code;
						var code = eventModel.code;
						self.Microi.ApiEngine.Run('miniprogram_login_reg_bind', {
							OsClient: self.Microi.OsClient,
							Code: code,
							LoginCode: loginCode,
							Name: '小程序用户'
						}, function(result) {
							self.Microi.HideLoading();
							if (self.Microi.CheckResult(result)) {
								self.Microi.SetCurrentUser(result.Data);
								self.Microi.SetToken(result.DataAppend.Token);
								self.$MicroiStore.commit('SetCurrentUser', result.Data);
								self.$MicroiStore.commit('SetIsLogin', true);
								self.Microi.Tips('登录成功！');
								uni.navigateBack();
							}
						});
					},
					fail() {
						self.Microi.HideLoading();
					}
				});
			},
			// 切换模式
			modeSwitch(index) {
				this.currentModeIndex = index
				this.showPassword = false
			},
			// 获取验证码
			async getCode(){
				var self = this;
				if(!self.Account || self.Account.length != 11){
					self.Microi.Tips('请输入正确的手机号码！', false)
					return;
				}
				if (this.$refs.code.canGetCode) {
					self.Microi.Tips('验证码发送中...', true, {
						Icon : 'none'
					})
					var result = await self.Microi.ApiEngine.Run('send_sms_reg', {
						Phone : self.Account
					});
					if(self.Microi.CheckResult(result)){
						self.Microi.Tips('验证码发送成功！', true, {
							Icon : 'none'
						})
						// 通知组件开始计时
						this.$refs.code.start()
					}
				}else {
					self.Microi.Tips(this.$refs.code.secNum + '秒后再重试', false, {
						Icon : 'none'
					})
				}
			},
			// 获取验证码倒计时被修改
			codeChange(event) {
				this.tips = event
			}
		}
	}
</script>

<style lang="scss" scoped>
	// @import '@/static/css/templatePage/custom_nav_bar.scss';
	/* 胶囊*/
	.tn-custom-nav-bar__back {
		width: 100%;
		height: 100%;
		position: relative;
		display: flex;
		justify-content: space-evenly;
		align-items: center;
		box-sizing: border-box;
		background-color: rgba(0, 0, 0, 0.15);
		border-radius: 1000rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.5);
		color: #FFFFFF;
		font-size: 18px;
	
		.icon {
			display: block;
			flex: 1;
			margin: auto;
			text-align: center;
		}
	
		&:before {
			content: " ";
			width: 1rpx;
			height: 110%;
			position: absolute;
			top: 22.5%;
			left: 0;
			right: 0;
			margin: auto;
			transform: scale(0.5);
			transform-origin: 0 0;
			pointer-events: none;
			box-sizing: border-box;
			opacity: 0.7;
			background-color: #FFFFFF;
		}
	}
	
	/* 悬浮 */
	.rocket-sussuspension {
		animation: suspension 3s ease-in-out infinite;
	}

	@keyframes suspension {

		0%,
		100% {
			transform: translate(0, 0);
		}

		50% {
			transform: translate(-0.8rem, 1rem);
		}
	}

	.login {
		position: relative;
		height: 100%;
		z-index: 1;

		/* 背景图片 start */
		&__bg {
			z-index: -1;
			position: fixed;

			&--top {
				top: 0;
				left: 0;
				right: 0;
				width: 100%;

				.bg {
					width: 750rpx;
					will-change: transform;
				}

				.rocket {
					margin: 50rpx 28%;
					width: 400rpx;
					will-change: transform;
				}
			}

			&--bottom {
				bottom: -10rpx;
				left: 0;
				right: 0;
				width: 100%;
				// height: 144px;
				margin-bottom: env(safe-area-inset-bottom);

				image {
					width: 750rpx;
					will-change: transform;
				}
			}
		}

		/* 背景图片 end */

		/* 内容 start */
		&__wrapper {
			margin-top: 403rpx;
			width: 100%;
		}

		/* 切换 start */
		&__mode {
			position: relative;
			margin: 0 auto;
			width: 476rpx;
			height: 77rpx;
			background-color: #FFFFFF;
			box-shadow: 0rpx 10rpx 50rpx 0rpx rgba(0, 3, 72, 0.1);
			border-radius: 39rpx;

			&__item {
				height: 77rpx;
				width: 100%;
				line-height: 77rpx;
				text-align: center;
				font-size: 31rpx;
				color: #908f8f;
				letter-spacing: 1em;
				text-indent: 1em;
				z-index: 2;
				transition: all 0.4s;

				&--active {
					font-weight: bold;
					color: #FFFFFF;
				}
			}

			&__slider {
				position: absolute;
				height: inherit;
				width: calc(476rpx / 2);
				border-radius: inherit;
				box-shadow: 0rpx 18rpx 72rpx 18rpx rgba(0, 195, 255, 0.1);
				z-index: 1;
				transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
			}
		}

		/* 切换 end */

		/* 登录注册信息 start */
		&__info {
			margin: 0 30rpx;
			margin-top: 105rpx;
			padding: 30rpx 51rpx;
			padding-bottom: 0;
			border-radius: 20rpx;
			background-color: #ffff;
			box-shadow: 0rpx 10rpx 50rpx 0rpx rgba(0, 3, 72, 0.1);

			&__item {

				&__input {
					margin-top: 59rpx;
					width: 100%;
					height: 77rpx;
					border: 1rpx solid #E6E6E6;
					border-radius: 39rpx;

					&__left-icon {
						width: 10%;
						font-size: 44rpx;
						margin-left: 20rpx;
						color: #AAAAAA;
					}

					&__content {
						width: 80%;
						padding-left: 10rpx;

						&--verify-code {
							width: 56%;
						}

						input {
							font-size: 24rpx;
							// letter-spacing: 0.1em;
						}
					}

					&__right-icon {
						width: 10%;
						font-size: 44rpx;
						margin-right: 20rpx;
						color: #AAAAAA;
					}

					&__right-verify-code {
						width: 34%;
						margin-right: 20rpx;
					}
				}

				&__button {
					margin-top: 75rpx;
					margin-bottom: 39rpx;
					width: 100%;
					height: 77rpx;
					text-align: center;
					font-size: 31rpx;
					font-weight: bold;
					line-height: 77rpx;
					letter-spacing: 1em;
					text-indent: 1em;
					border-radius: 39rpx;
					box-shadow: 1rpx 10rpx 24rpx 0rpx rgba(60, 129, 254, 0.35);
				}

				&__tips {
					margin: 30rpx 0;
					color: #AAAAAA;
				}
			}
		}

		/* 登录注册信息 end */

		/* 登录方式切换 start */
		&__way {
			margin: 0 auto;
			margin-top: 110rpx;

			&__item {
				&--icon {
					width: 77rpx;
					height: 77rpx;
					font-size: 50rpx;
					border-radius: 100rpx;
					margin-bottom: 18rpx;
					position: relative;
					z-index: 1;

					&::after {
						content: " ";
						position: absolute;
						z-index: -1;
						width: 100%;
						height: 100%;
						left: 0;
						bottom: 0;
						border-radius: inherit;
						opacity: 1;
						transform: scale(1, 1);
						background-size: 100% 100%;
						background-image: url(https://os.microios.com:1110/jsnzk-public/jsnzk/img/upload/icon_bg5.png);
					}
				}
			}
		}

		/* 登录方式切换 end */
		/* 内容 end */

	}

	/deep/.input-placeholder {
		font-size: 24rpx;
		color: #E6E6E6;
	}
</style>