<template>
	<view class="pages-a">
		<!-- 顶部自定义导航 -->
		<tn-nav-bar :isBack="false" :bottomShadow="false" backgroundColor="#FFFFFF">
			<view class="custom-nav tn-flex tn-flex-col-center tn-flex-row-left">
				<view class="custom-nav__back" @click="tn('/pageA/navigation/navigation')">
					<view class="tn-icon-deploy"></view>
				</view>
				<view class="tn-margin-top"
					style="text-shadow:  1rpx 0 0 #FFF, 0 1rpx 0 #FFF, -1rpx 0 0 #FFF , 0 -1rpx 0 #FFF;"
					@click="ClickTabs()">
					<tn-tabs :list="scrollList" :current="current" @change="tabChange" activeColor="#000" :bold="true"
						:showBar="true" :fontSize="36"></tn-tabs>
				</view>
			</view>
		</tn-nav-bar>
		<!-- <tn-scroll-view
		  :customNavHeight="vuex_custom_bar_height"
		  :style="{paddingTop: vuex_custom_bar_height + 'px'}"
		  :refreshState="refreshState"
		  @refresh="handleRefresh"
		  @refreshReady="handleRefreshReady"
		  @refreshStop="resetRefresh"
		> -->
		<!-- v-if="current == 0"  tn-skeleton-->
		<view class="" :style="{paddingTop: vuex_custom_bar_height + 'px'}">
			<!-- <view class="tn-color-gray--dark" style="margin: 20rpx 30rpx 0 30rpx;border-radius: 100rpx;
					padding-left: 6rpx;background-color: rgba(248, 247, 248, 0.9);" @click="tn('/pageA/search/search')">
				<tn-notice-bar :list="searlist" mode="vertical" leftIconName="search" :duration="6000"></tn-notice-bar>
			</view> -->
			<view class="tn-skeleton">
				<!--首页轮播图-->
				<swiper class="card-swiper" :circular="true" :autoplay="true" duration="500" interval="3000"
					@change="cardSwiper">
					<swiper-item v-for="(item,index) in swiperList" :key="index" :class="cardCur==index?'cur':''">
						<view v-if="item.Id" class="swiper-item image-banner"
							style="background-size: cover;border-radius: 15rpx;"
							:style="{ backgroundImage : 'url(' + Microi.FileServer + item.Tupian + ')' }">
						</view>
						<view v-else class="tn-skeleton-fillet swiper-item image-banner"
							style="background-size: cover;border-radius: 15rpx;">
						</view>
						<view class="swiper-item-text" v-if="item.Id">
							<view class="tn-text-bold tn-color-white" style="font-size: 50rpx;">{{item.Biaoti}}</view>
							<view class="tn-color-white tn-padding-top" style="font-size: 30rpx;">{{item.FubiaoT}}
							</view>
							<view class="tn-text-sm tn-text-bold tn-color-white tn-padding-top-sm tn-padding-bottom-sm">
								{{item.Zhaiyao}}
							</view>
						</view>
					</swiper-item>
				</swiper>
				<view class="indication">
					<block v-for="(item,index) in swiperList" :key="index">
						<view class="spot" :class="cardCur==index?'active':''"></view>
					</block>
				</view>
				<!-- <view class="swiper card-swiper" style="padding:0 22rpx;margin-bottom: 20rpx;margin-top: 20rpx;">
					<tn-stack-swiper :list="swiperList" @CallbackClick="LunbotuClick" direction="horizontal" height="100%"
						:switchRate="20" :scaleRate="0.05" :translateRate="7.2">
					</tn-stack-swiper>
				</view> -->
				<!-- 方式5，图片形式，安卓手机 start  首页快捷 -->
				<view class="tn-flex tn-flex-wrap home-shadow">
					<block v-for="(item, index) in IndexShortcutList" :key="index">
						<view class="tn-margin-bottom tn-margin-top-sm" style="width: 25%;" @tap="ShortcutClick(item)">
							<view v-if="item.Id"
								class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
								<view class="icon5__item--icon tn-flex tn-flex-row-center tn-flex-col-center "
									style="background-size:100% 100%;background-size: cover;"
									:style="{ backgroundImage : 'url(' + Microi.FileServer + item.Tupian + ')', boxShadow : SearchNeirongFL == item.ShuaxinCS ? '0px 0px 25rpx 15rpx #31E749' : '0px 0px 25rpx 15rpx #AAAAAA' }">
								</view>
								<view class="tn-color-black tn-text-center" style="height: 40rpx;width: 100%;">
									<text class="tn-text-ellipsis">{{ item.Mingcheng || '' }}</text>
								</view>
							</view>
							<view v-else class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
								<view
									class="tn-skeleton-circle icon5__item--icon tn-flex tn-flex-row-center tn-flex-col-center "
									style="background-size:100% 100%;background-size: cover;">
								</view>
								<view class="tn-skeleton-fillet tn-color-black tn-text-center"
									style="height: 40rpx;width: 50%;">
									<text class="tn-text-ellipsis"></text>
								</view>
							</view>
						</view>
					</block>
				</view>
				<!-- 方式5 end-->
			</view>
		</view>



		<!--胶囊 banner 需要可用显示出来即可 start-->
		<!-- <view class="tn-flex tn-flex-wrap tn-padding-bottom" @click="tn('')">
			  <view class="" style="width: 100%;">
				<view class="image-piccapsule tn-shadow-blur" style="background-image:url('https://resource.tuniaokj.com/images/capsule-banner/banner-tnmb.png');">
				   <view class="image-capsule">
				   </view>
				 </view>  
			  </view>  
			</view> -->
		<!-- banner end-->

		<view class="">
			<view v-if="!ContentListFirstLoading" class="">
				<view class="" style="padding: 0rpx 20rpx;">
					<tn-waterfall ref="waterfall" v-model="ContentList" @finish="handleWaterFallFinish">
						<template v-slot:left="{ leftList }">
							<!-- @click="tn('/pageB/activity/activity')"
							 @click="Microi.Tips('即将上线！', false)"
							 @click="tn('/pageB/activity/activity')"
							 @click="tn('/pageB/activity/activity')"
							 -->
							<!-- tn-bg-yellow tn-text-bold  -->
							<view class="tn-color-black tn-dynamic-bg-1 home-shadow"
								style="height: 160rpx;margin: 0 10rpx 20rpx 10rpx;border-radius: 10rpx;"
								@click="GotoShouyeGGYJH()">
								<view class="tn-padding-sm" style="max-height: 100%;overflow: hidden;color:#fff;"
									v-html="GetGG() || '无公告'">
								</view>
								<!-- <view class="tn-padding-left tn-padding-top-xs">
									去看看精选10条内容
									<text class="tn-icon-right tn-padding-left-xs"></text>
								</view> -->
							</view>
							<view v-for="(item, index) in leftList" :key="index" class="wallpaper__item"
								@tap="GotoDetail(item)">
								<view class="item__image" style="position: relative;" v-if="item.Id">
									<tn-lazy-load :threshold="6000" height="100%" :image="FileServer + item.YulanT"
										:index="item.Id" imgMode="widthFix"></tn-lazy-load>
									<view class="content-type-icon">
										<!-- tn-cool-bg-color-7 -->
										<tn-tag shape="circle" size="sm" height="35rpx" width="auto"
											backgroundColor="tn-dynamic-bg-1" fontColor="tn-color-white">
											<text 
												v-if="!((item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo') && item._WenjianDZLength == 1)"
												class="content-icon" 
												:class="(item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo')
													? 'tn-icon-video-fill' : 'tn-icon-image-fill'"></text>
											{{((item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo') && item._WenjianDZLength == 1) ? '' : (item._WenjianDZLength || '..') + ((item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo') ? 'V' : 'P')}} 
											<text class="content-icon" 
												:class="((item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo') && item._WenjianDZLength == 1) ?'tn-icon-video-fill' : 'tn-icon-eye-fill'"
												:style="{marginLeft: ((item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo') && item._WenjianDZLength == 1) ? '0px' : '10rpx'}"></text>
											{{item.Hits}}
										</tn-tag>
									</view>
								</view>
								<view class="item__data">
									<!-- white-space: nowrap; -->
									<view class="item__title-container">
										<text class="item__title tn-color-purple">{{ item.Biaoti }}</text>
									</view>
									 <!-- v-if="item.tags && item.tags.length > 0" -->
									<view class="item__tags-container">
									 <!-- v-for="(tagItem, tagIndex) in item.tags" :key="tagIndex" -->
										<view class="item__tag">{{ item.Fenlei }}</view>
										<view class="item__tag">{{ item.NeirongFL }}</view>
									</view>

									<view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding-top-xs">
										<view class="justify-content-item">
											<view class="tn-flex tn-flex-col-center tn-flex-row-left">
												<view class="logo-pic">
													<view class="logo-image">
														<view class=""
															:style="'background-image:url('+ FileServer + item.YulanT +');width: 40rpx;height: 40rpx;background-size: cover;'">
														</view>
													</view>
												</view>
												<view class="tn-padding-left-xs">
													<text class="tn-color-gray tn-text-sm">{{ item.CaijiLYZZ || item.UserName }}</text>
												</view>

											</view>
										</view>
										<view class="justify-content-item">
											<!-- tn-padding-right-xs -->
											<text style="font-size: 36rpx;"
												:class="item._IsFavorite ? 'tn-icon-like-fill tn-color-red' : 'tn-icon-like tn-color-gray'"></text>
											<!-- <text class="tn-color-gray">{{ item.ShoucangL || 0 }}</text> -->
										</view>
									</view>
								</view>
							</view>
						</template>
						<template v-slot:right="{ rightList }">

							<view v-for="(item, index) in rightList" :key="index" class="wallpaper__item"
								@tap="GotoDetail(item)">
								<view class="item__image" style="position: relative;">
									<tn-lazy-load :threshold="6000" height="100%"
										:image="'https://os.microios.com:1120/jsnzk-public' + item.YulanT" :index="item.Id"
										imgMode="widthFix"></tn-lazy-load>
									<view class="content-type-icon">
										<!-- tn-cool-bg-color-7 -->
										<tn-tag shape="circle" size="sm" height="35rpx" width="auto"
											backgroundColor="tn-dynamic-bg-1" fontColor="tn-color-white">
											<text 
												v-if="!((item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo') && item._WenjianDZLength == 1)"
												class="content-icon" 
												:class="(item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo')
													? 'tn-icon-video-fill' : 'tn-icon-image-fill'"></text>
											{{((item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo') && item._WenjianDZLength == 1) ? '' : (item._WenjianDZLength || '..') + ((item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo') ? 'V' : 'P')}} 
											<text class="content-icon" 
												:class="((item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo') && item._WenjianDZLength == 1) ?'tn-icon-video-fill' : 'tn-icon-eye-fill'"
												:style="{marginLeft: ((item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo') && item._WenjianDZLength == 1) ? '0px' : '10rpx'}"></text>
											{{item.Hits}}
										</tn-tag>
									</view>
								</view>
								<view class="item__data">
									<view class="item__title-container">
										<text class="item__title tn-color-purple">{{ item.Biaoti }}</text>
									</view>
									<view class="item__tags-container">
										<!-- v-for="(tagItem, tagIndex) in item.tags" :key="tagIndex" -->
										<view class="item__tag">{{ item.Fenlei }}</view>
										<view class="item__tag">{{ item.NeirongFL }}</view>
									</view>
									<view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding-top-xs">
										<view class="justify-content-item">
											<view class="tn-flex tn-flex-col-center tn-flex-row-left">
												<view class="logo-pic">
													<view class="logo-image">
														<view class=""
															:style="'background-image:url('+ 'https://os.microios.com:1120/jsnzk-public' + item.YulanT +');width: 40rpx;height: 40rpx;background-size: cover;'">
														</view>
													</view>
												</view>
												<view class="tn-padding-left-xs">
													<text class="tn-color-gray tn-text-sm">{{ item.CaijiLYZZ || item.UserName }}</text>
												</view>

											</view>
										</view>
										<view class="justify-content-item">
											<!-- tn-padding-right-xs -->
											<text style="font-size: 36rpx;"
												:class="item._IsFavorite ? 'tn-icon-like-fill tn-color-red' : 'tn-icon-like tn-color-gray'"></text>
											<!-- <text class="tn-color-gray">{{ item.ShoucangL || 0 }}</text> -->
										</view>
									</view>
								</view>
							</view>
						</template>
					</tn-waterfall>
				</view>
				<view style="padding-bottom: 100rpx;padding-top: 100rpx;">
					<tn-load-more :status="loadStatus" :loadText="loadText"></tn-load-more>
				</view>
			</view>

			<view v-if="ContentListFirstLoading" class="">
				<view class="" style="padding: 6vh 20rpx;">
					<view class="tn-text-center" style="font-size: 200rpx;padding-top: 30rpx;">
						<text class="tn-icon-wea-wind tn-color-gray--light"></text>
					</view>
					<view class="tn-color-gray--disabled tn-text-center tn-text-lg">一大波内容正在路上</view>
				</view>
			</view>

			<!-- <view class="" v-if="current==2">
				<view class="" style="padding: 6vh 20rpx;">
					<view class="tn-text-center" style="font-size: 200rpx;padding-top: 30rpx;">
						<text class="tn-icon-wea-wind tn-color-gray--light"></text>
					</view>
					<view class="tn-color-gray--disabled tn-text-center tn-text-lg">Loading...</view>
				</view>
			</view> -->

		</view>
		<!-- </tn-scroll-view> -->
		<view class='tn-tabbar-height'></view>
		<!-- 引用组件 -->
		<tn-skeleton :show="showSkeleton"></tn-skeleton>
	</view>
