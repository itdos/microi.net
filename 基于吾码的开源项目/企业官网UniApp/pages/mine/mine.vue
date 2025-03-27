<template>
	<view class="page-e tn-safe-area-inset-bottom">
		<!-- 顶部自定义导航 -->
		<!-- <tn-nav-bar :isBack="false" :bottomShadow="false" backgroundColor="none">
      <view class="custom-nav tn-flex tn-flex-col-center tn-flex-row-left" @click="tn('/minePages/message')">
        <view class="custom-nav__back">
          <view class="tn-icon-notice tn-color-gray" style="font-size: 50rpx;">
          </view>
        </view>
      </view>
    </tn-nav-bar> -->

		<view class="top-backgroup">
			<image src='https://resource.tuniaokj.com/images/my/my-bg4.png' mode='widthFix' class='backgroud-image'>
			</image>
		</view>

		<view class="tn-margin-left tn-margin-right" :style="{paddingTop: vuex_custom_bar_height + 'px'}">
			<!-- 图标logo/头像 -->
			<view class="tn-flex tn-flex-row-between tn-flex-col-center tn-margin-bottom" style="margin-top: -450rpx;">
				<view class="justify-content-item">
					<view class="tn-flex tn-flex-col-center tn-flex-row-left">
						<!-- @click="tn('/minePages/set')" -->
						<view class="logo-pic tn-shadow"  @click="Microi.Tips('即将上线！')">
							<view class="logo-image">
								<view class="tn-shadow-blur" :style="{ backgroundImage : 'url('+ GetAvatar() +')' }"
									style="width: 110rpx;height: 110rpx;background-size: cover;overflow: hidden;">
								</view>
							</view>
						</view>
						<view class="tn-padding-right">
							<view v-if="IsLogin" class="tn-padding-right tn-padding-left-sm">
								<text class="tn-color-wallpaper tn-text-xl tn-text-bold">{{CurrentUser.Name}}</text>
								<text class=" tn-round tn-text-xs tn-bg-red tn-color-white tn-margin-left-sm"
									style="padding: 10rpx 20rpx;">
									{{'普通用户'}}
								</text>
							</view>
							<view v-if="IsLogin" class="tn-padding-right tn-padding-top-xs tn-padding-left-sm tn-text-ellipsis"
								@click="copyUid">
								<text class="tn-color-gray">{{Microi.HidePhone(CurrentUser.Account)}}</text>
								<text class="tn-color-blue--disabled tn-padding-left-xs tn-text-sm tn-icon-copy"></text>
							</view>
							<!-- @click="tn('/minePages/login')" -->
							<view v-if="!IsLogin" style="margin-left: 20rpx;" class="tn-flex tn-flex-row-between"
								>
								<view class="tn-flex-1 justify-content-item tn-margin-xs tn-text-center">
									<tn-button shape="round" backgroundColor="#1D2541" fontColor="#ffffff"
										padding="20rpx 0" width="250rpx" shadow @getphonenumber="getUserPhoneNumber"
										open-type="getPhoneNumber" withCredentials="true"
										@tap="Microi.Loading('授权中...')">
										<text class="tn-icon-wechat tn-padding-right-xs tn-text-xl"></text>
										<text class="">授权登录</text>
									</tn-button>
								</view>
							</view>
						</view>

					</view>
				</view>
				<!-- @click="tn('/minePages/set')" -->
				<view class="justify-content-item" >
					<view class="tn-icon-install tn-color-gray" style="font-size: 50rpx;opacity: 0.5;">
					</view>
				</view>
			</view>

			<!-- 没有授权，则显示这个授权按钮-->
			<!-- <view class="tn-flex tn-flex-row-between" @click="tn('/minePages/login')">
        <view class="tn-flex-1 justify-content-item tn-margin-xs tn-text-center">
          <tn-button shape="round" backgroundColor="#1D2541" fontColor="#ffffff" padding="20rpx 0" width="40%" shadow>
            <text class="tn-icon-wechat tn-padding-right-xs tn-text-xl"></text>
            <text class="">授权登录</text>
          </tn-button>
        </view>
      </view> -->

			<view class="tn-margin-top-xl">
				<view class="button-number tn-flex tn-flex-row-between tn-flex-col-center tn-shadow-blur"
					style="background: linear-gradient(-120deg, #3E445A, #31374A, #2B3042, #262B3C);">

					<!-- @click="tn('/homePages/member')" -->
					<view class="tn-margin-left">
						<view class="tn-flex tn-flex-col-center" style="color: #F1C68E;margin-top: -20rpx;">
							<text class="tn-text-bold tn-text-xl">至尊</text>
							<text class="tn-icon-vip-text tn-text-center" style="font-size: 92rpx;"></text>
						</view>
						<view class='tn-color-white tn-text-sm'>会员福利，助力事业一骑绝尘</view>
					</view>
					<view class="tn-margin-right">
						<!-- @click="tn('/homePages/member')" -->
						<tn-button shape="round" backgroundColor="#F1C68E" fontColor="#634738" padding="10rpx 0"
							width="160rpx" shadow
							@click="Microi.Tips('即将上线！')"
							>
							<!-- <text class="tn-icon-vip tn-padding-right-sm tn-text-lg"></text> -->
							<text class="tn-text-bold">权 益</text>
						</tn-button>
					</view>

					<view class="tnwave waveAnimation">
						<view class="waveWrapperInner bgTop">
							<view class="wave waveTop"
								style="background-image: url('https://resource.tuniaokj.com/images/wave/wave-2.png')">
							</view>
						</view>
						<view class="waveWrapperInner bgMiddle">
							<view class="wave waveMiddle"
								style="background-image: url('https://resource.tuniaokj.com/images/wave/wave-2.png')">
							</view>
						</view>
						<view class="waveWrapperInner bgBottom">
							<view class="wave waveBottom"
								style="background-image: url('https://resource.tuniaokj.com/images/wave/wave-1.png')">
							</view>
						</view>
					</view>

				</view>
			</view>



			<!-- 方式5 start-->
			<!-- <view class="tn-flex">
        <view class="tn-flex-1 wallpaper-shadow tn-bg-white" style="margin: 50rpx 15rpx 0 0;padding: 30rpx 0;" @click="tn('/pageB/edit/edit')">
          <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
            <view class="icon5__item--icon tn-flex tn-flex-row-center tn-flex-col-center" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/png/280373/1666764808285-assets/web-upload/b83d1b36-7355-4f36-bc02-9f06b8c0867c.png');background-size:100% 100%;background-size: cover;">
            </view>
            <view class="tn-text-center" style="font-size: 30rpx;">
              <view class="tn-text-ellipsis">发布帖子</view>
            </view>
          </view>
        </view>
        <view class="tn-flex-1 wallpaper-shadow tn-bg-white" style="margin: 50rpx 0 0 15rpx;padding: 30rpx 0;" @click="tn('/pageA/create/create')">
          <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
            <view class="icon5__item--icon tn-flex tn-flex-row-center tn-flex-col-center" style="background-image:url('https://cdn.nlark.com/yuque/0/2022/png/280373/1666764788528-assets/web-upload/955b13dd-7715-4627-b8cc-04ae3d85051a.png');background-size:100% 100%;background-size: cover;">
            </view>
            <view class="tn-text-center" style="font-size: 30rpx;">
              <view class="tn-text-ellipsis">预存抵扣</view>
            </view>
          </view>
        </view>
      </view> -->

			<!-- 更多信息-->
			<!-- 方式12 start-->
			<view class="wallpaper-shadow tn-margin-top-lg tn-padding-top-sm tn-padding-bottom-sm tn-bg-white">

				<view class="tn-flex tn-flex-row-center tn-radius tn-padding-top">
					<!-- @click="tn('/minePages/order')" -->
					<view class="tn-padding-sm tn-margin-xs tn-radius" 
						@click="Microi.Tips('即将上线！')">
						<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
							<view
								class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-bg-blue--light">
								<view class="tn-icon-order tn-color-wallpaper"></view>
							</view>
							<view class="tn-text-center">
								<text class="tn-text-ellipsis">全部订单</text>
							</view>
						</view>
					</view>
					<!-- @click="tn('/homePages/member')" -->
					<view class="tn-padding-sm tn-margin-xs tn-radius" 
						@click="Microi.Tips('即将上线！')">
						<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
							<view
								class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-bg-blue--light">
								<view class="tn-icon-vip tn-color-wallpaper"></view>
							</view>
							<view class="tn-text-center">
								<text class="tn-text-ellipsis">会员权益</text>
							</view>
						</view>
					</view>
					<!-- <view class="tn-padding-sm tn-margin-xs tn-radius" @click="navAddress">
            <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
              <view class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-bg-blue--light">
                <view class="tn-icon-map tn-color-wallpaper"></view>
              </view>
              <view class="tn-text-center">
                <text class="tn-text-ellipsis">收货地址</text>
              </view>
            </view>
          </view> -->
		  <!-- @click="tn('/minePages/set')" -->
					<view class="tn-padding-sm tn-margin-xs tn-radius" 
						@click="Microi.Tips('即将上线！')">
						<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
							<view
								class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-bg-blue--light">
								<view class="tn-icon-identity tn-color-wallpaper"></view>
							</view>
							<view class="tn-text-center">
								<text class="tn-text-ellipsis">个人信息</text>
							</view>
						</view>
					</view>
					 <!-- @click="tn('/minePages/help')" -->
					<view class="tn-padding-sm tn-margin-xs tn-radius"
					@click="Microi.Tips('即将上线！')">
						<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
							<view
								class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-bg-blue--light">
								<view class="tn-icon-help tn-color-wallpaper"></view>
							</view>
							<view class="tn-text-center">
								<text class="tn-text-ellipsis">常见问题</text>
							</view>
						</view>
					</view>

				</view>
			</view>


			<!-- 更多信息-->
			<!-- <view class="wallpaper-shadow tn-margin-top-lg tn-padding-top-sm tn-padding-bottom-sm">
				<tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30" @click="copySource">
					<view class="tn-flex tn-flex-col-center">
						<view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="color: #7C8191;">
							<view class="tn-icon-plane-fill"></view>
						</view>
						<view class="tn-margin-left-sm tn-flex-1">开源地址</view>
						<view class="tn-color-gray tn-icon-right"></view>
					</view>
				</tn-list-cell>
				<tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30"
					@click="tn('/minePages/public')">
					<view class="tn-flex tn-flex-col-center">
						<view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="color: #7C8191;">
							<view class="tn-icon-bookmark-fill"></view>
						</view>
						<view class="tn-margin-left-sm tn-flex-1">关注我们</view>
						<view class="tn-color-gray tn-icon-right"></view>
					</view>
				</tn-list-cell>
				       <tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30" @click="tn('/pageA/help/help')">
          <view class="tn-flex tn-flex-col-center">
            <view
              class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center" style="color: #7C8191;">
              <view class="tn-icon-message-fill"></view>
            </view>
            <view class="tn-flex tn-flex-row-between" style="width: 100%;">
              <view class="tn-margin-left-sm">常见问题</view>
              <view class="tn-color-gray tn-icon-right"></view>
            </view>
          </view>
        </tn-list-cell>
			</view> -->

			<view class="wallpaper-shadow tn-margin-top-lg tn-margin-bottom-lg tn-padding-top-sm tn-padding-bottom-sm">
				<tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30">
					<button class="tn-flex tn-flex-col-center tn-button--clear-style" open-type="contact">
						<view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="color: #7C8191;">
							<view class="tn-icon-service-fill"></view>
						</view>
						<view class="tn-flex tn-flex-row-between" style="width: 100%;">
							<view class="tn-margin-left-sm">在线客服</view>
							<view class="tn-color-gray tn-icon-right"></view>
						</view>
					</button>
				</tn-list-cell>
				<tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30">
					<button class="tn-flex tn-flex-col-center tn-button--clear-style" open-type="feedback">
						<view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="color: #7C8191;">
							<view class="tn-icon-tip-fill"></view>
						</view>
						<view class="tn-flex tn-flex-row-between" style="width: 100%;">
							<view class="tn-margin-left-sm">问题反馈</view>
							<view class="tn-color-gray tn-icon-right"></view>
						</view>
					</button>
				</tn-list-cell>
				<tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30" @click="callPhoneNumber"
					data-number="15906556924">
					<view class="tn-flex tn-flex-col-center">
						<view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="color: #7C8191;">
							<view class="tn-icon-tel-circle-fill"></view>
						</view>
						<view class="tn-margin-left-sm tn-flex-1">技术热线</view>
						<view
							class="tn-margin-left-sm tn-color-wallpaper tn-text-sm tn-padding-left-xs tn-padding-right-xs tn-bg-gray--light tn-round">
							15906556924</view>
					</view>
				</tn-list-cell>
			</view>

		</view>

		<view class="tn-text-center tn-margin-top-xl tn-padding-bottom-xl">
			<view @click="navTuniaoUI">
				<text class="tn-color-blue tn-padding-xs">HUAYU智能</text>
				<text class="">提供技术支持</text>
			</view>
			<!-- <button class=" tn-button--clear-style" open-type="feedback">
    		<view class="tn-margin tn-text-center">
    			<text>UI期待你的需求</text>
    			<text class="tn-color-blue">留言</text>
    		</view>
    	</button> -->
		</view>

		<tn-modal v-model="show1" :custom="true">
			<view class="custom-modal-content">
				<image @tap="previewQRCodeImage" src='https://resource.tuniaokj.com/images/advertise/qrcode.jpg'
					mode='aspectFill' style="width: 100%;"></image>
				<view class="tn-text-center tn-padding-top" @click="copyWechat">
					<text class="">客服微信：tnkewo </text>
					<text class="tn-color-blue--disabled tn-padding-left-xs tn-text-df tn-icon-copy"></text>
				</view>
				<view class="tn-text-center tn-padding-top tn-text-lg">点击上图，可识别微信二维码</view>
			</view>
		</tn-modal>

		<view class='tn-tabbar-height'></view>

	</view>
