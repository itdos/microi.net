<template>
	<view class="template-pay tn-safe-area-inset-bottom"
		v-if="(Microi.ClientSystem != 'IOS' && Microi.ClientType == 'WeChat') 
				|| Microi.SysConfig.MiniProgramIosPay == 1
				|| Microi.ClientType != 'WeChat'
				"
		>
		<!-- 顶部自定义导航 -->
		<tn-nav-bar fixed alpha customBack> 
			<view slot="back" class='tn-custom-nav-bar__back' @click="goBack">
				<text class='icon tn-icon-left'></text>
				<text class='icon tn-icon-home-capsule-fill'></text>
			</view>
		</tn-nav-bar>


		<view class="" :style="{paddingTop: vuex_custom_bar_height + 'px'}">
			<view class="tn-margin">
				<view class="button-vip tn-flex tn-flex-row-between tn-shadow-blur tn-main-gradient-aquablue">
					<view class="tn-margin-left tn-margin-top-sm">
						<!-- tn-padding-top -->
						<view class="tn-color-white tn-text-left">
							<!-- <text class="tn-icon-rabbit tn-padding-right-sm"
								style="font-size: 80rpx;"></text> -->
							<text class="tn-text-bold" style="font-size: 60rpx;">
								{{CurrentUser.HuiyuanJB || '免费会员'}}
							</text>
						</view>
						<view class="tn-color-white tn-text-sm" style="padding-top: 10rpx;opacity: 0.6;">
							<view>
								图片每日下载次数：{{CurrentVipLevelModel.TupianMRXZCS || 0}} 次/天
							</view>
							<view v-if="Microi.SysConfig.MiniProgramVideo || Microi.ClientType == 'APP' || Microi.ClientType == 'H5'">
								短视频每日观看次数：{{CurrentVipLevelModel.DuanshiPMRGKCS || 0}} 次/天
							</view>
							<view v-if="Microi.SysConfig.MiniProgramVideo || Microi.ClientType == 'APP' || Microi.ClientType == 'H5'">
								短视频每日下载次数：{{CurrentVipLevelModel.DuanshiPMRXZCS || 0}} 次/天
							</view>
							<view v-if="(Microi.SysConfig.MiniProgramVideo  || Microi.ClientType == 'APP' || Microi.ClientType == 'H5')">
								长视频每日观看次数：{{CurrentVipLevelModel.ChangshiPMRGKCS || 0}} 次/天
							</view>
							<view v-if="(Microi.SysConfig.MiniProgramVideo  || Microi.ClientType == 'APP' || Microi.ClientType == 'H5')">
								长视频每日下载次数：{{CurrentVipLevelModel.ChangshiPMRXZCS || 0}} 次/天
							</view>
							
						</view>
					</view>
				</view>
			</view>

		</view>

		<view class="tn-margin tn-padding-top tn-color-white tn-text-lg tn-text-bold">
			选择升级项目
		</view>
		
		<!-- tn-flex tn-flex-col-center tn-flex-wrap -->
		<view class="tn-color-white tn-margin">
			<view v-for="(item, index) in VipLevelList" :key="item.Id"
				class="tn-padding-sm tn-text-left"
				:class="SelectedVipLevel.Id == item.Id ? 'tag-select' : 'tag-select-no'"
				@tap="SelectVipLevel(item)">
				 <!-- tn-padding-top-sm -->
				<view class="tn-text-xl">
					<!-- <text class="tn-icon-rabbit tn-padding-right-sm" style="margin-left: 0rpx;"></text> -->
					<text class="tn-text-md tn-text-bold" style="margin-right: 10rpx;">{{item.Mingcheng}} </text>
					<text class="tn-text-bold tn-color-red"> ￥{{item.HuiyuanJG}}</text>
				</view>
				<view class="tn-padding-top-xs tn-text-sm" style="color: #888CA0;">
					<view>
						图片每日下载次数：{{item.TupianMRXZCS || 0}} 次/天
					</view>
					<view v-if="Microi.SysConfig.MiniProgramVideo || Microi.ClientType == 'APP' || Microi.ClientType == 'H5'">
						短视频每日观看次数：{{item.DuanshiPMRGKCS || 0}} 次/天
					</view>
					<view v-if="Microi.SysConfig.MiniProgramVideo || Microi.ClientType == 'APP' || Microi.ClientType == 'H5'">
						短视频每日下载次数：{{item.DuanshiPMRXZCS || 0}} 次/天
					</view>
					<view v-if="(Microi.SysConfig.MiniProgramVideo  || Microi.ClientType == 'APP' || Microi.ClientType == 'H5')">
						长视频每日观看次数：{{item.ChangshiPMRGKCS || 0}} 次/天
					</view>
					<view v-if="(Microi.SysConfig.MiniProgramVideo || Microi.ClientType == 'APP' || Microi.ClientType == 'H5')">
						长视频每日下载次数：{{item.ChangshiPMRXZCS || 0}} 次/天
					</view>
				</view>
			</view>
		</view>


		<!-- <view class="tn-margin tn-padding-top tn-color-white tn-text-lg tn-text-bold">
			或输入充值金额
		</view>

		<view class="tn-margin tn-padding-top-xs">
			<view class="tn-flex" style="border-radius: 10rpx;padding: 20rpx 30rpx;background-color: #FFFFFF30;">
				<text class="tn-flex tn-text-lg tn-padding-right-xs tn-color-white">￥</text>
				<input placeholder="请输入充值金额" name="input" placeholder-style="color:#AAAAAA"
					style="width: 100%;color: #FFFFFF;"></input>
			</view>
		</view> -->

		<tn-modal v-model="ShowAgreePay"
			:custom="true" 
			:showCloseBtn="true"
			:title="NoticeModel.Biaoti"
			:safeAreaInsetBottom="true"
			>
			<view class="custom-modal-content">
				<view class="tn-icon tn-icon-about-fill"></view>
				<view ref="content" class="content" style="max-height: 700rpx;overflow-y: scroll;">
					<view class="text" v-html="NoticeModel.Neirong"></view>
				</view>
				<view style="margin-top: 40rpx;margin-bottom: 15rpx;">
					<tn-button shape="round" backgroundColor="#1D2541" fontColor="#ffffff" padding="40rpx 70rpx" width="49%" shadow
						@tap="AgreePay = false;ShowAgreePay = false;"
						style="margin-right: 4rpx;"
						>
					  <!-- <text class="tn-icon-wechat tn-padding-right-xs tn-text-xl"></text> -->
					  <text class="">
						  不同意
					  </text>
					</tn-button>
					<tn-button shape="round" backgroundColor="#1D2541" fontColor="#ffffff" padding="40rpx 70rpx" width="49%" shadow
						@tap="AgreePay = true;ShowAgreePay = false;"
						>
					  <text class="tn-icon-wechat tn-padding-right-xs tn-text-xl"></text>
					  <text class="">
						  同意
					  </text>
					</tn-button>
				</view>
			</view>
		</tn-modal>
		<!-- 悬浮按钮-->
		<view class="tn-flex tn-footerfixed" style="background-color: #161324;">
		  <view class="tn-flex-1 justify-content-item tn-margin tn-text-center">
		    <view class="tn-padding-lg"
				>
			<text class="tn-icon-tip tn-padding-right-xs tn-color-gray"></text>
				<tn-checkbox v-model="AgreePay"
				  :name="AgreePay">
				  </tn-checkbox>
		      <text class="tn-color-gray">充值前请查看并同意</text>
		      <text class="tn-color-blue--disabled">《充值协议》</text>
			  <!-- <tn-checkbox-group>
				<tn-checkbox v-model="AgreePay"
				  :name="AgreePay">
					充值前请查看并同意《充值协议》
				  </tn-checkbox>
			  </tn-checkbox-group> -->
		    </view>
		    <tn-button 
				@click="Pay()"
				backgroundColor="#4327DF" padding="40rpx 0" shape="round" width="80%">
		      <text class="tn-color-white">立 即 充 值</text>
		    </tn-button>
		  </view>
		</view>
		
	</view>
