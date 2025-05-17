<template>
	<view class="template-edit">
		<!-- <web-view :src="htmlUrl" v-if="htmlUrl"></web-view> -->
		<!-- 顶部自定义导航 -->
		<tn-nav-bar fixed customBack :bottomShadow="false" backgroundColor="#16171D">
			<view slot="back" class='tn-custom-nav-bar__back' @click="goBack">
				<text class='icon tn-icon-left-arrow'></text>
			</view>
			<view class="tn-flex tn-flex-col-center tn-flex-row-center">
				<text class="tn-text-bold tn-text-xl tn-color-white">订单信息</text>
			</view>
		</tn-nav-bar>
		<view class="tn-color-white tn-margin-left tn-margin-right"
			:style="{paddingTop: vuex_custom_bar_height + 20 + 'px'}">
			<view class="box-shadow tn-padding-bottom-sm">
				<view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding">
					<view class="justify-content-item" style="width: 100%;">
						<view class="tn-text-bold tn-text-lg">
							商品信息<!-- <text class="tn-color-orange tn-padding-left-xs">*</text> -->
						</view>
						<view class="">
							<!-- <view class="order__item__head tn-flex tn-flex-direction-row tn-flex-col-center tn-flex-row-between">
							    <view class="order__item__head__title">
							      <text class="">订单编号：TN009098765798</text>
							      <text class="tn-icon-copy tn-text-sm tn-padding-left-sm" style="opacity: 0.5;"></text>
							    </view>
							  </view> -->

							<view
								class="order__item__content tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-between">
								<view
									class="tn-flex tn-flex-nowrap tn-flex-direction-row tn-flex-col-center tn-flex-row-left">
									<view class="order__item__content__image">
										<image :src="V8.FileServer + (ProductDetail.YulanT2 || ProductDetail.YulanT)"
											mode="aspectFill"></image>
									</view>
									<!-- <view class="order__item__content__image">
							        <image src="/static/img/5555.png" mode="aspectFill"></image>
							      </view> -->
									<!-- <view class="order__item__content__image">
							        <image src="/static/img/5555.png" mode="aspectFill"></image>
							      </view> -->
									<view class="order__item__content__title">
										{{ProductDetail.ShangpinMC}}
									</view>
								</view>
								<view
									class="order__item__content__info tn-flex tn-flex-direction-column tn-flex-col-center tn-flex-row-center">
									<view class="order__item__content__info__price">
										<text class="order__item__content__info__price--unit">￥</text>
										<text
											class="order__item__content__info__price__value--integer">{{ShangpinJG}}</text>
										<!-- <text class="order__item__content__info__price__value--decimal">.00</text> -->
									</view>
									<view class="order__item__content__info__count">
										<text>共{{Count}}件</text>
									</view>
								</view>
							</view>
							<view
								class="order__item__operation tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-between">
								<view class="order__item__operaation__left tn-text-sm" style="opacity: 0.5;">
									<text class="tn-icon-shop tn-padding-right-xs"></text>
									<text class="">修改数量</text>
								</view>
								<view
									class="order__item__operation__right tn-flex tn-flex-direction-row tn-flex-nowrap tn-flex-col-center tn-flex-row-right">
									<view class="order__item__operation__right__button">
										<tn-button backgroundColor="#FFFFFF" padding="10rpx 18rpx" height="auto"
											:fontSize="38" :plain="true" fontColor="#FFFFFF" shape=""
											@click="UptCount()" style="margin-right: 20px;">
											-
										</tn-button>
										{{ Count }}
										<tn-button backgroundColor="#FFFFFF" padding="10rpx 18rpx" height="auto"
											:fontSize="38" :plain="true" fontColor="#FFFFFF" shape=""
											@click="AddCount()" style="margin-left: 20px;">
											+
										</tn-button>
									</view>
								</view>
							</view>
						</view>
					</view>
				</view>
			</view>

			<view class="box-shadow tn-margin-top-lg tn-padding-bottom-sm">
				<view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding">
					<view class="justify-content-item" style="width: 100%;">
						<view class="tn-text-bold tn-text-lg">
							配送信息<!-- <text class="tn-color-orange tn-padding-left-xs">*</text> -->
						</view>
						<view class="tn-color-gray tn-padding-top tn-padding-bottom tn-color-white">
							<input v-model="ShouhuoR" placeholder="收货人" name="input"
								placeholder-style="color:#AAAAAA"></input>
						</view>
						<view class="tn-color-gray tn-padding-top-xs tn-padding-bottom tn-color-white">
							<input v-model="ShouhuoRSJH" placeholder="手机号" name="input"
								placeholder-style="color:#AAAAAA" value=""></input>
						</view>

						<view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding-bottom"
							@tap="showPicker">
							<view class="justify-content-item">
								<view class="tn-color-gray" style="font-size: 16px;">
									{{ City }}
								</view>
							</view>
							<view class="justify-content-item tn-text-lg tn-color-gray">
								<view class="tn-icon-right"></view>
							</view>
						</view>

						<view class="tn-color-gray tn-padding-top-xs tn-color-white" style="width: 100%;">
							<view class="box-shadow tn-padding-xs" style="border-radius: 10rpx;margin: 0rpx;width:100%">
								<textarea v-model="ShouhuoRXXDZ" maxlength="500" placeholder="详细地址信息"
									placeholder-style="color:#AAAAAA" style="height: 100rpx;width: 100%;"></textarea>
							</view>
						</view>
					</view>
					<!-- <view class="justify-content-item tn-text-xl tn-color-gray">
						<view class="tn-icon-my tn-padding-top"></view>
					</view> -->
				</view>
			</view>



			<!-- <view class="box-shadow tn-margin-top-lg tn-padding-bottom-sm">
				<view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding">
					<view class="justify-content-item">
						<view class="tn-text-bold tn-text-lg">
							支付信息
						</view>
						<view class="tn-color-gray tn-padding-top-xs tn-color-white">
							<input placeholder="请输入您的称呼" name="input" placeholder-style="color:#AAAAAA"
								value=""></input>
						</view>
					</view>
					<view class="justify-content-item tn-text-xl tn-color-gray">
						<view class="tn-icon-my tn-padding-top"></view>
					</view>
				</view>
			</view> -->


			<view class="">
				<tn-picker mode="region" v-model="show" :areaCode='["44", "4401", "440106"]'
					@confirm="confirmPicker"></tn-picker>
			</view>

			<!-- <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding" @tap="showPicker">
        <view class="justify-content-item">
          <view class="tn-text-bold tn-text-lg">
            地区信息 <text class="tn-color-orange tn-padding-left-xs">*</text>
          </view>
          <view class="tn-color-gray tn-padding-top-xs">
            {{ result }}
          </view>
        </view>
        <view class="justify-content-item tn-text-lg tn-color-gray">
          <view class="tn-icon-right tn-padding-top"></view>
        </view>
      </view> -->

			<!-- <view class="tn-flex tn-flex-row-between tn-flex-col-center tn-padding">
				<view class="tn-flex justify-content-item">
					<view class="tn-text-bold tn-text-lg">
						反馈内容 <text class="tn-color-orange tn-padding-left-xs">*</text>
					</view>
				</view> -->
			<!-- <view class="tn-flex justify-content-item tn-color-gray">
          200字内
        </view> -->
		</view>

		<!-- <view class="box-shadow tn-padding" style="border-radius: 10rpx;margin: 0rpx 30rpx 30rpx 30rpx;">
				<textarea maxlength="500" placeholder="请填写反馈内容" placeholder-style="color:#AAAAAA"
					style="height: 300rpx;width: 100%;"></textarea>
			</view> -->

		<!-- <view class="tn-text-bold tn-text-lg tn-padding tn-text-justify tn-strip-top">
        <text>补充相关要求</text>
        <text class="tn-text-sm tn-padding-left-xs" style="opacity: 0.5;">为你提供更好的服务</text>
      </view>
      
       -->
		<!-- <picker @change="bindPickerChange" :value="index" :range="array">
	     <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding">
	       <view class="justify-content-item">
	         <view class="tn-text-bold tn-text-lg">
	           指定发货方式 <text class="tn-color-orange tn-padding-left-xs">*</text>
	         </view>
	         <view class="tn-color-gray tn-padding-top-xs" v-if="index===99">
	           请选择
	         </view>
	         <view class="tn-color-gray tn-padding-top-xs" v-else>
	           {{array[index]}}
	         </view>
	       </view>
	       <view class="justify-content-item tn-text-lg tn-color-gray">
	         <view class="tn-icon-right tn-padding-top"></view>
	       </view>
	     </view>
	   </picker>
	   
	   <picker @change="bindDateChange" :value="index1" :range="array1">
	     <view class="tn-flex tn-flex-row-between tn-strip-bottom-min tn-padding">
	       <view class="justify-content-item">
	         <view class="tn-text-bold tn-text-lg">
	           期望收货时间 <text class="tn-color-orange tn-padding-left-xs">*</text>
	         </view>
	         <view class="tn-color-gray tn-padding-top-xs" v-if="index1===99">
	           请选择
	         </view>
	         <view class="tn-color-gray tn-padding-top-xs" v-else>
	           {{array1[index1]}}
	         </view>
	       </view>
	       <view class="justify-content-item tn-text-lg tn-color-gray">
	         <view class="tn-icon-right tn-padding-top"></view>
	       </view>
	     </view>
	   </picker> -->


		<!-- 悬浮按钮-->
		<view class="tn-flex tn-footerfixed">
			<view class="tn-flex-1 justify-content-item tn-margin-right tn-margin-left-xs tn-text-center">
				<tn-button backgroundColor="#FFFFFF " padding="40rpx 0" width="60%" :fontSize="28" fontColor="#000000"
					shape="round" @click="GoPay()">
					<text class="">去 支 付</text>
				</tn-button>
			</view>
		</view>



	</view>
	</view>
