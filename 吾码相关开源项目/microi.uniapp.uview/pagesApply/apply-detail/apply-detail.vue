<template>
	<view class="apply_detail_wrapper">
		<u-navbar :is-back="true" title="详情" title-color="#171717" title-size="34" :title-bold="true">		</u-navbar>
		<view class="detail_header">
			<image src="../../static/logo.png" class="apply_avatar"></image>
			<view class="apply_user">
				<view class="apply_title">由罗丹红提交的请假申请</view>
				<view class="apply_time">2021-09-08 16:40</view>
			</view>
			<image class="watermark" src="../../static/img/apply/xq-tongguo.png"></image>
		</view>
		<view class="apply_detail_info">
			<view class="apply_detail_item">
				<view class="detail_label">
					申请人
				</view>
				<view class="detail_content">
					罗丹红&设计部
				</view>
			</view>
			<!-- 到时候数据渲染v-for apply_detail_item -->
			<view class="apply_detail_item">
				<view class="detail_label">
					类型
				</view>
				<view class="detail_content">
					调休
				</view>
			</view>
			<view class="apply_detail_item">
				<view class="detail_label">
					时长
				</view>
				<view class="detail_content">
					<view class="duration">
						2.5小时
					</view>
					<view class="time_axis">
						<view class="timeline">
							<view class="time_line_item">2021-09-08 12:00</view>
							<view class="time_line_item">2021-09-08 14:30</view>
						</view>
					</view>
				</view>
			</view>
			<view class="apply_detail_item">
				<view class="detail_label">
					请假原因
				</view>
				<view class="detail_content">
					<view class="reason u-line-2">
						整箱订单数据展示，分页功能实现，订单详情TAB和对应内容显示，装箱货物信息下载的功能...
					</view>
					<view class="reason_image_wrapper">
						<image src="../../static/logo.png" class="reason_image"></image>
					</view>
				</view>
			</view>
			<view class="approval_no_wrapper">
				<text>审批编号</text>
				<text class="approval_no">2014784445546</text>
			</view>
		</view>
		<view class="approval_progress">
			<view class="approval_hd">
				<view class="approval_title">审批进度</view>
			</view>
			<view class="approval_bd">
				<!-- 未通过有备注内容，给了固定高度 -->
				<!-- 后续拿数据的时，如果未通过务必:class一个approval_error类 否则时间轴线会过长 -->
				<view class="approval_list approval_error">
				<!-- <view class="approval_list"> -->
					<view class="approval_item">
						<view class="approval_user_wrapper ">
							<view class="approval_user_info">
								<image src="../../static/logo.png" class="approval_user_avatar"></image>
								<view class="approval_username">
									罗丹红
								</view>

							</view>
							<view class="approval_time">
								2021-09-08 16:40
							</view>
							<!-- 到时候v-if判断审批状态是否未通过 是才显示这个 -->
							<!-- <view class="approval_mark u-line-3">
							</view> -->
						</view>
						<!-- 动态绑定类 approval_success  通过 approval_fail 未通过-->
						<view class="approval_status">
							提交审批
						</view>
					</view>
					
					<view class="approval_item">
						<!-- 图标动态给在这样式 默认是钩，例如待审批  -->
						<!-- 如果要给自定义图标，其他状态，在这加↓ 案例：approval_waiting -->
						<view class="approval_user_wrapper approval_waiting">
							<view class="approval_user_info">
								<image src="../../static/logo.png" class="approval_user_avatar"></image>
								<view class="approval_username">
									舒欣欣
								</view>
							</view>
							<view class="approval_time">
								2021-09-08 16:40
							</view>
						</view>
						<view class="approval_status">
							待审批
						</view>
					</view>			
					<view class="approval_item">
						<view class="approval_user_wrapper">
							<view class="approval_user_info">
								<image src="../../static/logo.png" class="approval_user_avatar"></image>
								<view class="approval_username">
									罗丹红
								</view>

							</view>
							<view class="approval_time">
								2021-09-08 16:40
							</view>
						</view>
						<view class="approval_status approval_success">
							通过
						</view>
					</view>
					<view class="approval_item">
						<view class="approval_user_wrapper">
							<view class="approval_user_info">
								<image src="../../static/logo.png" class="approval_user_avatar"></image>
								<view class="approval_username">
									罗丹红
								</view>
							</view>
							<view class="approval_time">
								2021-09-08 16:40
							</view>
							<view class="approval_mark u-line-3">
								Lorem ipsum dolor sit amet, consectetur adipisicing elit. Similique atque quia eos
								beatae dolores perferendis maiores neque dolorum optio culpa asperiores earum minima
								sapiente? Accusantium dolor esse similique facilis laudantium.
							</view>
						</view>

						<view class="approval_status approval_fail">
							不通过
						</view>
					</view>
				
				 </view>
			</view>
		</view>
		<view class="apply_footer">
			<!-- 因为审批人和被审批人界面都一样的，只是权限不同，到时候看情况显示按钮 -->
			<view class="footer_item">
				<image class="footer_img" src="../../static/img/apply/bianji.png"></image>
				<text>编辑</text>
			</view>
			<view class="footer_item">
				<image class="footer_img" src="../../static/img/apply/chexiao.png"></image>
				<text>撤销</text>
			</view>
			<view class="footer_item" @click="popShow = true">
				<image class="footer_img" src="../../static/img/apply/bianji.png"></image>
				<text>审批</text>
			</view>
		</view>
			<u-popup v-model="popShow" mode="bottom" border-radius="48" safe-area-inset-bottom="true" height="50%">
				<view class="pop_wrapper">
					<image class="del" src="../../static/img/apply/del.svg" mode="" @click="popShow = false"></image>
					<view class="pop_inp_wrapper">
						<u-input v-model="comments" type="textarea" height="100" :autoHeight="true" placeholder="请输入审批意见(必填)" :clearable="false" />
					</view>
					<view class="pop_control">
						<view class="addition">
							<u-upload :action="action" :file-list="fileList" width="100" height="100" :showText="false"></u-upload>
						</view>
						<view class="sendMsgTo">
							<u-radio-group v-model="checkedSend">
								<u-radio>
									<text>审批意见通过聊天转发给</text>
									<text class="sendName">桂淑英</text>
								</u-radio>
							</u-radio-group>
						</view>
						<u-button :custom-style="loginBtn" @click="goShenpi">
							确认同意
						</u-button>
					</view>
				</view>
			</u-popup>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				popShow: false ,// 弹框
				comments: "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Eveniet minus magni ad quibusdam eos soluta expedita consequuntur aliquam sunt dolor alias numquam harum minima. Hic molestias dolores magnam fugiat illum.",
				checkedSend: '',
				loginBtn:{
					width: '100%',
					height: '100rpx',
					borderRadius: '8rpx',
					backgroundColor: '#3F5CD9',
					color: '#fff',
					fontSize: '32rpx',
					textAlign: 'center',
					lineHeight: '100rpx',
					marginTop: '40rpx'
				},
				// 演示地址，请勿直接使用
				action: 'http://www.example.com/upload',
				fileList: [
					
				]
			}
		},
		methods: {
			goShenpi(){
				this.popShow = false
			}
		}
	}
