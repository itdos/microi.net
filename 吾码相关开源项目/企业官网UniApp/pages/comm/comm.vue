<template>
	<view class="order tn-safe-area-inset-bottom">

		<!-- 顶部自定义导航 -->
		<tn-nav-bar :isBack="false" :bottomShadow="false" backgroundColor="#FFFFFF">
			<view class="custom-nav tn-flex tn-flex-col-center tn-flex-row-left">
				<!-- @click="tn('/homePages/search')" -->
				<view class="custom-nav__back">
					<view class="tn-icon-search-menu-fill"></view>
				</view>
				<view class="" style="width: 62vw;overflow: hidden;margin-top: 36rpx;">
					<tn-tabs :list="scrollList" :current="current" @change="tabChange" activeColor="#000" :bold="true"
						:fontSize="36"></tn-tabs>
				</view>
			</view>
		</tn-nav-bar>

		<view class="tn-margin-top-sm" :style="{paddingTop: vuex_custom_bar_height - 10 + 'px'}">
			<swiper class="card-swiper" @click="tn('/homePages/navigation')" :circular="true" :autoplay="true"
				duration="500" interval="8000" @change="cardSwiper">
				<swiper-item v-for="(item,index) in LunbotuList" :key="index" :class="cardCur==index?'cur':''">
					<view class="swiper-item image-banner"
						:style="'background-image:url('+ Microi.FileServer + item.Tupian + ');background-size: cover;border-radius: 15rpx;'"
						style="background-size: cover;background-position: center center;">
					</view>
					<!-- <view class="swiper-item-text">
            <view class="tn-text-bold tn-color-white" style="font-size: 50rpx;">{{item.title}}</view>
            <view class="tn-color-white tn-padding-top" style="font-size: 30rpx;">{{item.name}}</view>
            <view class="tn-text-sm tn-text-bold tn-color-white tn-padding-top-sm tn-padding-bottom-sm">{{item.text}}</view>
          </view> -->
				</swiper-item>
			</swiper>
			<view class="indication">
				<block v-for="(item,index) in LunbotuList" :key="index">
					<view class="spot" :class="cardCur==index?'active':''"></view>
				</block>
			</view>
		</view>

		<!-- 方式4 start-->
		<view class="tn-flex tn-flex-wrap">
			<!-- @click="tn('/discoveryPages/business')" -->
			<view v-for="(item, index) in iconData" :key="index" style="width: 25%;"
				@click="Microi.Tips('即将上线！')"
				>
				<view class="tn-margin-bottom tn-margin-top-sm">
					<view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
						<!-- 预留的图片形式 -->
						<!-- <view class="icon4__item--icon tn-flex tn-flex-row-center tn-flex-col-center" :style="'background-image:url('+ item.url +');background-size:100% 100%;background-size: cover;'">
		    </view> -->
						<!-- 字体图标形式-->
						<view
							class="icon4__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur tn-cool-color-icon4"
							:class="['tn-cool-bg-color-' + item.color]">
							<view :class="['tn-icon-' + item.icon]"></view>
						</view>
						<view class="tn-color-gray--dark tn-text-center">
							<text class="tn-text-ellipsis">{{ item.title }}</text>
						</view>
					</view>
				</view>
			</view>
		</view>
		<!-- 方式4 end-->
		<!-- tn-margin-top-xl -->
		<view class="">
			<view class="nav_title--wrap">
				<view class="nav_title tn-main-gradient-aquablue">
					<text class="tn-icon-star tn-padding-right-sm tn-text-xxl"></text>
					<text class="tn-text-xxl">智 / 能 / 产 / 品</text>
					<text class="tn-icon-star tn-padding-left-sm tn-text-xxl"></text>
				</view>
			</view>
		</view>

		<view class="">
			<view class="">

				<view class="" style="padding: 30rpx 20rpx;">
					<tn-waterfall ref="waterfall" v-model="ProductList" @finish="handleWaterFallFinish">
						<template v-slot:left="{ leftList }">
							<view v-for="(item, index) in leftList" :key="item.Id" class="product__item home-shadow"
								@click="tn('/commPages/product?Id=' + item.Id)">
								<view class="item__image">
									<!-- widthFix -->
									<tn-lazy-load :threshold="6000" height="100%" :image="Microi.FileServer + item.FengmianT"
										:index="item.id" imgMode="aspectFill"></tn-lazy-load>
								</view>
								<view class="item__data tn-margin-left-sm tn-margin-right-sm">
									<view class="item__title-container">
										<text class="item__title tn-color-cat clamp-text-2">{{ item.ChanpinMC }}</text>
									</view>
									<!-- <view v-if="item.tags && item.tags.length > 0" class="item__tags-container">
										<view v-for="(tagItem, tagIndex) in item.tags" :key="tagIndex"
											class="item__tag">{{ tagItem }}</view>
									</view> -->
									<!-- <view class="item__price-container tn-color-red">
                    <text class="item__price--unit">￥</text>
                    <text class="item__price--integer">{{ item.price }}</text>
                    <text class="tn-color-gray tn-text-sm tn-padding-left-sm" style="font-size: 24rpx;">{{ item.likeCount }} 人咨询</text>
                  </view> -->

									<view class="tn-flex tn-flex-row-between tn-flex-col-between tn-margin-top-xs">
										<view class="justify-content-item tn-color-red">
											<text class="tn-text-sm">￥</text>
											<text class="tn-text-xl">{{ item.ShichangJ || 0 }}</text>
										</view>
										<view class="justify-content-item tn-color-gray tn-text-center"
											style="padding-top: 5rpx;">
											<text class="tn-icon-eye tn-padding-right-xs tn-text-lg"></text>
											<text class="tn-text-df">{{ item.LiulanL || 0 }}</text>
										</view>
									</view>


									<!-- <view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding-top-xs">
                    <view class="justify-content-item">
                      <view class="tn-flex tn-flex-col-center tn-flex-row-left">
                        <view class="logo-pic">
                          <view class="logo-image">
                            <view class="" :style="'background-image:url('+ item.userImage +');width: 40rpx;height: 40rpx;background-size: cover;'">
                            </view>
                          </view>
                        </view>
                        <view class="tn-padding-left-xs">
                          <text class="tn-color-gray tn-text-sm">{{ item.userName }}</text>
                        </view>
                  
                      </view>
                    </view>
                    <view class="justify-content-item">
                      <text class="tn-icon-fire tn-color-gray tn-padding-right-xs"></text>
                      <text class="tn-color-gray">{{ item.viewUser.viewUserCount }}</text>
                    </view>
                  </view> -->


								</view>
							</view>
						</template>
						<template v-slot:right="{ rightList }">
							<!-- <view class="tn-text-bold home-shadow tn-main-gradient-blue tn-color-white"
								style="height: 160rpx;margin: 0 10rpx 20rpx 10rpx;border-radius: 10rpx;"
								@click="tn('/commPages/nav')">
								<view class="tn-padding-left tn-padding-top-lg">
									导航 · 图鸟生态
								</view>
								<view class="tn-padding-left tn-padding-top-xs">
									看看都有什么
									<text class="tn-icon-link tn-padding-left-xs"></text>
								</view>
							</view> -->
							<view v-for="(item, index) in rightList" :key="item.id" class="product__item home-shadow"
								@click="tn('/commPages/product?Id=' + item.Id)">
								<view class="item__image">
									<!-- widthFix -->
									<tn-lazy-load :threshold="6000" height="100%" :image="'https://file.microios.com/huayu-public' + item.FengmianT"
										:index="item.id" imgMode="aspectFill"></tn-lazy-load>
								</view>
								<view class="item__data tn-margin-left-sm tn-margin-right-sm">
									<view class="item__title-container">
										<text class="item__title tn-color-cat clamp-text-2">{{ item.ChanpinMC }}</text>
									</view>
									<!-- <view class="item__tags-container">
										<view v-for="(tagItem, tagIndex) in item.tags" :key="tagIndex"
											class="item__tag">{{ tagItem }}</view>
									</view> -->
									<!-- <view class="item__price-container tn-color-red">
                    <text class="item__price--unit">￥</text>
                    <text class="item__price--integer">{{ item.price }}</text>
                    <text class="tn-color-gray tn-text-sm tn-padding-left-sm" style="font-size: 24rpx;">{{ item.likeCount }} 人咨询</text>
                  </view> -->
									<view class="tn-flex tn-flex-row-between tn-flex-col-between tn-margin-top-xs">
										<view class="justify-content-item tn-color-red">
											<text class="tn-text-sm">￥</text>
											<text class="tn-text-xl">{{ item.ShichangJ || 0 }}</text>
										</view>
										<view class="justify-content-item tn-color-gray tn-text-center"
											style="padding-top: 5rpx;">
											<text class="tn-icon-eye tn-padding-right-xs tn-text-lg"></text>
											<text class="tn-text-df">{{ item.LiulanL || 0 }}</text>
										</view>
									</view>
									<!-- <view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding-top-xs">
                    <view class="justify-content-item">
                      <view class="tn-flex tn-flex-col-center tn-flex-row-left">
                        <view class="logo-pic">
                          <view class="logo-image">
                            <view class="" :style="'background-image:url('+ item.userImage +');width: 40rpx;height: 40rpx;background-size: cover;'">
                            </view>
                          </view>
                        </view>
                        <view class="tn-padding-left-xs">
                          <text class="tn-color-gray tn-text-sm">{{ item.userName }}</text>
                        </view>
                  
                      </view>
                    </view>
                    <view class="justify-content-item">
                      <text class="tn-icon-fire tn-color-gray tn-padding-right-xs"></text>
                      <text class="tn-color-gray">{{ item.viewUser.viewUserCount }}</text>
                    </view>
                  </view> -->
								</view>
							</view>
						</template>
					</tn-waterfall>
				</view>
				<tn-load-more :status="loadStatus"></tn-load-more>



			</view>

			<!-- <view class="">
        <view class="" style="padding: 15vh 20rpx;">
          <view class="tn-text-center" style="font-size: 200rpx;padding-top: 30rpx;">
            <text class="tn-icon-wea-wind tn-color-gray--light"></text>
          </view>
          <view class="tn-color-gray--disabled tn-text-center tn-text-lg">内容被台风吹走了</view>
        </view>
      </view> -->



		</view>
		<view class='tn-tabbar-height'></view>


	</view>
