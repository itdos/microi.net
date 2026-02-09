<template>
	<view class="news tn-safe-area-inset-bottom">

		<swiper class="card-swiper" :circular="true" :autoplay="true" duration="500" interval="18000"
			@change="cardSwiper">
			<swiper-item v-for="(item,index) in LunbotuList" :key="index" :class="cardCur==index?'cur':''">
				<view class="swiper-item image-banner">
					<!-- v-if="item.type=='image'" -->
					<image :src="Microi.FileServer + item.Tupian" mode="aspectFill" ></image>
				</view>
				<view class="tn-text-df tn-text-bold tnloukong">{{item.Biaoti}}</view>
				<view class="swiper-item-text">
					<view class="tn-text-lg tn-text-bold tn-color-white">{{item.FubiaoT}}</view>
				</view>
			</swiper-item>
		</swiper>
		<view class="indication">
			<block v-for="(item,index) in LunbotuList" :key="index">
				<view class="spot" :class="cardCur==index?'active':''"></view>
			</block>
		</view>

		<view class="" style="padding-bottom: 60rpx;margin-top: -100rpx;z-index: 999; position: relative;">
			<!-- 不建议写时间，因为写了时间，你就要经常更新文章了鸭-->
			<view class="">
				<block v-for="(item, index) in NewsList" :key="index">
					<view class="article-shadow tn-margin tn-bg-white" @click="tn('/newsPages/article?Id=' + item.Id)">
						<view class="tn-flex">

							<view class="tn-margin-sm tn-padding-top-xs" style="width: 100%;">
								<view class="tn-text-lg tn-text-bold clamp-text-1 tn-text-justify">
									<text class="">{{ item.Biaoti || '' }}</text>
								</view>
								<view class="tn-padding-top-xs" style="min-height: 90rpx;">
									<text class="tn-text-df tn-color-gray clamp-text-2 tn-text-justify">
										{{ item.Zhaiyao || '' }}
									</text>
								</view>
								<view class="tn-flex tn-flex-row-between tn-flex-col-between tn-margin-top-sm">
									<!-- <view v-for="(label_item,label_index) in item.label" :key="label_index"
										class="justify-content-item tn-tag-content__item tn-margin-right tn-text-sm tn-text-bold">
										<text class="tn-tag-content__item--prefix">#</text> {{ label_item }}
									</view> -->
									<view class="justify-content-item tn-color-gray tn-text-center"
										style="padding-top: 5rpx;">
										<!-- <text class="tn-icon-rocket tn-padding-right-xs tn-text-lg"></text> -->
										<text class="tn-icon-eye tn-padding-right-xs tn-text-lg"></text>
										<text class="tn-padding-right tn-text-df">{{ item.LiuliangL || 0 }}</text>
										<!-- <text class="tn-icon-like-lack tn-padding-right-xs tn-text-lg"></text>
										<text class="tn-text-df">{{ item.likeCount }}</text> -->
									</view>
								</view>
							</view>
							<view class="image-pic tn-margin-sm"
								:style="'background-image:url(' + Microi.FileServer + item.YulanT + ')'">
								<view class="image-article">
								</view>
							</view>
						</view>
					</view>
				</block>

			</view>



			<!-- 三图图文 -->
			<view class="" v-if="false">
				<block v-for="(item,index) in news3" :key="index">
					<view class="article-shadow tn-margin" @click="tn('/newsPages/article')">
						<view class="" style="padding: 15rpx 10rpx 0 10rpx;">
							<tn-grid hoverClass="none" :col="3">
								<block v-for="(image_item,image_index) in item.mainImage" :key="image_index">
									<view class="" style="width: 33.3%;">
										<view class="image-pic tn-margin-xs"
											:style="'background-image:url(' + image_item + ')'">
											<view class="image-article">
											</view>
										</view>
										<!-- <image
                      class="blogger__main-image blogger__main-image--3"
                      :src="image_item"
                      mode="aspectFill"
                    ></image> -->
									</view>
								</block>
							</tn-grid>
						</view>


						<view class="tn-margin-sm tn-padding-bottom-sm">
							<view class="tn-text-lg tn-text-bold clamp-text-1 tn-text-justify">
								<text class="">{{ item.title }}</text>
							</view>
							<!-- <view class="tn-padding-top-xs" style="min-height: 90rpx;">
                <text class="tn-text-df tn-color-gray clamp-text-2 tn-text-justify">
                  {{ item.desc }}
                </text>
              </view> -->
							<view class="tn-flex tn-flex-row-between tn-flex-col-between tn-margin-top-sm">
								<view v-for="(label_item,label_index) in item.label" :key="label_index"
									class="justify-content-item tn-tag-content__item tn-margin-right tn-text-sm tn-text-bold">
									<text class="tn-tag-content__item--prefix">#</text> {{ label_item }}
								</view>
								<view class="justify-content-item tn-color-gray tn-text-center"
									style="padding-top: 5rpx;">
									<text class="tn-icon-rocket tn-padding-right-xs tn-text-lg"></text>
									<text class="tn-padding-right tn-text-df">{{ item.collectionCount }}</text>
									<text class="tn-icon-like-lack tn-padding-right-xs tn-text-lg"></text>
									<text class="tn-text-df">{{ item.likeCount }}</text>
								</view>
							</view>
						</view>
					</view>

				</block>
			</view>


			<view v-if="false" class="">

				<block v-for="(item,index) in news2" :key="index">
					<view class="article-shadow tn-margin tn-padding-sm" @click="tn('/newsPages/article')">
						<view class="image-pic" :style="'background-image:url(' + item.userAvatar + ')'">
							<view class="image-design">
							</view>
						</view>
						<view class="tn-margin-top tn-padding-bottom-sm">
							<view class="tn-text-lg tn-text-bold clamp-text-1 tn-text-justify">
								<text class="">{{ item.title }}</text>
							</view>
							<!-- <view class="tn-padding-top-xs" style="min-height: 90rpx;">
                <text class="tn-text-df tn-color-gray clamp-text-2 tn-text-justify">
                  {{ item.desc }}
                </text>
              </view> -->
							<view class="tn-flex tn-flex-row-between tn-flex-col-between tn-margin-top-sm">
								<view v-for="(label_item,label_index) in item.label" :key="label_index"
									class="justify-content-item tn-tag-content__item tn-margin-right tn-text-sm tn-text-bold">
									<text class="tn-tag-content__item--prefix">#</text> {{ label_item }}
								</view>
								<view class="justify-content-item tn-color-gray tn-text-center"
									style="padding-top: 5rpx;">
									<text class="tn-icon-rocket tn-padding-right-xs tn-text-lg"></text>
									<text class="tn-padding-right tn-text-df">{{ item.collectionCount }}</text>
									<text class="tn-icon-like-lack tn-padding-right-xs tn-text-lg"></text>
									<text class="tn-text-df">{{ item.likeCount }}</text>
								</view>
							</view>
						</view>
					</view>

				</block>
			</view>

			<!-- 不建议写时间，因为写了时间，你就要经常更新文章了鸭-->
			<view v-if="false" class="">
				<block v-for="(item, index) in news4" :key="index">
					<view class="article-shadow tn-margin" @click="tn('/newsPages/article')">
						<view class="tn-flex">

							<view class="tn-margin-sm tn-padding-top-xs" style="width: 100%;">
								<view class="tn-text-lg tn-text-bold clamp-text-1 tn-text-justify">
									<text class="">{{ item.title }}</text>
								</view>
								<view class="tn-padding-top-xs" style="min-height: 90rpx;">
									<text class="tn-text-df tn-color-gray clamp-text-2 tn-text-justify">
										{{ item.desc }}
									</text>
								</view>
								<view class="tn-flex tn-flex-row-between tn-flex-col-between tn-margin-top-sm">
									<view v-for="(label_item,label_index) in item.label" :key="label_index"
										class="justify-content-item tn-tag-content__item tn-margin-right tn-text-sm tn-text-bold">
										<text class="tn-tag-content__item--prefix">#</text> {{ label_item }}
									</view>
									<view class="justify-content-item tn-color-gray tn-text-center"
										style="padding-top: 5rpx;">
										<text class="tn-icon-rocket tn-padding-right-xs tn-text-lg"></text>
										<text class="tn-padding-right tn-text-df">{{ item.collectionCount }}</text>
										<text class="tn-icon-like-lack tn-padding-right-xs tn-text-lg"></text>
										<text class="tn-text-df">{{ item.likeCount }}</text>
									</view>
								</view>
							</view>
							<view class="image-pic tn-margin-sm"
								:style="'background-image:url(' + item.userAvatar + ')'">
								<view class="image-article">
								</view>
							</view>
						</view>
					</view>
				</block>

			</view>

		</view>


		<view class='tn-tabbar-height'></view>


	</view>
