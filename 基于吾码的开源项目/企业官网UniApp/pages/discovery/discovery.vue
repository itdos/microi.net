<template>
	<view class="page-c">
		<!-- 顶部自定义导航 -->
		<!-- <tn-nav-bar fixed alpha customBack>
      <view slot="back" class='tn-custom-nav-bar__back'>
        <text class='icon tn-icon-notice'></text>
        <text class='icon tn-icon-caring'></text>
      </view>
    </tn-nav-bar> -->

		<view class="top-backgroup">
			<image
				src='https://file.microios.com/huayu-public/huayu/img/upload/play1.jpg'
				mode='widthFix' class='backgroud-image'></image>
		</view>

		<swiper class="card-swiper" :circular="true" :autoplay="false" duration="500" interval="5000"
			previous-margin="170rpx" next-margin="170rpx" @change="cardSwiper" style="margin-top: -470rpx;">
			<swiper-item v-for="(item,index) in LunbotuList" :key="index" :class="cardCur==index?'cur':''">
				<view class="tnphone-white-min swiper-item  wow fadeInLeft2">
					<view class="skin wow fadeInRight2">
						<view class="screen wow fadeInUp2">
							<!-- <view class="head">
        			  <text>{{item.name}}</text>
        		  </view> -->
							<view class="peak wow">
								<view class="sound"></view>
								<view class="lens"></view>
							</view>
							<!-- <view class="area-l">
        			  <view class="">
                  <text class="tn-icon-all"></text>
                  <text class="tn-icon-wifi tn-padding-left-xs"></text>
        			  </view>
        		  </view>
        		  <view class="area-r">
        			  <view class="">
                  <text class="tn-icon-light"></text>
                  <text class="tn-icon-time tn-padding-left-xs"></text>
                </view>
        		  </view> -->
							<!-- <view class="talk"></view> -->

							<view class="image-banner">
								 <!-- v-if="item.type=='image'" -->
								<image :src="Microi.FileServer + item.Tupian" mode="aspectFill"></image>
							</view>

						</view>
					</view>
				</view>
			</swiper-item>
		</swiper>


		<!--    <view class="">
      <view class="nav_title--wrap">
        <view class="nav_title tn-cool-bg-color-15">
          <text class="tn-icon-star tn-padding-right-sm tn-text-xxl"></text>
          <text class="tn-text-xl">图 / 鸟 / 业 / 务</text>
          <text class="tn-icon-star tn-padding-left-sm tn-text-xxl"></text>
        </view>
      </view>
    </view> -->


		<!-- 方式4 start-->
		<view class="tn-flex tn-flex-wrap">
			<!-- @click="tn('/discoveryPages/business?Id=' + item.Id)" -->
			<view v-for="(item, index) in iconData" :key="index" style="width: 25%;"
				@click="Microi.Tips('即将上线！')"
				>
				 <!-- tn-margin-top-sm -->
				<view class="tn-margin-bottom">
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


		<!-- 方式4 start-->
		<!-- <view class="tn-flex">
      <view class="tn-flex-1 tn-padding-sm tn-radius" @click="tn('/activityPages/planet')">
        <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
          <view class="icon4__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur">
            <view class="tn-icon-discover-planet-fill tn-cool-color-icon4 tn-cool-bg-color-5"></view>
          </view>  
          <view class="tn-color-gray--dark tn-text-center">
            <text class="tn-text-ellipsis">开源项目</text>
          </view>
        </view>
      </view>
      <view class="tn-flex-1 tn-padding-sm tn-radius" @click="tn('/activityPages/project')">
        <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
          <view class="icon4__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur">
            <view class="tn-icon-trophy-fill tn-cool-color-icon4 tn-cool-bg-color-15"></view>
          </view>  
          <view class="tn-color-gray--dark tn-text-center">
            <text class="tn-text-ellipsis">官方赛事</text>
          </view>
        </view>
      </view>
      <view class="tn-flex-1 tn-padding-sm tn-radius" @click="tn('/activityPages/map')">
        <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
          <view class="icon4__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur">
            <view class="tn-icon-seal tn-cool-color-icon4 tn-cool-bg-color-8"></view>
          </view>  
          <view class="tn-color-gray--dark tn-text-center">
            <text class="tn-text-ellipsis">创业联盟</text>
          </view>
        </view>
      </view>
      <view class="tn-flex-1 tn-padding-sm tn-radius" @click="tn('/activityPages/study')">
        <view class="tn-flex tn-flex-direction-column tn-flex-row-center tn-flex-col-center">
          <view class="icon4__item--icon tn-flex tn-flex-row-center tn-flex-col-center tn-shadow-blur">
            <view class="tn-icon-creative-fill tn-cool-color-icon4 tn-cool-bg-color-3"></view>
          </view>  
          <view class="tn-color-gray--dark tn-text-center">
            <text class="tn-text-ellipsis">课程学习</text>
          </view>
        </view>
      </view>
    </view> -->
		<!-- 方式4 end-->