</script>

<style lang="scss">
	page {
		background-color: #F5F7F9;
	}

	.apply_detail_wrapper {
		&::after {
			content: '';
			display: block;
			height: 300rpx;
		}

		.detail_header {
			display: flex;
			align-items: center;
			padding: 0 30rpx;
			height: 150rpx;
			background: #fff;
			position: relative;

			.watermark {
				position: absolute;
				right: 55rpx;
				top: 70rpx;
				width: 185rpx;
				height: 166rpx;
			}

			.apply_avatar {
				width: 72rpx;
				height: 72rpx;
				border-radius: 8rpx;
			}

			.apply_user {
				margin-left: 36rpx;

				.apply_title {
					font-size: 32rpx;
					font-weight: 500;
				}

				.apply_time {
					font-size: 24rpx;
					margin-top: 20rpx;
					font-weight: 500;
					color: #BEC1CC;
				}
			}
		}

		.apply_detail_info {
			margin-top: 21rpx;
			background: #fff;

			.apply_detail_item {
				display: flex;
				padding: 34rpx 33rpx 0;

				&:nth-last-child(2) {
					display: block;
				}

				.detail_label {
					width: 137rpx;
					flex-shrink: 0;
					color: #919191;
					font-size: 28rpx;
					font-weight: 500;
				}

				.detail_content {
					.duration {
						color: #3F5CD9;
						font-weight: 500;
						font-size: 28rpx;
					}

					.time_axis {
						width: 557rpx;
						margin-top: 19rpx;
						min-height: 116rpx;
						background: #F4F6FF;
						padding: 21rpx 0 18rpx 55rpx;
						border-radius: 8rpx;

						.timeline {
							.time_line_item {
								font-size: 24rpx;
								color: #171717;
								position: relative;
								margin-bottom: 39rpx;

								&:nth-last-child(1) {
									margin: 0;

									&::after {
										display: none;
									}
								}

								&::before {
									content: '';
									display: block;
									position: absolute;
									top: 10rpx;
									left: -32rpx;
									width: 12rpx;
									height: 12rpx;
									border: 1px solid #BBBBBB;
									border-radius: 50%;
									background: #F4F6FF;
								}

								&::after {
									content: '';
									display: block;
									position: absolute;
									width: 1rpx;
									height: 65rpx;
									background: #BBBBBB;
									left: -25rpx;
									top: 25rpx;
								}
							}
						}
					}

					.reason {
						margin-top: 26rpx;
						font-weight: 500;
						font-size: 28rpx;
					}

					.reason_image_wrapper {
						padding: 29rpx 0 47rpx 0;

						.reason_image {
							width: 120rpx;
							height: 120rpx;
						}

					}
				}
			}
		}

		.approval_no_wrapper {
			display: flex;
			align-items: center;
			border-top: 1rpx solid #E6E6E6;
			font-size: 28rpx;
			font-weight: 500;
			color: #919191;
			background: #fff;
			padding: 0 31rpx;
			height: 109rpx;

			.approval_no {
				margin-left: 36rpx;
			}
		}

		.approval_progress {
			margin-top: 19rpx;
			background-color: #fff;

			.approval_hd {
				padding: 40rpx 34rpx;

				.approval_title {
					font-weight: bold;
				}
			}

			.approval_bd {
				display: flex;

				.approval_list {
					padding-left: 132rpx;
					width: 100%;
					position: relative;

					&::after {
						content: '';
						display: block;
						position: absolute;
						top: 102rpx;
						left: 55rpx;
						// bottom: 139rpx;
						bottom: 95rpx;
						border-left: 2rpx dashed #DBDBDB;
					}

					&.approval_error {
						&::after {
							bottom: 255rpx;
						}
						.approval_item {
							&:nth-last-child(1) {
								height: 329rpx;

								.approval_user_wrapper {
									&::before {
										background-image: url(../../static/img/apply/xq-cha.png);
									}
								}
							}

						}
					}

					.approval_item {
						display: flex;
						justify-content: space-between;
						padding: 44rpx 0 36rpx;
						margin-right: 37rpx;
						border-top: 1rpx solid #E6E6E6;
						.approval_status {
							margin-top: 36rpx;
							font-weight: 500;
							flex-shrink: 0;

							&.approval_success {
								color: #05C46D;
							}

							&.approval_fail {
								color: #F23D4F;
							}
						}
						&:nth-child(1) {
							border: 0;

							.approval_user_wrapper {
								&::before {
									// 到时候换成第一个图 第一张图 提交审批
									// background-image: url();
								}
							}
						}
						.approval_user_wrapper {
							position: relative;
							
							// 默认对勾
							&::before {
								content: '';
								position: absolute;
								width: 40rpx;
								height: 40rpx;
								background: url(../../static/img/apply/xq-dui.png);
								background-size: 40rpx 40rpx;
								left: -98rpx;
								top: 25rpx;
								z-index: 10;
							}
							
							// 自定义图标样式加在这里，例
							&.approval_waiting::before{
								background: #ccc;
								border-radius: 50%;
							}
							

							.approval_user_info {
								display: flex;
								align-items: center;

								.approval_user_avatar {
									width: 54rpx;
									height: 54rpx;
									border-radius: 8px;
								}

								.approval_username {
									font-size: 32rpx;
									font-weight: 500;
									margin-left: 19rpx;
								}
							}

							.approval_time {
								font-size: 24rpx;
								margin-top: 24rpx;
								margin-left: 4rpx;
								color: #919191;
							}

							.approval_mark {
								margin-top: 34rpx;
							}

						}
					}
				}

			}
		}

		.apply_footer {
			display: flex;
			justify-content: space-between;
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			padding: 0 207rpx 0 204rpx;
			background: #fff;
			height: 174rpx;
			box-shadow: 0px 4px 7px 2px rgba(188, 188, 188, 0.57);
			z-index: 11;

			.footer_item {
				// flex: 1;
				display: flex;
				flex-direction: column;
				justify-content: center;
				align-items: center;
				color: #B6B6B6;
				font-size: 24rpx;
				padding: 0 20rpx;

				.footer_img {
					width: 50rpx;
					height: 50rpx;
					margin-bottom: 8rpx;
				}
			}
		}
		
		.pop_wrapper{
			padding: 60rpx 30rpx;
			position: relative;
			height: 100%;
			.del{
				width: 30rpx;
				height: 30rpx;
				position: absolute;
				right: 30rpx;
				top: 20rpx;
			}
			.pop_inp_wrapper{}
			.pop_control{
				position: absolute;
				bottom: 30rpx;
				left: 0;
				right: 0;
				padding: 30rpx;
				.addition{
					display: flex;
					height: 140rpx;
					align-items: center;
					border-bottom: 2rpx solid #eeeeee;
					.addition_item{
						width: 40rpx;
						height: 40rpx;
						margin-right: 30rpx;
					}
				}
				.sendMsgTo{
					margin: 24rpx 0 15rpx 0;
					.sendName{
						margin-left: 8rpx;
						color: #6f7385;
						font-weight: 500;
					}
				}
			}
		}
	}
</style>
