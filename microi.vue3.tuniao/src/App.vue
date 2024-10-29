<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { inject } from 'vue';
import microiRequest from '@/config/api';
import { tnNavPage } from '@tuniao/tnui-vue3-uniapp/utils'
const Microi: any = inject('Microi'); // 使用注入Microi实例
onLaunch(() => {
  // 初始化
  Microi.Init()
  // #ifdef H5
  // 获取token自动登录
  var token = decodeURIComponent((new RegExp('[?|&|%3F]' + 'token' + '%3D' + '([^&;]+?)(&|#|;|$)').exec(location.href) || [, ""])[1].replace(/\+/g, '%20')) || null;
  if (!token) {
      token = decodeURIComponent((new RegExp('[?|&|%3F]' + 'token' + '=' + '([^&;]+?)(&|#|;|$)').exec(location.href) || [, ""])[1].replace(/\+/g, '%20')) || null;
  }
  if (token) {
    uni.setStorageSync('Token', token)
    microiRequest.TokenLogin({
      _token: token,
      Token: token,
      TokenName: 'token',
      OsClient: Microi.OsClient
    }).then(res => {
      console.log(res,123)
      if (res.Code == 1) {
        Microi.SetCurrentUser(res.Data);
        uni.setStorageSync('userInfo', res.Data)
      }
    })
  }
  console.log('App Launch',token)
// #endif
  // 如果未添加服务器配置，跳转到服务器配置页面
	if (uni.getStorageSync('OsClient') && uni.getStorageSync('ApiBase')) {
	} else {
    // 去登录
    uni.showModal({
      title: '提示',
      content: '登录后才可正常使用，是否立即登录？',
      confirmText: '去登录',
      success: res => {
        if (res.confirm) {
          // tnNavPage('/pages-user/server/index', 'reLaunch')
          uni.reLaunch({
            url: '/pages/login/index'
          })
        }
      }
    })
	}
})
</script>
<style lang="scss">
//修复工作台页面每行碰到图片无法加载时，图标和文字未对齐的bug --by itdos.com 2024-01-09
.tn-avatar--lg{
	overflow:hidden;
}
@import '@tuniao/tn-style/dist/uniapp/index.css';
</style>
