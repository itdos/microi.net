<template>
	<view style="background-color: #f7f7f7;overflow: hidden;height: 100%;">
		<u-navbar title="与XX私信" :background="background" back-icon-color="#fff" title-color="#fff" :title-bold="true"></u-navbar>
		
		<view class="cu-chat">
			<view class="cu-item self">
				<view class="main">
					<view class="content bg-itdos shadow">
						<text>喵喵喵！喵喵喵！喵喵喵！喵喵！喵喵！！喵！喵喵喵！</text>
					</view>
				</view>
				<image class="cu-avatar radius" src="/static/img/my/toux.png"></image>
				<view class="date">2018年3月23日 13:23</view>
			</view>
			<view class="cu-item">
				<image class="cu-avatar radius" src="/static/img/my/toux.png"></image>
				<view class="main">
					<view class="content shadow">
						<text>喵喵喵！喵喵喵！</text>
					</view>
				</view>
				<view class="date "> 13:23</view>
			</view>
			<view class="cu-info">
				<text class="cuIcon-roundclosefill text-red "></text> 对方已关闭私信功能
			</view>
			<view class="cu-info">
				对方开启了只有粉丝才能私信功能，你还不是他(她)的粉丝。请先关注对方，才能发送私信。
				<text class="text-blue">去关注</text>
			</view>
			<view class="cu-item self">
				<view class="main">
					<image src="https://ossweb-img.qq.com/images/lol/web201310/skin/big10006.jpg" class="radius" mode="widthFix"></image>
				</view>
				<image class="cu-avatar radius" src="/static/img/my/toux.png"></image>
				<view class="date"> 13:23</view>
			</view>
			<view class="cu-item">
				<image class="cu-avatar radius" src="/static/img/my/toux.png"></image>
				<view class="main">
					<view class="content shadow">
						@#$^&**
					</view>
				</view>
				<view class="date">13:23</view>
			</view>
		</view>
		
		<view class="cu-bar input foot safe-area-inset-bottom" :style="[{bottom:InputBottom+'px'}]">
			<view class="baos">
				<input class="solid-bottom" :adjust-position="false" :focus="false" maxlength="300" cursor-spacing="10" placeholder="对他说点什么呢？"
				 @focus="InputFocus" @blur="InputBlur" placeholder-class="plaClass"></input>
				<view class="action">
					<text class="cuIcon-emoji text-black" @click="changeEmoji"></text>
					<text class="cuIcon-roundadd text-black" @click="changeMore"></text>
				</view>
				<button class="cu-btn bg-itdos shadow">发送</button>
			</view>
			<view class="emoji" v-if="emoji">
				1111
			</view>
			<view class="more" v-if="more">
				<view class="list">
					<view class="box" @tap="chooseImage">
						<u-icon name="photo" color="#909399" size="48"></u-icon>
					</view>
					<view class="box" @tap="camera">
						<u-icon name="camera" color="#909399" size="48"></u-icon>
					</view>
				</view>
			</view>
		</view>
		
	</view>
</template>

<script>
	export default {
		components:{
			
		},
		data() {
			return {
				background:{
					background:'#3F5CD9'
				},
				InputBottom: 0,
				emoji:false,
				more:false,
			}
		},
		methods:{
			InputFocus(e) {
				this.InputBottom = e.detail.height
				this.more = false
				this.emoji = false
			},
			InputBlur(e) {
				this.InputBottom = 0
				this.more = false
				this.emoji = false
			},
			changeEmoji(){
				if (this.emoji == false){
					this.emoji = true
					this.InputBottom = 125
					this.more = false
				}else{
					this.emoji = false
					this.InputBottom = 0
					this.more = false
				}
			},
			changeMore(){
				if (this.more == false){
					this.more = true
					this.InputBottom = 125
					this.emoji = false
				}else{
					this.more = false
					this.InputBottom = 0
					this.emoji = false
				}
			},
			// 选择图片发送
			chooseImage(){
				
			},
			//拍照发送
			camera(){
				
			},
		},
		onShareAppMessage(res) { //发送给朋友
			// return {
			// 	title: this.title,
			// 	imageUrl: this.thumb,
			// }
		},
		onShareTimeline(res) { //分享到朋友圈
			// return {
			// 	title: this.title,
			// 	imageUrl: this.thumb,
			// }
		}
	}
</script>

<style lang="scss" scoped>
@import "@/colorui/main.css";
@import "@/colorui/icon.css";
.cu-chat{
  padding-bottom: 130rpx;
}
.solid-bottom{
	background-color: #F7F7F7;
	padding-left: 20rpx;
	border-radius: 40rpx;
	padding-left: 30rpx;
}
.solid-bottom::after{
	border-bottom: none;
}
.plaClass{
	font-size: 26rpx;
	color: #909399;
}
.bg-itdos{
	background-color: #3F5CD9;
	color: #fff;
}
.cu-bar .action:first-child>text[class*="cuIcon-"] {
    margin-right: 0;
}
.cu-bar.input {
    // padding-right: 24rpx;
	box-shadow: 0 -2rpx 6rpx rgba(0, 0, 0, 0.1);
	// padding-top: 20rpx;
	// padding-bottom: 20rpx;
}
.cu-bar.input .action {
    margin-left: 24rpx;
	height: 64rpx;
}
.cu-bar .baos{
	display: flex;
	justify-content: space-between;
	width: 100%;
	height: 50px;
	padding-top: 20rpx;
}
.cu-bar .action>text[class*="cuIcon-"]+text[class*="cuIcon-"] {
    margin-left: 15rpx;
}
.cu-avatar{
	border-radius: 50%;
}
.cu-btn{
	padding: 0 25rpx;
	font-size: 26rpx;
	height: 56rpx;
	margin-top: 5rpx;
	border-radius: 40rpx;
}
.cu-chat .cu-item>.main {
	max-width: calc(100% - 240rpx);
	margin: 0 25rpx;
}
.cu-chat .cu-item.self>.main .content::after {
    right: -5rpx;
}
.cu-chat .cu-item>.main .content::after {
	left: -5rpx;
}
.emoji,.more{
	position: fixed;
	bottom: 0;
	left: 0;
	width: 100%;
	background-color: #fff;
	height: 250rpx;
	z-index: 100;
}
.list{
	width: 100%;
	display: flex;
	flex-wrap: wrap;
	padding: 24rpx;
	.box{
		width: 18vw;
		height: 18vw;
		border-radius: 20upx;
		background-color: #fff;
		display: flex;
		justify-content: center;
		align-items: center;
		margin-right: 20rpx;
		margin-top: 10rpx;
		border: 1px solid #ccc;
	}
}
</style>