<!-- tn-margin-top-xl -->
		<view class="">
			<view class="nav_title--wrap">
				<view class="nav_title tn-main-gradient-aquablue">
					<text class="tn-icon-star tn-padding-right-sm tn-text-xxl"></text>
					<text class="tn-text-xxl">项 / 目 / 案 / 例</text>
					<text class="tn-icon-star tn-padding-left-sm tn-text-xxl"></text>
				</view>
			</view>
		</view>


		<!-- 图文 -->
		<view class="tn-flex tn-flex-direction-column tn-margin-bottom-xl">

			<block v-for="(item,index) in CaseList" :key="index">
				<view class="tn-blogger-content2__wrap" @click="tn('/discoveryPages/case?Id=' + item.Id)">
					<view class="tn-shadow-blur image-pic"
						:style="'background-image:url(' + Microi.FileServer + item.YulanT + ');background-size: cover;background-position: center;'">
						<view class="image-design">
							<view class="tn-text-df"
								style="width: 100%;height: 120rpx;background: linear-gradient(0deg, rgba(0,0,0,0.3), rgba(0,0,0,0));position: absolute;bottom: 0;border-radius: 0 0 12rpx 12rpx;">
								<view
									class="tn-text-lg tn-text-bold tn-padding-top-xl tn-padding-left tn-padding-right tn-color-white clamp-text-1">
									{{ item.AnliBT }}</view>
							</view>
						</view>
					</view>

					<!-- <view class="tn-blogger-content2__label tn-text-justify tn-margin-top tn-margin-bottom-sm">
            <text class="tn-blogger-content2__label__desc tn-text-bold tn-text-lg">{{ item.desc }}</text>  
          </view>
          
          <view class="tn-flex tn-flex-row-between tn-flex-col-center tn-margin-top-xs">
            
            <view class="justify-content-item tn-text-center">
              <view v-for="(label_item,label_index) in item.label" :key="label_index"
                class="justify-content-item tn-tag-content__item tn-margin-right tn-text-sm tn-text-bold">
                <text class="tn-tag-content__item--prefix">#</text> {{ label_item }}
              </view>
            </view>
            
            <view class="justify-content-item tn-flex tn-flex-col-center">
              <view style="margin-right: 0rpx;margin-left: 10rpx;">
                <view class="tn-color-gray">
                  <text class="tn-icon-rocket tn-padding-right-xs tn-text-lg"></text>
                  <text class="tn-padding-right tn-text-df">{{ item.collectionCount }}</text>
                  <text class="tn-icon-like-lack tn-padding-right-xs tn-text-lg"></text>
                  <text class="tn-text-df">{{ item.likeCount }}</text>
                </view>
              </view>
            </view>
          </view> -->
				</view>

			</block>
		</view>



		<view class='tn-tabbar-height'></view>

	</view>
</template>

