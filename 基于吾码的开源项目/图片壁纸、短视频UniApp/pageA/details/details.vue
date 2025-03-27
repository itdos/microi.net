<template>
	<view class="template-details">
		<!-- <view style="position: fixed;top: 0;left: 0;width: 100vw;height: 100rpx;color: #FFFFFF;z-index: -1;text-align: center;line-height: 100rpx;">
			下拉加载上一条
		</view>
		<view style="position: fixed;bottom: 0;left: 0;width: 100vw;height: 100rpx;color: #FFFFFF;z-index: -1;text-align: center;line-height: 100rpx;">
			上拉加载下一条
		</view> -->
		<!-- 顶部自定义导航 -->
		<tn-nav-bar fixed alpha customBack v-show="ShowBottomTabbar">
			<view slot="back" class='tn-custom-nav-bar__back' @click="goBack">
				<text class='icon tn-icon-left'></text>
				<text class='icon tn-icon-home-capsule-fill'></text>
			</view>
		</tn-nav-bar>

		<view class="user-info" v-if="ShowBottomTabbar">
			<!-- @click="tn('/pageA/author/author')" -->
			<view class="icon15__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur button-2"
				@click="showLandscape"
				style="margin-bottom: 40rpx;">
				<view class="tn-icon-my"></view>
			</view>
			<!-- @tap="showLandscape" -->
			<view class="icon15__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur button-3"
				@click="FavoriteSwitch()"
				style="margin-bottom: 40rpx;display: block;text-align: center;">
				<view style="padding-top: 5rpx;" :class="ContentDetail._IsFavorite ? 'tn-icon-like-fill' : 'tn-icon-like-lack'"></view>
				<view class="" style="font-size: 26rpx;">
					{{Microi.GetCountStr(ContentDetail.ShoucangL)}}
				</view>
			</view>
			<!-- <view class="icon15__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur button-1"
				@click="tn('/pageB/chat/chat')">
				<view class="tn-icon-comment"></view>
			</view> -->
			<!-- @click="tn('/pageB/chat/chat')" -->
			<view class="icon15__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur button-1"
				@tap="OpenEdit()"
				style="margin-bottom: 40rpx;display: block;text-align: center;">
				<view style="padding-top: 5rpx;" class="tn-icon-eye"></view>
				<view style="font-size: 26rpx;">
					{{Microi.GetCountStr(ContentDetail.Hits)}}
				</view>
			</view>
		</view>

		<!-- 页面内容 -->
		<!-- <scroll-view 
		            scroll-y="true"
		            :style="{height: '100vh'}"
		            :refresher-threshold="100"
			        @refresherrefresh="refresherrefreshFun"
		            @refresherpulling="refresherpullingFun"
		            :refresher-triggered="isRefresher"
			        @scrolltolower="scrolltolowerFun"
			        refresher-enabled="true"
		            refresher-default-style="none"> -->
			<swiper v-if="ContentDetail.Id" class="card-swiper" :circular="true" :autoplay="true" duration="500"
				interval="12000" @tap="ShiftBottomTabbar()" @change="cardSwiper">
				<swiper-item v-for="(item,index) in swiperList" :key="item.Id" :class="cardCur==index?'cur':''">
					<!-- 这里可能是vue的bug，不管是使用`url('${item.Path}')`还是下面，均报错。也就是无法给Path添加双引号，但不添加双引号，由于Path里面包含括号，也无法加载图片。
					:style="{backgroundImage: 'url(\''+item.Path+'\')'}" -->
					<view class="swiper-item image-banner"
						:style="'background-image:url(' + item.Path + ');background-size: ' + (HengxiangSPTemp ? 'contain' : 'cover') + ';border-radius: 15rpx;'">
					</view>
				</swiper-item>
			</swiper>
		<!-- </scroll-view> -->
		<view class="indication" v-if="ShowBottomTabbar">
			<block v-for="(item,index) in swiperList" :key="item.Id">
				<view class="spot" :class="cardCur==index?'active':''"></view>
			</block>
		</view>
		<view v-if="!ContentDetail.Id" class="" :style="{paddingTop: vuex_custom_bar_height + 'px'}">
			<view class="loader">
				<view class="circle loading1"></view>
				<view class="circle loading2"></view>
				<view class="circle loading3"></view>
				<view class="circle loading4"></view>
				<view class="circle loading5"></view>
				<view class="circle loading6"></view>
				<view class="circle loading7"></view>
				<view class="circle loading8"></view>
			</view>
		</view>

		<!-- 底部tabbar start-->
		<view v-if="ShowBottomTabbar" class="tabbar footerfixed dd-glass tn-color-white" style="border-radius: 100rpx;">
			<!-- <view class="action" @click="FavoriteSwitch()">
				<view class="bar-icon">
					<view :class="ContentDetail._IsFavorite ? 'tn-icon-like-fill' : 'tn-icon-like-lack'"
						:style="{ color: ContentDetail._IsFavorite ? 'red' : '#ffffff'}">
						<text style="padding-left: 5rpx;font-size: 28rpx;color:#ffffff">{{ContentDetail.ShoucangL || 0}}</text>
					</view> 
					<image class="" src='https://resource.tuniaokj.com/images/tabbar/a1.png'></image>
				</view>
				<view class="">收藏</view>
				<view class="">{{ContentDetail.ShoucangL || 0}}</view>
			</view>
			<view class="action" @tap="OpenEdit()">
				<view class="bar-icon">
					<view class="tn-icon-eye">
						<text style="padding-left: 5rpx;font-size: 28rpx;color:#ffffff">{{ContentDetail.Hits || 0}}</text>
					</view>
				</view>
				<view class="">浏览</view>
				<view class="">{{ContentDetail.Hits || 0}}</view>
			</view> -->
			<view class="action" @click="GetContentDetail('Next')">
				<view class="bar-icon">
					<view class="tn-icon-down"></view>
				</view>
				<view class="">下条</view>
			</view>
			<view class="action" @click="GetContentDetail('Last')">
				<view class="bar-icon">
					<view class="tn-icon-up"></view>
				</view>
				<view class="">上条</view>
			</view>
			<view class="action" @tap="Download">
				<view class="bar-icon">
					<view class="tn-icon-download">
						<!-- <text style="padding-left: 5rpx;font-size: 28rpx;">{{ContentDetail.XiazaiL || 0}}</text> -->
					</view> 
					<!-- <image class="" src='https://resource.tuniaokj.com/images/tabbar/k2.png'></image> -->
				</view>
				<!-- <view class="">下载</view> -->
				<view class="">{{ContentDetail.XiazaiL || 0}}</view>
			</view>
			<!-- <view class="action" @tap="XuanZhuan()">
				<view class="bar-icon">
					<view class="tn-icon-download">
					</view>
					<image class="" src='https://resource.tuniaokj.com/images/tabbar/k2.png'></image>
				</view>
				<view class="">旋转</view>
			</view> -->
			<!-- <view class="action">

				<view class="bar-icon">
					<view class="tn-icon-flower">
					<view class="tn-icon-my"></view>
					<image class="" src='https://resource.tuniaokj.com/images/tabbar/i2.png'></image>
				</view>
				<view class="">作者</view>
			</view> -->
			
			<view class="action" @tap="HengxiangSPTemp = !HengxiangSPTemp;">
				<view class="bar-icon">
					<view class="tn-icon-copy-fill">
					</view>
				</view>
				<view class="">{{ HengxiangSPTemp ? '全屏' : '全图' }}</view>
			</view>
			
			<!-- <view class="action" @tap="showLandscape">
				<view class="bar-icon">
					<view class="tn-icon-my"></view>
				</view>
				<view class="">作者</view>
			</view> -->
			
			<view class="action">
				<button class="tn-flex-direction-column tn-flex-row-center tn-flex-col-center tn-button--clear-style"
					open-type="share">
					<view class="bar-icon">
						<view class="tn-icon-send">
						</view>
						<!-- <image class="" src='https://resource.tuniaokj.com/images/tabbar/d2.png'></image> -->
					</view>
					<view class="">分享</view>
				</button>
			</view>
			
		</view>

		<!-- 压屏窗-->
		<tn-modal v-model="ShowEdit"
			:custom="true" 
			:showCloseBtn="true"
			:title="'编辑'"
			:safeAreaInsetBottom="true"
			>
			<view>
				<tn-form :labelWidth="300" style="text-align: right;">
					<tn-form-item label="加浏览" style="text-align: right;">
						<tn-button size="sm" @click="AddHits()" backgroundColor="#01BEFF" fontColor="#ffffff"
							style="width: 180rpx;">
							<text class="tn-icon-add-circle" style="margin-right: 2rpx;"></text> 加浏览
						</tn-button>
					</tn-form-item>
					<tn-form-item label="是否免费" style="text-align: right;">
						<!-- @change="(value) => { return SwitchContent(value, 'ShifouMF'); }" -->
						<tn-switch v-model="ContentDetail.ShifouMF" @change="SwitchContentShifouMF"></tn-switch>
					</tn-form-item>
					<tn-form-item label="是否推荐首页">
						<tn-switch v-model="ContentDetail.ShifouTJ" @change="SwitchContentShifouTJ"></tn-switch>
					</tn-form-item>
					<tn-form-item label="小程序不可见">
						<tn-switch v-model="ContentDetail.WeixinXCXBKJ" @change="SwitchContentWeixinXCXBKJ"></tn-switch>
					</tn-form-item>
					<tn-form-item label="未登录不可见">
						<tn-switch v-model="ContentDetail.WeidengLBKJ" @change="SwitchContentWeidengLBKJ"></tn-switch>
					</tn-form-item>
					<tn-form-item label="非手机号会员不可见">
						<tn-switch v-model="ContentDetail.FeishouJHHYBKJ" @change="SwitchContentFeishouJHHYBKJ"></tn-switch>
					</tn-form-item>
					<tn-form-item label="是否置顶">
						<tn-switch v-model="ContentDetail.ShifouZD" @change="SwitchContentShifouZD"></tn-switch>
					</tn-form-item>
					<tn-form-item label="免费会员不可见">
						<tn-switch v-model="ContentDetail.MianfeiHYBKJ" @change="SwitchContentMianfeiHYBKJ"></tn-switch>
					</tn-form-item>
					<tn-form-item label="非竖屏内容">
						<tn-switch v-model="ContentDetail.HengxiangSP" @change="SwitchContentHengxiangSP"></tn-switch>
					</tn-form-item>
					<tn-form-item label="不推荐近期热门">
						<tn-switch v-model="ContentDetail.ButuiJJQRM" @change="SwitchContentButuiJJQRM"></tn-switch>
					</tn-form-item>
				</tn-form>
			</view>
		</tn-modal>
		<tn-landscape :show="show1" @close="closeLandscape" closePosition="bottom" :closeSize="60">
			<view class="tn-color-white" style="width: 100vw;">

				<view class="" style="margin: 120rpx 60rpx;">
					<view class="tn-flex tn-flex-col-top">

						<view class="">
							<view class="logo-pic tn-shadow">
								<view class="logo-image">
									<view class="tn-shadow-blur"
										:style="'background-image:url(' + Microi.FileServer + ContentDetail.YulanT + ');width: 100rpx;height: 100rpx;background-size: cover;'">
									</view>
								</view>
							</view>
							<view class="tn-icon-sex-male"
								style="position: absolute;margin: -105rpx 0 0 72rpx;border-radius: 100rpx;background-color: #FFFFFF;color: #FF71D2;padding: 5rpx;">
							</view>
						</view>
						<view class="tn-padding-left-sm tn-padding-top-xs" style="width: 100%;">
							<view class="tn-flex tn-flex-row-between tn-flex-col-between">
								<view class="justify-content-item">
									<text class="tn-text-lg tn-text-bold">{{ContentDetail.CaijiLYZZ || ContentDetail.UserName}}</text>
									<!-- <text class="tn-padding-left-sm tn-padding-right-xs">水瓶座</text>
									<text class="tn-icon-con-virgo"></text> -->
								</view>
								<!-- <view class="justify-content-item tn-round tn-text-xs tn-bg-orangered--light tn-color-orangered" style="padding: 5rpx 15rpx;">
                  <text class="tn-icon-warning-fill tn-padding-right-xs"></text> 举报
                </view> -->
							</view>
							<view class="tn-padding-top-xs">
								<view class="">
									<text class="tn-text-df tn-color-gray--light">{{ContentDetail.CreateTime && ContentDetail.CreateTime.substr(0, 10)}}</text>
								</view>
							</view>
						</view>
					</view>


					<view class="tn-flex tn-flex-row-between tn-flex-col-between tn-margin-top-xl tn-text-justify">
						<text class="">{{ContentDetail.Biaoti}}</text>
					</view>
				</view>


			</view>
		</tn-landscape>
		
	</view>