</template>

<script>
	export default {
		name: 'Comm',
		data() {
			return {
				Microi: this.Microi,
				ProductList: [],
				current: 0,
				scrollList: [{
						name: '产品'
					},
					{
						name: '最新'
					},
					{
						name: '最热'
					}
				],
				cardCur: 0,
				LunbotuList: [],
				iconData: [{
						url: 'https://cdn.nlark.com/yuque/0/2021/png/280373/1635153878788-assets/web-upload/6d98b558-4ba3-49dc-9c66-ac633f77c92b.png',
						title: '所有分类',
						icon: 'cube-fill',
						color: '5',
						path: ''
					},
					{
						url: 'https://cdn.nlark.com/yuque/0/2021/png/280373/1635153878788-assets/web-upload/6d98b558-4ba3-49dc-9c66-ac633f77c92b.png',
						title: '智能灯光',
						icon: 'clover-fill',
						color: '6',
						path: ''
					},
					{
						url: 'https://cdn.nlark.com/yuque/0/2021/png/280373/1635153878788-assets/web-upload/6d98b558-4ba3-49dc-9c66-ac633f77c92b.png',
						title: '智能窗帘',
						icon: 'notebook-fill',
						color: '7',
						path: ''
					},
					{
						url: 'https://cdn.nlark.com/yuque/0/2021/png/280373/1635153878788-assets/web-upload/6d98b558-4ba3-49dc-9c66-ac633f77c92b.png',
						title: '智能马桶',
						icon: 'block-fill',
						color: '8',
						path: ''
					},
					{
						url: 'https://cdn.nlark.com/yuque/0/2021/png/280373/1635153878788-assets/web-upload/6d98b558-4ba3-49dc-9c66-ac633f77c92b.png',
						title: '智能新风',
						icon: 'moon-fill',
						color: '15',
						path: ''
					},
					{
						url: 'https://cdn.nlark.com/yuque/0/2021/png/280373/1635153878788-assets/web-upload/6d98b558-4ba3-49dc-9c66-ac633f77c92b.png',
						title: '智能净水',
						icon: 'dragon',
						color: '16',
						path: ''
					},
					{
						url: 'https://cdn.nlark.com/yuque/0/2021/png/280373/1635153878788-assets/web-upload/6d98b558-4ba3-49dc-9c66-ac633f77c92b.png',
						title: '智能晾衣架',
						icon: 'gloves-fill',
						color: '1',
						path: ''
					},
					{
						url: 'https://cdn.nlark.com/yuque/0/2021/png/280373/1635153878788-assets/web-upload/6d98b558-4ba3-49dc-9c66-ac633f77c92b.png',
						title: '智能面板',
						icon: 'signpost-fill',
						color: '2',
						path: ''
					}
				],
				/* 瀑布流*/
				loadStatus: 'loadmore',
				list: [],
				data: [{
						title: '酷炫发现页面',
						userName: '试试就逝世',
						mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1661311316649-assets/web-upload/4de21afc-9abe-4c2a-b9fb-919d5537eb88.jpeg',
						userImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1664005699098-assets/web-upload/e8b29292-72fc-4c1e-9d7c-fd9dba31cb62.jpeg',
						storeType: 1, // 1 自营 2 第三方店铺
						newProduct: true, // 是否为新品
						tags: ['首页'],
						price: 1.29,
						likeCount: 2,
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
							viewUserCount: 338
						},
					},
					{
						title: '圈子页面',
						userName: '你的名字',
						mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1661311317595-assets/web-upload/d0effa8c-78f5-477f-b070-481840860bfe.jpeg',
						userImage: 'https://resource.tuniaokj.com/images/blogger/avatar_2.jpeg',
						storeType: 1, // 1 自营 2 第三方店铺
						newProduct: false, // 是否为新品
						tags: ['表单', '新建'],
						price: 0.05,
						likeCount: 21,
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
							viewUserCount: 289
						},
					},
					{
						title: '分类页面',
						userName: '青梅煮马',
						mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1649251556232-assets/web-upload/041b5cc9-2b8d-4d69-87b7-0441c4aefc92.jpeg',
						userImage: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg',
						storeType: 1, // 1 自营 2 第三方店铺
						newProduct: true, // 是否为新品
						tags: ['分类', '功能入口'],
						price: 2.18,
						likeCount: 6,
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
							viewUserCount: 381
						},
					},
					{
						title: '新年活动页面',
						userName: '你的名字',
						mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1648173855092-assets/web-upload/c9d704b6-53a1-4021-a415-efb01fd23efb.jpeg',
						userImage: 'https://resource.tuniaokj.com/images/blogger/avatar_4.jpeg',
						newProduct: true, // 是否为新品
						tags: ['首页', '新年活动'],
						price: 0.01,
						likeCount: 54,
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
							viewUserCount: 526
						},
					},
					{
						title: '名片首页',
						userName: '坟头草三米高',
						mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1648118577434-assets/web-upload/64689435-f0e9-4f6b-bb30-927cd28be18d.jpeg',
						userImage: 'https://resource.tuniaokj.com/images/blogger/avatar_1.jpeg',
						newProduct: false, // 是否为新品
						tags: [],
						price: 1.08,
						likeCount: 43,
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
							viewUserCount: 372
						},
					},
					{
						title: '官网页面',
						userName: '不许凶我',
						mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1648118569596-assets/web-upload/4a310720-62d8-46db-9605-22bbf55e5d95.jpeg',
						userImage: 'https://resource.tuniaokj.com/images/blogger/avatar_2.jpeg',
						storeType: 2, // 1 自营 2 第三方店铺
						storeType: 2, // 1 自营 2 第三方店铺
						newProduct: false, // 是否为新品
						tags: ['官网'],
						price: 0.01,
						likeCount: 0,
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
							viewUserCount: 694
						},
					},
					{
						title: '组件页面',
						userName: 'seventeen',
						mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1648118575211-assets/web-upload/30620690-02eb-4939-8d75-72075f1717dd.jpeg',
						userImage: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg',
						storeType: 2, // 1 自营 2 第三方店铺
						newProduct: false, // 是否为新品
						tags: [],
						price: 1.88,
						likeCount: 21,
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
							viewUserCount: 508
						},
					},
					{
						title: '官网模板',
						userName: '你的名字',
						mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1648118569642-assets/web-upload/dc58fb91-92e2-4807-92cc-f277a9038fff.jpeg',
						userImage: 'https://resource.tuniaokj.com/images/blogger/avatar_4.jpeg',
						storeType: 1, // 1 自营 2 第三方店铺
						newProduct: false, // 是否为新品
						tags: [],
						price: 1.29,
						likeCount: 39,
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
							viewUserCount: 923
						},
					},
					{
						title: '博客页面',
						userName: '图鸟东东',
						mainImage: 'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1648118569457-assets/web-upload/b1bd35ad-1e7e-4d83-97c2-27eba8f5efdb.jpeg',
						userImage: 'https://resource.tuniaokj.com/images/blogger/avatar_4.jpeg',
						storeType: 1, // 1 自营 2 第三方店铺
						newProduct: false, // 是否为新品
						tags: [],
						price: 0.05,
						likeCount: 66,
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
							viewUserCount: 989
						},
					},
					{
						title: '扫码页面',
						userName: '此处凶姐承包',
						mainImage: 'https://cdn.nlark.com/yuque/0/2021/jpeg/280373/1640501433262-assets/web-upload/c8c99c94-e4d4-4b48-a853-bea4a19ff17b.jpeg',
						userImage: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg',
						storeType: 1, // 1 自营 2 第三方店铺
						newProduct: false, // 是否为新品
						tags: ['扫码', '功能页'],
						price: 0.01,
						likeCount: 12,
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
					}
				],
			}
		},
		onLoad() {

		},
		/* 瀑布流*/
		created() {
			var self = this;
			// this.getRandomData()
			self.GetProductLunbotu();
			self.GetProductList();
		},
		methods: {
			GetProductList() {
				var self = this;
				self.ProductList = [];
				self.$nextTick(() => {
					self.Microi.ApiEngine.Run('get_product_list', {}, function(result) {
						if (self.Microi.CheckResult(result)) {
							self.ProductList = result.Data;
						}
					});
				})
			},
			GetProductLunbotu() {
				var self = this;
				self.Microi.ApiEngine.Run('get_slideshow', {
					_Type: 'Product'
				}, function(result) {
					if (self.Microi.CheckResult(result)) {
						self.LunbotuList = result.Data;
					}
				});
			},
			// 跳转
			tn(e) {
				uni.navigateTo({
					url: e,
				});
			},
			// cardSwiper
			cardSwiper(e) {
				this.cardCur = e.detail.current
			},
			// tab选项卡切换
			tabChange(index) {
				var self = this;
				self.current = index
				// self.GetProductList();
			},

			/* 瀑布流*/
			// 获取随机数据
			getRandomData() {
				this.loadStatus = 'loading'
				for (let i = 0; i < 10; i++) {
					let index = this.$t.number.randomInt(0, this.data.length - 1)
					let item = JSON.parse(JSON.stringify(this.data[index]))
					let price = this.getPrice(item.price)
					item.id = this.$t.uuid()
					item.priceInteger = price[0]
					item.priceDecimal = price[1]
					this.list.push(item)
				}
			},
			// 瀑布流加载完毕事件
			handleWaterFallFinish() {
				this.loadStatus = 'loadmore'
			},
			// 获取价格整数和小数部分
			getPrice(price) {
				const priceStr = String(price)
				if (priceStr.indexOf('.') !== -1) {
					return priceStr.split('.')
				} else {
					return [priceStr, '00']
				}
			}
		}
	}
