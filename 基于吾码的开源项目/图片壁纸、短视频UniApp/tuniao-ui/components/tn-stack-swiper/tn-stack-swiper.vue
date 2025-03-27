<template>
	<view class="tn-stack-swiper-class tn-stack-swiper" :style="{
      width: $t.string.getLengthUnitValue(width),
      height: $t.string.getLengthUnitValue(height)
    }" :list="swiperList" :itemData="itemData" :currentIndex="swiperIndex" :autoplayFlag="autoplayFlag"
		:change:list="wxs.listObserver" :change:itemData="wxs.itemDataObserver"
		:change:currentIndex="wxs.swiperIndexChange" :change:autoplayFlag="wxs.autoplayFlagChange">
		 <!-- tn-skeleton -->
		<block v-for="(item, index) in list" :key="index">
			<!-- #ifdef MP-WEIXIN -->
			<!--@tap="Click(item)" style="position: relative;" 均为itdos.com新增-->
			<view class="tn-stack-swiper__item tn-stack-swiper__item__transition"
				:class="[`tn-stack-swiper__item--${direction}`]" :data-index="index" :data-switchRate="switchRate"
				@touchstart="wxs.touchStart" :catch:touchmove="touching?wxs.touchMove:''"
				:catch:touchend="touching?wxs.touchEnd:''" 
				@tap="Click(item)"
				style="background-color: rgba(188, 188, 188, 0.3);border-radius: 10px;"
				>
				 <!-- tn-skeleton-fillet -->
				<image v-if="item.Id" class="tn-stack-swiper__image" mode="aspectFill" :src="item.image"></image>
				<view v-else-if="index == swiperIndex" class="" :style="{paddingTop: vuex_custom_bar_height + 'px'}">
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
				<!--by itdos.com START-->
				<view v-if="item.Id && index == swiperIndex" class="content-type-icon" >
					<tn-tag
						class="content-icon-left" 
						shape="circle" 
						size="sm" width="auto" height="40rpx"
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
				<!--by itdos.com END-->
			</view>
			<!-- #endif -->

			<!-- #ifndef MP-WEIXIN -->
			<!--@tap="Click(item)" style="position: relative;" 均为itdos.com新增-->
			<view class="tn-stack-swiper__item" :class="[`tn-stack-swiper__item--${direction}`]" :data-index="index"
				:data-switchRate="switchRate" @touchstart="wxs.touchStart" @touchmove="wxs.touchMove"
				@touchend="wxs.touchEnd"
				@tap="Click(item)"
				style="background-color: rgba(188, 188, 188, 0.3);border-radius: 10px;"
				>
				<image v-if="item.Id" class="tn-stack-swiper__image" mode="aspectFill" :src="item.image"></image>
				<view v-else-if="index == swiperIndex" class="" :style="{paddingTop: vuex_custom_bar_height + 'px'}">
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
				<!--by itdos.com START-->
				<view v-if="item.Id && index == swiperIndex" class="content-type-icon" >
					<tn-tag
						class="content-icon-left" 
						shape="circle" 
						size="sm" width="auto" height="40rpx"
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
				<!--by itdos.com END-->
			</view>
			<!-- #endif -->
		</block>
	</view>
</template>

