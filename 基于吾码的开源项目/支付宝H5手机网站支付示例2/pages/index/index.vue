<template>
	<view>
		<view class="sign_bj_box">
			<image src="/static/sign_bj.png" mode=""></image>
		</view>
		<view class="sign_content_box">
			<view class="content_title_box">
				<view class="content_title_heng"></view>
				<view class="content_title_text">支付宝在线支付</view>	
				<view class="content_title_heng"></view>
			</view>
			<view class="content_title1">Alipay online.</view>
			<view class="form_content_box">
				<view class="form_content_title_box">消费信息</view>
				
				<view class="form_content_item_box" @click="open">
					<view class="form_content_item_name">消费金额</view>
					<view class="form_content_item_input" >
						<!-- <input type="digit" disabled placeholder="必填" v-model="expense" /> -->
						<input type="number" placeholder="[必填]" v-model="expense" />
					</view>
				</view>
				
				
				
				<view class="form_content_item_box">
					<view class="form_content_item_name">收货人</view>
					<view class="form_content_item_input">
						 <!-- :focus="isFocus" -->
						<input type="text" placeholder="(选填)"  v-model="name" />
					</view>
				</view>
				
				<view class="form_content_item_box"  style="margin-bottom: 0;">
					<view class="form_content_item_name">手机号</view>
					<view class="form_content_item_input">
						<input type="number" maxlength="11" placeholder="(选填)" v-model="phone" />
					</view>
				</view>
				<view class="form_content_item_box">
					<view class="form_content_item_name">商品名称</view>
					<view class="form_content_item_input">
						 <!-- :focus="isFocus" -->
						<input type="text"  v-model="productName" disabled />
					</view>
				</view>
				<view class="form_content_item_box"  style="margin-bottom: 0;">
					<view class="form_content_item_name">收获地址</view>
					<view class="form_content_item_input">
						<input type="text" maxlength="11" disabled v-model="address" />
					</view>
				</view>
			
				
			</view>
			
			<view class="expense_tip_box">
				<view class="expense_tip_title">
					<!-- 路费报销须知 -->
				</view>
				<view class="expense_desc">
					<!-- 这里是路费报销须知这里是路费报销须知这里是路费报销须知 -->
				</view>	
				
			</view>
			<!-- <view class="agree_xieyi_box">
				 <image src="https://lhyzapi.400539.com/assets/weapp/samll_select1.png" mode=""  @click="handleAgree()" v-if="select_agree==1"></image>
				 <image src="https://lhyzapi.400539.com/assets/weapp/samll_select.png" mode=""  @click="handleAgree()" v-if="select_agree==0"></image>
				 我已阅读并同意  <text >《隐私协议》</text>
			</view> -->
			<view  style="height: 150rpx;"></view>
			
			<view class="fix_submit_box">
				<view class="submit_box" hover-class="submit_box_hover" @click="handleSubmit()">去支付</view>
			</view>	
			
		</view> 
		<lzc-keyboard ref="lzckeyboard" :defaultValue='defaultValue' confirmText='确定' :confirmStyle='confirmStyle' @change="change" @confirm="confirm" @hide="hide"></lzc-keyboard>
	</view