</template>

<script>
	import {
		mapState
	} from 'vuex'
	import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
	export default {
		name: 'TemplateDetails',
		mixins: [template_page_mixin],
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
				HengxiangSPTemp : 0,
				ShowEdit: false,
				ContentDetail: {},
				Loading: true,
				ShowBottomTabbar: true,
				Microi: this.Microi,
				show1: false,
				cardCur: 0,
				cardCurCount: 0,
				swiperList: [],
			}
		},
		created() {
			var self = this;
		},
		onLoad() {
			var self = this;
			self.GetContentDetail();
		},
		/**
		 * 下拉加载上一条(和onLoad同级)
		 */
		onPullDownRefresh () {
			
		},
		/**
		 * 上拉加载下一条
		 */
		onReachBottom() {
			var self = this;
			self.Microi.Tips('onReachBottom');
		  // 执行加载更多操作
		  // 可以在这里获取更多数据或追加页面内容

		  // 模拟异步获取数据
		  setTimeout(() => {
			// 完成加载后，可以根据实际情况判断是否还有更多数据
			// 如果没有更多数据，可以调用 uni.showToast() 方法提示用户
		  }, 1000);
		},
		methods: {
			OpenEdit(){//content
				var self = this;
				//CurrentUser.YunxuZJLLS
				if(self.Microi.GetCurrentUser().YunxuZJLLS){
					// self.ContentDetail = content;
					self.ShowEdit = true;
				}
			},
			FavoriteSwitch(){
				var self = this;
				var isFavorite = self.ContentDetail._IsFavorite;
				//判断是否已登陆
				if(!self.IsLogin){
					self.Microi.ConfirmTips('是否去登录？', function(){
						uni.navigateTo({
							url: '/pages/common/login'
						})
					});
					return;
				}else{
					self.ContentDetail._IsFavorite = !self.ContentDetail._IsFavorite;
					isFavorite ? self.ContentDetail.ShoucangL -= 1 : self.ContentDetail.ShoucangL += 1;
					//添加收藏记录
					self.Microi.ApiEngine.Run('add_content_favorite', {
						Id : self.Microi.GetUrlQuery(self, 'ContentId'),
						Favorite : isFavorite ? 0 : 1
					}, function(result){
						if(self.Microi.CheckResult(result)){
							self.Microi.Tips(isFavorite ? '取消收藏成功！' : '收藏成功！');
						}
					});
				}
			},
			SwitchContentShifouMF(value){
				var self = this;
				self.SwitchContent(value, 'ShifouMF');
			},
			SwitchContentShifouTJ(value){
				var self = this;
				self.SwitchContent(value, 'ShifouTJ');
			},
			SwitchContentWeixinXCXBKJ(value){
				var self = this;
				self.SwitchContent(value, 'WeixinXCXBKJ');
			},
			SwitchContentWeidengLBKJ(value){
				var self = this;
				self.SwitchContent(value, 'WeidengLBKJ');
			},
			SwitchContentFeishouJHHYBKJ(value){
				var self = this;
				self.SwitchContent(value, 'FeishouJHHYBKJ');
			},
			SwitchContentShifouZD(value){
				var self = this;
				self.SwitchContent(value, 'ShifouZD');
			},
			SwitchContentMianfeiHYBKJ(value){
				var self = this;
				self.SwitchContent(value, 'MianfeiHYBKJ');
			},
			SwitchContentHengxiangSP(value){
				var self = this;
				self.HengxiangSPTemp = value;
				self.SwitchContent(value, 'HengxiangSP');
			},
			SwitchContentButuiJJQRM(value){
				var self = this;
				self.SwitchContent(value, 'ButuiJJQRM');
			},
			SwitchContent(value, type){
				var self = this;
				var param = {
					Id : self.Microi.GetUrlQuery(self, 'ContentId')
				};
				param[type] = value ? 1 : 0;
				self.Microi.ApiEngine.Run('upt_content', param, function(result){
					if(self.Microi.CheckResult(result)){
						self.Microi.Tips('修改成功！');
					}
				});
			},
			async AddHits(){
				var self = this;
				self.ShowEdit = true;
				var result = await self.Microi.ApiEngine.Run('upt_content_hits_add', {
					Id : self.Microi.GetUrlQuery(self, 'ContentId')
				});
				if(self.Microi.CheckResult(result)){
					self.Microi.Tips('当前浏览量' + result.DataAppend.Hits);
				}
			},
			Download() {
				var self = this;
				//判断是否已登陆
				if(!self.IsLogin){
					self.Microi.ConfirmTips('是否去登录？', function(){
						uni.navigateTo({
							url: '/pages/common/login'
						})
					});
					return;
				}else{
					self.Microi.Tips('下载功能开发中', false);
					// self.ContentDetail._IsFavorite = !self.ContentDetail._IsFavorite;
					//添加下载记录
					// self.Microi.ApiEngine.Run('add_content_favorite', {
					// 	Id : self.Microi.GetUrlQuery(self, 'ContentId'),
					// 	Favorite : isFavorite ? 0 : 1
					// }, function(result){
					// 	if(self.Microi.CheckResult(result)){
					// 		self.Microi.Tips(isFavorite ? '取消收藏成功！' : '收藏成功！');
					// 	}
					// });
				}
			},
			XuanZhuan() {

			},
			GetContentDetail(nextLast) {
				var self = this;
				var contentId = self.Microi.GetUrlQuery(self, 'ContentId'); //uni.getStorageSync("ContentId");
				if (!contentId) {
					self.Microi.Tips('参数错误！', false);
					return;
				}
				self.cardCur = 0;
				self.ContentDetail = {};
				var param = {
					Id: contentId,
				};
				if(nextLast){
					param.NextOrLast = nextLast;
				}
				param.SortType = self.Microi.GetUrlQuery(self, 'SortType');
				param.NeirongFL = self.Microi.GetUrlQuery(self, 'NeirongFL');
				self.Microi.ApiEngine.Run('get_content_detail', param, function(result) {
					if (self.Microi.CheckResult(result)) {
						self.ContentDetail = result.Data;
						self.HengxiangSPTemp = result.Data.HengxiangSP;
						var wenjianDZ = result.Data.WenjianDZ;
						self.cardCurCount = wenjianDZ.length;
						var realWenjianDZ = [];
						var tIndex = 0;
						wenjianDZ.forEach(item => {
							if (self.Microi.IsImg(item
								.Path)) { // && tIndex < 5  需要做一个功能，首次只加载5张，往右滑动的时候再动态加载
								tIndex++;
								realWenjianDZ.push(item);
							}
						});
						if (realWenjianDZ.length == 0) {
							realWenjianDZ.push({
								Id: 1,
								Path: self.Microi.FileServer + self.ContentDetail.YulanT
							});
						}
						self.swiperList = realWenjianDZ
						// self.Microi.Tips('浏览内容，积分-10', true, {
						// 	Icon : 'none',
						// 	Time : 1500,
						// 	CssClass : 'microi-toast microi-toast-bottom'
						// });
					}
				})
			},
			ShiftBottomTabbar() {
				this.ShowBottomTabbar = !this.ShowBottomTabbar
			},
			// 跳转
			tn(e) {
				uni.navigateTo({
					url: e,
				});
			},

			// cardSwiper
			cardSwiper(e) {
				var self = this;
				self.cardCur = e.detail.current
				if (self.cardCurCount > self.cardCur + 1 &&
					self.cardCurCount != self.swiperList.length
				) {

				}
			},

			// 弹出压屏窗
			showLandscape() {
				this.openLandscape()
			},
			// 打开压屏窗
			openLandscape() {
				this.show1 = true
			},
			// 关闭压屏窗
			closeLandscape() {
				this.show1 = false
			},
		}
	}