</template>

<script>
	import {
		mapState
	} from 'vuex'
	export default {
		name: 'PagesA',
		computed: {
			...mapState({
				CurrentUser: function() {
					return this.$MicroiStore.state.CurrentUser;
				},
				IsLogin: function() {
					return this.$MicroiStore.state.IsLogin;
				},
				SysConfig: function() {
					return this.$MicroiStore.state.SysConfig;
				},
			}),

		},
		/**
		 * WeChat下并不会执行
		 */
		onLoad() {
			var self = this;
			
		},
		data() {
			return {
				Microi: this.Microi,
				showSkeleton: true,

				loadText: {
					loadmore: '下拉加载更多内容',
					loading: '下波内容加载中...',
					nomore: '实再是没有了'
				},

				refreshState: false,
				refreshText: '下拉刷新',
				refreshIconRevolve: false,

				FileServer: this.Microi.FileServer,
				IndexShortcutList: [{}, {}, {}, {}],
				DefaultIndexShortcutList: [{}, {}, {}, {}],
				searlist: [
					'输入关键词搜索'
				],
				cardCur: 0,
				swiperList: [{}],
				DefaultSwiperList: [{}],

				current: 0,
				LastCurrent: 0,
				scrollList: [{
						name: '交友广场'//随机
					},
					{
						name: '最新'
					},
					{
						name: '热门'
					}
				],
				ContentListFirstLoading: true,
				/* 瀑布流*/
				loadStatus: 'loadmore', //loading、nomore
				ContentList: [], //{}, {}, {}, {}, {}, {}
				DefaultContentList: [], //{}, {}, {}, {}, {}, {}
				PageIndex: 1,
				PageCount: -1,
				SearchNeirongFL : '',
			}
		},
		created() {
			var self = this
			self.Init();
			// if(self.Microi.ClientType == 'WeChat'){
			// 	self.loadText.nomore += '（下载APP更多）';
			// }
		},
		methods: {
			Init() {
				var self = this;
				self.showSkeleton = true;
				self.swiperList = [...self.DefaultSwiperList];
				self.IndexShortcutList = [...self.DefaultIndexShortcutList];
				self.Microi.ApiEngine.Run('get_slideshow', {}, function(result) {
					if (self.Microi.CheckResult(result)) {
						result.Data.forEach(item => {
							item.image = self.Microi.FileServer + item.Tupian;
						});
						self.swiperList = result.Data;
					}
				})
				self.Microi.ApiEngine.Run('get_index_shortcut', {}, function(result) {
					if (self.Microi.CheckResult(result)) {
						self.IndexShortcutList = result.Data;
					}
					self.showSkeleton = false;
				})

				self.GetContentList({
					ContentListFirstLoading: true
				});
			},
			GetCountStr(count){
				if(!count){
					return 0;
				}
				else if(count < 10000){
					return count;
				}else if(count < 100000){
					return (count / 10000).toFixed(2) + '万';
				}else{
					return (count / 10000).toFixed(1) + '万';
				}
			},
			LunbotuClick(item){
				var self = this;
			},
			ShortcutClick(item){
				var self = this;
				console.log('ShortcutClick - ' + item.DianjiLX + ' - ' + item.ShuaxinCS)
				if(item.DianjiLX == '刷新'){
					self.SearchNeirongFL = item.ShuaxinCS;
					self.GetContentList({
						ContentListFirstLoading: true
					});
				}else{
					self.tn(item.Lianjie)
				}
			},
			GetGG() {
				var self = this;
				return self.SysConfig && self.SysConfig.ShouyeGGYJH;
			},
			GotoShouyeGGYJH() {
				var self = this;
				if (self.SysConfig.ShouyeGGYJHLJ) {
					self.Microi.NavigateTo(self.SysConfig.ShouyeGGYJHLJ);
				}
			},
			// 处理触发刷新事件
			handleRefresh() {
				var self = this;
				this.refreshState = true
				this.refreshText = '正在刷新'
				self.GetContentList({
					ContentListFirstLoading: true
				}, function() {
					self.refreshState = false
					self.resetRefresh()
				});
				setTimeout(() => {

				}, 2000)
			},
			// 处理刷新准备事件
			handleRefreshReady() {
				this.refreshText = '松开刷新'
				this.refreshIconRevolve = true
			},
			// 重置刷新
			resetRefresh() {
				this.refreshText = '下拉刷新'
				this.refreshIconRevolve = false
			},
			GotoDetail(item) {
				var self = this;
				
				var _orderBy = 'Random'; //默认Random
				if (self.current == 1) {
					_orderBy = 'Latest';
				} else if (self.current == 2) {
					_orderBy = 'Hottest';
				} else if (self.current == 0) {
					_orderBy = 'Random';
				}
				var getParam = {
					_SortType: _orderBy
				};
				var urlParam = `?ContentId=${item.Id}&PageType=Detail&SortType=${getParam._SortType}`;
				
				if (item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo') {
					if (self.Microi.ClientType == 'APP') {
						console.log('to ShortVideoAppDetail$')
						// self.tn(`/pageA/nvueSwiper/index${urlParam}`)
						// self.tn('/pageA/nvueSwiper/index_copy?ContentId=' + item.Id, item.Id)
						// uni.switchTab(`/pages/index/component/ShortVideoApp${urlParam}`)
						// self.tn(`/pages/index/component/ShortVideoApp${urlParam}`)
						self.tn(`/pages/index/component/ShortVideoAppDetail${urlParam}`)
					} else if (self.Microi.ClientType == 'H5') {
						// self.tn('/pageA/nvueSwiper/nvueSwiper?ContentId=' + item.Id, item.Id)
						self.tn(`/pages/index/component/ShortVideo${urlParam}`)
					} else if (self.Microi.ClientType == 'WeChat') {
						//微信小程序需要判断是否已有视频资质
						if (self.Microi.SysConfig.MiniProgramVideo) {
							// self.tn('/pageA/nvueSwiper/nvueSwiper?ContentId=' + item.Id, item.Id)
							self.tn(`/pages/index/component/ShortVideo${urlParam}`)
							// self.tn(`/pages/index/component/ShortVideoChunlei${urlParam}`)
						} else {
							self.tn(`/pageA/details/details${urlParam}`)
						}
					}
				} else {
					self.tn(`/pageA/details/details${urlParam}`)
				}
			},
			GetContentList(param, callback) {
				var self = this;
				this.loadStatus = 'loading'
				//如果是首次加载、或整页刷新，将ContentListFirstLoading、PageIndex、PageCount还原为初始值
				if (param && param.ContentListFirstLoading) {
					self.ContentListFirstLoading = true;
					self.PageIndex = 1;
					self.PageCount = -1;
				}
				//如果到了最后一页
				if (self.PageIndex >= self.PageCount && self.PageCount != -1) {
					self.loadStatus = 'nomore'
					return;
				}
				self.ContentList = [...self.DefaultContentList];
				var _orderBy = '';
				if (self.current == 1) {
					_orderBy = 'Latest';
				} else if (self.current == 2) {
					_orderBy = 'Hottest';
				} else if (self.current == 0) {
					_orderBy = 'Random';
				}
				var getParam = {
					_SortType: _orderBy
				};
				if (param && param.PageIndexAdd) {
					self.PageIndex++;
				}
				getParam._PageIndex = self.PageIndex;
				getParam.NeirongFL = self.SearchNeirongFL;
				self.Microi.ApiEngine.Run('get_content_list', getParam, function(result) {
					if (self.Microi.CheckResult(result)) {
						result.Data.forEach(item => {
							item.Hits = self.Microi.GetCountStr(item.Hits);
						});
						self.ContentList = result.Data;
						self.PageCount = result.PageCount;
					}
					self.ContentListFirstLoading = false;
					if (callback) {
						callback();
					}
					if(getParam._PageIndex >= self.PageCount){
						self.loadStatus = 'nomore';
					}
				})
			},
			// cardSwiper
			cardSwiper(e) {
				this.cardCur = e.detail.current
			},
			ClickTabs() {
				var self = this;
				if (self.LastCurrent != self.current) {
					self.LastCurrent = parseInt(self.current)
				} else {
					if(self.current == 0){
						self.SearchNeirongFL = '';
					}
					self.GetContentList({
						ContentListFirstLoading: true
					});
				}
			},
			// tab选项卡切换
			tabChange(index) {
				var self = this;
				self.LastCurrent = parseInt(self.current)
				self.current = index
				if(self.current == 0){
					self.SearchNeirongFL = '';
				}
				self.GetContentList({
					ContentListFirstLoading: true
				});
			},
			// 跳转
			tn(e, id) {
				var self = this;
				if (id) {
					uni.setStorageSync("ContentId", id);
				}
				uni.navigateTo({
					url: e,
				});
			},
			// 瀑布流加载完毕事件
			handleWaterFallFinish() {
				var self = this;
				if(self.PageIndex >= self.PageCount){
					self.loadStatus = 'nomore';
				}else{
					self.loadStatus = 'loadmore'
				}
			}
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
			var self = this;
			if(this.loadStatus != 'loading'){
				self.GetContentList({
					PageIndexAdd : true
				})
			} 
		}
	}
