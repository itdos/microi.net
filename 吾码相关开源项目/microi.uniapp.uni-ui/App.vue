<script>
	import {
		mapMutations
	} from 'vuex'
	import {
		inject
	} from 'vue';
	import { getApiUrl, getQueryParams } from '@/utils'
	import configOsClient from '@/static/config/index.js'
	export default {
		data() {
			return {
				appReady: false, // 应用是否准备就绪
				initialLoadComplete: false // 初始化加载是否完成
			}
		},
		onLaunch:async function() {
			const self = this
			const Microi = inject('Microi'); // 使用注入Microi实例
			self.Microi = Microi;
			
			// 设置全局变量，用于其他组件判断应用是否准备就绪
			getApp().globalData.appReady = false;
			
			// 安全地获取url参数
			let queryParams = {};
			try {
				queryParams = getQueryParams() || {}; // 获取url参数
				console.log('queryParams', queryParams);
			} catch (error) {
				console.error('Error getting query parameters:', error);
				queryParams = {};
			}
			
			// 根据url参数判断客户端类型，并设置ApiBase
			if (queryParams && queryParams.OsClient) {
				if (configOsClient && configOsClient[queryParams.OsClient]) { // 如果配置了客户端类型
					uni.setStorageSync('ApiBase', configOsClient[queryParams.OsClient]);
					uni.setStorageSync('OsClient', queryParams.OsClient);
				} else { // 如果没有配置客户端类型，则使用默认配置
					uni.setStorageSync('OsClient', queryParams.OsClient);
					uni.setStorageSync('ApiBase', configOsClient.apibase);
				}
				if (Microi && Microi.OsClient !== queryParams.OsClient) {
					Microi.SetToken('');
					Microi.SetCurrentUser('');
					Microi.InitApi() // 初始化api
				}
			} else {
				// #ifdef H5
				// 获取地址栏地址
				try {
					const url = window && window.location ? window.location.origin : '';
					if (url) {
						// 使用正则表达式匹配并提取域名部分
						const match = url.match(/https?:\/\/([^\/]+)/);
						if (match) {
							// 获取匹配到的域名部分
							const domain = match[1];
							// 正则表达式用于判断域名是否符合 xxx-m.* 格式
							const domainPattern = /^([a-zA-Z0-9-]+)-m\.(.+)$/;
							// 判断域名是否符合特定格式
							if (domainPattern.test(domain)) {
								// 提取 xxx 部分作为 OsClient
								const osClientMatch = domain.match(/^([a-zA-Z0-9-]+)-m\.(.+)$/);
								if (osClientMatch) {
									const osClient = osClientMatch[1]; // xxx 部分
									const domainSuffix = osClientMatch[2]; // 域名后缀部分
									
									// 构建 ApiBase URL
									const protocol = url.startsWith('https') ? 'https' : 'http';
									const apiBase = `${protocol}://api.${domainSuffix}`;
									
									// 设置存储
									uni.setStorageSync('OsClient', osClient);
									uni.setStorageSync('ApiBase', apiBase);
									Microi.InitApi() // 初始化api
								}
							}
						}
					}
				} catch (error) {
					console.error('Error processing window.location:', error);
				}
				// #endif
			}
			// 如果用户未登录，则查看是否有code参数，如果有则获取token自动登录
			// 获取到飞书code获取token自动登录
			if (queryParams && queryParams.code) {
				self.Microi.ApiEngine.Run('feishu_login',{
					code: queryParams.code,
					appKey: queryParams.AppKey
				}).then(res => {
					if (res.Code == 1) {
						Microi.SetCurrentUser(res.Data.CurrentUser);
						Microi.SetToken(res.Data.Token) // 设置token
						self.$MicroiStore.commit('SetIsLogin', self.Microi.IsLogin());
						self.$MicroiStore.commit('SetCurrentUser', self.Microi.GetCurrentUser());
						uni.$emit('testParam', "你好")
					} else {
						uni.showToast({
							title: res.Msg,
							icon: 'none'
						})
					}
				})
			}
			// 获取token自动登录
		 else if (queryParams && (queryParams.token || queryParams.Token)) {
				Microi.Post(getApiUrl('TokenLogin'),
				{
					_token: queryParams.token || queryParams.Token,
					Token: queryParams.token || queryParams.Token,
					TokenName: 'token',
					OsClient: Microi.OsClient
				}, function(res){
					Microi.SetToken(queryParams.token || queryParams.Token) // 设置token
					Microi.SetCurrentUser(res.Data);
					self.$MicroiStore.commit('SetIsLogin', true);
					self.$MicroiStore.commit('SetCurrentUser', res.Data);
					uni.$emit('testParam', "你好")
				}, {
					Header : {
						authorization : 'Bearer ' +  (queryParams.token || queryParams.Token)
					}
				})
			}
			// 初始化microi
			self.Microi.Init({
				TokenCallback : function(){
					try{
						self.$MicroiStore.commit('SetIsLogin', self.Microi.IsLogin());
						self.$MicroiStore.commit('SetCurrentUser', self.Microi.GetCurrentUser());
						uni.$emit('testParam', "你好")
					}catch(e){
						console.error(e)
					}
				}
			});//集成了获取系统设置、自动登录、Token定时以旧换新 等等
			// else if (!self.Microi.IsLogin()) {
			// 	// 未登录，跳转登录页
			// 	uni.navigateTo({
			// 		url: '/pages/mine/login/login'
			// 	})
			// }

			// #ifdef APP-PLUS


			// 一键登录预登陆，可以显著提高登录速度
			// uni.preLogin({
			// 	provider: 'univerify',
			// 	success: (res) => {
			// 		// 成功
			// 		this.setUniverifyErrorMsg();
			// 		//console.log("preLogin success: ", res);
			// 	},
			// 	fail: (res) => {
			// 		this.setUniverifyLogin(false);
			// 		this.setUniverifyErrorMsg(res.errMsg);
			// 		// 失败
			// 		//console.log("preLogin fail res: ", res);
			// 	}
			// })
			// #endif
			if (Microi.IsLogin()) {
				// 在项目启动时，缓存项目组织架构
				try {
					// 检查缓存是否存在且未过期
					const cachedData = uni.getStorageSync('GetSysDeptStep')
					const cacheTime = uni.getStorageSync('GetSysDeptStep_time')
					const now = Date.now()
					const cacheExpired = !cacheTime || (now - cacheTime > 30 * 60 * 1000) // 30分钟过期
					
					if (!cachedData || cacheExpired) {
						// 异步获取组织架构数据
						Microi.Post(getApiUrl('GetSysDeptStep'), {
							FormEngineKey: "Sys_Dept"
						}).then(res => {
							if (res.Code == 1) {
								// 存储数据
								uni.setStorage({
									key: 'GetSysDeptStep',
									data: res.Data,
									success: function () {
										// 记录缓存时间
										uni.setStorageSync('GetSysDeptStep_time', Date.now())
									}
								});
							}
						}).catch(err => {
							console.error('获取组织架构数据失败:', err)
						})
					}
				} catch (error) {
					console.error('缓存读取错误:', error)
				}
			}
			
			// 标记应用已准备就绪
			setTimeout(() => {
				this.appReady = true;
				getApp().globalData.appReady = true;
			}, 500); // 给予500ms的时间让应用完成基本初始化
		},
		onShow: function() {
			//console.log('App Show')
			// 如果初始加载已完成，则不再执行
			if (this.initialLoadComplete) return;
			
			// 标记初始加载已完成
			this.initialLoadComplete = true;

		},
		onHide: function() {
			//console.log('App Hide')
		},
		globalData: {
			test: '',
			appReady: false // 应用是否准备就绪
		},
		methods: {
			...mapMutations(['setUniverifyErrorMsg', 'setUniverifyLogin']),
		}
	}
