<script>
export default {
	onLaunch: function() {
		// console.log('App Launch')
		// #ifdef H5
		if (!this.isLogin) {
			// 公众号授权登录
			// 需要在后端设置公众号appid和appSecrect，否则不要开启
			// this.wxOauth()
			console.log('当前没有登录')
		}
		// #endif
	},
	onShow: function() {
		// console.log('App Show')
	},
	onHide: function() {
		// console.log('App Hide')
	}
}
</script>

<style lang="scss">
/*每个页面公共css */
@import './static/fonts/iconfont.css';
@import 'uview-ui/theme.scss';
</style>