<script>
	export default {
		name: 'Discovery',
		data() {
			return {
				CaseList:[],
				Microi:this.Microi,
				cardCur: 0,
				LunbotuList: [],
				list1: [{
						icon: 'honor-fill',
						title: '称呼计算器',
						join: '629',
						color: 'blue'
					},
					{
						icon: 'count-fill',
						title: '支付宝语音生成',
						join: '268',
						color: 'purplered'
					},
					{
						icon: 'gloves-fill',
						title: '一周天气预报',
						join: '332',
						color: 'cyan'
					},
					{
						icon: 'trusty-fill',
						title: '今日星座运势',
						join: '106',
						color: 'orangeyellow'
					},
					{
						icon: 'hardware-fill',
						title: '来碗毒鸡汤',
						join: '98',
						color: 'indigo'
					},
					{
						icon: 'baby-fill',
						title: '垃圾分一分',
						join: '57',
						color: 'red'
					},
					{
						icon: 'safe-fill',
						title: '手持弹幕',
						join: '76',
						color: 'green'
					},
					{
						icon: 'flag-fill',
						title: '孩子取名',
						join: '225',
						color: 'orange'
					},
					{
						icon: 'topics-fill',
						title: '午餐吃什么',
						join: '422',
						color: 'teal'
					},
					{
						icon: 'light-fill',
						title: '朋友圈文案',
						join: '983',
						color: 'orangered'
					}
				],
				iconData: [{
						url: 'https://cdn.nlark.com/yuque/0/2021/png/280373/1635153878788-assets/web-upload/6d98b558-4ba3-49dc-9c66-ac633f77c92b.png',
						title: '别墅案例',
						icon: 'cube-fill',
						color: '5',
						path: ''
					},
					{
						url: 'https://cdn.nlark.com/yuque/0/2021/png/280373/1635153878788-assets/web-upload/6d98b558-4ba3-49dc-9c66-ac633f77c92b.png',
						title: '公寓案例',
						icon: 'clover-fill',
						color: '6',
						path: ''
					},
					{
						url: 'https://cdn.nlark.com/yuque/0/2021/png/280373/1635153878788-assets/web-upload/6d98b558-4ba3-49dc-9c66-ac633f77c92b.png',
						title: '住宅案例',
						icon: 'notebook-fill',
						color: '7',
						path: ''
					},
					{
						url: 'https://cdn.nlark.com/yuque/0/2021/png/280373/1635153878788-assets/web-upload/6d98b558-4ba3-49dc-9c66-ac633f77c92b.png',
						title: '开发商精装',
						icon: 'block-fill',
						color: '8',
						path: ''
					},
					// {
					// 	url: 'https://cdn.nlark.com/yuque/0/2021/png/280373/1635153878788-assets/web-upload/6d98b558-4ba3-49dc-9c66-ac633f77c92b.png',
					// 	title: 'Icon图标',
					// 	icon: 'moon-fill',
					// 	color: '15',
					// 	path: ''
					// },
					// {
					// 	url: 'https://cdn.nlark.com/yuque/0/2021/png/280373/1635153878788-assets/web-upload/6d98b558-4ba3-49dc-9c66-ac633f77c92b.png',
					// 	title: 'Logo商标',
					// 	icon: 'dragon',
					// 	color: '16',
					// 	path: ''
					// },
					// {
					// 	url: 'https://cdn.nlark.com/yuque/0/2021/png/280373/1635153878788-assets/web-upload/6d98b558-4ba3-49dc-9c66-ac633f77c92b.png',
					// 	title: '名片设计',
					// 	icon: 'gloves-fill',
					// 	color: '1',
					// 	path: ''
					// },
					// {
					// 	url: 'https://cdn.nlark.com/yuque/0/2021/png/280373/1635153878788-assets/web-upload/6d98b558-4ba3-49dc-9c66-ac633f77c92b.png',
					// 	title: '其他业务',
					// 	icon: 'signpost-fill',
					// 	color: '2',
					// 	path: ''
					// }
				],
				content2: [{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_2.jpeg',
						userName: '可我会像',
						date: '2021年12月20日',
						label: ['轻奢', '全景', '茶水间'],
						desc: '简历王者小程序，再度来袭',
						mainImage: [
							'https://cdn.nlark.com/yuque/0/2021/jpeg/280373/1629527293232-assets/web-upload/c4e46812-9aab-4d4b-b6c2-8d2d6f1c4662.jpeg',
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
							viewUserCount: 65
						},
						collectionCount: 312,
						commentCount: 22,
						likeCount: 166
					},
					{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg',
						userName: '可我会像',
						date: '2021年12月20日',
						label: ['现代', '全景', '办公室'],
						desc: '图鸟圈子免费开源可商用模板',
						mainImage: [
							'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1661311317595-assets/web-upload/d0effa8c-78f5-477f-b070-481840860bfe.jpeg',
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
							viewUserCount: 65
						},
						collectionCount: 368,
						commentCount: 22,
						likeCount: 202
					},
					{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg',
						userName: '可我会像',
						date: '2021年12月20日',
						label: ['现代', '全景', '办公室'],
						desc: '图鸟微信红包封面设计',
						mainImage: [
							'https://cdn.nlark.com/yuque/0/2023/jpeg/280373/1683216545991-assets/web-upload/ca20dad6-0cc1-4df4-b644-1cc223cebdd1.jpeg',
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
							viewUserCount: 65
						},
						collectionCount: 368,
						commentCount: 22,
						likeCount: 202
					},
					{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg',
						userName: '可我会像',
						date: '2021年12月20日',
						label: ['现代', '全景', '办公室'],
						desc: '图鸟纸质红包封面设计',
						mainImage: [
							'https://cdn.nlark.com/yuque/0/2021/jpeg/280373/1637114629128-assets/web-upload/4f31b7b1-15c9-4363-b77c-02511905b0c4.jpeg',
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
							viewUserCount: 65
						},
						collectionCount: 368,
						commentCount: 22,
						likeCount: 202
					},
					{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg',
						userName: '可我会像',
						date: '2021年12月20日',
						label: ['现代', '全景', '办公室'],
						desc: '创意加载动画',
						mainImage: [
							'https://cdn.nlark.com/yuque/0/2023/gif/280373/1683183756106-assets/web-upload/34aa1b47-222a-4dfe-8b17-8c26e83ddc6a.gif',
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
							viewUserCount: 65
						},
						collectionCount: 368,
						commentCount: 22,
						likeCount: 202
					},
					{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg',
						userName: '可我会像',
						date: '2021年12月20日',
						label: ['现代', '全景', '办公室'],
						desc: '某凶到此一游并占屏',
						mainImage: [
							'https://cdn.nlark.com/yuque/0/2023/jpeg/280373/1683185728989-assets/web-upload/af525e21-57d0-4403-9c13-bf073d632638.jpeg',
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
							viewUserCount: 65
						},
						collectionCount: 368,
						commentCount: 22,
						likeCount: 202
					}
				],
				content3: [{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_2.jpeg',
						userName: '可我会像',
						date: '2021年12月20日',
						label: ['轻奢', '全景', '茶水间'],
						desc: '简历王者小程序，再度来袭',
						mainImage: [
							'https://cdn.nlark.com/yuque/0/2021/jpeg/280373/1629527293232-assets/web-upload/c4e46812-9aab-4d4b-b6c2-8d2d6f1c4662.jpeg',
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
							viewUserCount: 65
						},
						collectionCount: 312,
						commentCount: 22,
						likeCount: 166
					},
					{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg',
						userName: '可我会像',
						date: '2021年12月20日',
						label: ['现代', '全景', '办公室'],
						desc: '图鸟圈子免费开源可商用模板',
						mainImage: [
							'https://cdn.nlark.com/yuque/0/2022/jpeg/280373/1661311317595-assets/web-upload/d0effa8c-78f5-477f-b070-481840860bfe.jpeg',
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
							viewUserCount: 65
						},
						collectionCount: 368,
						commentCount: 22,
						likeCount: 202
					},
					{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg',
						userName: '可我会像',
						date: '2021年12月20日',
						label: ['现代', '全景', '办公室'],
						desc: '图鸟微信红包封面设计',
						mainImage: [
							'https://cdn.nlark.com/yuque/0/2021/png/280373/1629527289054-assets/web-upload/a3699c34-1997-4da5-b358-351858099617.png?x-oss-process=image%2Fresize%2Cw_220',
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
							viewUserCount: 65
						},
						collectionCount: 368,
						commentCount: 22,
						likeCount: 202
					},
					{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg',
						userName: '可我会像',
						date: '2021年12月20日',
						label: ['现代', '全景', '办公室'],
						desc: '图鸟纸质红包封面设计',
						mainImage: [
							'https://cdn.nlark.com/yuque/0/2021/jpeg/280373/1637114629128-assets/web-upload/4f31b7b1-15c9-4363-b77c-02511905b0c4.jpeg',
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
							viewUserCount: 65
						},
						collectionCount: 368,
						commentCount: 22,
						likeCount: 202
					},
					{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg',
						userName: '可我会像',
						date: '2021年12月20日',
						label: ['现代', '全景', '办公室'],
						desc: '底色阴影自动跟着变',
						mainImage: [
							'https://cdn.nlark.com/yuque/0/2023/gif/280373/1683183756106-assets/web-upload/34aa1b47-222a-4dfe-8b17-8c26e83ddc6a.gif',
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
							viewUserCount: 65
						},
						collectionCount: 368,
						commentCount: 22,
						likeCount: 202
					},
					{
						userAvatar: 'https://resource.tuniaokj.com/images/blogger/avatar_3.jpeg',
						userName: '可我会像',
						date: '2021年12月20日',
						label: ['现代', '全景', '办公室'],
						desc: '某凶到此一游并占屏',
						mainImage: [
							'https://cdn.nlark.com/yuque/0/2023/jpeg/280373/1683185728989-assets/web-upload/af525e21-57d0-4403-9c13-bf073d632638.jpeg',
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
							viewUserCount: 65
						},
						collectionCount: 368,
						commentCount: 22,
						likeCount: 202
					}
				],
				linksData: [{
						icon: 'honor-fill',
						join: '629',
						color: 'purplered',
						url: '',
						title: '司命',
						appid: 'wx734d93edc5b48019',
						path: 'pages/index/index'
					},
					{
						icon: 'count-fill',
						join: '268',
						color: 'blue',
						url: '',
						title: '爱小睡眠',
						appid: 'wx65880bde88b32037',
						path: 'pages/index/index'
					},
					{
						icon: 'gloves-fill',
						join: '332',
						color: 'orangeyellow',
						url: '',
						title: '群友作品',
						appid: '',
						path: 'pages/index/index'
					},
					{
						icon: 'trusty-fill',
						join: '106',
						color: 'cyan',
						url: '',
						title: '群友作品',
						appid: '',
						path: 'pages/index/index'
					},
					{
						icon: 'hardware-fill',
						join: '98',
						color: 'red',
						url: '',
						title: '群友作品',
						appid: '',
						path: 'pages/index/index'
					},
					{
						icon: 'baby-fill',
						join: '57',
						color: 'indigo',
						url: '',
						title: '群友作品',
						appid: '',
						path: 'pages/index/index'
					},
					{
						icon: 'safe-fill',
						join: '76',
						color: 'orange',
						url: '',
						title: '群友作品',
						appid: '',
						path: 'pages/index/index'
					},
					{
						icon: 'flag-fill',
						join: '225',
						color: 'green',
						url: '',
						title: '群友作品',
						appid: '',
						path: 'pages/index/index'
					},
					{
						icon: 'topics-fill',
						join: '422',
						color: 'orangered',
						url: '',
						title: '群友作品',
						appid: '',
						path: 'pages/index/index'
					},
					{
						icon: 'light-fill',
						join: '983',
						color: 'teal',
						url: '',
						title: '表情包制作',
						appid: 'wx096589e82af2ffa5',
						path: 'pages/index/index'
					}
				],

			}
		},
		created() {
			var self = this;
			self.GetCaseLunbotu();
			self.GetCaseList();
		},
		onReady() {

		},
		methods: {
			GetCaseList() {
				var self = this;
				self.CaseList = [];
				self.$nextTick(() => {
					self.Microi.ApiEngine.Run('get_case_list', {}, function(result) {
						if (self.Microi.CheckResult(result)) {
							self.CaseList = result.Data;
						}
					});
				})
			},
			GetCaseLunbotu(){
				var self = this;
				self.Microi.ApiEngine.Run('get_slideshow', {
					_Type : 'Case'
				}, function(result){
					if(self.Microi.CheckResult(result)){
						self.LunbotuList = result.Data;
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
			}
		}
	}
</script>

<style lang="scss" scoped>
	.page-c {
		max-height: 100vh;
	}

	/* 底部安全边距 start*/
	.tn-tabbar-height {
		min-height: 120rpx;
		height: calc(140rpx + env(safe-area-inset-bottom) / 2);
		height: calc(140rpx + constant(safe-area-inset-bottom));
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

	/* 阴影 start*/
	.home-shadow {
		border-radius: 15rpx;
		box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
	}


	/* .tnphone-white-min 细边框*/
	.tnphone-white-min {
		width: 380rpx;
		height: 800rpx;
		border-radius: 40rpx;
		background: #E9E5F3;
		padding: 7rpx;
		display: table;
		color: #333;
		box-sizing: border-box;
		box-shadow: 0rpx 10rpx 50rpx 0rpx rgba(0, 0, 0, 0.15);
		margin: 70rpx auto;
		cursor: default;
		position: relative
	}

	.tnphone-white-min .skin {
		width: 100%;
		height: 100%;
		border-radius: 40rpx;
		background: #E9E5F3;
		padding: 10rpx;
	}

	.tnphone-white-min .screen {
		width: 100%;
		height: 100%;
		border-radius: 30rpx;
		background: #E9E5F3;
		position: relative;
		overflow: hidden
	}

	.tnphone-white-min .head {
		width: 100%;
		height: 90rpx;
		text-align: center;
		position: absolute;
		padding: 45rpx 15rpx 10rpx 15rpx;
	}

	.tnphone-white-min .peak {
		left: 22%;
		width: 56%;
		height: 27rpx;
		margin: -2rpx auto 0rpx;
		border-radius: 0 0 20rpx 20rpx;
		background: #E9E5F3;
		position: absolute
	}

	.tnphone-white-min .sound {
		width: 48rpx;
		height: 6rpx;
		border-radius: 15rpx;
		background: #555;
		position: absolute;
		left: 50%;
		top: 50%;
		margin-left: -24rpx;
		margin-top: -10rpx;
		box-shadow: 0rpx 4rpx 4rpx 0rpx #444 inset
	}

	.tnphone-white-min .lens {
		width: 6rpx;
		height: 6rpx;
		border-radius: 50%;
		background: #2c5487;
		position: absolute;
		left: 50%;
		top: 50%;
		margin-left: 34rpx;
		margin-top: -10rpx
	}

	.tnphone-white-min .talk {
		width: 50%;
		height: 6rpx;
		border-radius: 15rpx;
		background: rgba(0, 0, 0, .3);
		position: absolute;
		bottom: 8rpx;
		left: 50%;
		margin-left: -25%
	}

	.tnphone-white-min .area-l,
	.tnphone-white-min .area-r {
		width: 70rpx;
		height: 16rpx;
		position: absolute;
		top: 6rpx
	}

	.tnphone-white-min .area-l {
		left: 0;
		text-align: center;
		font-size: 12rpx;
		line-height: 22rpx;
		text-indent: 10rpx;
		font-weight: 600;
		padding-left: 20rpx;
	}

	.tnphone-white-min .area-r {
		right: 0;
		text-align: center;
		font-size: 12rpx;
		line-height: 22rpx;
		text-indent: 10rpx;
		font-weight: 600;
		padding-right: 20rpx;
	}

	.tnphone-white-min .fa-feed {
		float: left;
		font-size: 12rpx !important;
		transform: rotate(-45deg);
		margin-top: 4rpx;
		margin-right: 8rpx
	}

	.tnphone-white-min .fa-battery-full {
		float: left;
		font-size: 12rpx !important;
		margin-top: 6rpx
	}

	.tnphone-white-min .fa-chevron-left {
		float: left;
		margin-top: 4rpx
	}

	.tnphone-white-min .fa-cog {
		float: right;
		margin-top: 4rpx
	}

	.tnphone-white-min .btn01 {
		width: 3rpx;
		height: 28rpx;
		border-radius: 3rpx 0 0 3rpx;
		background: #222;
		position: absolute;
		top: 105rpx;
		left: -3rpx
	}

	.tnphone-white-min .btn02 {
		width: 3rpx;
		height: 54rpx;
		border-radius: 3rpx 0 0 3rpx;
		background: #222;
		position: absolute;
		top: 160rpx;
		left: -3rpx
	}

	.tnphone-white-min .btn03 {
		width: 3rpx;
		height: 54rpx;
		border-radius: 3rpx 0 0 3rpx;
		background: #222;
		position: absolute;
		top: 230rpx;
		left: -3rpx
	}

	.tnphone-white-min .btn04 {
		width: 3rpx;
		height: 86rpx;
		border-radius: 0 3rpx 3rpx 0;
		background: #222;
		position: absolute;
		top: 180rpx;
		right: -3rpx
	}


	/* 顶部背景图 start */
	.top-backgroup {
		height: 450rpx;
		z-index: -1;

		.backgroud-image {
			width: 100%;
			height: 446rpx;
			// z-index: -1;
		}
	}

	/* 顶部背景图 end */

	/* 轮播样机样式 start*/
	.card-swiper {
		height: 810rpx !important;
	}

	.card-swiper swiper-item {
		width: 260rpx !important;
		// left: 170rpx;
		// width: 380rpx !important;
		// left: 185rpx;
		box-sizing: border-box;
		padding: 0rpx 15rpx 90rpx 15rpx;
		overflow: initial;
	}

	.card-swiper swiper-item .swiper-item {
		display: block;
		transform: scale(0.45);
		transition: all 0.2s ease-in 0s;
		overflow: hidden;
	}

	.card-swiper swiper-item.cur .swiper-item {
		transform: scale(0.65);
		transition: all 0.2s ease-in 0s;
	}

	.image-banner {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.image-banner image {
		width: 100%;
		height: 770rpx;
		// border: 1rpx solid red;
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
		background-color: #000;
		opacity: 0;
		width: 10rpx;
		height: 10rpx;
		border-radius: 20rpx;
		margin: 0 8rpx !important;
		top: -80rpx;
		position: relative;
	}

	.spot.active {
		opacity: 0;
		width: 30rpx;
		background-color: #000;
	}

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

	/* 组件导航列表 start*/
	.nav-list {
		display: flex;
		flex-wrap: wrap;
		padding: 0rpx 12rpx 0rpx;
		justify-content: space-between;

		/* 列表元素 start */
		.nav-list-item {
			padding: 95rpx 30rpx 5rpx 30rpx;
			border-radius: 12rpx;
			width: 45%;
			margin: 0 18rpx 40rpx;
			background-size: cover;
			background-position: center;
			position: relative;
			z-index: 99;

			/* 元素标题 start */
			.nav-link {
				font-size: 32rpx;
				text-transform: capitalize;
				padding: 0 0 10rpx 0;
				position: relative;

				.title {
					color: #FFFFFF;
					margin-top: 100rpx;
					text-align: center;
				}

				.join {
					color: #FFFFFF;
					margin-top: 20rpx;
					margin-bottom: 40rpx;
					text-align: center;
				}
			}

			/* 元素标题 end */

			/* 元素图标 start */
			.icon {
				font-variant: small-caps;
				position: absolute;
				top: 60rpx;
				right: 50rpx;
				left: 37%;
				width: 90rpx;
				height: 90rpx;
				line-height: 90rpx;
				margin: 0;
				padding: 0;
				display: inline-flex;
				text-align: center;
				justify-content: center;
				vertical-align: middle;
				font-size: 50rpx;
				color: #FFFFFF;
				white-space: nowrap;
				opacity: 0.9;
				background-color: rgba(0, 0, 0, 0.05);
				background-size: cover;
				background-position: 50%;
				border-radius: 5000rpx;

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
					background-image: url(https://resource.tuniaokj.com/images/cool_bg_image/icon_bg2.png);
				}
			}

			/* 元素图标 end */
		}

		/* 列表元素 end */
	}

	/* 组件导航列表 end*/


	/* 文章内容 start*/
	.tn-blogger-content2 {
		&__wrap {
			padding: 30rpx 30rpx 10rpx 30rpx;
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
		padding: 180rpx 0rpx;
		font-size: 40rpx;
		font-weight: 300;
		position: relative;
	}

	.image-pic {
		// border: 1rpx solid rgba(0, 0, 0, 0.04);
		background-size: cover;
		background-repeat: no-repeat;
		// background-attachment:fixed;
		background-position: top;
		border-radius: 15rpx;
	}

	/* 文章内容 end*/


	/* 资讯主图 start*/
	.image-article {
		border-radius: 8rpx;
		width: 200rpx;
		height: 200rpx;
		position: relative;
	}


	/* 伙伴主图 start*/
	.image-partner {
		border-radius: 8rpx;
		border: 1rpx solid #F8F7F8;
		height: 100rpx;
		position: relative;
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
</style>