</template>

<script>
	export default {
		name: 'News',
		data() {
			return {
				Microi: this.Microi,
				cardCur: 0,
				LunbotuList: [],
				news4: [{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_2.jpeg',
						userName: '可我会像',
						date: '2021年12月20日',
						color: 'blue',
						label: ['空间设计'],
						title: '为什么资讯不显示时间？',
						desc: '你确定你经常更新文章吗？',
						mainImage: 'https://resource.tuniaokj.com/images/shop/computer2.jpg',
						viewUser: {
							latestUserAvatar: [{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_1.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_2.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_4.jpeg'
								},
							],
							viewUserCount: 321
						},
						collectionCount: 654,
						commentCount: 232,
						likeCount: 543
					},
					{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg',
						userName: '可我会像',
						date: '2021年12月20日',
						color: 'green',
						label: ['创意家具'],
						title: '创意一点点',
						desc: '创意灵感从这里开始',
						mainImage: 'https://resource.tuniaokj.com/images/shop/phonecase1.jpg',
						viewUser: {
							latestUserAvatar: [{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_1.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_2.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_4.jpeg'
								},
							],
							viewUserCount: 230
						},
						collectionCount: 987,
						commentCount: 236,
						likeCount: 342
					},
					{
						userAvatar: 'https://resource.tuniaokj.com/images/shop/phonecase2.jpg',
						userName: '可我会像',
						date: '2021年12月20日',
						color: 'orange',
						label: ['简约风'],
						title: '图鸟UI素材已上传语雀',
						desc: '语雀素材地址资源',
						mainImage: 'https://resource.tuniaokj.com/images/shop/phonecase2.jpg',
						viewUser: {
							latestUserAvatar: [{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_1.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_2.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_4.jpeg'
								},
							],
							viewUserCount: 106
						},
						collectionCount: 765,
						commentCount: 32,
						likeCount: 91
					},
					{
						userAvatar: 'https://resource.tuniaokj.com/images/shop/watch1.jpg',
						userName: '可我会像',
						date: '2021年12月20日',
						color: 'purplered',
						label: ['清理神器'],
						title: '最强的视频转GIF工具',
						desc: '神器推荐',
						mainImage: 'https://resource.tuniaokj.com/images/shop/watch1.jpg',
						viewUser: {
							latestUserAvatar: [{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_1.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_2.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_4.jpeg'
								},
							],
							viewUserCount: 232
						},
						collectionCount: 776,
						commentCount: 48,
						likeCount: 86
					},
					{
						userAvatar: 'https://resource.tuniaokj.com/images/shop/sticker.jpg',
						userName: '可我会像',
						date: '2021年12月20日',
						color: 'purple',
						label: ['科技风'],
						title: '酷炫的小程序粒子效果一览',
						desc: '小程序粒子效果',
						mainImage: 'https://resource.tuniaokj.com/images/shop/sticker.jpg',
						viewUser: {
							latestUserAvatar: [{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_1.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_2.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_4.jpeg'
								},
							],
							viewUserCount: 456
						},
						collectionCount: 342,
						commentCount: 42,
						likeCount: 76
					},
					{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_1.jpeg',
						userName: '可我会像',
						date: '2021年12月20日',
						color: 'brown',
						label: ['工具'],
						title: '小程序任意页面生成二维码',
						desc: '二维码生成器',
						mainImage: 'https://resource.tuniaokj.com/images/shop/card.jpg',
						viewUser: {
							latestUserAvatar: [{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_1.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_2.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_4.jpeg'
								},
							],
							viewUserCount: 129
						},
						collectionCount: 265,
						commentCount: 22,
						likeCount: 62
					}
				],

				news3: [{
					userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_4.jpeg',
					userName: '可我会像',
					date: '2021年12月20日',
					color: 'red',
					label: ['小程序'],
					title: '我不喜欢带伞，因为雨滴从来不滴落我手心上',
					desc: '小程序前端源码，欢迎白嫖嗷嗷，可以的话，插件市场三连支持一下aa',
					mainImage: [
						'https://resource.tuniaokj.com/images/simple/image0.jpg',
						'https://resource.tuniaokj.com/images/simple/logo-flower.jpg',
						'https://resource.tuniaokj.com/images/simple/banner0.jpg',
					],
					viewUser: {
						latestUserAvatar: [{
								src: 'https://resource.tuniaokj.com/images/blogger/avatar_1.jpeg'
							},
							{
								src: 'https://resource.tuniaokj.com/images/blogger/avatar_2.jpeg'
							},
							{
								src: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg'
							},
							{
								src: 'https://resource.tuniaokj.com/images/blogger/avatar_4.jpeg'
							},
						],
						viewUserCount: 567
					},
					collectionCount: 543,
					commentCount: 543,
					likeCount: 206
				}],

				news2: [{
					userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_4.jpeg',
					userName: '可我会像',
					date: '2021年12月20日',
					color: 'red',
					label: ['小程序'],
					title: '小程序官网源码，已上线',
					desc: '小程序前端源码，欢迎白嫖嗷嗷，可以的话，插件市场三连支持一下aa',
					mainImage: 'https://resource.tuniaokj.com/images/shop/prototype2.jpg',
					viewUser: {
						latestUserAvatar: [{
								src: 'https://resource.tuniaokj.com/images/blogger/avatar_1.jpeg'
							},
							{
								src: 'https://resource.tuniaokj.com/images/blogger/avatar_2.jpeg'
							},
							{
								src: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg'
							},
							{
								src: 'https://resource.tuniaokj.com/images/blogger/avatar_4.jpeg'
							},
						],
						viewUserCount: 567
					},
					collectionCount: 543,
					commentCount: 543,
					likeCount: 206
				}],

				NewsList: [{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/blogger_beibei.jpg',
						userName: '可我会像',
						date: '2021年12月20日',
						color: 'cyan',
						label: ['模型'],
						title: '3D家具模型了解一下？',
						desc: '家具模型应有尽有',
						mainImage: 'https://resource.tuniaokj.com/images/shop/prototype1.jpg',
						viewUser: {
							latestUserAvatar: [{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_1.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_2.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_4.jpeg'
								},
							],
							viewUserCount: 987
						},
						collectionCount: 567,
						commentCount: 69,
						likeCount: 65
					},
					{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_2.jpeg',
						userName: '可我会像',
						date: '2021年12月20日',
						color: 'blue',
						label: ['神器'],
						title: '为什么资讯不显示时间？',
						desc: '你确定你经常更新文章吗？',
						mainImage: 'https://resource.tuniaokj.com/images/shop/computer2.jpg',
						viewUser: {
							latestUserAvatar: [{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_1.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_2.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg'
								},
								{
									src: 'https://resource.tuniaokj.com/images/blogger/avatar_4.jpeg'
								},
							],
							viewUserCount: 321
						},
						collectionCount: 654,
						commentCount: 232,
						likeCount: 543
					}
				],
			}
		},
		onLoad() {

		},

		created() {
			var self = this;
			self.GetNewsLunbotu();
			self.GetNewsList();
		},
		methods: {
			GetNewsLunbotu(){
				var self = this;
				self.Microi.ApiEngine.Run('get_slideshow', {
					_Type : 'News'
				}, function(result){
					if(self.Microi.CheckResult(result)){
						self.LunbotuList = result.Data;
					}
				});
			},
			GetNewsList(){
				var self = this;
				self.Microi.ApiEngine.Run('get_news_list', {
				}, function(result){
					if(self.Microi.CheckResult(result)){
						self.NewsList = result.Data;
					}
				});
			},
			// cardSwiper
			cardSwiper(e) {
				this.cardCur = e.detail.current
			},
			// 跳转
			tn(e) {
				uni.navigateTo({
					url: e,
				});
			},
		}
	}
