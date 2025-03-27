<template>
	<view class="page-e tn-safe-area-inset-bottom">

		<!-- 顶部自定义导航 -->
		<!-- <tn-nav-bar :isBack="false" :bottomShadow="false" backgroundColor="none">
			<view class="custom-nav tn-flex tn-flex-col-center tn-flex-row-left" @click="NavigateTo('')">
				<view class="custom-nav__back">
					<text class="tn-text-bold tn-text-xl tn-color-black">个人中心</text>
				</view>
			</view>
		</tn-nav-bar> -->

		<view class="top-backgroup">
			<image :src="Microi.FileServer + '/jsnzk/img/upload/my-bg2.png'" mode='widthFix' class='backgroud-image'>
			</image>
		</view>
		
		<view class="tnwave waveAnimation">
		  <view class="waveWrapperInner bgTop">
		    <view class="wave waveTop" :style="{backgroundImage: 'url(' + Microi.FileServer + '/jsnzk/img/upload/wave-2.png)'}"></view>
		  </view>
		  <view class="waveWrapperInner bgMiddle">
		    <view class="wave waveMiddle" :style="{backgroundImage: 'url(' + Microi.FileServer + '/jsnzk/img/upload/wave-2.png)'}"></view>
		  </view>
		  <view class="waveWrapperInner bgBottom">
		    <view class="wave waveBottom" :style="{backgroundImage: 'url(' + Microi.FileServer + '/jsnzk/img/upload/wave-1.png)'}"></view>
		  </view>
		</view>

		<view class="tn-margin-left tn-margin-right" :style="{paddingTop: vuex_custom_bar_height + 'px'}">
			<!-- 图标logo/头像 -->
			<view class="tn-flex tn-flex-row-between tn-flex-col-center tn-margin-bottom" 
				style="margin-top: -450rpx;"
				@click="NavigateTo('/pageA/set/set', true)">
				<view class="justify-content-item">
					<view class="tn-flex tn-flex-col-center tn-flex-row-left">
						<view class="logo-pic tn-shadow">
							<view class="logo-image">
								<view class="tn-shadow-blur"
									style="width: 110rpx;height: 110rpx;background-size: cover;overflow: hidden;"
									:style="{ backgroundImage : 'url(' + Microi.FileServer + Microi.AppLogo + ')' }">
								</view>
							</view>
						</view>
						<view class="tn-padding-right">
							<view class="tn-padding-right tn-padding-left-sm">
								<!-- tn-color-wallpaper -->
								<button v-if="IsLogin" 
									:plain="true" 
									class="tn-color-white tn-text-xl tn-text-bold"
									style="border: none;line-height: 1.5;padding-left: 0;text-align: left;">
									{{CurrentUser.Name}}
								</button>
								<button v-else :plain="true" 
									style="border: none;line-height: 1.5;padding-left: 0;text-align: left;"
									class="tn-color-white tn-text-xl tn-text-bold">
									登录/注册
								</button>
							</view>
							<!-- tn-text-ellipsis -->
							<view class="tn-padding-right tn-padding-top-xs tn-padding-left-sm ">
								<!-- <text class="tn-color-gray">高级UI设计</text> -->
								<!-- tn-padding-left-sm -->
								<button v-if="IsLogin" 
									:plain="true" 
									class="tn-color-white tn-text-sm"
									style="border: none;line-height: 1.5;padding-left: 0;text-align: left;overflow: visible;"
									>
									{{Microi.HidePhone(CurrentUser.Account)}}
									<text v-if="IsLogin"
										class="tn-dynamic-bg-1 tn-round tn-text-xs tn-color-white tn-margin-left-sm"
										style="padding: 10rpx 20rpx;">
										{{CurrentUser.HuiyuanJB || '免费会员'}}
									</text>
								</button>
								<button v-else 
									:plain="true"
									class="tn-color-white  tn-text-sm"
									style="border: none;line-height: 1.5;padding-left: 0;text-align: left;"
									>
									登录并开通会员可解锁更多内容
								</button>
							</view>
						</view>

					</view>
				</view>
				<!-- <view class="justify-content-item">
					<view class="tn-icon-right tn-color-gray">
					</view>
				</view> -->
			</view>

			<!-- 没有授权，则显示这个授权按钮-->
			<!-- <view class="tn-flex tn-flex-row-between" @click="NavigateTo('/minePages/login')">
				<view class="tn-flex-1 justify-content-item tn-margin-xs tn-text-center">
				  <tn-button shape="round" backgroundColor="#1D2541" fontColor="#ffffff" padding="20rpx 0" width="40%" shadow>
					<text class="tn-icon-wechat tn-padding-right-xs tn-text-xl"></text>
					<text class="">授权登录</text>
				  </tn-button>
				</view>
			</view> -->

			<!-- <view class="tn-margin-top-xl">
				<view class="button-number tn-flex tn-flex-row-between tn-flex-col-center tn-shadow-blur"
					style="background: linear-gradient(-120deg, #3E445A, #31374A, #2B3042, #262B3C);">

					<view class="tn-margin-left">
						<view class='title' style="color: #F1C68E;">
							tn-padding-left-xs
							<text class="tn-icon-refund tn-text-xl tn-text-center tn-padding-right-xs"></text>
							<text class="tn-text-bold tn-text-xl">0 积分</text>
							<text class="tn-icon-vip-text tn-text-center" style="position: absolute;margin: -22rpx 0 0 0;font-size: 92rpx;"></text>
						</view>
						<view class='tn-color-white tn-text-sm tn-padding-top-sm'>分享积分+10，邀请注册积分+50</view>
					</view>
					<view class="tn-margin-right">
						<tn-button shape="round" backgroundColor="#F1C68E" fontColor="#634738" padding="10rpx 0"
							style="float: right;"
							width="160rpx" shadow open-type="share">
							<text class="tn-icon-vip tn-padding-right-sm tn-text-lg"></text>
							<text class="tn-text-bold">充 值</text>
						</tn-button>
						<tn-button shape="round" backgroundColor="#F1C68E" fontColor="#634738" padding="10rpx 0"
							style="float: right;" width="160rpx" shadow open-type="share">
							<text class="tn-icon-vip tn-padding-right-sm tn-text-lg"></text>
							<text class="tn-text-bold">分 享</text>
						</tn-button>
					</view>

				</view>
			</view> -->
			<!-- 消息&数据 -->
			<view class="tn-shadow-warp" style="margin-top: 90rpx;background-color: rgba(255,255,255,1);margin-left: -30rpx;margin-right: -30rpx;">
			  <view class="tn-flex">
			    <view class="tn-flex-1 tn-padding-sm tn-margin-xs">
			      <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
			        <view class="">
			          <view class="tn-text-xxl tn-color-orange">0</view>
			        </view>
			        <view class="tn-margin-top-xs tn-color-gray tn-text-df tn-text-center">
			          <text class="tn-icon-fire"></text>
			          <text class="tn-padding-left-xs">积分</text>
			        </view>
			      </view>
			    </view>
			    <view class="tn-flex-1 tn-padding-sm tn-margin-xs">
			      <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
			        <view class="">
			          <view class="tn-text-xxl tn-color-blue">0</view>
			        </view>
			        <view class="tn-margin-top-xs tn-color-gray tn-text-df tn-text-center">
			          <text class="tn-icon-share-circle"></text>
			          <text class="tn-padding-left-xs">获赞</text>
			        </view>
			      </view>
			    </view>
			    <view class="tn-flex-1 tn-padding-sm tn-margin-xs">
			      <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
			        <view class="">
			          <view class="tn-text-xxl tn-color-red">0</view>
			        </view>
			        <view class="tn-margin-top-xs tn-color-gray tn-text-df tn-text-center">
			          <text class="tn-icon-like"></text>
			          <text class="tn-padding-left-xs">佣金</text>
			        </view>
			      </view>
			    </view>
			  </view>
			</view> 
			<!-- 方式20 start-->
			<view class="tn-flex">
				<view class="tn-flex-1 wallpaper-shadow tn-bg-white" style="margin: 50rpx 15rpx 0 0;padding: 30rpx 0;"
					@tap="NavigateToPay('/pageB/pay/pay')">
					<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
						<!-- <view class="icon20__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur tn-bg-orangered tn-color-white">
						  <view class="tn-icon-computer-fill"></view>
						</view> -->
						<view class="icon5__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="background-size:100% 100%;background-size: cover;"
							:style="{ backgroundImage : 'url(' + Microi.FileServer + '/jsnzk/img/upload/A2.png)' }">
						</view>
						<view class="tn-text-center" style="font-size: 30rpx;">
							<view class="tn-text-ellipsis">{{(Microi.ClientSystem != 'IOS' || Microi.ClientType != 'WeChat') ? '升级会员' : '免费会员'}}</view>
						</view>
					</view>
				</view>
				<!-- <view class="tn-flex-1 wallpaper-shadow tn-bg-white"
					style="margin: 50rpx 15rpx 0 0;padding: 30rpx 0;" @click="NavigateTo('/pageB/edit/edit')">
					<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
						<view class="icon20__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur tn-bg-orangered tn-color-white">
						  <view class="tn-icon-computer-fill"></view>
						</view>
						<view class="icon5__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="background-size:100% 100%;background-size: cover;"
							:style="{ backgroundImage : 'url(' + Microi.FileServer + '/jsnzk/img/upload/B2.png)' }">
						</view>
						<view class="tn-text-center" style="font-size: 30rpx;">
							<view class="tn-text-ellipsis">收藏下载</view>
						</view>
					</view>
				</view> -->
				<view class="tn-flex-1 wallpaper-shadow tn-bg-white" style="margin: 50rpx 0 0 15rpx;padding: 30rpx 0;"
					@click="NavigateTo('/pageA/interact/interact', true)">
					<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
						<view
							class="icon20__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur tn-bg-purplered tn-color-white">
							<view class="tn-icon-moon-fill"></view>
						</view>
						<!-- <view class="icon5__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="background-size:100% 100%;background-size: cover;"
							:style="{ backgroundImage : 'url(' + Microi.FileServer + '/jsnzk/img/upload/B2.png)' }">
						</view> -->
						<view class="tn-text-center" style="font-size: 30rpx;">
							<view class="tn-text-ellipsis">收藏下载</view>
						</view>
					</view>
				</view>
			</view>
			<!-- 图标或者图片布局，有需要直接显示出来即可，预留的布局 -->
			<!-- 方式15  start-->
			<!-- <view class="tn-flex tn-flex-row-between tn-bg-white wallpaper-shadow tn-margin-top-xl">
				<view class="tn-padding-sm tn-margin-xs" @click="NavigateTo('/minePages/release')">
					<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center tn-margin-left">
						<view class="icon15__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur"
							style="background-color: #F3F2F7;color: #7C8191;">
							<view class="tn-icon-calendar"></view>
						</view>
						<view class="icon5__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="background-image:url('https://cdn.nlark.com/yuque/0/2022/png/280373/1666764808285-assets/web-upload/b83d1b36-7355-4f36-bc02-9f06b8c0867c.png');background-size:100% 100%;background-size: cover;">
						</view>
						<view class="tn-text-center">
							<text class="tn-text-ellipsis">个人中心</text>
						</view>
					</view>
				</view>
				<view class="tn-padding-sm tn-margin-xs" @click="NavigateTo('/minePages/collect')">
					<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
						<view class="icon15__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur"
							style="background-color: #F3F2F7;color: #7C8191;">
							<view class="tn-icon-star"></view>
						</view>
						<view class="icon5__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="background-image:url('https://cdn.nlark.com/yuque/0/2022/png/280373/1666764788528-assets/web-upload/955b13dd-7715-4627-b8cc-04ae3d85051a.png');background-size:100% 100%;background-size: cover;">
						</view>
						<view class="tn-text-center">
							<text class="tn-text-ellipsis">收藏下载</text>
						</view>
					</view>
				</view>
				<view class="tn-padding-sm tn-margin-xs">
					<view
						class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center tn-margin-right">
						<view class="icon15__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur"
							style="background-color: #F3F2F7;color: #7C8191;">
							<view class="tn-icon-download"></view>
						</view>
						<view class="icon5__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="background-image:url('https://cdn.nlark.com/yuque/0/2022/png/280373/1666764788454-assets/web-upload/397ee31e-b1b1-44ea-bb4c-0436eee867e5.png');background-size:100% 100%;background-size: cover;">
						</view>
						<view class="tn-text-center">
							<text class="tn-text-ellipsis">积分明细</text>
						</view>
					</view>
				</view>
			</view> -->
			<!-- 方式15 end-->




			<!-- 更多信息-->
			<!-- 方式12 start-->
			<view class="wallpaper-shadow tn-margin-top-lg tn-padding-top-sm tn-padding-bottom-sm tn-bg-white">
				<view class="tn-flex tn-flex-row-center tn-radius tn-padding-top">
					<!-- <view class="tn-padding-sm tn-margin-xs tn-radius" @click="NavigateTo('/pageA/me/me')">
						<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
							<view
								class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-bg-grey--light">
								<view class="tn-icon-honor tn-color-wallpaper"></view>
							</view>
							<view class="tn-text-center">
								<text class="tn-text-ellipsis">个人中心</text>
							</view>
						</view>
					</view> -->
					<!-- <view class="tn-padding-sm tn-margin-xs tn-radius" @click="NavigateTo('/pageA/interact/interact')">
						<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
							<view
								class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-bg-grey--light">
								<view class="tn-icon-signpost tn-color-wallpaper"></view>
							</view>
							<view class="tn-text-center">
								<text class="tn-text-ellipsis">收藏下载</text>
							</view>
						</view>
					</view> -->
					<view class="tn-padding-sm tn-margin-xs tn-radius" 
						@tap="NavigateTo('/pageB/order/order', true)">
						<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
							<view
								class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-bg-grey--light">
								<view class="tn-icon-discover tn-color-wallpaper"></view>
							</view>
							<view class="tn-text-center">
								<text class="tn-text-ellipsis">我的订单</text>
							</view>
						</view>
					</view>
					<view class="tn-padding-sm tn-margin-xs tn-radius" @click="NavigateTo('/pageB/task/task')">
						<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
							<view
								class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-bg-grey--light">
								<view class="tn-icon-calendar tn-color-wallpaper"></view>
							</view>
							<view class="tn-text-center">
								<text class="tn-text-ellipsis">积分任务</text>
							</view>
						</view>
					</view>
					<view class="tn-padding-sm tn-margin-xs tn-radius"
						@click="NavigateTo('/pageB/integral/integral', true)">
						<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
							<view
								class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-bg-grey--light">
								<view class="tn-icon-order tn-color-wallpaper"></view>
							</view>
							<view class="tn-text-center">
								<text class="tn-text-ellipsis">积分明细</text>
							</view>
						</view>
					</view>
					<view class="tn-padding-sm tn-margin-xs tn-radius" @click="NavigateTo('/pageA/help/help')">
						<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
							<view
								class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-bg-grey--light">
								<view class="tn-icon-help tn-color-wallpaper"></view>
							</view>
							<view class="tn-text-center">
								<text class="tn-text-ellipsis">帮助中心</text>
							</view>
						</view>
					</view>
					
				</view>
				<!-- <view class="tn-flex tn-flex-row-center tn-radius tn-padding-top">
					
					<view class="tn-padding-sm tn-margin-xs tn-radius" @click="NavigateTo('/pageA/history/history')">
						<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
							<view
								class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-bg-grey--light">
								<view class="tn-icon-discover tn-color-wallpaper"></view>
							</view>
							<view class="tn-text-center">
								<text class="tn-text-ellipsis">创作记录</text>
							</view>
						</view>
					</view>

					<view class="tn-padding-sm tn-margin-xs tn-radius" @click="NavigateTo('/pageB/chat/chatGPT')">
						<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
							<view
								class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-bg-grey--light">
								<view class="tn-icon-topics tn-color-wallpaper"></view>
							</view>
							<view class="tn-text-center">
								<text class="tn-text-ellipsis">智能助手</text>
							</view>
						</view>
					</view>
					<view class="tn-padding-sm tn-margin-xs tn-radius" @click="NavigateTo('/pageA/help/help')">
						<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
							<view
								class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-bg-grey--light">
								<view class="tn-icon-help tn-color-wallpaper"></view>
							</view>
							<view class="tn-text-center">
								<text class="tn-text-ellipsis">帮助中心</text>
							</view>
						</view>
					</view>
					<view class="tn-padding-sm tn-margin-xs tn-radius" @click="NavigateTo('/pageA/set/set')">
						<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
							<view
								class="icon12__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-bg-grey--light">
								<view class="tn-icon-set tn-color-wallpaper"></view>
							</view>
							<view class="tn-text-center">
								<text class="tn-text-ellipsis">系统设置</text>
							</view>
						</view>
					</view>
				</view> -->
			</view>

			<view v-if="CurrentUser.YunxuFBNR"
				class="wallpaper-shadow tn-margin-top-lg tn-padding-top-sm tn-padding-bottom-sm">
				<tn-list-cell @click="NavigateTo('/pageB/edit/edit', true)" :hover="true" :unlined="true" :radius="true"
					:fontSize="30">
					<button class="tn-flex tn-flex-col-center tn-button--clear-style">
						<view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="color: #7C8191;">
							<view class="tn-icon-message-fill"></view>
						</view>
						<view class="tn-flex tn-flex-row-between" style="width: 100%;">
							<view class="tn-margin-left-sm">发布内容</view>
							<view class="tn-color-gray tn-icon-right"></view>
						</view>
					</button>
				</tn-list-cell>
			</view>
			<!-- 更多信息-->
			<view class="wallpaper-shadow tn-margin-top-lg tn-padding-top-sm tn-padding-bottom-sm">
				<tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30"
					@click="OpenSource()">
					<view class="tn-flex tn-flex-col-center">
						<view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="color: #7C8191;">
							<view class="tn-icon-light-fill"></view>
						</view>
						<view class="tn-margin-left-sm tn-flex-1">获取此程序源码</view>
						<view class="tn-color-gray tn-icon-right"></view>
					</view>
				</tn-list-cell>
				<tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30"
					@click="NavigateToMiniProgram('wx5ad86a7a7e3bd950', '/pages/index/index')">
					<view class="tn-flex tn-flex-col-center">
						<view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="color: #7C8191;">
							<view class="tn-icon-science-fill"></view>
						</view>
						<view class="tn-margin-left-sm tn-flex-1">后台系统小程序</view>
						<view class="tn-color-gray tn-icon-right"></view>
					</view>
				</tn-list-cell>
				<tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30"
					@click="NavigateToMiniProgram('wxa23cc962d55b7f89', '/pages/index/index')">
					<view class="tn-flex tn-flex-col-center">
						<view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="color: #7C8191;">
							<view class="tn-icon-trust-fill"></view>
						</view>
						<view class="tn-margin-left-sm tn-flex-1">官网小程序</view>
						<view class="tn-color-gray tn-icon-right"></view>
					</view>
				</tn-list-cell>
				<!-- <tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30"
					@click="NavigateTo('/pageA/about/about')">
					<view class="tn-flex tn-flex-col-center">
						<view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="color: #7C8191;">
							<view class="tn-icon-science-fill"></view>
						</view>
						<view class="tn-margin-left-sm tn-flex-1">关于图鸟</view>
						<view class="tn-color-gray tn-icon-right"></view>
					</view>
				</tn-list-cell>
				
				<tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30"
					@click="NavigateTo('/pageB/article/article')">
					<view class="tn-flex tn-flex-col-center">
						<view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="color: #7C8191;">
							<view class="tn-icon-trust-fill"></view>
						</view>
						<view class="tn-margin-left-sm tn-flex-1">关注我们</view>
						<view class="tn-color-gray tn-icon-right"></view>
					</view>
				</tn-list-cell> -->
			</view>

			<!-- <view class="wallpaper-shadow tn-margin-top-lg tn-margin-bottom-lg tn-padding-top-sm tn-padding-bottom-sm">
				<tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30">
					<button class="tn-flex tn-flex-col-center tn-button--clear-style" open-type="contact">
						<view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="color: #7C8191;">
							<view class="tn-icon-wechat-fill"></view>
						</view>
						<view class="tn-flex tn-flex-row-between" style="width: 100%;">
							<view class="tn-margin-left-sm">合作勾搭</view>
							<view class="tn-color-gray tn-icon-right"></view>
						</view>
					</button>
				</tn-list-cell>
				<tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30">
					<button class="tn-flex tn-flex-col-center tn-button--clear-style" open-type="feedback">
						<view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="color: #7C8191;">
							<view class="tn-icon-message-fill"></view>
						</view>
						<view class="tn-flex tn-flex-row-between" style="width: 100%;">
							<view class="tn-margin-left-sm">问题反馈</view>
							<view class="tn-color-gray tn-icon-right"></view>
						</view>
					</button>
				</tn-list-cell>
				<tn-list-cell :hover="true" :unlined="true" :radius="true" :fontSize="30" @click="callPhoneNumber"
					data-number="18266666666">
					<view class="tn-flex tn-flex-col-center">
						<view class="icon1__item--icon tn-flex tn-flex-row-center tn-flex-col-center"
							style="color: #7C8191;">
							<view class="tn-icon-tel-circle-fill"></view>
						</view>
						<view class="tn-margin-left-sm tn-flex-1">技术支持</view>
						<view
							class="tn-margin-left-sm tn-color-wallpaper tn-text-sm tn-padding-left-xs tn-padding-right-xs tn-bg-gray--light tn-round">
							188****8888</view>
					</view>
				</tn-list-cell>
			</view> -->

		</view>
		<view style="line-height: 50rpx;text-align: center;color: #d5d5d5;font-size:24rpx;margin-top:50rpx;">
			jsnzk v1.0.7
		</view>
		<view style="line-height: 50rpx;text-align: center;color: #d5d5d5;font-size:24rpx;">
			Power by Microi.net
		</view>
		<view style="line-height: 50rpx;text-align: center;color: #d5d5d5;font-size:24rpx;">
			Copyright © 2009-2024
		</view>
		<view @tap="GotoBeian()" style="line-height: 50rpx;text-align: center;color: #d5d5d5;font-size:24rpx;color:#3D7EFF;text-decoration: underline;margin-bottom:50rpx;">
			蜀ICP备2023012232号-6A
		</view>
		<!-- 在使用自定义内容时，title、content、button设置的内容将会失效。 -->
		<tn-modal v-model="ShowSource" 
			:custom="true" 
			:showCloseBtn="true"
			:button="SourceCodeBtns"
			:title="GetSourceCodeModel.Biaoti"
			:safeAreaInsetBottom="true"
			>
			<view class="custom-modal-content">
				<view class="tn-icon tn-icon-about-fill"></view>
				<view ref="content" class="content">
					<view class="text" v-html="GetSourceCodeModel.Neirong"></view>
				</view>
				<view style="margin-top: 40rpx;margin-bottom: 15rpx;">
					<tn-button shape="round" backgroundColor="#1D2541" fontColor="#ffffff" padding="40rpx 70rpx" width="100%" shadow
						@tap="CopyContent()"
						>
					  <text class="tn-icon-wechat tn-padding-right-xs tn-text-xl"></text>
					  <text class="">
						  复制内容
					  </text>
					</tn-button>
				</view>
			</view>
		</tn-modal>
		<!-- <view ref="content2" class="content2">
			<view class="text" v-html="GetSourceCodeModel.Neirong"></view>
		</view> -->
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
				ShowSource: false,
				GetSourceCodeModel:{},
				SourceCodeBtns: [{
				    text: '关闭',
				    backgroundColor: '#E6E6E6',
				    fontColor: '#FFFFFF'
				  },
				  {
				    text: '复制内容',
				    backgroundColor: 'tn-bg-indigo',
				    fontColor: '#FFFFFF'
				  }
				]
			}
		},
		created() {
			var self = this;
			self.Microi.ApiEngine.Run('get_jsnzk_sourcecode', {}, function(result){
				if(self.Microi.CheckResult(result)){
					self.GetSourceCodeModel = result.Data;
				}
			});
		},
		//并不会执行
		onShow() {
			var self = this;

		},

		methods: {
			GotoBeian(){
				uni.navigateTo({
					url: '/pages/common/webView?url=https://beian.miit.gov.cn'
				})
			},
			removeTagsAndAddLineBreaks: function (html) {
				var text = html.toString();
				// 增加换行符
				text = text.replace(/<\/p>/g, '\n\n'); // 替换 </p> 标签为双换行符
				text = text.replace(/<\/?br\s?\/?>/g, '\n'); // 替换 <br> 或 <br/> 标签为单换行符
				// 去掉 HTML 标签
				text = text.replace(/<[^>]+>/g, '');
				return text;
			},
			CopyContent(){
				var self = this;
				// const content = self.GetSourceCodeModel.Neirong;
				// const content = self.$refs.content2.innerText
				var content = self.removeTagsAndAddLineBreaks(self.GetSourceCodeModel.Neirong);
				  uni.setClipboardData({
					data: content,
					success() {
						self.Microi.Tips('复制成功', true);
					},
					fail() {
					  self.Microi.Tips('复制失败', false);
					}
				  })
			},
			NavigateToMiniProgram(appId, path, param) {
				var self = this;
				self.Microi.NavigateToMiniProgram(appId, path, param);
			},
			OpenSource() {
				var self = this;
				self.ShowSource = true;
			},
			// 跳转
			NavigateTo(url, checkLogin) {
				var self = this;
				self.Microi.NavigateTo(url, checkLogin);
			},
			NavigateToPay(url, checkLogin){
				var self = this;
				if(self.Microi.ClientSystem == 'IOS' 
					&& self.Microi.ClientType == 'WeChat'
					&& self.Microi.SysConfig.MiniProgramIosPay != 1){
					return;
				}
				self.Microi.NavigateTo(url, checkLogin);
			},
			//拨打固定电话
			callPhoneNumber() {
				uni.makePhoneCall({
					phoneNumber: "18219128888",
				});
			},
			// 复制开源地址
			copySource() {
				wx.vibrateShort();
				uni.setClipboardData({
					data: "https://ext.dcloud.net.cn/publisher?id=356088",
				})
			},
		},
		onPageScroll(e){
			
		},
		onShareAppMessage(e){
			
		},
		onShareTimeline(e){
			
		},
		onPullDownRefresh() {
			setTimeout(() => {
				uni.stopPullDownRefresh()
			}, 100);
		},
		onReachBottom() {
			//只是测试效果，逻辑以实际数据为准
			if (!this.pullUpOn) return;
			this.loadding = true
			setTimeout(() => {
				this.loadding = false
				this.pullUpOn = false
			}, 1000)
		}
	}