</template>

<script>
	import {
		mapState
	} from 'vuex'
	export default {
		name: 'Mine',
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
		data() {
			return {
				Microi: this.Microi,
				Avatar: '',
				show1: false,
			}
		},
		async onShow() {
			var self = this
			self.GetAvatar();
		},
		methods: {
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
								self.Microi.SetCurrentUser(result.Data.CurrentUser);
								self.Microi.SetToken(result.Data.Token);
								self.$MicroiStore.commit('SetCurrentUser', result.Data.CurrentUser);
								self.$MicroiStore.commit('SetIsLogin', true);
								self.Microi.Tips('登录成功！');
								self.GetAvatar();
								// uni.navigateBack();
							}
						});
					},
					fail() {
						self.Microi.HideLoading();
					}
				});
			},
			GetAvatar() {
				var self = this;
				if (self.Microi.IsLogin() && self.Microi.GetCurrentUser().Avatar) {
					self.Avatar = self.Microi.FileServer + self.Microi.GetCurrentUser().Avatar;
				} else {
					self.Avatar = self.Microi.FileServer + self.Microi.AppLogo;
				}
				return self.Avatar;
			},
			// 跳转
			tn(e) {
				uni.navigateTo({
					url: e,
				});
			},

			// 跳转到图鸟UI
			navTuniaoUI() {
				// uni.navigateToMiniProgram({
				// 	appId: 'wxf3d81a452b88ff4b'
				// })
			},

			// 收货地址
			navAddress() {
				uni.chooseAddress({})
			},

			// 单纯短震动
			short() {
				wx.vibrateShort();
			},

			//拨打固定电话
			callPhoneNumber() {
				uni.makePhoneCall({
					phoneNumber: "15906556924",
				});
			},
			// 复制id
			copyUid() {
				var self = this;
				wx.vibrateShort();
				uni.setClipboardData({
					data: self.CurrentUser.Account,
				})
			},
			// 复制开源地址
			copySource() {
				wx.vibrateShort();
				uni.setClipboardData({
					data: "https://ext.dcloud.net.cn/publisher?id=356088",
				})
			},
		}
	}