</script>

<style lang="scss">
	@import '@/uni_modules/uni-scss/index.scss';
	/* #ifndef APP-PLUS-NVUE */
	/* uni.css - 通用组件、模板样式库，可以当作一套ui库应用 */
	@import './common/uni.css';
	@import './common/currentStyles.css';
	@import './common/tailwind-replacement.css';
	@import '@/static/customicons.css';
	/* H5 兼容 pc 所需 */
	/* #ifdef H5 */
	@media screen and (min-width: 768px) {
		body {
			overflow-y: scroll;
		}
	}

	/* 顶栏通栏样式 */
	/* .uni-top-window {
	    left: 0;
	    right: 0;
	} */

	uni-page-body {
		min-height: 100% !important;
		height: auto !important;
	}

	.uni-top-window uni-tabbar .uni-tabbar {
		background-color: #fff !important;
	}

	.uni-app--showleftwindow .hideOnPc {
		display: none !important;
	}

	/* #endif */

	/* 以下样式用于 hello uni-app 演示所需 */
	// page {
	// 	background-color: #efeff4;
	// 	height: 100%;
	// 	font-size: 28rpx;
	// 	/* line-height: 1.8; */
	// }

	.fix-pc-padding {
		padding: 0 50px;
	}

	.uni-header-logo {
		padding: 30rpx;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		margin-top: 10rpx;
	}

	.uni-header-image {
		width: 100px;
		height: 100px;
	}

	.uni-hello-text {
		color: #7A7E83;
	}

	.uni-hello-addfile {
		text-align: center;
		line-height: 300rpx;
		background: #FFF;
		padding: 50rpx;
		margin-top: 10px;
		font-size: 38rpx;
		color: #808080;
	}

	/* #endif*/
	   /* #ifdef H5 */ 
		//  uni-page-head { display: none; } 
    /* #endif */

		::v-deep .uni-modal__bd{
			color: #000;
			font-size: 17px;
		}
		::v-deep .uni-toast__icon{
			margin: 20px auto;
		}
</style>
