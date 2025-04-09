<template>
	<view class="key-container" @click="hide" v-show="showMask">
		<uni-transition :modeClass="['slide-bottom']" :show="show"
		:styles="{height:'100vh'}"
		 :duration="duration">
			<view class="key-content" @click.stop>
				<slot></slot>
				<view class="key-box block flex">
					<view class="key-left">
						<view class="key-top flex flex-wrap">
							<view class="btn-box" v-for="(item,index) in numArr" :key="index">
								<button hover-class="active"  class="cu-btn key-btn text-black text-xl" @click.stop="keydown(item)">{{item}}</button>
							</view>
						</view>
						<view class="key-bottom">
							<view class="btn-zero">
								<button hover-class="active" class="cu-btn key-btn text-black text-xl"  @click.stop="keydown('0')">0</button>
							</view>
							<view class="btn-point">
								<button hover-class="active" class="cu-btn key-btn text-black text-xl" @click.stop="keydown('.')">.</button>
							</view>
						</view>
					</view>
					<view class="key-right">
						<view class="del">
							<button hover-class="active" class="cu-btn key-btn text-black text-xl" @click.stop="del">
								<text class="zm iconbackspace text-xl"></text>
							</button>
						</view>
						<view class="confirm">
							<button hover-class="active" :style="[confirmStyle]" class="cu-btn" @click.stop="confirm">
								<text class="confirm-text">{{confirmText}}</text>
							</button>
						</view>
					</view>
				</view>
			</view>
		</uni-transition>
	</view>
</template>

<script>
/**
 * 付款组件
 * @property {Number} duration - 弹出动画时长，默认为300
 * @event {Function} change - 数字改变触发，参数为数字
 * @event {Function} confirm - 付款时触发，参数为数字
 * @event {Function} hide - 关闭键盘触发，参数为空
 */
// 使用方法,查看同级目录exmple
import uniTransition from './uni-transition/uni-transition.vue'
export default{
	components:{
		uniTransition
	},
	props:{
		duration:{
			type:Number,//弹出动画时常
			default:300
		},
		confirmText:{
			type:String,
			default:'付款'
		},
		defaultValue:{
			type:String,
			default:''
		},
		confirmStyle:{
			type:Object,
			default:()=>{
				return{
					backgroundColor:'#57BE6D'
				} 
			}
		}
	},
	data(){
		return{
			value:'',//输出的值
			show:false,//显示键盘
			showMask:false,//遮罩层
			numArr:[1,2,3,4,5,6,7,8,9]
		}
	},
	mounted() {
		console.log(this.defaultValue)
		this.value = this.defaultValue
	},
	watch:{
		value(newval,oldval){
			this.$emit("change",newval);
		},
		defaultValue(newval,oldval){
			this.value = newval
			console.log('变化了',this.value)
		}
	},
	methods:{
		close(){
			this.show = false;
			setTimeout(()=>{
				this.showMask = false;
			},this.duration)
		},
		open(){
			// this.value = '';
			this.show = true;
			this.showMask = true;
		},
		del(){
			if(this.value.length){
				this.value = this.value.slice(0,this.value.length-1);
			}
		},
		keydown(e){
			console.log(e)
			switch(e){
				case '.':
				// 当输入为点的时候，如果第一次输入点，则补零
				if(!this.value.length){
					this.value = '0.';
				}else{
					if(this.value.indexOf('.')>-1){
						// 如果已经有点，则无效
					}else{
						this.value = this.value+''+e;
					}
				}
				break;
				case '0':
				if(this.value.length === 0){
					this.value = this.value+''+e;
				}
				if(Number(this.value) === 0 && this.value.indexOf('.')== -1){
					// 当输入为零的时候，如果value转换成数字为零，且没有点则无效
				}else{
					this.value = this.value+''+e;
				}
				break;
				default:
				
				this.value = this.value+''+e;
				var str = this.value 
				if (str.includes(".")) {
				  // 字符串中包含小数点的情况
				  if (str.startsWith("0")) {
				    str = "0" + str.slice(1); // 在开头添加0
				  }
				} else {
				  // 字符串中不包含小数点的情况
				  if (str.startsWith("0")) {
				    str = str.substr(1, 1); // 去除开头的0，取第二位作为新的第一位
				  }
				}
				this.value = str
				// #ifdef MP-WEIXIN
					this.$nextTick(() => {
						this.value = (this.value.match(/^([1-9]\d*|0)(\.\d{0,2})?/g)[0]) || null
					})
				// #endif
				
				// #ifndef MP-WEIXIN
					this.value = (this.value.match(/^([1-9]\d*|0)(\.\d{0,2})?/g)[0]) || null
				// #endif
				
				
				break;
			}
		},
		hide(){
			this.$emit('hide');
			this.close();
		},
		confirm(){
			this.$emit('confirm',this.value);
			this.close();
		}
	}
}
</script>