</script>

<style lang="scss" scoped>
	.template-details {
		margin: 0;
		width: 100%;
		height: 100vh;
		color: #fff;
		overflow: hidden;
		background-color: #000;
	}

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



	/* 图标容器15 start */
	.icon15 {
		&__item {
			width: 30%;

			border-radius: 10rpx;
			padding: 30rpx;
			margin: 20rpx 10rpx;
			transform: scale(1);
			transition: transform 0.3s linear;
			transform-origin: center center;

			&--icon {
				width: 100rpx;
				height: 100rpx;
				font-size: 50rpx;
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

	/* 按钮 */
	.user-info{
		position: fixed;
		right: 5%;
		z-index: 1001;
		bottom: calc(150rpx + env(safe-area-inset-bottom));
		bottom: calc(150rpx + constant(safe-area-inset-bottom));
	}
	.button-1 {
		background-color: rgba(0, 0, 0, 0.15);
		// position: fixed;
		/* bottom:200rpx;
      right: 20rpx; */
		// top: 25%;
		// right: 30rpx;
		z-index: 1001;
		border-radius: 100px;
	}

	.button-2 {
		background-color: rgba(0, 0, 0, 0.15);
		// position: fixed;
		/* bottom:200rpx;
      right: 20rpx; */
		// top: 35%;
		// right: 30rpx;
		z-index: 1001;
		border-radius: 100px;
	}

	.button-3 {
		background-color: rgba(0, 0, 0, 0.15);
		// position: fixed;
		/* bottom:200rpx;
      right: 20rpx; */
		// top: 45%;
		// right: 30rpx;
		z-index: 1001;
		border-radius: 100px;
	}


	/* 用户头像 start */
	.logo-image {
		width: 100rpx;
		height: 100rpx;
		position: relative;
	}

	.logo-pic {
		background-size: cover;
		background-repeat: no-repeat;
		// background-attachment:fixed;
		background-position: top;
		border: 6rpx solid rgba(255, 255, 255, 0.25);
		box-shadow: 0rpx 0rpx 80rpx 0rpx rgba(0, 0, 0, 0.15);
		border-radius: 50%;
		overflow: hidden;
		// background-color: #FFFFFF;
	}

	/* 底部tabbar start*/
	/* 毛玻璃*/
	.dd-glass {
		width: 100%;
		backdrop-filter: blur(20rpx);
		-webkit-backdrop-filter: blur(20rpx);
	}

	.footerfixed {
		position: fixed;
		// margin: 20rpx;
		// margin: 40rpx 5%;
		margin-left:5%;
		width: 90%;
		// bottom: calc(env(safe-area-inset-bottom) / 2);
		bottom: env(safe-area-inset-bottom);
		bottom: constant(safe-area-inset-bottom);
		z-index: 999;
		background-color: rgba(0, 0, 0, 0.15);
		box-shadow: 0rpx 0rpx 30rpx 0rpx rgba(0, 0, 0, 0.07);
	}

	.tabbar {
		display: flex;
		align-items: center;
		// min-height: 110rpx;
		height: 100rpx;
		justify-content: space-between;
		padding: 0;
		// height: calc(110rpx + env(safe-area-inset-bottom) / 2);
		// height: calc(80rpx + env(safe-area-inset-bottom) / 2);
		// padding-bottom: calc(env(safe-area-inset-bottom) / 2);
	}

	.tabbar .action {
		font-size: 22rpx;
		position: relative;
		flex: 1;
		text-align: center;
		padding: 0;
		display: block;
		height: auto;
		line-height: 1;
		margin: 0;
		overflow: initial;
	}

	.tabbar .action .bar-icon {
		width: 100rpx;
		position: relative;
		display: block;
		height: auto;
		margin: 0 auto 10rpx;
		text-align: center;
		font-size: 42rpx;
	}

	.tabbar .action .bar-icon image {
		width: 50rpx;
		height: 50rpx;
		display: inline-block;
	}


	/* 全屏轮播  start*/
	.card-swiper {
		height: 100vh !important;
	}

	.card-swiper swiper-item {
		width: 750rpx !important;
		left: 0rpx;
		box-sizing: border-box;
		overflow: initial;
	}

	.card-swiper swiper-item .swiper-item {
		width: 100%;
		display: block;
		height: 100vh;
		border-radius: 0rpx;
		// transform: scale(0.9);
		transform: scale(1);//修改为从小变大，而不是从大变小 --2024-01-09 by itdos.com
		transition: all 0.2s ease-in 0s;
		will-change: transform;
		overflow: hidden;

	}

	.card-swiper swiper-item.cur .swiper-item {
		// transform: scale(1);
		transform: scale(1.2);//修改为从小变大，而不是从大变小 --2024-01-09 by itdos.com
		transition: all 0.2s ease-in 0s;
		will-change: transform;
		// background: no-repeat center center;
		background: no-repeat 50% 50%; //和上面一个道理

		//图片动画 -------START
		-webkit-animation-name: kenburns;
		animation-name: kenburns;
		-webkit-animation-timing-function: linear;
		animation-timing-function: linear;
		-webkit-animation-iteration-count: infinite;
		animation-iteration-count: infinite;
		-webkit-animation-duration: 16s;
		animation-duration: 16s;
		opacity: 1;
		// transform: scale(1.2);
		transform: scale(1);//修改为从小变大，而不是从大变小 --2024-01-09 by itdos.com
		//图片动画 -------END
	}
	//--2024-01-09新增 防止滑动时右边图片显示过大 --by itdos.com
	.card-swiper swiper-item .swiper-item {
		background: no-repeat 50% 50%; //和上面一个道理
	}

	.image-banner {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	//图片动画 -------START
	.card-swiper swiper-item.cur .swiper-item.image-banner:nth-child(1) {
		-webkit-animation-name: kenburns-1;
		animation-name: kenburns-1;
		z-index: 3;
	}

	@-webkit-keyframes kenburns-1 {
		0% {
			opacity: 1;
			// transform: scale(1.2);
			transform: scale(1);//修改为从小变大，而不是从大变小 --2024-01-09 by itdos.com
		}

		1.5625% {
			opacity: 1;
		}

		23.4375% {
			opacity: 1;
		}

		26.5625% {
			opacity: 1;
			// transform: scale(1);
			transform: scale(1.2);//修改为从小变大，而不是从大变小 --2024-01-09 by itdos.com
		}

		100% {
			opacity: 1;
			// transform: scale(1.2);
			transform: scale(1);//修改为从小变大，而不是从大变小 --2024-01-09 by itdos.com
		}

		98.4375% {
			opacity: 1;
			// transform: scale(1.2117647059);
			transform: scale(1);//修改为从小变大，而不是从大变小 --2024-01-09 by itdos.com
		}

		100% {
			opacity: 1;
		}
	}

	@keyframes kenburns-1 {
		0% {
			opacity: 1;
			// transform: scale(1.2);
			transform: scale(1);//修改为从小变大，而不是从大变小 --2024-01-09 by itdos.com
		}

		1.5625% {
			opacity: 1;
		}

		23.4375% {
			opacity: 1;
		}

		26.5625% {
			opacity: 1;
			// transform: scale(1);
			transform: scale(1.2);//修改为从小变大，而不是从大变小 --2024-01-09 by itdos.com
		}

		100% {
			opacity: 1;
			// transform: scale(1.2);
			transform: scale(1);//修改为从小变大，而不是从大变小 --2024-01-09 by itdos.com
		}

		98.4375% {
			opacity: 1;
			// transform: scale(1.2117647059);
			transform: scale(1);//修改为从小变大，而不是从大变小 --2024-01-09 by itdos.com
		}

		100% {
			opacity: 1;
		}
	}

	//图片动画 -------END

	.image-banner image {
		width: 100%;
		// height: 100%;
	}

	/* 轮播指示点 start*/
	.indication {
		z-index: 9999;
		width: 100%;
		height: 36rpx;
		position: fixed;
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		bottom: calc(120rpx + env(safe-area-inset-bottom));
		bottom: calc(120rpx + constant(safe-area-inset-bottom));
	}

	.spot {
		background-color: #FFFFFF;
		opacity: 0.6;
		width: 10rpx;
		min-width: 4rpx;
		height: 10rpx;
		border-radius: 20rpx;
		// top: calc(-280rpx - env(safe-area-inset-bottom) / 2);
		// top: calc(-280rpx - constant(safe-area-inset-bottom));
		// top: calc(-200rpx - env(safe-area-inset-bottom));
		// top: calc(-200rpx - constant(safe-area-inset-bottom));
		margin: 0 8rpx !important;
		// position: relative;
	}

	.spot.active {
		opacity: 1;
		width: 30rpx;
		min-width: 10rpx;
		background-color: #FFFFFF;
	}



	/* 加载动画   by itdos.com*/
	.loader {
		position: absolute;
		width: 120rpx;
		height: 120rpx;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	.circle {
		color: #01BEFF;
		position: absolute;
		border-radius: 100%;
		width: 30rpx;
		height: 30rpx;
		display: inline-block;
		float: none;
		background-color: currentColor;
		border: 0 solid currentColor;
		-webkit-animation: spin 1s infinite ease-in-out;
		-moz-animation: spin 1s infinite ease-in-out;
		-o-animation: spin 1s infinite ease-in-out;
		animation: spin 1s infinite ease-in-out
	}

	.loader :nth-child(1) {
		top: 5%;
		left: 50%;
		-webkit-animation-delay: -.875s;
		-moz-animation-delay: -.875s;
		-o-animation-delay: -.875s;
		animation-delay: -.875s
	}

	.loader :nth-child(2) {
		top: 18.1801948466%;
		left: 81.8198051534%;
		-webkit-animation-delay: -.75s;
		-moz-animation-delay: -.75s;
		-o-animation-delay: -.75s;
		animation-delay: -.75s
	}

	.loader :nth-child(3) {
		top: 50%;
		left: 95%;
		-webkit-animation-delay: -.625s;
		-moz-animation-delay: -.625s;
		-o-animation-delay: -.625s;
		animation-delay: -.625s
	}

	.loader :nth-child(4) {
		top: 81.8198051534%;
		left: 81.8198051534%;
		-webkit-animation-delay: -.5s;
		-moz-animation-delay: -.5s;
		-o-animation-delay: -.5s;
		animation-delay: -.5s
	}

	.loader :nth-child(5) {
		top: 94.9999999966%;
		left: 50.0000000005%;
		-webkit-animation-delay: -.375s;
		-moz-animation-delay: -.375s;
		-o-animation-delay: -.375s;
		animation-delay: -.375s
	}

	.loader :nth-child(6) {
		top: 81.8198046966%;
		left: 18.1801949248%;
		-webkit-animation-delay: -.25s;
		-moz-animation-delay: -.25s;
		-o-animation-delay: -.25s;
		animation-delay: -.25s
	}

	.loader :nth-child(7) {
		top: 49.9999750815%;
		left: 5.0000051215%;
		-webkit-animation-delay: -.125s;
		-moz-animation-delay: -.125s;
		-o-animation-delay: -.125s;
		animation-delay: -.125s
	}

	.loader :nth-child(8) {
		top: 18.179464974%;
		left: 18.1803700518%;
		-webkit-animation-delay: 0s;
		-moz-animation-delay: 0s;
		-o-animation-delay: 0s;
		animation-delay: 0s
	}

	@-webkit-keyframes spin {

		0%,
		100% {
			opacity: 1;
			-webkit-transform: scale(1);
			transform: scale(1)
		}

		20% {
			opacity: 1
		}

		80% {
			opacity: 0;
			-webkit-transform: scale(0);
			transform: scale(0)
		}
	}

	@-moz-keyframes spin {

		0%,
		100% {
			opacity: 1;
			-moz-transform: scale(1);
			transform: scale(1)
		}

		20% {
			opacity: 1
		}

		80% {
			opacity: 0;
			-moz-transform: scale(0);
			transform: scale(0)
		}
	}

	@-o-keyframes spin {

		0%,
		100% {
			opacity: 1;
			-o-transform: scale(1);
			transform: scale(1)
		}

		20% {
			opacity: 1
		}

		80% {
			opacity: 0;
			-o-transform: scale(0);
			transform: scale(0)
		}
	}

	@keyframes spin {

		0%,
		100% {
			opacity: 1;
			-webkit-transform: scale(1);
			-moz-transform: scale(1);
			-o-transform: scale(1);
			transform: scale(1)
		}

		20% {
			opacity: 1
		}

		80% {
			opacity: 0;
			-webkit-transform: scale(0);
			-moz-transform: scale(0);
			-o-transform: scale(0);
			transform: scale(0)
		}
	}
</style>