</script>

<style lang="scss" scoped>
	.page-e {
		max-height: 100vh;
	}

	/* 底部安全边距 start*/
	.tn-tabbar-height {
		min-height: 20rpx;
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
			margin: auto 30rpx;
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
			// z-index: -1;
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
	.tn-three {
		position: absolute;
		top: 50%;
		right: 50%;
		bottom: 50%;
		left: 50%;
		transform: translate(-38rpx, -16rpx) rotateX(30deg) rotateY(20deg) rotateZ(-30deg);
		text-shadow: -1rpx 2rpx 0 #f0f0f0, -2rpx 4rpx 0 #f0f0f0, -10rpx 20rpx 30rpx rgba(0, 0, 0, 0.2);
	}

	.icon20 {
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
					// background-image: url(https://os.microios.com:1110/jsnzk-public/jsnzk/img/upload/icon_bg.png);
				}
			}
		}
	}


	/* 积分数字 */
	.button-number {
		width: 100%;
		height: 150rpx;
		border-radius: 15rpx;
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
			background-image: url(https://os.microios.com:1110/jsnzk-public/jsnzk/img/upload/icon_bg.png);
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
					background-image: url(https://os.microios.com:1110/jsnzk-public/jsnzk/img/upload/icon_bg.png);
				}
			}
		}
	}

	/* 图标容器1 end */
	
	
	/* 波浪*/
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
	    z-index: 9999;
	    height: 100rpx;
	    left: 0;
	    right: 0;
	    top: 300rpx;
	    bottom: auto;
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
	    opacity: 0.4;
	}
	.waveTop {
	    background-size: 50% 45px;
	}
	.waveAnimation .waveTop {
	  animation: move_wave 4s linear infinite;
	}
	
	.bgMiddle {
	    opacity: 0.6;
	}
	.waveMiddle {
	    background-size: 50% 40px;
	}
	.waveAnimation .waveMiddle {
	    animation: move_wave 3.5s linear infinite;
	}
	
	.bgBottom {
	    opacity: 0.95;
	}
	.waveBottom {
	    background-size: 50% 35px;
	}
	.waveAnimation .waveBottom {
	    animation: move_wave 2s linear infinite;
	}
	/* 波浪*/
</style>