</template>

<script>
	import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
	export default {
		name: 'TemplateEdit',
		mixins: [template_page_mixin],
		data() {
			return {
				BtnLoading : false,
				htmlUrl: '',
				ShangpinJG: 0,
				Count: 1,
				City: '地区信息',
				ProductDetail: {},
				show: false,
				index: 99,
				array: ['暂无要求', '快递送货上门', '物流送货上门-包卸货', '物流送货上门-不包卸货', '物流站点自提', '买家上门自提'],
				index1: 99,
				array1: ['暂无要求', '紧急采购（3天）', '正常采购（一周）', '非紧急采购（协商时间）'],
				result: '请选择收货地区',
				areaCode: [],
				ShouhuoR: '',
				ShouhuoRSJH: '',
				ShouhuoRDQ: '',
				ShouhuoRXXDZ: '',

			}
		},
		onLoad() {
			var self = this;
			self.GetProductDetail();
		},
		methods: {
			async GoPay() {
				var self = this;
				if(self.BtnLoading){
					self.V8.Tips('勿重复提交', false);
					return;
				}
				self.BtnLoading = true;
				var host = window.location.host;
				self.V8.ApiEngine.Run('create-alipay-order-v2', {
					Host: host,
					ShouhuoR: self.ShouhuoR,
					ShouhuoRSJH: self.ShouhuoRSJH,
					ShouhuoRDQ: self.ShouhuoRDQ,
					ShouhuoRXXDZ: self.City,
					TotalAmount: self.ShangpinJG,
					ProductId: self.ProductDetail.Id,
				}, function(result) {
					if (self.V8.CheckResult(result)) {
						self.V8.Tips('接口请求成功！若未弹出支付页面，请连接WIFI、或切换为电信/联通网后重试！');
						window.location.href = result.Data;
						// function triggerFallback(){
						// 	self.V8.ApiEngine.Run('create-alipay-order', {
						// 		Host: host,
						// 		ShouhuoR: self.ShouhuoR,
						// 		ShouhuoRSJH: self.ShouhuoRSJH,
						// 		ShouhuoRDQ: self.ShouhuoRDQ,
						// 		ShouhuoRXXDZ: self.City,
						// 		TotalAmount: self.ShangpinJG,
						// 		ProductId: self.ProductDetail.Id,
						// 	}, (result2) => {
						// 	    window.location.href = result2.Data;
						// 		self.BtnLoading = false;
						// 	});
						// }
						// // 创建隐藏iframe检测目标地址
						// const iframe = document.createElement('iframe');
						// iframe.style.display = 'none';
						// iframe.src = "https://aaa.xiongmao212.com/submit.php";
						
						// // 设置超时定时器
						// let timeoutId = setTimeout(() => {
						// 	iframe.remove(); // 移除iframe避免内存泄漏
						//     triggerFallback(); // 超时触发备用逻辑
						// }, 2000); // 3秒超时限制
						
						// // 成功加载监听
						// iframe.onload = () => {
						// 	clearTimeout(timeoutId); // 清除超时定时器
						// 	iframe.remove();
						//     window.location.href = result.Data; // 确认可达后正式跳转
						// 	self.BtnLoading = false;
						// };
						
						// // 失败监听
						// iframe.onerror = () => {
						// 	clearTimeout(timeoutId); // 清除超时定时器
						//     iframe.remove();
						// 	triggerFallback(); // 网络错误直接触发备用逻辑
						// };
						
						// document.body.appendChild(iframe);
					}
					self.BtnLoading = false;
					// 1. 获取完整的 HTML 结构（需包含 <head> 和 <body>）
					// const parser = new DOMParser();
					// const newDoc = parser.parseFromString(result.Data, 'text/html');
					// 2. 替换 <head> 内容
					// document.head.innerHTML = newDoc.head.innerHTML;
					// 3. 替换 <body> 内容
					// document.body.innerHTML = newDoc.body.innerHTML; 
					// 4. 重新执行新脚本（如果有）
					// const scripts = document.body.getElementsByTagName('script');
					// Array.from(scripts).forEach(oldScript => {
					// 	const newScript = document.createElement('script');
					// 	newScript.text = oldScript.text;
					// 	document.body.appendChild(newScript);
					// 	oldScript.parentNode.removeChild(oldScript);
					// });
				})
			},
			AddCount() {
				var self = this;
				self.Count++;
				self.ShangpinJG = self.Count * self.ProductDetail.ShangpinJG;
			},
			UptCount() {
				var self = this;
				if (self.Count > 1) {
					self.Count--;
					self.ShangpinJG = self.Count * self.ProductDetail.ShangpinJG;
				}
			},
			GetProductDetail() {
				var self = this;
				self.V8.ApiEngine.Run('get-product-detail', {
					Id: self.V8.GetUrlQuery('Id', self)
				}, function(result) {
					if (self.V8.CheckResult(result)) {
						self.ProductDetail = result.Data;
						self.ShangpinJG = self.ProductDetail.ShangpinJG;
					}
				});
			},
			// 跳转
			tn(e) {
				uni.navigateTo({
					url: e,
				});
			},

			bindPickerChange: function(e) {
				this.index = e.detail.value
			},
			bindDateChange: function(e) {
				this.index1 = e.detail.value
			},

			// 打开Picker
			openPicker() {
				this.show = true
			},
			// 弹出Picker
			showPicker(event) {
				this.openPicker()
			},
			// 切换默认地区
			defaultRegionChange(event) {
				if (event.index === 0) {
					this.defaultRegion = ['广东省', '广州市', '天河区']
					this.areaCode = []
				} else if (event.index === 1) {
					this.defaultRegion = []
					this.areaCode = ['44', '4401', '440111']
				}
				this.openPicker()
			},
			// 切换点击遮罩关闭
			maskCloseableChange(event) {
				this.maskCloseable = event.index === 0 ? true : false
				this.openPicker()
			},

			// 点击确认按钮
			confirmPicker(event) {
				this.City = `${event.province.label}-${event.city.label}-${event.area.label}`
			},


		}
	}