</script>

<style lang="scss" scoped>
	.page-e {
		max-height: 100vh;
	}

	/* 底部安全边距 start*/
	.tn-tabbar-height {
		min-height: 120rpx;
		height: calc(140rpx + env(safe-area-inset-bottom) / 2);
		height: calc(140rpx + constant(safe-area-inset-bottom));
	}

	.tn-color-wallpaper {
		color: #1D2541;
	}


	/* 自定义导航栏内容 start */
	.custom-nav {
		height: 100%;

		&__back {
			margin: auto 5rpx;
			font-size: 40rpx;
			margin-right: 10rpx;
			flex-basis: 5%;
			width: 100rpx;
			position: absolute;
		}
	}

	/* 自定义导航栏内容 end */

	/* 顶部背景图 start */
	.top-backgroup {
		height: 450rpx;
		z-index: -1;

		.backgroud-image {
			width: 100%;
			height: 450rpx;
			z-index: -1;
		}
	}

	/* 顶部背景图 end */


	/* 图标容器5 start */
	.icon5 {
		&__item {
			// width: 30%;
			background-color: #FFFFFF;
			border-radius: 10rpx;
			padding: 0rpx;
			margin: 0rpx;
			transform: scale(1);
			transition: transform 0.3s linear;
			transform-origin: center center;

			&--icon {
				width: 96rpx;
				height: 96rpx;
				border-radius: 50%;
				margin-bottom: 18rpx;
				position: relative;
				z-index: 1;
			}
		}
	}

	/* 用户头像 start */
	.logo-image {
		width: 110rpx;
		height: 110rpx;
		position: relative;
		overflow: hidden;
		border-radius: 50%;
	}

	.logo-pic {
		background-size: cover;
		background-repeat: no-repeat;
		// background-attachment:fixed;
		background-position: top;
		border: 8rpx solid rgba(255, 255, 255, 0.05);
		box-shadow: 0rpx 0rpx 80rpx 0rpx rgba(0, 0, 0, 0.15);
		border-radius: 50%;
		overflow: hidden;
		// background-color: #FFFFFF;
	}

	/* 页面阴影 start*/
	.wallpaper-shadow {
		border-radius: 15rpx;
		box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
	}

	/* 页面阴影 end*/

	/* 图标容器15 start */
	.icon15 {
		&__item {
			width: 30%;
			background-color: #FFFFFF;
			border-radius: 10rpx;
			padding: 30rpx;
			margin: 20rpx 10rpx;
			transform: scale(1);
			transition: transform 0.3s linear;
			transform-origin: center center;

			&--icon {
				width: 100rpx;
				height: 100rpx;
				font-size: 60rpx;
				border-radius: 50%;
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


				}
			}
		}
	}


	/* 图标容器12 start */
	.icon12 {
		&__item {
			width: 30%;
			background-color: #FFFFFF;
			border-radius: 10rpx;
			padding: 30rpx;
			margin: 20rpx 10rpx;
			transform: scale(1);
			transition: transform 0.3s linear;
			transform-origin: center center;

			&--icon {
				width: 15rpx;
				height: 15rpx;
				font-size: 50rpx;
				border-radius: 50%;
				margin-bottom: 38rpx;
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

				}
			}
		}
	}

	/* 图标容器1 start */
	.icon1 {
		&__item {
			// width: 30%;
			background-color: #FFFFFF;
			border-radius: 10rpx;
			padding: 30rpx;
			margin: 20rpx 10rpx;
			transform: scale(1);
			transition: transform 0.3s linear;
			transform-origin: center center;

			&--icon {
				width: 40rpx;
				height: 40rpx;
				font-size: 40rpx;
				border-radius: 50%;
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
					background-image: url(https://resource.tuniaokj.com/images/cool_bg_image/icon_bg.png);
				}
			}
		}
	}

	/* 图标容器1 end */


	.button-shake {
		animation: shake 4s infinite;
	}

	@keyframes shake {

		5%,
		50% {
			transform: scale(1);
		}

		10% {
			transform: scale(0.9);
		}

		15% {
			transform: scale(1.15);
		}

		20% {
			transform: scale(1.15) rotate(-5deg);
		}

		25% {
			transform: scale(1.15) rotate(5deg);
		}

		30% {
			transform: scale(1.15) rotate(-3deg);
		}

		35% {
			transform: scale(1.15) rotate(2deg);
		}

		40% {
			transform: scale(1.15) rotate(0);
		}
	}



	/* 背景波浪高度 */
	.button-number {
		width: 100%;
		height: 150rpx;
		border-radius: 15rpx;
		position: relative;
		z-index: 1;
	}

	/* 动态背景波浪*/
	@keyframes move_wave {
		0% {
			transform: translateX(0) translateZ(0) scaleY(1)
		}

		50% {
			transform: translateX(-25%) translateZ(0) scaleY(1)
		}

		100% {
			transform: translateX(-50%) translateZ(0) scaleY(1)
		}
	}

	.tnwave {
		overflow: hidden;
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		top: 0;
		margin: auto;
		z-index: -1;
		border-radius: 15rpx;
	}

	.waveWrapperInner {
		position: absolute;
		width: 100%;
		overflow: hidden;
		height: 100%;
	}

	.wave {
		position: absolute;
		left: 0;
		width: 200%;
		height: 100%;
		background-repeat: repeat no-repeat;
		background-position: 0 bottom;
		transform-origin: center bottom;
	}

	.bgTop {
		opacity: 0.1;
	}

	.waveTop {
		background-size: 50% 45px;
	}

	.waveAnimation .waveTop {
		animation: move_wave 4s linear infinite;
	}

	.bgMiddle {
		opacity: 0.2;
	}

	.waveMiddle {
		background-size: 50% 40px;
	}

	.waveAnimation .waveMiddle {
		animation: move_wave 3.5s linear infinite;
	}

	.bgBottom {
		opacity: 0.3;
	}

	.waveBottom {
		background-size: 50% 35px;
	}

	.waveAnimation .waveBottom {
		animation: move_wave 2s linear infinite;
	}
</style>