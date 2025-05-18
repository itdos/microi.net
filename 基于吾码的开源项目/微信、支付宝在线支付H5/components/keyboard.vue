
<template>
	<view class="keyboard-box">
		<view class="left">
			<view class="item" @click="typing(1)">1</view>
			<view class="item" @click="typing(2)">2</view>
			<view class="item" @click="typing(3)">3</view>
			<view class="item" @click="typing(4)">4</view>
			<view class="item" @click="typing(5)">5</view>
			<view class="item" @click="typing(6)">6</view>
			<view class="item" @click="typing(7)">7</view>
			<view class="item" @click="typing(8)">8</view>
			<view class="item" @click="typing(9)">9</view>
			<view class="item zero" @click="typing(0)">0</view>
			<view class="item point" @click="typing('.')">.</view>
		</view>
		<view class="right">
			<view class="del" @click="typing('')">X</view>
			<view class="confirm" @click="confirm">{{confirmText}}</view>
		</view>
	</view>
</template>
<script>
export default {
	name: 'keyboard',
	props: {
		value: '',
		inter: {
			default: 5
		},
		decimal: {
			default: 2
		},
	},
	data() {
		return {
			/*value 在组件中的值*/
			val: '',
			aIllegal: ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '0..', '.'],
			confirmText:'确认支付'
		}
	},
	methods: {
		confirm(){
			this.$emit('confirm')
		},
		resetConfirmText(){
			this.confirmText = '确认支付'
		},
		showPayText(){
			this.confirmText = '支付中....'
		},
		/*输入*/
		typing(value) {
			/*如果是点击删除*/
			if (value === '') {
				this.del()
			}
			/*保存旧的值*/
			let oldValue = this.val
			/*获取新的值*/
			this.val = this.val + value
			/*检验新值, 如果没有通过检测, 恢复值*/
			if (!this.passCheck(this.val)) {
				this.val = oldValue
				return
			}
			/*为了让外界同步输入, 需要发送事件*/
			this.notify()
		},
		/*判读是否需要加0*/
		toCompletion() {
			let list = this.value.split('.')
			if (typeof list[1] === 'undefined') {
				if (this.val !== '') {
					this.val = this.val + '.'
					this.completion(this.decimal)
				}
			} else {
				if (list[1].length < this.decimal) {
					this.completion(this.decimal - list[1].length)
				}
			}
		},
		completion(len) {
			let v = ''
			for (let i = 0; i < len; i++) {
				v = v + '0'
			}
			this.val = this.val + v
		},
		notify() {
			this.$u.vuex('money',this.val)
			// this.$emit('input', this.val)
			// console.log(this.val)
		},
		del() {
			/*删除值并不会触发值的校验, 所以需要手动再触发一次*/
			this.val = this.val.slice(0, -1)
			this.notify()
		},
		
		passCheck(val) {
			/*验证规则*/
			let aRules = [this.illegalInput, this.illegalValue, this.accuracy]
			return aRules.every(item => {
				return item(val)
			})
		},
		illegalInput(val) {
			if (this.aIllegal.indexOf(val) > -1) {
				return false
			}
			return true
		},
		/*非法值*/
		illegalValue(val) {
			if (parseFloat(val) != val) {
				return false
			}
			return true
		},
		/*验证精度*/
		accuracy(val) {
			let v = val.split('.')
			if (v[0].length > this.inter) {
				return false
			}
			if (v[1] && v[1].length > this.decimal) {
				return false
			}
			return true
		}
	}
}
</script>
<style scoped lang="scss">
.keyboard {
	font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', STHeiti, 'Microsoft Yahei', Tahoma, Simsun, sans-serif;
	user-select: none;
	font-size: 16px;
	width: 100%;
}
.input-box {
	display: flex;
	align-items: center;
	justify-content: space-between;
	line-height: 24px;
	.label {
		color: #333;
	}
	.content {
		display: flex;
		.input {
			font-size: 20px;
			color: #313131;
		}
		.cursor {
			background-color: #4788c5;
			width: 2px;
			margin-left: 2px;
		}
		.placeholder {
			color: #eee;
		}
		.currency {
			color: #c1c1c1;
		}
	}
}
.keyboard-box {
	display: flex;
	justify-content: space-between;
	position: fixed;
	bottom: 50px;
	bottom: calc(50px + constant(safe-area-inset-bottom));
	bottom: calc(50px + env(safe-area-inset-bottom));
	width: 100%;
	background-color: #fff;
	.left {
		display: flex;
		flex-wrap:wrap;
		width: 75%;
		.item {
			width: 33.33%;
			height: 120rpx;
			line-height: 120rpx;
			text-align: center;
			font-size: 56rpx;
			// font-weight: bold;
			border-right: 1rpx solid #eee;
			border-top: 1rpx solid #eee;
			box-sizing: border-box;
			&:active{
				background-color: #f2f2f2;
			}
		}
		.zero {
			padding-left: 86rpx;
			width: 66.66%;
			text-align: left;
			
		}
		.zero,.point {
			border-bottom: 1rpx solid #eee;
		}
	}
	.right {
		width: 25%;
		.del {
			display: flex;
			align-items: center;
			justify-content: center;
			height: 120rpx;
			border-top: 1rpx solid #eee;
			box-sizing: border-box;
		}
		.confirm {
			display: flex;
			align-items: center;
			justify-content: center;
			text-align: center;
			line-height: 54rpx;
			padding: 0 50rpx;
			height: 360rpx;
			background-color: #ff661b;
			color: #fff;
			font-size: 36rpx;
			border-top: 1rpx solid #eee;
			box-sizing: border-box;
			&:active {
				opacity: .8;
			}
		}
	}
}
</style>