</script>

<style lang="scss" scoped>
	/* 胶囊*/
	.tn-custom-nav-bar__back {
		width: 60%;
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

	}

	/* 页面阴影 start*/
	.box-shadow {
		border-radius: 15rpx;
		border: 1rpx solid #494B51;
		background-color: rgba(255, 255, 255, 0.08);
		// box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);
	}

	/* 间隔线 start*/
	.tn-strip-bottom-min {
		width: 100%;
		border-bottom: 1rpx solid #F8F9FB08;
	}

	.tn-strip-top {
		width: 100%;
		border-top: 20rpx solid #F8F9FB08;
	}

	/* 间隔线 end*/

	/* 底部悬浮按钮 start*/
	.tn-tabbar-height {
		min-height: 160rpx;
		height: calc(180rpx + env(safe-area-inset-bottom) / 2);
		height: calc(180rpx + constant(safe-area-inset-bottom));
	}

	.tn-footerfixed {
		position: fixed;
		width: 100%;
		bottom: calc(80rpx + env(safe-area-inset-bottom));
		z-index: 1024;
		box-shadow: 0 1rpx 6rpx rgba(0, 0, 0, 0);

	}

	/* 底部悬浮按钮 end*/

	/* 商品信息 */
	.template-order {}

	/* 底部安全边距 start*/
	.tn-tabbar-height {
		min-height: 40rpx;
		height: calc(60rpx + env(safe-area-inset-bottom) / 2);
		height: calc(60rpx + constant(safe-area-inset-bottom));
	}

	/* 胶囊*/
	.tn-custom-nav-bar__back {
		width: 60%;
		height: 100%;
		position: relative;
		display: flex;
		justify-content: space-evenly;
		align-items: center;
		box-sizing: border-box;
		background-color: rgba(0, 0, 0, 0.15);
		border-radius: 100rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.5);
		color: #FFFFFF;
		font-size: 18px;

		.icon {
			display: block;
			flex: 1;
			margin: auto;
			text-align: center;
		}

	}

	.top-fixed {
		position: fixed;
		top: 0;
		width: 100%;
		transition: all 0.25s ease-out;
		z-index: 100;
	}


	.order {
		&--wrap {
			position: fixed;
			left: 0;
			right: 0;
			width: 100%;
			background-color: inherit;
		}

		/* 导航栏 start */
		&__tabs {
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			background-color: inherit;
		}

		/* 导航栏 end */

		/* 订单内容 start */
		&__item {
			color: #FFFFFF;
			margin: 30rpx;
			padding: 36rpx 26rpx;
			border-radius: 15rpx;
			border: 1rpx solid #494B51;
			background-color: rgba(255, 255, 255, 0.08);
			border-radius: 15rpx;
			// box-shadow: 0rpx 0rpx 50rpx 0rpx rgba(0, 0, 0, 0.07);

			&:first-child {
				margin-top: 40rpx;
			}

			&:last-child {
				margin-bottom: 0;
			}

			/* 头部 start */
			&__head {

				&__title {
					font-weight: bold;
					line-height: normal;

					&--right-icon {
						font-size: 24rpx;
						margin-left: 8rpx;
					}
				}

				&__status {
					font-size: 22rpx;
					color: #AAAAAA;
				}
			}

			/* 头部 end */

			/* 内容 start */
			&__content {

				margin-top: 20rpx;

				&__image {
					margin-right: 20rpx;

					image {
						width: 140rpx;
						height: 140rpx;
						border-radius: 10rpx;
					}
				}

				&__title {
					padding-right: 40rpx;
					display: -webkit-box;
					overflow: hidden;
					white-space: normal !important;
					text-overflow: ellipsis;
					word-wrap: break-word;
					-webkit-line-clamp: 2;
					-webkit-box-orient: vertical;
				}

				&__info {

					&__price {
						&--unit {
							font-size: 20rpx;
						}

						&__value--integer,
						&__value--decimal {
							font-weight: bold;
						}

						&__value--decimal {
							font-size: 20rpx;
						}
					}

					&__count {
						color: #AAAAAA;
						font-size: 24rpx;
					}
				}
			}

			/* 内容 end */

			/* 操作按钮 start */
			&__operation {
				margin-top: 20rpx;

				&__right {
					&__button {
						margin-left: 10rpx;
					}
				}
			}

			/* 操作按钮 end */
		}

		/* 订单内容 end */
	}
</style>