</script>

<style lang="scss" scoped>
	.item__title-container{
		// white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-height: 40rpx;
		.item__title{
			font-size: 26rpx !important;
		}
	}
	.content-type-icon {
		opacity: 0.9;
		position: absolute;
		right: 10rpx;
		top: 10rpx;
		width: auto;
		height: 35rpx;
		z-index: 1;
		line-height: 35rpx;

		.content-icon {
			font-size: 25rpx;
			color: #fff;
			margin-right: 5rpx;
			// box-shadow: 0px 0px 10px 0px #d5d5d5;
		}
	}

	.pages-a {
		max-height: 100vh;
	}


	/* 自定义导航栏内容 start */
	.custom-nav {
		height: 100%;

		&__back {
			margin: auto 5rpx;
			font-size: 50rpx;
			margin-right: 10rpx;
			margin-left: 30rpx;
			flex-basis: 5%;
		}
	}

	/* 底部安全边距 start*/
	.tn-tabbar-height {
		min-height: 120rpx;
		height: calc(140rpx + env(safe-area-inset-bottom) / 2);
		height: calc(140rpx + constant(safe-area-inset-bottom));
	}

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

	/* 轮播视觉差 start */
	.card-swiper {
		height: 330rpx !important;
	}

	.card-swiper swiper-item {
		width: 750rpx !important;
		left: 0rpx;
		box-sizing: border-box;
		padding: 40rpx 30rpx 30rpx 30rpx;
		overflow: initial;
	}

	.card-swiper swiper-item .swiper-item {
		width: 100%;
		display: block;
		height: 100%;
		border-radius: 15rpx;
		transform: scale(1);
		transition: all 0.2s ease-in 0s;
		will-change: transform;
		// overflow: hidden;
		background-position: center center;
	}

	.card-swiper swiper-item.cur .swiper-item {
		transform: none;
		transition: all 0.2s ease-in 0s;
		will-change: transform;
	}

	.card-swiper swiper-item .swiper-item-text {
		margin-top: -220rpx;
		text-align: center;
		width: 100%;
		display: block;
		border-radius: 10rpx;
		transform: translate(100rpx, 0rpx) scale(0.9, 0.9);
		transition: all 0.6s ease 0s;
		will-change: transform;
		overflow: hidden;
	}

	.card-swiper swiper-item.cur .swiper-item-text {
		margin-top: -220rpx;
		width: 100%;
		transform: translate(0rpx, 0rpx) scale(0.9, 0.9);
		transition: all 0.6s ease 0s;
		will-change: transform;
	}

	.image-banner {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.image-banner image {
		width: 100%;
		height: 100%;
	}

	/* 轮播指示点 start*/
	.indication {
		z-index: 9999;
		width: 100%;
		height: 36rpx;
		position: absolute;
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
	}

	.spot {
		background-color: #FFFFFF;
		opacity: 0.6;
		width: 10rpx;
		height: 10rpx;
		border-radius: 20rpx;
		top: -70rpx;
		margin: 0 8rpx !important;
		position: relative;
	}

	.spot.active {
		opacity: 1;
		width: 30rpx;
		background-color: #FFFFFF;
	}


	/* 胶囊banner*/
	.image-capsule {
		padding: 100rpx 0rpx;
		font-size: 40rpx;
		font-weight: 300;
		position: relative;
	}

	.image-piccapsule {
		background-size: cover;
		background-repeat: no-repeat;
		// background-attachment:fixed;
		background-position: top;
		border-radius: 20rpx 20rpx 0 0;
	}

	/* 用户头像 start */
	.logo-image {
		width: 40rpx;
		height: 40rpx;
		position: relative;
	}

	.logo-pic {
		background-size: cover;
		background-repeat: no-repeat;
		// background-attachment:fixed;
		background-position: top;
		border: 1rpx solid rgba(255, 255, 255, 0.05);
		// box-shadow: 0rpx 0rpx 80rpx 0rpx rgba(0, 0, 0, 0.15);
		border-radius: 50%;
		overflow: hidden;
		// background-color: #FFFFFF;
	}

	/* 瀑布流*/
	.wallpaper__item {
		background-color: #FFFFFF;
		overflow: hidden;
		margin: 0 10rpx;
		margin-bottom: 20rpx;
		// box-shadow: 0rpx 0rpx 30rpx 0rpx rgba(0, 0, 0, 0.07);

		.item {

			/* 图片 start */
			&__image {
				width: 100%;
				height: auto;
				background-color: #FFFFFF;
				border: 1rpx solid #F8F7F8;
				border-radius: 10rpx;
				overflow: hidden;
			}

			/* 图片 end */

			/* 内容 start */
			&__data {
				padding: 14rpx 0rpx;
			}

			/* 标题 start */
			&__title-container {
				text-align: justify;
				line-height: 38rpx;
				vertical-align: middle;
			}

			&__title {
				font-size: 30rpx;
			}

			/* 标题 end */

			/* 标签 start */
			&__tags-container {
				display: flex;
				flex-direction: row;
				flex-wrap: nowrap;
				align-items: center;
				justify-content: flex-start;
			}

			&__tag {
				margin: 10rpx;
				color: #7C8191;
				background-color: #F3F2F7;
				padding: 4rpx 14rpx 6rpx;
				border-radius: 10rpx;
				font-size: 20rpx;

				&:first-child {
					margin-left: 0rpx !important;
				}
			}

			/* 标签 end */

			/* 内容 end */
		}
	}
</style>