</script>

<style lang="scss" scoped>
	/* 标题 start */
	.nav_title {
		-webkit-background-clip: text;
		color: transparent;
	
		&--wrap {
			position: relative;
			display: flex;
			height: 120rpx;
			font-size: 42rpx;
			align-items: center;
			justify-content: center;
			font-weight: bold;
			background-image: url(https://resource.tuniaokj.com/images/title_bg/title44.png);
			background-size: cover;
		}
	}
	
	/* 标题 end */
	
	/* 图标容器4 start */
	.tn-cool-color-icon4 {
		// background-image: -webkit-linear-gradient(135deg, #ED1C24, #FECE12);   16
		// background-image: linear-gradient(135deg, #ED1C24, #FECE12);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		text-fill-color: transparent;
	}
	
	.icon4 {
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
				width: 110rpx;
				height: 110rpx;
				font-size: 60rpx;
				border-radius: 50%;
				margin-bottom: 18rpx;
				position: relative;
				z-index: 1;
				box-shadow: 0px 10px 30px rgba(70, 23, 129, 0.12),
					0px -8px 40px rgba(255, 255, 255, 1),
					inset 0px -10px 10px rgba(70, 23, 129, 0.05),
					inset 0px 10px 20px rgba(255, 255, 255, 1);
			}
		}
	}
	
	.order {
		max-height: 100vh;
	}

	/* 自定义导航栏内容 start */
	.custom-nav {
		height: 100%;

		&__back {
			margin: auto 5rpx;
			font-size: 45rpx;
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

	/* 阴影 start*/
	.home-shadow {
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
		border-radius: 10rpx;
		transform: scale(1);
		transition: all 0.2s ease-in 0s;
		will-change: transform;
		// overflow: hidden;
	}

	.card-swiper swiper-item.cur .swiper-item {
		transform: none;
		transition: all 0.2s ease-in 0s;
		will-change: transform;
	}

	.card-swiper swiper-item .swiper-item-text {
		margin-top: -160rpx;
		text-align: center;
		width: 100%;
		display: block;
		height: 50%;
		border-radius: 10rpx;
		transform: translate(100rpx, -60rpx) scale(0.9, 0.9);
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

	/* 头像 start */
	.logo-image2 {
		width: 90rpx;
		height: 90rpx;
		position: relative;
	}

	.logo-pic2 {
		background-size: cover;
		background-repeat: no-repeat;
		// background-attachment:fixed;
		background-position: top;
		box-shadow: 0rpx 0rpx 80rpx 0rpx rgba(0, 0, 0, 0.15);
		border-radius: 50%;
		overflow: hidden;
		// background-color: #FFFFFF;
	}

	/* 瀑布流*/
	.product__item {
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
				border-radius: 10rpx 10rpx 0 0;
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
				font-size: 28rpx;
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

			/* 价格 start */
			&__price-container {
				font-size: 24rpx;
				color: #E83A30;
			}

			&__price {
				&--unit {}

				&--integer {
					font-size: 38rpx;
				}

				&--decimal {}
			}

			/* 价格 end */
			/* 内容 end */
		}
	}
</style>