>
</template>
<script>
	import lzcKeyboard from "@/components/lzc-keyboard/lzc-keyboard.vue";
	export default {
		components: {
			lzcKeyboard,
		},
		data() {
			return {
				productName:'日用品生活用品零售批发',
				address:'到店取货',
				confirmStyle:{
					backgroundColor:'#162F8A'
				}, 
				isFocus:true,
				expense:'',
				defaultValue:'',
				btn_status:true,
				phone:'',
				name:'',
				idcard:'',
				select_agree:0,
				
			};
		},
		onLoad(e) {
			var self = this;
			self.$nextTick(function(){
				// self.$refs.lzckeyboard.open(); 
			});
		},
		methods:{
			change(e){
				// if(e>200){
				// 	this.$nextTick(() => {
				// 		this.expense = 0;
				// 		this.defaultValue = this.expense
				// 	})
				// 	uni.showToast({
				// 		title:'金额不能超过200元',
				// 		icon:'none'
				// 	})
				// }else{
					this.$nextTick(() => {
						this.expense = e;
						this.defaultValue = this.expense
					})
				// }
				console.log("数字改变",e);			
			},
			open(){
				console.log("打开键盘");
				// this.$refs.lzckeyboard.open(); 
			},
			confirm(e){
				console.log("付款",e);
			},
			hide(){
				console.log("关闭键盘")
			},
			handleAgree(){
				var a = this
				if(a.select_agree==0){
					a.select_agree=1
				}else{
					a.select_agree=0
				}
			},
			handleSubmit(){
				var a = this;
				var payLine = '';
				var host = window.location.host;
				if(host == 'net.microi.net:1305'){
					payLine = 'microi';
				}else if(host == 'net.itdos.com:1303'){
					payLine = 'itdos';
				}
				var requestOptions = {
					url: 'https://os.microios.com:1100/apiengine/create-alipay-order',
					data: {
						PayLine : payLine,
						TotalAmount : this.expense,
						MaijiaCH : this.name,
						MaijiaSJH : this.phone
					},
					header: {
						'content-type': 'application/json;charset=UTF-8',
						'OsClient' : 'microios',
					},
					method: 'POST',
					dataType: 'json',
				};
				// if(ResponseType){
				// 	requestOptions.responseType = ResponseType;
				// }
				uni.request({
					...requestOptions,
					success: (res) => {
						var result = res.data;
						if(result.Code == 1){
							window.location.href = result.Data;//get
						}else{
							uni.showToast({
								title: result.Msg,
								icon: 'error',//Icon || (isSuccess ? 'success' : 'error'),//error(有效)、fail(无效)、exception(无效)
								duration: 2000,//Time || (isSuccess ? 1000 : 2000),
								// class: CssClass || 'microi-toast',//有效
								position : 'center',//（仅App生效）、top、bottom
							})
						}
					},
					fail: (res) => {
						uni.showToast({
							title: `网络出现问题，请重试：${res.errMsg}`,
							icon: 'error',//Icon || (isSuccess ? 'success' : 'error'),//error(有效)、fail(无效)、exception(无效)
							duration: 2000,//Time || (isSuccess ? 1000 : 2000),
							// class: CssClass || 'microi-toast',//有效
							position : 'center',//（仅App生效）、top、bottom
						})
					}
				})
				// if(a.name==''){
				// 	uni.showToast({
				// 		title:'请输入姓名',
				// 		icon:'none'
				// 	})
				// }else if(a.phone==''){
				// 	uni.showToast({
				// 		title:'请输入联系电话',
				// 		icon:'none'
				// 	})
				// }else if(a.phone.length!=11){
				// 	uni.showToast({
				// 		title:'手机号不足11位',
				// 		icon:'none'
				// 	})
				// }else if(!/^(13[0-9]|14[01456879]|15[0-35-9]|16[2567]|17[0-8]|18[0-9]|19[0-35-9])\d{8}$/.test(a.phone)){
				// 	uni.showToast({
				// 		title:'手机号格式不正确',
				// 		icon:'none'
				// 	})
				// }else if(a.expense==''){
				// 	uni.showToast({
				// 		title:'请输入路费金额',
				// 		icon:'none'
				// 	})
				// }else if(a.expense<0 || a.expense>200){
				// 	uni.showToast({
				// 		title:'请输入正确的路费金额',
				// 		icon:'none'
				// 	})
				// }else if(a.select_agree==0){
				// 	uni.showToast({
				// 		title: '请先阅读并同意隐私协议',
				// 		icon: 'none'
				// 	})
				// }else{
				// 	// 请求接口
					
				// }
			},
		}
	}
</script>

