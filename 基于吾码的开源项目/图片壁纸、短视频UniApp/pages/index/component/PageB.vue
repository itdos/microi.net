<template>
	<view class="page-b">
		<tn-popup v-model="ShowSort" mode="top">
			<view style="height: 400rpx;">
				<!-- <tn-select mode="single" v-model="ShowSort" :list="SortTextArr"></tn-select> -->
				
			</view>
		</tn-popup>
		<!-- <tn-picker v-model="ShowSort" mode="selector" :defaultSelector="[0]" :range="SortTextArr" range-key="label"></tn-picker> -->
		<!-- 顶部自定义导航 -->
		<tn-nav-bar :isBack="false" :bottomShadow="false" backgroundColor="#FFFFFF">
			<view class="custom-nav tn-flex tn-flex-col-center tn-flex-row-left">
				<view class="custom-nav__back" @click="tn('/pageA/navigation/navigation')">
					<view class="tn-icon-deploy"></view>
				</view>
				<view class="tn-margin-top"
					style="text-shadow:  1rpx 0 0 #FFF, 0 1rpx 0 #FFF, -1rpx 0 0 #FFF , 0 -1rpx 0 #FFF;">
					<tn-tabs :list="scrollList" :current="current" @change="tabChange" activeColor="#000" :bold="true"
						:fontSize="36"></tn-tabs>
				</view>
			</view>
		</tn-nav-bar>

		<view class="tn-classify__wrap" :style="{paddingTop: vuex_custom_bar_height + 'px'}">

			<!-- 搜索框 -->
			<view class="tn-classify__search--wrap" style="padding-bottom: 0rpx;" v-show="false">
				<view class="tn-color-gray--dark"
					style="margin: 20rpx 30rpx 0rpx 30rpx;border-radius: 100rpx;padding-left: 6rpx;background-color: rgba(248, 247, 248, 0.9);"
					@click="tn('/pageA/search/search')">
					<tn-notice-bar :list="searlist" mode="vertical" leftIconName="search"
						:duration="6000"></tn-notice-bar>
				</view>
			</view>

			<!-- 分类列表和内容 -->
			<view class="tn-classify__container">
				<view class="tn-classify__container__wrap tn-flex tn-flex-nowrap tn-flex-row-around tn-bg-white">
					<!-- 左边容器 -->
					<scroll-view class="tn-classify__left-box left-width" :scroll-top="leftScrollViewTop" scroll-y
						scroll-with-animation :style="{height: scrollViewHeight + 'px'}">
						<view class="tn-classify__tabbar__item tn-flex tn-flex-col-center tn-flex-row-center"
							:class="[tabbarItemClass(0)]" @tap.stop="clickClassifyNav(0)">
							<view class="tn-classify__tabbar__item__title">全 部</view>
						</view>
						<!--  -->
						<view v-for="(item, index) in FenleiList" :key="item.Id" :id="`tabbar_item_${index + 1}`"
							class="tn-classify__tabbar__item tn-flex tn-flex-col-center tn-flex-row-center"
							:class="[tabbarItemClass(index + 1)]" @tap.stop="clickClassifyNav(index + 1, item)"
							style="display: block;text-align: center;"
							>
							<!--  -->
							<!--  -->
							<view class="tn-classify__tabbar__item__title" 
								style="padding-bottom: 2rpx;font-size: 26rpx;"
								:style="{ paddingTop: item.NeirongZS && Microi.ClientType == 'WeChat' ? '25rpx' : '40rpx'}"
								>
								{{ item.Mingcheng }}
								<!--第五种方式-->
								<!-- <tn-badge>
									99
									<slot>{{ item.Mingcheng }}</slot>
								</tn-badge> -->
							</view>
							<!--第四种方式-->
							<!-- style="width: 82rpx;padding: 0 4rpx;"
							<tn-badge v-if="item.NeirongZS" 
								backgroundColor="#01BEFF" fontColor="#FFFFFF" :absolute="true" :translateCenter="false"
								:top="'10rpx'"
								:right="'5rpx'"
								
								>
							  <text>{{Microi.GetCountStr(item.NeirongZS)}}</text>
							</tn-badge> -->
							<view class="bg-image-50-view" v-if="item.NeirongZS" style="display: block;color:#999;font-size: 20rpx;">
								<!-- <text class="tn-icon-camera-fill"></text> -->
								<text>{{Microi.GetCountStr(item.NeirongZS)}}条</text>
								<!--第二种方式-->
								<!-- <tn-tag size="sm" shape="circle" style="">
									<text>APP</text>
									<text>{{Microi.GetCountStr(item.NeirongZS)}}</text>
								</tn-tag> -->
								<!--第三种方式-->
								<!-- <view class="capsule">
									<tn-tag size="sm" class="capsule-tag" padding="0" shape="circleLeft" backgroundColor="#01BEFF" fontColor="#FFFFFF" :plain="false">
									  APP
									</tn-tag>
									<tn-tag size="sm" class="capsule-tag" padding="0" shape="circleRight" backgroundColor="#01BEFF" fontColor="#080808" :plain="true">
									  {{Microi.GetCountStr(item.NeirongZS)}}
									</tn-tag>
								</view> -->
							</view>
						</view>
					</scroll-view>

					<!-- 右边容器 -->
					<scroll-view class="tn-classify__right-box tn-skeleton" scroll-y :scroll-top="rightScrollViewTop"
						:style="{height: scrollViewHeight + 'px'}"
						@scroll="ContentOnScroll"
						>
						<block>
							<view class="tn-classify__content" @click="tn('/preferredPages/product')">

								<!-- 推荐壁纸轮播图，有需要直接显示出来即可 -->
								<!-- <view class="tn-classify__content__recomm">
									<tn-swiper v-if="classifyContent.recommendProduct.length > 0"
										class="tn-classify__content__recomm__swiper"
										:list="classifyContent.recommendProduct" :height="100" :effect3d="true"
										mode=""></tn-swiper>
								</view> --> 

								<!-- 分类内容子栏目 -->

								<view class="tn-classify__content__sub-classify">
									<view
										class="tn-classify__content__sub-classify--title tn-text-lg"
										style="padding-right: 10rpx;color: #3668FC;margin-bottom: 10rpx;">
										<!-- <tn-tag shape="circle" backgroundColor="tn-cool-bg-color-7"
											fontColor="tn-color-white" width="170rpx" padding="0 16rpx">
											{{currentTabbarObj.Mingcheng || '全 部'}}
										</tn-tag> -->
										<!-- <view style="float: left;font-size: 26rpx !important;">
											<tn-tag
												style="font-size: 26rpx;"
												shape="circle" 
												size="lg" 
												height="35rpx"
												width="auto"
												backgroundColor="tn-dynamic-bg-1" 
												fontColor="tn-color-white">
												<text class="content-icon"
													style="padding-right: 10rpx;"
													:class="'tn-icon-camera-fill'"
														></text>
												{{ DataCount == -1 ? '..' : DataCount }}
												<text class="content-icon"
													:class="'tn-icon-video-fill'"
													style="padding-left: 20rpx;padding-right: 10rpx;"
														></text>
												{{ 0 }}
											</tn-tag>
										</view> -->
										<!-- <view style="float: right;" @tap="ShowSort = true;">
											{{ SortText }} <text class="tn-icon-sequence-vertical" style="padding-left: 5rpx;"></text>
										</view>
										<view style="clear: both;"></view> -->
										<view>
											<!-- <tn-tabs :list="SortTextArr" :isScroll="true" :current="CurrentSortText" name="label" @change="ChangeSort"></tn-tabs> -->
											<!-- #ifdef MP-WEIXIN -->
											<tn-subsection :list="SortTextArr2" mode="button" :borderRadius="50" @change="ChangeSort"></tn-subsection>
											<!-- #endif -->
											<!-- #ifndef MP-WEIXIN -->
											<tn-tabs :list="SortTextArr" :isScroll="false" :current="CurrentSortIndex" name="label" @change="ChangeSort"></tn-tabs> 
											<!-- #endif -->
										</view>
									</view> 
									<view
										class="tn-classify__content__sub-classify__content tn-flex tn-flex-wrap tn-flex-col-center tn-flex-row-left">
										<!-- tn-skeleton-fillet -->
										<view v-for="(item,index) in ContentList" :key="item.Id"
											class="tn-classify__content__sub-classify__content__item tn-flex tn-flex-wrap tn-flex-row-center " style="margin-bottom: 15rpx;">
											<view class="tn-skeleton-fillet tn-classify__content__sub-classify__content__image tn-flex tn-flex-col-center tn-flex-row-center"
												@click="GotoDetail(item)" 
												style="position: relative;">

												<image  v-if="item.Id" 
													:src="Microi.FileServer + item.YulanT" mode="aspectFill"></image>
												<!-- <tn-lazy-load v-if="item.Id" :threshold="6000" height="100%" 
													:image="Microi.FileServer + item.YulanT"
													imgMode="aspectFill"
													></tn-lazy-load> -->

												<view class="content-type-icon" v-if="item.Id">
													<view class="content-type-icon">
														<tn-tag
															shape="circle" 
															size="sm" 
															height="35rpx"
															width="auto"
															backgroundColor="tn-dynamic-bg-1" 
															fontColor="tn-color-white">
															<text class="content-icon"
																v-if="!((item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo') && item._WenjianDZLength == 1)"
																:class="(item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo')
																	? 'tn-icon-video-fill' : 'tn-icon-image-fill'"
																	></text>
															{{((item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo') && item._WenjianDZLength == 1) ? '' : (item._WenjianDZLength || '..') + ((item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo') ? 'V' : 'P')}} 
															<text class="content-icon"
																:class="((item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo') && item._WenjianDZLength == 1) ?'tn-icon-video-fill' : 'tn-icon-eye-fill'"
																:style="{marginLeft: ((item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo') && item._WenjianDZLength == 1) ? '0px' : '10rpx'}"
																	></text>
															{{Microi.GetCountStr(item.Hits)}}
														</tn-tag>
													</view>
												</view>

											</view>
											<!-- 标题，有需要可以显示出来 -->
											<!-- tn-margin-bottom-sm -->
											<view
												class="tn-skeleton-fillet tn-color-purple tn-classify__content__sub-classify__content__title tn-margin-top-xs"
												style="width:100%;height:40rpx;">
												{{ item.Biaoti || '' }}
											</view>
											<view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding-top-xs" style="max-width: calc(100% - 10rpx);width: calc(100% - 10rpx);margin-right: 10rpx;">
												<view class="justify-content-item" style="max-width: calc(100% - 36rpx);overflow: hidden;">
													<view class="tn-flex tn-flex-col-center tn-flex-row-left">
														<view class="logo-pic">
															<view class="logo-image">
																<view class="tn-skeleton-circle"
																	:style="'background-image:url('+ Microi.FileServer + item.YulanT +');width: 40rpx;height: 40rpx;background-size: cover;border-radius: 50%;'">
																</view>
															</view>
														</view>
														<view 
														class="tn-padding-left-xs tn-skeleton-fillet" 
														style="white-space: nowrap;overflow: hidden;text-overflow: ellipsis;">
															<text class="tn-color-gray tn-text-sm">{{ item.CaijiLYZZ || item.UserName }}</text>
														</view>
											
													</view>
												</view>
												<view class="justify-content-item" style="overflow: hidden;">
													<!-- tn-padding-right-xs -->
													<text style="font-size: 32rpx;"
												:class="item._IsFavorite ? 'tn-icon-like-fill tn-color-red' : 'tn-icon-like tn-color-gray'"></text>
													<!-- <text class="tn-color-gray">{{ item.ShoucangL || 0 }}</text> -->
												</view>
											</view>
										</view>
									</view>
								</view>
							</view>

						</block>
						<view @tap="ClickLoadMore()"
							style="padding-bottom: 300rpx;padding-top: 50rpx;">
							<tn-load-more  :status="loadStatus" :loadText="loadText"></tn-load-more>
						</view>
						<!-- <view class='tn-tabbar-height'></view> -->
						<!-- <view style="height: 100rpx;width: 100%;"></view> -->
					</scroll-view>
				</view>
			</view>
		</view>
		<!-- 引用组件 -->
		<tn-skeleton :show="showSkeleton"></tn-skeleton>
		
	</view> 