</template>

<script>
	import {
		mapState
	} from 'vuex'
	import template_page_mixin from '@/libs/mixin/template_page_mixin.js'
	export default {
		name: 'TemplatePay',
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
		onLoad() {
			var self = this;
			//获取当前登录用户的会员级别信息
			var param = {};
			if(self.CurrentUser.HuiyuanJBID){
				param.Id = self.CurrentUser.HuiyuanJBID;
			}else{
				param._Where = [{ Name : 'HuiyuanJBKEY', Value : 'free', Type : '=' }]
			}
			self.Microi.FormEngine.GetFormDataAnonymous('diy_vip_level', param, function(result){
				if(result.Code == 1){
					self.CurrentVipLevelModel = result.Data;
				}
			});
			self.Microi.ApiEngine.Run('get_vip_level_list', {}, function(result){
				if(self.Microi.CheckResult(result)){
					self.VipLevelList = result.Data;
				} 
			});
			self.Microi.ApiEngine.Run('get_pay_agreement', {}, function(result){
				if(self.Microi.CheckResult(result)){
					self.NoticeModel = result.Data;
				}
			});
		},
		data() {
			return {
				Microi: this.Microi,
				NoticeModel:{},
				AgreePay:false,
				ShowAgreePay:false,
				VipLevelList:[],
				CurrentVipLevelModel : {},
				SelectedVipLevel:{},
			}
		},
		methods: {
			SelectVipLevel(item){
				this.SelectedVipLevel = item;
			},
			Pay(){
				var self = this;
				if(!self.AgreePay){
					self.ShowAgreePay = true;
					return;
				}
				if(!self.SelectedVipLevel.Id){
					self.Microi.Tips('请选择要升级的项目！', false);
					return;
				}
				if(self.SelectedVipLevel.HuiyuanJG <= 0){
					self.Microi.Tips('会员价格小于等于0，无法升级！', false);
					return;
				}
				self.Microi.ApiEngine.Run('v3_pay_transactions_jsapi', {
					ProductId : self.SelectedVipLevel.Id,
				}, function(result){
					if(self.Microi.CheckResult(result)){
						//https://pay.weixin.qq.com/wiki/doc/apiv3/apis/chapter3_5_4.shtml
						uni.requestPayment({
							provider: 'wxpay',
							timeStamp: result.Data.timeStamp,//时间戳，秒
							nonceStr: result.Data.nonceStr,//随机字符串，不长于32位。
							package: result.Data.package,//小程序下单接口返回的prepay_id参数值。
							signType: 'RSA',//签名类型，默认为RSA，仅支持RSA。
							paySign: result.Data.paySign,//签名，使用字段appId、timeStamp、nonceStr、package计算得出的签名值
							success: function(res) {
								self.Microi.Tips('支付成功', true);
								// uni.redirectTo({
								// 	url: '/pages/money/paySuccess'
								// })
								uni.navigateBack();
							},
							fail: function(err) {
								self.Microi.Tips('支付失败：' + err.errMsg, false)
							}
						});
					}
				})
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

	.template-pay {
		// height: 100vh;
		height: 100%;
		background-color: #161324;
		padding-bottom: 400rpx;
	}

	/* 底部悬浮按钮 start*/
	.tn-tabbar-height {
		min-height: 100rpx;
		height: calc(120rpx + env(safe-area-inset-bottom) / 2);
	}

	.tn-footerfixed {
		position: fixed;
		width: 100%;
		// bottom: calc(60rpx + env(safe-area-inset-bottom));
		bottom: 0;
		// padding-bottom: calc(60rpx + env(safe-area-inset-bottom));
		padding-bottom: calc(env(safe-area-inset-bottom));
		z-index: 1024;
		box-shadow: 0 1rpx 6rpx rgba(0, 0, 0, 0);

	}

	/* 底部悬浮按钮 end*/

	/* 卡 */
	.button-vip {
		width: 100%;
		height: 300rpx;
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
			background-image: url(https://resource.tuniaokj.com/images/cool_bg_image/icon_bg4.png);
		}
	}

	.tag-select {
		// width: 31%;
		width: 100%;
		border: 4rpx solid #4327DF;
		// margin: 8rpx 1%;
		margin-top: 10rpx;
		margin-bottom: 10rpx;
		border-radius: 20rpx;
		background-color: #211E2F50;
	}

	.tag-select-no {
		// width: 31%;
		width: 100%;
		border: 4rpx solid #211E2F;
		// margin: 8rpx 1%;
		margin-top: 10rpx;
		margin-bottom: 10rpx;
		border-radius: 20rpx;
		background-color: #211E2F;
	}
</style>