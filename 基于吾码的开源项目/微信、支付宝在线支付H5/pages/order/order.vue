<template>
	<view >
		<view class="page-top">
			<view class="content">
				<view class="title">累计提现</view>
				<view class="price" v-if="userInfo.pay_money">￥{{ userInfo.pay_money | money }}</view>
				<view class="price" v-else>￥{{ 0 | money }}</view>
				<view class="statistics">
					<u-icon name="yuanhuan" custom-prefix="custom-icon" size="22"></u-icon>
					<text>累计订单：</text>
					<text class="last-time">{{ userInfo.pay_order }}</text>
				</view>
			</view>
		</view>
		<!-- <view class="section-title">
			<u-icon name="yuanhuan" custom-prefix="custom-icon" size="32" color="#EE343F"></u-icon>
			<text>交易明细</text>
		</view> -->
		<view class="tabs u-flex">
			<view class="tabs-item" :class="{ active: queryType == item.id }" v-for="item in tabsList" :key="item.id" @click="changeTab(item.id)">{{ item.name }}</view>
		</view>
		<view class="order-list" v-if="orderList.length != 0">
			<view class="card item" v-for="(item, index) in orderList" :key="index">
				<view class="top" :class="{ expend: item.type == 1 }">
					<view class="sign"></view>
					<view class="type">{{ item.type == 1 ? '支出' : '收入' }}</view>
					<view class="price" v-if="item.type == 1">￥{{ item.total }}</view>
					<view class="price" v-if="item.type == 2">￥{{ item.withdrawal_money }}</view>
				</view>
				<view class="bottom">
					<view class="time">{{ item.update_time | timeFormat('yy/mm/dd hh:MM') }}</view>
					<view class="status" v-if="item.type == 1">{{ item.pay_status == 1 ? '已完成' : '未完成' }}</view>
					<view class="status" v-if="item.type == 2">{{ item.status == 1 ? '已到账' : '未到账' }}</view>
				</view>
			</view>
		</view>
		<view class="no-order" v-else><image src="../../static/no-order.png" mode=""></image></view>
	</view>
</template>

<script>
export default {
	data() {
		return {
			tabsList: [
				{
					id: 1,
					name: '支出'
				},
				{
					id: 2,
					name: '收入'
				}
			],
			orderList: [],
			queryType:1,
			page: {
				page:1,
				page_size:10
			},
			total: 0
		}
	},
	onLoad() {
		this.getOrderList()
		this.getUserInfo()
	},
	methods: {
		getUserInfo(){
			this.$u.api.getUserInfo().then(res=>{
				console.log(res)
				this.$u.vuex('userInfo',res.data)
			})
		},
		getOrderList() {
			this.$u.api.getOrderList(this.page).then(res => {
				console.log(res)
				this.orderList.push(...res.data.data)
				this.total = res.data.total
			})
		},
		getWithdrawalList(){
			this.$u.api.getWithdrawalList(this.page).then(res=>{
				console.log(res)
				this.orderList.push(...res.data.data)
				this.total = res.data.total
			})
		},
		changeTab(id) {
			this.queryType = id
			this.orderList = []
			if (this.queryType == 1) {
				this.getOrderList()
			} else if(this.queryType == 2) {
				this.getWithdrawalList()
			}
		}
	},
	onReachBottom() {
		if (this.orderList.length >= this.total) return
		this.page.page++
		this.getOrderList()
	}
}
</script>

<style lang="scss">
.page-top {
	width: 750rpx;
	height: 332rpx;
	background: url(../../static/order-top-bg.png) no-repeat center / 100% 100%;
	color: #fff;
	.content {
		padding: 60rpx 60rpx 0;
		.title {
			font-size: 32rpx;
		}
		.price {
			margin-top: 40rpx;
			font-size: 42rpx;
			font-weight: bold;
		}
		.statistics {
			display: flex;
			align-items: center;
			margin-top: 30rpx;
			font-size: 26rpx;
		}
	}
}
.section-title {
	margin-top: 20rpx;
	padding: 0 32rpx;
	/deep/ .custom-icon-yuanhuan:before {
		font-weight: bold;
	}
	text {
		margin-left: 20rpx;
		font-size: 32rpx;
	}
}
.card {
	margin-bottom: 30rpx;
	padding: 24rpx 32rpx;
	border-radius: 24rpx;
	background-color: #fff;
	box-shadow: 2rpx 8rpx 20rpx 8rpx #f9f9f9;
}
.tabs {
	position: sticky;
	top: 0;
	width: 100%;
	display: flex;
	align-items: center;
	height: 80rpx;
	background-color: #fff;
	border-bottom: 1rpx solid #f7f7f7;
	.tabs-item {
		position: relative;
		width: 50%;
		text-align: center;
		font-size: 32rpx;
	}
	.active {
		&::after {
			position: absolute;
			content: '';
			left: 50%;
			top: 26rpx;
			width: 100rpx;
			height: 18rpx;
			transform: translateX(-50%);
			background-color: #ff4c3f;
			// background-color: #fabe00;
			border-radius: 4rpx;
			z-index: -1;
		}
	}
}
.order-list {
	margin-top: 30rpx;
	padding: 0 32rpx;
	.item {
		font-size: 28rpx;
		.top {
			display: flex;
			align-items: center;
			color: #70c21d;
			.sign {
				height: 12rpx;
				width: 12rpx;
				border-radius: 6rpx;
				background-color: #70c21d;
			}
			.type {
				margin-left: 12rpx;
			}
			.price {
				margin-left: auto;
			}
		}
		.expend {
			color: #ff4c3f;
			.sign {
				background-color: #ff4c3f;
			}
		}
		.bottom {
			display: flex;
			align-items: center;
			margin-top: 20rpx;
			color: #999;
			.status {
				margin-left: auto;
			}
		}
	}
}
.no-order {
	image {
		position: fixed;
		top: 60%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 356rpx;
		height: 310rpx;
	}
}
</style>