</template>

<script>
	export default {
		name: 'templateShopClassify',
		data() {
			return {
				Microi: this.Microi,
				ShowSort : false,
				SortTextArr2:['最新', '热门', '随机', '收藏', '下载', '最早'],
				SortTextArr:[{ value : '', label : '最新' }, 
							 { value : 'Hottest', label : '热门' }, 
							 { value : 'Random', label : '随机' }, 
							 { value : 'Favorite', label : '收藏' }, 
							 { value : 'Download', label : '下载' }, 
							 { value : 'Earliest', label : '最早' }, 
								],
				SortText : '最新发布',//最多浏览、最多收藏
				CurrentSortText : '最新',
				CurrentSortIndex : 0,
				showSkeleton: true,
				searlist: [
					'输入关键词搜索',
				],
				
				
				
				loadText: {
					loadmore: '下拉加载更多内容',
					loading: '下波内容加载中...',
					nomore: '实再是没有了'
				},
				
				current: 0,
				scrollList: [{
						name: '交友广场'//分类
					},
					{
						name: '图片'
					},
					// {
					// 	name: '视频'
					// }
				],
				// 侧边栏分类数据
				FenleiList: [],
				// 分类里面的内容信息
				ContentList: [{}, {}, {}, {}, {}, {}, {}, {}],
				DefaultContentList: [{}, {}, {}, {}, {}, {}, {}, {}],
				// 分类菜单item的信息
				tabbarItemInfo: [],
				// scrollView的top值
				scrollViewBasicTop: 0,
				// scrollView的高度
				scrollViewHeight: 0,
				// 左边scrollView的滚动高度
				leftScrollViewTop: 0,
				// 右边scrollView的滚动高度
				rightScrollViewTop: 0,
				// 当前选中的tabbar序号
				currentTabbarIndex: 0,
				currentTabbarObj: {},
				
				PageIndex : 1,
				PageCount : -1,
				DataCount : -1,
				
				loadStatus: 'loadmore',//loading、nomore
				ScrollLoading : false,
			}
		},
		computed: {
			tabbarItemClass() {
				return index => {
					if (index === this.currentTabbarIndex) {
						return 'tn-classify__tabbar__item--active tn-bg-white'
					} else {
						let clazz = 'tn-bg-gray--light'
						if (this.currentTabbarIndex > 0 && index === this.currentTabbarIndex - 1) {
							clazz += ' tn-classify__tabbar__item--active--prev'
						}
						if (this.currentTabbarIndex < this.FenleiList.length && index === this.currentTabbarIndex +
							1) {
							clazz += ' tn-classify__tabbar__item--active--next'
						}
						return clazz
					}
				}
			}
		},
		mounted() {
			var self = this;
			self.Microi.ApiEngine.Run('get_fenlei', {}, function(result) {
				if (self.Microi.CheckResult(result)) {
					self.FenleiList = result.Data;
					// self.currentTabbarObj = result.Data[0];
					self.GetContentList();
				}
			})
			this.$nextTick(() => {
				this.getScrollViewInfo()
				// this.getTabbarItemRect()
			})
			
			if(self.Microi.SysConfig.MiniProgramVideo 
				|| self.Microi.ClientType != 'WeChat'
				){
				self.scrollList.push({
					name : '视频'
				});
			}
		},
		methods: {
			ChangeSort(select){
				var self = this;
				if(typeof(select) == 'object'){
					self.CurrentSortText = select.name;
				}else{
					self.CurrentSortIndex = select;
					self.CurrentSortText = self.SortTextArr[select].label;
				}
				self.GetContentList();
			},
			// tab选项卡切换
			tabChange(index) {
				var self = this;
				self.current = index
				self.GetContentList();
			},
			ContentOnScroll(event){
				var self = this
				const { scrollTop, scrollHeight, clientHeight } = event.detail
				// 计算是否滚动到底部
				//scrollViewHeight
				if (scrollTop + self.scrollViewHeight >= scrollHeight - 100 && !self.ScrollLoading) {
					self.ScrollLoading = true;
					// 滚动到底部触发的逻辑
					self.ClickLoadMore();
				}
			},
			ClickLoadMore(){
				var self = this;
				self.GetContentList({
					PageIndexAdd : true
				})
			},
			GotoDetail(item) {
				var self = this;
				var getParam = {
					
					NeirongFL: self.currentTabbarObj.Key || ''
				};
				var _orderBy = 'Latest'; //默认Latest
				if (self.CurrentSortText == '最新') {
					_orderBy = 'Latest';//Latest
				} else if (self.CurrentSortText == '最早') {
					_orderBy = 'Earliest';
				}else if (self.CurrentSortText == '浏览' || self.CurrentSortText == '热门') {
					_orderBy = 'Hottest';
				}else if (self.CurrentSortText == '收藏') {
					_orderBy = 'Favorite';
				}else if (self.CurrentSortText == '下载') {
					_orderBy = 'Download';
				}
				else if (self.CurrentSortText == '随机') {
					_orderBy = 'Random';
				}
				
				getParam._SortType = _orderBy;
				
				var urlParam = `?ContentId=${item.Id}&PageType=Detail&SortType=${getParam._SortType}&NeirongFL=${getParam.NeirongFL}`;
				
				if(item.Fenlei == 'Video' || item.Fenlei == 'ShortVideo'){
					if(self.Microi.ClientType == 'APP'){
						console.log('to ShortVideoAppDetail$')
						// self.tn('/pageA/nvueSwiper/index?ContentId=' + item.Id, item.Id)
						// self.tn(`/pages/index/component/ShortVideoApp?ContentId=${item.Id}&PageType=Detail&SortType=${getParam._SortType}&NeirongFL=${getParam.NeirongFL}`)
						self.tn(`/pages/index/component/ShortVideoAppDetail${urlParam}`)
					}
					else if(self.Microi.ClientType == 'H5'){
						// self.tn('/pageA/nvueSwiper/nvueSwiper?ContentId=' + item.Id, item.Id)
						// self.tn(`/pages/index/component/ShortVideo?ContentId=${item.Id}&PageType=Detail&SortType=${getParam._SortType}&NeirongFL=${getParam.NeirongFL}`)
						self.tn(`/pages/index/component/ShortVideo${urlParam}`)
					}
					else if(self.Microi.ClientType == 'WeChat'){
						//微信小程序需要判断是否已有视频资质
						if(self.Microi.SysConfig.MiniProgramVideo){
							// self.tn('/pageA/nvueSwiper/nvueSwiper?ContentId=' + item.Id, item.Id)
							// self.tn(`/pages/index/component/ShortVideo?ContentId=${item.Id}&PageType=Detail&SortType=${getParam._SortType}&NeirongFL=${getParam.NeirongFL}`)
							self.tn(`/pages/index/component/ShortVideo${urlParam}`)
						}else{
							self.tn(`/pageA/details/details${urlParam}`)
						}
					}
				}else {
					self.tn(`/pageA/details/details${urlParam}`)
				}
			},
			GetContentList(param, callback) {
				var self = this;
				var isPushContent = false;
				if(param && param.PageIndexAdd){
					self.PageIndex++;
					isPushContent = true;
				}else{
					self.showSkeleton = true;
					self.PageIndex = 1;
					self.PageCount = -1;
					self.ContentList = [...self.DefaultContentList];
				}
				if(self.PageIndex > self.PageCount && self.PageCount != -1){
					self.loadStatus = 'nomore'
					self.ScrollLoading = false;
					return; 
				}
				self.loadStatus = 'loading'
				// var _orderBy = '';
				// if (self.current == 1) {
				// 	_orderBy = 'Latest';
				// } else if (self.current == 2) {
				// 	_orderBy = 'Hottest';
				// }
				var getParam = {
					NeirongFL: self.currentTabbarObj.Key || ''
				};
				getParam._PageIndex = self.PageIndex;
				getParam._PageIndex = self.PageIndex;
				if(self.current == 1){
					getParam.Fenlei = 'Image';
				}else if(self.current == 2){
					getParam.FenleiList = ['Video', 'ShortVideo'];
				}
				var _orderBy = ''; //默认Latest
				if (self.CurrentSortText == '最新') {
					_orderBy = '';//Latest
				} else if (self.CurrentSortText == '最早') {
					_orderBy = 'Earliest';
				}else if (self.CurrentSortText == '浏览' || self.CurrentSortText == '热门') {
					_orderBy = 'Hottest';
				}else if (self.CurrentSortText == '收藏') {
					_orderBy = 'Favorite';
				}else if (self.CurrentSortText == '下载') {
					_orderBy = 'Download';
				}
				else if (self.CurrentSortText == '随机') {
					_orderBy = 'Random';
				}
				
				getParam._SortType = _orderBy;
				self.Microi.ApiEngine.Run('get_content_list', getParam, function(result) {
					if (self.Microi.CheckResult(result)) {
						self.PageCount = result.PageCount;
						self.DataCount = result.DataCount;
						
						if(!isPushContent){
							self.ContentList = result.Data;
						}else{
							result.Data.forEach(item => {
								self.ContentList.push(item);
							});
						}
					}
					if (callback) {
						callback();
					}
					if(getParam._PageIndex >= self.PageCount){
						self.loadStatus = 'nomore';
					}else{
						self.loadStatus = 'loadmore';
					}
					self.ScrollLoading = false;
					// self.showSkeleton = false;
				})
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

			// 获取scrollView的高度信息
			getScrollViewInfo() {
				// 获取搜索栏的bottom信息，然后用整个屏幕的可用高度减去bottom的值即可获取scrollView的高度(防止双重滚动)
				this._tGetRect('.tn-classify__search--wrap').then((rect) => {
					// 如果获取失败重新获取
					if (!rect) {
						setTimeout(() => {
							this.getScrollViewInfo()
						}, 10)
						return
					}
					// 获取当前屏幕的可用高度
					const systemInfo = uni.getSystemInfoSync()
					this.scrollViewBasicTop = systemInfo.statusBarHeight + rect.bottom + uni.upx2px(10)
					this.scrollViewHeight = systemInfo.safeArea.height + systemInfo.statusBarHeight - rect.bottom -
						uni.upx2px(10) - 49
				})
			},
			// 获取分类菜单每个item的信息
			getTabbarItemRect() {
				let view = uni.createSelectorQuery().in(this)
				for (let i = 0; i < this.FenleiList.length; i++) {
					view.select('#tabbar_item_' + i).boundingClientRect()
				}
				view.exec(res => {
					if (!res.length) {
						setTimeout(() => {
							this.getTabbarItemRect()
						}, 10)
						return
					}

					// 将每个分类item的相关信息
					res.map((item) => {
						this.tabbarItemInfo.push({
							top: item.top,
							height: item.height
						})
					})
				})
			},
			// 点击了分类导航
			clickClassifyNav(index, item) {
				var self = this;
				if (this.currentTabbarIndex === index) {
					return
				}
				this.currentTabbarIndex = index
				this.currentTabbarObj = item || {};
				self.GetContentList();
				// this.handleLeftScrollView(index)
				this.switchClassifyContent()
			},
			// 点击分类后，处理scrollView滚动到居中位置
			handleLeftScrollView(index) {
				const tabbarItemTop = this.tabbarItemInfo[index].top - this.scrollViewBasicTop
				if (tabbarItemTop > this.scrollViewHeight / 2) {
					this.leftScrollViewTop = tabbarItemTop - (this.scrollViewHeight / 2) + this.tabbarItemInfo[index]
						.height
				} else {
					this.leftScrollViewTop = 0
				}
			},
			// 切换对应分类的数据
			switchClassifyContent() {
				this.rightScrollViewTop = 1
				this.$nextTick(() => {
					this.rightScrollViewTop = 0
				})
				// this.classifyContent.subClassify[0].title = this.tabbar[this.currentTabbarIndex]
			}
		}
	}
</script>

<style lang="scss" scoped>
	// .bg-image-50-view{
	// 	/deep/ .tn-tag-class{
	// 		background-image: linear-gradient(to right, #d5d5d5 50%, transparent 50%);
	// 	}
	// }
	.logo-image {
		width: 40rpx;
		height: 40rpx;
		position: relative;
		border-radius: 50%;
	}
	.tn-classify__content__sub-classify__content__title{
		font-size: 26rpx !important;
		overflow: hidden;
		text-overflow: ellipsis;
		max-height: 40rpx;
		text-align: left;
		width:100%;
	}
	.content-type-icon{
		opacity: 0.9;
		position: absolute;
		right: 6rpx;
		top: 5rpx;
		width: auto;
		height: 35rpx;
		z-index: 1;
		line-height: 35rpx;
		.content-icon{
			font-size: 25rpx;color: #fff;
			margin-right: 5rpx;
			// box-shadow: 0px 0px 10px 0px #d5d5d5;
		}
	}

	.page-b {
		max-height: 100vh;
		overflow: hidden;
	}

	/* 自定义导航栏内容 start */
	.custom-nav {
		height: 100%;

		&__back {
			// margin: auto 30rpx;
			// margin-right: 10rpx;
			// flex-basis: 5%;
			// width: 100rpx;
			// position: absolute;
			
			margin: auto 5rpx;
			font-size: 50rpx;
			margin-right: 10rpx;
			margin-left: 30rpx;
			flex-basis: 5%;
		}
	}


	.left-width {
		flex-basis: 28%;
		font-size: 26rpx;
	}

	/* 自定义导航栏内容 end */
	.tn-classify {

		/* 搜索栏 start */
		&__search {
			&--wrap {}

			&__box {
				flex: 1;
				text-align: center;
				padding: 20rpx 30rpx;
				margin: 0 30rpx;
				border-radius: 60rpx;
				font-size: 30rpx;
			}

			&__icon {
				padding-right: 10rpx;
			}

			&__text {
				padding-right: 10rpx;
			}
		}

		/* 搜索栏 end */

		/* 分类列表和内容 strat */
		&__container {}

		&__left-box {}

		&__right-box {
			background-color: #FFFFFF;
		}

		/* 分类列表和内容 end */

		/* 侧边导航 start */
		&__tabbar {
			&__item {
				height: 110rpx;

				&:first-child {
					border-top-right-radius: 0rpx;
				}

				&:last-child {
					border-bottom-right-radius: 0rpx;
				}

				&--active {
					background-color: #FFFFFF;
					position: relative;
					// font-weight: bold;
					color: #3668FC;

					&::before {
						content: '';
						position: absolute;
						width: 12rpx;
						height: 40rpx;
						top: 50%;
						left: 0;
						background-color: #3668FC;
						border-radius: 12rpx;
						transform: translateY(-50%) translateX(-50%);
					}

					&--prev {
						border-bottom-right-radius: 26rpx;
					}

					&--next {
						border-top-right-radius: 26rpx;
					}
				}
			}
		}

		/* 侧边导航 end */

		/* 分类内容 start */
		&__content {
			margin: 18rpx;

			/* 推荐商品 start */
			&__recomm {
				margin-bottom: 40rpx;

				&__swiper {}
			}

			/* 推荐商品 end */

			/* 子栏目 start */
			&__sub-classify {
				margin-bottom: 20rpx;
				padding-bottom: 40rpx;

				&--title {
					// font-weight: bold;
					margin-bottom: 18rpx;
					font-size: 28rpx;
				}

				&__content {

					&__item {
						width: 50%;
					}

					&__image {
						background-color: rgba(188, 188, 188, 0.1);
						border-radius: 10rpx;
						margin: 10rpx 10rpx 0 10rpx;
						margin-left: 0;
						width: 100%;
						height: 340rpx;
						overflow: hidden;
						border: 1rpx solid rgba(0, 0, 0, 0.02);

						image {
							width: 100%;
							height: 340rpx;
						}
					}

					&__title {
						margin-right: 10rpx;
					}
				}
			}

			/* 子栏目 end */
		}

		/* 分类内容 end */
	}
</style>