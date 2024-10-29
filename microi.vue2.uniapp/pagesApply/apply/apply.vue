<template>
	<view class="apply">
		<u-navbar :is-back="true" title="我的申请" title-color="#fff" title-size="34" :title-bold="true"
		 :background="{background:'#3F5CD9'}" back-icon-color="#fff">
		</u-navbar>
		<view class="tabs_wrapper">
			<u-tabs :list="list" :is-scroll="false" height="90" font-size="28" inactive-color="#7B7B7B"
				active-color="#171717" :current="current" @change="change" class="tabs" 
				:active-item-style="{fontSize:'32rpx'}" :bold="false" :show-bar="false"></u-tabs>
			<view class="all-lanmu">
				<u-image @click="lanmuShow=true" active-color="#3F5CD9" width="36rpx" height="36rpx"
					src="/static/img/work/all-lanmu.png" mode=""></u-image>
			</view>
		</view>
		<view class="cards-list">
			<view class="card-item" v-for="(item,index) in applyList" :key="index" @click="goDetail(item)">
				<view class="card_hd">
					<view class="card_title_wrapper"
						:class="{'apply-error':item.status == 1, 'apply-success':item.status== 2}">
						<view class="card_title">
							{{item.title}}
						</view>
						<view class="card_status">
							<!-- <image class="status_icon" src="../../static/时间@2x.png"></text> -->
							<text class="status_text">{{status_text(item.status)}}</text>
						</view>
					</view>
				</view>
				<view class="card_bd">
					<view class="card_bd_item">
						<text>请假类型：</text>
						<text>{{item.type}}</text>
					</view>
					<view class="card_bd_item">
						<text>开始时间：</text>
						<text>{{item.start}}</text>
					</view>
					<view class="card_bd_item">
						<text>结束时间：</text>
						<text>{{item.end}}</text>
					</view>
				</view>
			</view>
		</view>
		
		<!-- 栏目分类弹窗 -->
		<u-popup v-model="lanmuShow" mode="top" length="100%">
			<view class="lanmu-show">
				<u-image class="lanmu-del" width="48rpx" height="48rpx" src="/static/img/work/del.svg"
					@click="lanmuShow=false" mode=""></u-image>
				<view class="lanmu-title">
					栏目分类
				</view>
				<view class="lanmu-tips">选择你想快速查看的栏目</view>
				<view class="lanmu-item" v-for="(item,index) in list" :key="index" @click="change(index)">
					<view class="lanmu-cont">
						{{item.name}}
					</view>
				</view>
				<view class="lanmu-bg">
					
				</view>
			</view>
		</u-popup>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				list: [{
					name: '请假'
				}, {
					name: '加班'
				}, {
					name: '补卡',
				}],
				current: 0,
				applyList: [{
						id: 0,
						title: '罗丹红的请假申请',
						type: '调休',
						start: '2021-09-01 14:00',
						end: '2021-09-01 14:00',
						status: 0 // 假设0审批 1未通过 2审批通过
					},
					{
						id: 1,
						title: '罗丹红的请假申请',
						type: '调休',
						start: '2021-09-01 14:00',
						end: '2021-09-01 14:00',
						status: 1 // 假设0审批 1未通过 2审批通过
					},
					{
						id: 2,
						title: '罗丹红的请假申请',
						type: '调休',
						start: '2021-09-01 14:00',
						end: '2021-09-01 14:00',
						status: 2 // 假设0审批中 1未通过 2审批通过
					}
				],
				lanmuShow:false,
			}
		},
		methods: {
			change(index) {
				this.current = index;
				this.lanmuShow = false
			},
			status_text(id) {
				let txt = '';
				if (id == 0) return '审批中'
				if (id == 1) return '未通过'
				return '审批通过 '
			},
			goDetail(item){
				this.$Router.push({
					name:'apply-detail'
				})
			}
		}
	}
</script>