<style lang="scss" scoped>
@font-face {
  font-family: 'zm';  /* project id 2442084 */
  src: url('https://at.alicdn.com/t/font_2442084_o72ps3802ih.eot');
  src: url('https://at.alicdn.com/t/font_2442084_o72ps3802ih.eot?#iefix') format('embedded-opentype'),
  url('https://at.alicdn.com/t/font_2442084_o72ps3802ih.woff2') format('woff2'),
  url('https://at.alicdn.com/t/font_2442084_o72ps3802ih.woff') format('woff'),
  url('https://at.alicdn.com/t/font_2442084_o72ps3802ih.ttf') format('truetype'),
  url('https://at.alicdn.com/t/font_2442084_o72ps3802ih.svg#zm') format('svg');
}

.zm {
  font-family: "zm" !important;
  font-size: 16px;
  font-style: normal;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.iconbackspace:before {
  content: "\ef11";
}

.flex{
	display: flex;
}
.flex-wrap{
	flex-wrap: wrap;
}
.cu-btn {
	position: relative;
	border: 0rpx;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
	padding: 0 30rpx;
	font-size: 28rpx;
	height: 64rpx;
	line-height: 1;
	text-align: center;
	text-decoration: none;
	overflow: visible;
	margin-left: initial;
	transform: translate(0rpx, 0rpx);
	margin-right: initial;
}

.cu-btn::after {
	display: none;
}
.text-xl{
	font-size:36rpx;
	font-weight: bold;
	font-family: 'microsoft-yahei';
}
.text-black{
	color:#333;
}
.active{
	background-color: #ddd !important;
	transform: translate(2rpx,2rpx);
}
.key-container{
	position: fixed;
	bottom: 0;
	top:0;
	left:0;
	right:0;
	z-index: 99999;
	.key-content{
		position: absolute;
		bottom: 0;
		width: 100vw;
		background-color: #F7F7F7;
	}
}
.key-box{
	width: 100%;
	box-sizing: border-box;
	padding:10rpx 10rpx 0;
	padding-bottom: calc(4rpx +  constant(safe-area-inset-bottom));
	padding-bottom: calc(4rpx +  env(safe-area-inset-bottom));
	.key-left{
		width: 75%;
	}
	.key-right{
		width: 25%;
		display: flex;
		flex-direction: column;
	}
	.key-bottom{
		width: 100%;
		display: flex;
	}
}
.del{
	width: 100%;
}
.btn-box{
	width: 33.33%;
	padding:0 10rpx 10rpx 0;
	box-sizing: border-box;
}
.btn-zero{
	width: 66.66%;
	padding:0 10rpx 10rpx 0;
	box-sizing: border-box;
}
.btn-point{
	width: 33.33%;
	padding:0 10rpx 10rpx 0;
	box-sizing: border-box;
}
.key-right{
	flex-shrink: 0;
}
.key-btn{
	background-color: #fff;
	width: 100%;
	height: 90rpx;
}

.confirm{
	width: 100%;
	flex:1;
	padding: 10rpx 0 10rpx 0;
	box-sizing: border-box;
	button{
		width: 100%;
		height: 100%;
		.confirm-text{
			color:#fff;
			display: block;
			font-size: 32rpx;
		}
	}
}

</style>