<!-- #ifdef MP-WEIXIN -->
<script src="./index.wxs" lang="wxs" module="wxs"></script>
<!-- #endif -->
<!-- #ifndef MP-WEIXIN -->
<script src="./index-h5.wxs" lang="wxs" module="wxs"></script>
<!-- #endif -->
<script>
	export default {
		name: 'tn-stack-swiper',
		props: {
			// 显示图片的列表数据
			// {
			//   // 图片地址
			//   image: 'xxx'
			// }
			list: {
				type: Array,
				default () {
					return []
				}
			},
			// 轮播容器的宽度 rpx
			width: {
				type: [String, Number],
				default: '100%'
			},
			// 轮播容器的高度 rpx
			height: {
				type: [String, Number],
				default: 500
			},
			// 自动切换
			autoplay: {
				type: Boolean,
				default: false
			},
			// 自动切换时长 ms
			interval: {
				type: Number,
				default: 5000
			},
			// 滑动切换移动比例, [0 - 100]
			// 比例相对于item的宽度
			switchRate: {
				type: Number,
				default: 30
			},
			// 缩放比例 [0-1]
			scaleRate: {
				type: Number,
				default: 0.1
			},
			// 下一轮播偏移比例
			translateRate: {
				type: Number,
				default: 16
			},
			// 下一轮播透明比例
			opacityRate: {
				type: Number,
				default: 10
			},
			// 滑动方向
			// horizontal -> 水平 vertical -> 垂直
			direction: {
				type: String,
				default: 'horizontal'
			}
		},
		data() {
			return {
				Microi: this.Microi,
				autoplayTimer: null,
				// window窗口的宽度
				windowWidth: 0,
				// 轮播item的宽度
				swiperItemWidth: 0,
				// 轮播item的高度
				swiperItemHeight: 0,
				// 当前选中的轮播item
				swiperIndex: -1,
				// 标记是否开始触摸
				touching: true,
				// 轮播列表信息
				swiperList: [],
				// 标记当前是否为自动播放
				autoplayFlag: false
			}
		},
		computed: {
			itemData() {
				return {
					windowWidth: this.windowWidth,
					itemWidth: this.swiperItemWidth,
					itemHeight: this.swiperItemHeight,
					direction: this.direction,
					autoplaying: this.autoplayFlag
				}
			}
		},
		watch: {
			list(val) {
				var self = this;
				this.swiperList = []
				this.$nextTick(() => {
					this.initSwiperRectInfo()
				})
			},
			autoplay(val) {
				if (!val) {
					this.clearAutoPlayTimer()
				} else {
					this.setAutoPlay()
				}
			}
		},
		created() {
			this.autoplayFlag = this.autoplay
		},
		mounted() {
			this.$nextTick(() => {
				this.initSwiperRectInfo()
			})
		},
		destroyed() {
			this.clearAutoPlayTimer()
		},
		methods: {
			Click(item){
				this.$emit('CallbackClick', item);
			},
			// 初始化轮播容器信息
			async initSwiperRectInfo() {
				// 用于一开始绑定事件
				// this.touching = true
				// 获取轮播item的宽度
				const swiperItemRect = await this._tGetRect('.tn-stack-swiper__item')
				if (!swiperItemRect || !swiperItemRect.width || !swiperItemRect.height) {
					setTimeout(() => {
						this.initSwiperRectInfo()
					}, 50)
					return
				}
				this.swiperItemWidth = swiperItemRect.width
				this.swiperItemHeight = swiperItemRect.height
				// this.touching = false

				// 获取系统的窗口宽度信息
				const systemInfo = uni.getSystemInfoSync()
				this.windowWidth = systemInfo.windowWidth
				this.swiperIndex = 0

				// 设置对应swiper元素的位置和层级信息
				this.swiperList = this.list.map((item, index) => {

					const scale = 1 - (this.scaleRate * index)

					if (this.direction === 'horizontal') {
						item.translateX = ((index * this.translateRate) * 0.01 * this.swiperItemWidth)
					} else if (this.direction === 'vertical') {
						item.translateY = ((index * this.translateRate) * 0.01 * this.swiperItemHeight)
					}
					item.opacity = (1 - ((index * this.opacityRate) * 0.01))
					item.zIndex = this.list.length - index
					item.scale = scale <= 0 ? 0 : scale

					return item
				})

				this.setAutoPlay()
			},
			// 设置自动切换轮播
			setAutoPlay() {
				if (this.autoplay) {
					this.clearAutoPlayTimer()
					this.autoplayFlag = true
					this.autoplayTimer = setInterval(() => {
						this.swiperIndex = this.swiperIndex + 1 > this.swiperList.length - 1 ? 0 : this
							.swiperIndex + 1
					}, this.interval)
				}
			},
			// 清除自动切换定时器
			clearAutoPlayTimer() {
				if (this.autoplayTimer != null) {
					this.autoplayFlag = false
					clearInterval(this.autoplayTimer)
				}
			},
			// 修改轮播选中index
			changeSwiperIndex(e) {
				// console.log(e.index);
				this.swiperIndex = e.index
				this.$emit('change', {
					index: e.index
				})
			},
			// 修改触摸状态
			changeTouchState(e) {
				this.touching = e.touching
			},
			// 打印日志
			printLog(data) {
				console.log("log", data);
			}
		}
	}
</script>

<style lang="scss" scoped>
	//by itdos.com START
	.content-type-icon{
		opacity: 0.9;
		position: absolute;
		right: 20rpx;
		top: 25rpx;
		width: auto;
		height: 40rpx;
		z-index: 1;
		line-height: 40rpx;
		.content-icon{
			font-size: 30rpx;color: #fff;
			 margin-right: 5rpx;
			// box-shadow: 0px 0px 10px 0px #d5d5d5;
		}
	}
	//by itdos.com END
	.tn-stack-swiper {
		position: relative;

		&__item {
			position: absolute;
			border-radius: 20rpx;
			overflow: hidden;

			&--horizontal {
				width: 88%;
				height: 100%;
				transform-origin: left center;
			}

			&--vertical {
				width: 100%;
				height: 88%;
				transform-origin: top center;
			}

			&__transition {
				transition-property: transform, opacity;
				transition-duration: 0.25s;
				transition-timing-function: ease-out;
				// transition: transform, opacity 0.25s ease-in-out !important;
			}
		}

		&__image {
			width: 100%;
			height: 100%;
		}
	}
	
	/* 加载动画   by itdos.com*/
	.loader {
	  position:absolute;
	  width:120rpx;
	  height:120rpx;
	  top:50%;
	  left:50%;
	  transform:translate(-50%, -50%);
	}
	.circle{
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