<style lang="scss">
	page {
		background: #F5F7F9;
	}

	.apply {
		padding-bottom: 30rpx;

		.tabs_wrapper {
			background: #fff;
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding-right: 39rpx;
			position: relative;

			.tabs {
				width: 517rpx;
			}

			.all-lanmu {
				position: absolute;
				right: 0;
				width: 120rpx;
				height: 80rpx;
				display: flex;
				justify-content: flex-end;
				align-items: center;
				background-image: linear-gradient(to right,
						rgba(255, 255, 255, 0),
						rgba(255, 255, 255, 1),
						rgba(255, 255, 255, 1),
						rgba(255, 255, 255, 1));
				padding-right: 30rpx;
			}
		}

		.cards-list {
			margin: 20rpx 30rpx;

			.card-item {
				background: #fff;
				border-radius: 11rpx;
				margin-bottom: 20rpx;
				padding-bottom: 20rpx;

				.card_hd {
					.card_title_wrapper {
						display: flex;
						justify-content: space-between;
						align-items: center;
						position: relative;
						height: 98rpx;
						border-bottom: 1rpx solid #E6E6E6;

						&.apply-error {
							&::before {
								background: #F23D4F;
							}

							.card_status {
								&::before {
									background-image: url(../../static/img/apply/icon1.png);
								}

								.status_text {
									color: #F23D4F;
								}
							}
						}

						&.apply-success {
							&::before {
								background: #05C46D;
							}

							.card_status {
								&::before {
									background-image: url(../../static/img/apply/icon2.png);
								}

								.status_text {
									color: #05C46D;
								}
							}
						}

						&::before {
							content: '';
							position: absolute;
							display: block;
							width: 10rpx;
							height: 30rpx;
							background: #FFBA2E;
							border-radius:
								0px 8px 8px 0px;
						}

						.card_title {
							font-size: 29rpx;
							color: #000;
							font-weight: 700;
							padding-left: 42rpx;
						}

						.card_status {
							display: flex;
							align-items: center;
							padding-right: 30rpx;
							position: relative;

							&::before {
								content: '';
								display: block;
								position: absolute;
								left: -44rpx;
								width: 30rpx;
								height: 30rpx;
								background-image: url(../../static/img/apply/icon3.png);
								background-repeat: no-repeat;
								background-size: 30rpx 30rpx;
							}

							.status_text {
								font-size: 28rpx;
								font-weight: 500;
								color: #FFBA2E;
							}
						}
					}
				}

				.card_bd {
					display: flex;
					flex-direction: column;
					justify-content: center;
					padding: 0 33rpx;
					height: 212rpx;

					.card_bd_item {
						font-size: 28rpx;
						font-weight: 500;

						&:nth-child(2) {
							padding: 34rpx 0;
						}
					}
				}
			}
		}
	}
	.lanmu-show {
		padding: 0 10rpx;
		height: 100%;
		position: relative;
	
		.lanmu-item {
			width: 33%;
			height: 150rpx;
			display: inline-flex;
			justify-content: center;
			align-items: center;
			padding: 30rpx;
			vertical-align: top;
	
			.lanmu-cont {
				width: 100%;
				height: 100%;
				border: 1rpx solid #000;
				border-radius: 8rpx;
				display: flex;
				justify-content: center;
				align-items: center;
				font-size: 24rpx;
				padding: 0 12rpx;
			}
		}
	
		.lanmu-title {
			padding: 30rpx 0 0 30rpx;
			font-size: 38rpx;
			font-weight: bold;
			padding-top: 100rpx;
			color: #3F5CD9;
		}
	
		.lanmu-tips {
			color: #BEBFBF;
			font-size: 28rpx;
			font-weight: normal;
			margin-top: 10rpx;
			margin-bottom: 50rpx;
			padding-left: 30rpx;
		}
	
		.lanmu-del {
			position: absolute;
			right: 44rpx;
			top: 110rpx;
		}
		
		.lanmu-bg{
			width: 100%;
			height: 35%;
			position: absolute;
			left: 0;
			bottom: 0;
			background-image: linear-gradient(to top,#3F5CD9 -110%,#fff);
		}
	}
	
</style>
