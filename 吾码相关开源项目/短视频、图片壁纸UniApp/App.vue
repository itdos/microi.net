<script>
	import Vue from 'vue'
	import store from './store/index.js'
	import updateCustomBarInfo from './tuniao-ui/libs/function/updateCustomBarInfo.js'
	// Microi ------- START
	import {
		mapState
	} from 'vuex'
	// Microi ------- END
	export default {
		// Microi ------- START
		computed: {
			...mapState({
				CurrentUser: function() {
					return this.$MicroiStore.state.CurrentUser;
				},
				IsLogin: function() {
					return this.$MicroiStore.state.IsLogin;
				},
			}),
		},
		// Microi ------- END
		onLaunch: function() {
			// Microi ------- END
			var self = this;
			self.Microi.Init({
				TokenCallback : async function(){
					self.$MicroiStore.commit('SetIsLogin', self.Microi.IsLogin());
					self.$MicroiStore.commit('SetCurrentUser', self.Microi.GetCurrentUser());
					self.$MicroiStore.commit('SysConfig', self.Microi.GetSysConfigSync());
				}
			});
			// Microi ------- END
			uni.onTabBarMidButtonTap(() => {
				uni.navigateTo({
				  url: '/pages/index/component/PageC',
				});
			})
			uni.getSystemInfo({
				success: function(e) {
					// #ifndef H5
					// 获取手机系统版本
					const system = e.system.toLowerCase()
					const platform = e.platform.toLowerCase()
					// 判断是否为ios设备
					if (platform.indexOf('ios') != -1 && (system.indexOf('ios') != -1 || system.indexOf(
							'macos') != -1)) {
						Vue.prototype.SystemPlatform = 'apple'
					} else if (platform.indexOf('android') != -1 && (system.indexOf('android') != -1)) {
						Vue.prototype.SystemPlatform = 'android'
					} else {
						Vue.prototype.SystemPlatform = 'devtools'
					}
					// #endif
				}
			})

			// 获取设备的状态栏信息和自定义顶栏信息
			// store.dispatch('updateCustomBarInfo')
			updateCustomBarInfo().then((res) => {
				store.commit('$tStore', {
					name: 'vuex_status_bar_height',
					value: res.statusBarHeight
				})
				store.commit('$tStore', {
					name: 'vuex_custom_bar_height',
					value: res.customBarHeight
				})
			})

			// #ifdef MP-WEIXIN
			//更新检测
			if (wx.canIUse('getUpdateManager')) {
				const updateManager = wx.getUpdateManager();
				updateManager && updateManager.onCheckForUpdate((res) => {
					if (res.hasUpdate) {
						updateManager.onUpdateReady(() => {
							uni.showModal({
								title: '更新提示',
								content: '新版本已经准备就绪，是否需要重新启动应用？',
								success: (res) => {
									if (res.confirm) {
										uni.clearStorageSync() // 更新完成后刷新storage的数据
										updateManager.applyUpdate()
									}
								}
							})
						})

						updateManager.onUpdateFailed(() => {
							uni.showModal({
								title: '已有新版本上线',
								content: '小程序自动更新失败，请删除该小程序后重新搜索打开哟~~~',
								showCancel: false
							})
						})
					} else {
						//没有更新
					}
				})
			} else {
				uni.showModal({
					title: '提示',
					content: '当前微信版本过低，无法使用该功能，请更新到最新的微信后再重试。',
					showCancel: false
				})
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
	/* 注意要写在第一行，同时给style标签加入lang="scss"属性 */
	@import './common/app.scss';
	@import './tuniao-ui/index.scss';
	@import './tuniao-ui/iconfont.css';
</style>