<style lang="scss">
page {
	background-color: #f5f6f8;
}	
.top_nav_box{
	position: absolute;
	top: 0;
	left: 0;
	z-index: 10;	
}
.sign_bj_box{
	width: 750rpx;
	height: 636rpx;
	image{
		width: 100%;
		height: 100%;
	}
}
.sign_content_box{
	position: absolute;
	width: 750rpx;
	left: 0;
	top: 0;
	.content_title1{
		text-align: center;
		color: #fff;
		font-weight: 400;
		padding-top: 16rpx;
		padding-bottom: 48rpx;
	}
	.content_title_box{
		display: flex;
		align-items: center;
		justify-content: center;
		padding-top: 30rpx;
		.content_title_text{
			font-weight: 600;
			font-size: 52rpx;
			color: #FFF;
			margin: 0 32rpx;
			height: 60rpx;
			line-height: 60rpx;
		}
		.content_title_heng{
			width: 120rpx;
			height: 2rpx;
			background: #fff;
		}
	}
	.form_content_box{
		width: 686rpx;
		min-height: 336rpx;
		margin: 0 auto;
		border-radius: 16rpx;
		background: #FFF;
		padding-top: 28rpx;
		padding-bottom: 24rpx;
		.form_content_title_box{
			padding-left: 24rpx;
			font-weight: 600;
			color: #303133;
			font-size: 30rpx;
			padding-bottom: 28rpx;
		}
		.form_content_item_box{
			width: 638rpx;
			height: 88rpx;
			border-radius: 12rpx;
			background-color: #f5f6f8;
			display: flex;
			align-items: center;
			margin: 0 auto;
			margin-bottom: 20rpx;
			.form_content_item_name{
				width: 156rpx;
				margin-left: 24rpx;
				height: 88rpx;
				line-height: 88rpx;
				font-weight: 600;
				color: #303133;
				font-size: 30rpx;
			}
			.form_content_item_picker{
				height: 88rpx;
				position: relative;
				font-size:30rpx;
				width: 430rpx;
				.pick_img{
					width: 44rpx;
					height: 44rpx;
					position: absolute;
					right: 0;
					image{
						width: 44rpx;
						height: 44rpx;
						margin-top:24rpx;
					}
				}
				picker{
					z-index: 9;
					position: absolute;
					top: 0;
					left: 0;
					width: 430rpx;
					height:88rpx;	
					.pick_input{
						height: 88rpx;
						line-height: 88rpx;
						text-align: left;
					}
					.pick_input1{
						color: #808080;
					}
				}
			}
			.form_content_item_input{
				width: 420rpx;
				height: 88rpx;
				input{
					height: 88rpx;
					line-height: 88rpx;
					font-size: 30rpx;
				}
			}
		}
	}
	.expense_img_box{
		width: 686rpx;
		min-height: 202rpx;
		border-radius: 12rpx;
		background: var(--unnamed, #FFF);
		margin: 0 auto;
		margin-top: 20rpx;
		padding-top: 28rpx;
		.img_list{
			display: flex;
			width: 642rpx;
			margin: 0 auto;
			flex-wrap: wrap;
			padding-bottom: 24rpx;
		}
		.form_content_title_box{
			padding-left: 24rpx;
			font-weight: 600;
			color: #303133;
			font-size: 30rpx;
			padding-bottom: 14rpx;
		}
	}
	.expense_tip_box{
		padding: 32rpx;
		padding-bottom: 0;
		.expense_tip_title{
			color: var(--unnamed, #303133);
			font-size: 26rpx;
			font-weight: 600;
		}
		.expense_desc{
			padding-top: 10rpx;
			word-break: break-all;
			white-space:normal; 
			word-wrap:break-word;
			word-break:break-word;
		}
	}
	.fix_submit_box{
		width: 750rpx;
		box-shadow: 0rpx 0rpx 26rpx 0rpx rgba(0,0,0,0.0800);
		padding-bottom: calc(16rpx +  constant(safe-area-inset-bottom));
		padding-bottom: calc(16rpx +  env(safe-area-inset-bottom));
		position: fixed;
		z-index: 70;
		left: 0;
		bottom: 0;
		background-color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		padding-top: 16rpx;
		.submit_box{
			width: 686rpx;
			height: 80rpx;
			text-align: center;
			line-height: 80rpx;
			color: #fff;
			font-size: 30rpx;
			margin: 0 auto;
			border-radius: 200rpx;
			background: linear-gradient(270deg, #F6D741 0%, #00985F 29.69%, #1D2088 100%), linear-gradient(270deg, #EFE925 0%, #31D054 49.87%, #1C77FF 100%);
		}
		.submit_box_hover{
			opacity: 0.8;
		}
	}
	.agree_xieyi_box{
		display: flex;
		align-items: center;
		padding-left: 36rpx;
		font-size: 24rpx;
		color: #606266;
		padding-top: 40rpx;
		margin-bottom: 96rpx;
		text{
			color: #1C77FF;
			margin: 0 0rpx
		}
		image{
			width: 36rpx;
			height: 36rpx; 
			margin-right: 8rpx;
		}
	}
	
}	
</style>
