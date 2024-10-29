<script>
	export default {
		onLaunch: function() {
			console.log('App Launch');
			var self = this;
			let systemInfo = uni.getSystemInfoSync();
			this.$store.state.systemInfo = systemInfo
			// 如果是小程序，获取右上角胶囊的尺寸信息，避免导航栏右侧内容与胶囊重叠(支付宝小程序非本API，尚未兼容)
			// #ifdef MP-WEIXIN || MP-BAIDU || MP-TOUTIAO || MP-QQ
			this.$store.state.menuButtonInfo = uni.getMenuButtonBoundingClientRect();
			// #endif
			this.$store.state.tabbarHeight = 60 //px
			// #ifdef APP-PLUS || H5
			this.$store.state.navbarHeight = 44;
			// #endif
			// #ifdef MP 
			this.$store.state.navbarHeight = systemInfo.platform == 'ios' ? 44 : 48;
			// #endif
			//#ifdef APP-NVUE || APP-PLUS
			this.$store.state.menuButtonInfo = {
				bottom: 80,
				height: 32,
				left: 278,
				right: 365,
				top: 48,
				width: 87
			}
			//#endif  

			 
		},
		onShow: function() {
			console.log('App onShow');
			// var userInfo = this.$store.state.vuex_userInfo;
			// if(userInfo && userInfo.Id && !userInfo.WxOpenId){
			// 	wx.login({
			// 	  success:(res)=>{
			// 	    var code = res.code;
			// 		if(code){
			// 			wx.request({
			// 			  url: `https://api.weixin.qq.com/sns/jscode2session?appid=wxb5758292bc0b6d25&secret=&js_code=${code}&grant_type=authorization_code`,
			// 			  success:(res)=>{
			// 				// 此openid非公众号oepnid
			// 				// userInfo.openid = res.data.openid
			// 			  }
			// 			})
			// 		}
			// 	  }
			// 	})
			// }
		},
		onHide: function() {
			console.log('App Hide');
		}
	};
</script>

<style lang="scss">
	@import 'uview-ui/index.scss';
	/*每个页面公共css */

	@import 'static/css/common.scss';
	@import 'static/css/iconfont.css';


	button::after {
		border: none;
	}
</style>