</script>

<style lang="scss" scoped>
	.news {
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

		&__search {
			flex-basis: 60%;
			width: 100%;
			height: 100%;

			&__box {
				width: 100%;
				height: 70%;
				padding: 10rpx 0;
				margin: 0 30rpx;
				border-radius: 60rpx 60rpx 0 60rpx;
				font-size: 24rpx;
			}

			&__icon {
				padding-right: 10rpx;
				margin-left: 20rpx;
				font-size: 30rpx;
			}

			&__text {
				// color: #AAAAAA;
			}
		}
	}

	/* 底部安全边距 start*/
	.tn-tabbar-height {
		min-height: 120rpx;
		height: calc(140rpx + env(safe-area-inset-bottom) / 2);
		height: calc(140rpx + constant(safe-area-inset-bottom));
	}

	/* 文字截取*/
	.clamp-text-1 {
		-webkit-line-clamp: 1;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		text-overflow: ellipsis;
		overflow: hidden;
	}

	.clamp-text-2 {
		-webkit-line-clamp: 2;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		text-overflow: ellipsis;
		overflow: hidden;
	}

	/* 镂空 */
	.tnloukong {
		position: fixed;
		padding: 4rpx 8rpx;
		bottom: 220rpx;
		border-radius: 5rpx;
		left: 30rpx;
		font-weight: bold;
		text-align: center;
		z-index: 1000;
		background: rgba(255, 255, 255, 1);
		color: #070707;
		/* mix-blend-mode: overlay; difference;lighten;hue*/
		mix-blend-mode: lighten;

	}


	/* 轮播视觉差 start */
	.card-swiper {
		height: 500rpx !important;
	}

	.card-swiper swiper-item {
		width: 750rpx !important;
		left: 0rpx;
		box-sizing: border-box;
		// padding: 0rpx 30rpx 90rpx 30rpx;
		overflow: initial;
	}

	.card-swiper swiper-item .swiper-item {
		width: 100%;
		display: block;
		height: 100%;
		transform: scale(1);
		transition: all 0.2s ease-in 0s;
		will-change: transform;
		overflow: hidden;
	}

	.card-swiper swiper-item.cur .swiper-item {
		transform: none;
		transition: all 0.2s ease-in 0s;
		will-change: transform;
	}

	.card-swiper swiper-item .swiper-item-text {
		margin: -200rpx 0 0 30rpx;
		width: 100%;
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
		width: 30rpx;
		height: 6rpx;
		border-radius: 0rpx;
		left: -275rpx;
		top: -130rpx;
		margin: 0 5rpx !important;
		position: relative;
	}

	.spot.active {
		opacity: 1;
		width: 30rpx;
		background-color: #FFFFFF;
	}


	/* 阴影 start*/
	.home-shadow {
		border-radius: 15rpx;
		box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
	}


	/* 资讯主图 start*/
	.image-article {
		border-radius: 8rpx;
		width: 200rpx;
		height: 200rpx;
		position: relative;
	}

	.image-pic {
		border: 1rpx solid #F8F7F8;
		background-size: cover;
		background-repeat: no-repeat;
		// background-attachment:fixed;
		background-position: top;
		border-radius: 10rpx;
	}

	.article-shadow {
		border-radius: 15rpx;
		box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
	}

	/* 文字截取*/
	.clamp-text-1 {
		-webkit-line-clamp: 1;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		text-overflow: ellipsis;
		overflow: hidden;
	}

	.clamp-text-2 {
		-webkit-line-clamp: 2;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		text-overflow: ellipsis;
		overflow: hidden;
	}

	/* 标签内容 start*/
	.tn-tag-content {
		&__item {
			display: inline-block;
			line-height: 35rpx;
			color: #1D2541;
			background-color: #F3F2F7;
			border-radius: 10rpx;
			font-size: 22rpx;
			padding: 5rpx 15rpx;

			&--prefix {
				padding-right: 10rpx;
			}
		}
	}


	/* 大单图 start*/
	.tn-blogger-content2 {
		&__wrap {
			padding: 30rpx;
		}

		&__info {
			&__btn {
				margin-right: -12rpx;
				opacity: 0.5;
			}
		}

		&__label {
			&__item {
				line-height: 45rpx;
				padding: 0 20rpx;
				margin: 5rpx 18rpx 0 0;

				&--prefix {
					color: #00FFC8;
					padding-right: 10rpx;
				}
			}

			&__desc {
				line-height: 55rpx;
			}
		}

		&__main-image {
			box-shadow: 0rpx 5rpx 40rpx 0rpx rgba(43, 158, 246, 0.2);
			border-radius: 16rpx;

			&--1 {
				max-width: 690rpx;
				min-width: 690rpx;
				max-height: 400rpx;
				min-height: 400rpx;
			}

			&--2 {
				max-width: 260rpx;
				max-height: 260rpx;
			}

			&--3 {
				height: 212rpx;
				width: 100%;
			}
		}

		&__count-icon {
			font-size: 40rpx;
			padding-right: 5rpx;
		}
	}

	.image-design {
		padding: 140rpx 0rpx;
		font-size: 40rpx;
		font-weight: 300;
		position: relative;
	}

	.image-pic {
		background-size: cover;
		background-repeat: no-repeat;
		// background-attachment:fixed;
		background-position: top;
		border-radius: 10rpx;
	}

	/* 文章内容 end*/
</style>