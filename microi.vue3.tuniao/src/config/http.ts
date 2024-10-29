import { Microi } from "./microi.uniapp.js"
// import { useUser } from '@/stores';
import { tnNavPage } from '@tuniao/tnui-vue3-uniapp/utils'
import dayjs from 'dayjs';
// const userStore = useUser()

// 导出请求函数
export function request(url: any, method: any, data: any, header = {}) {
	// 添加请求头
	  header = {
	    'Authorization': `Bearer ${uni.getStorageSync('Token')}`,
	    ...header
	  };
  return new Promise((resolve, reject) => {
    uni.request({
      url: Microi.ApiBase + url,
      method: method,
      data: data,
      header: header,
      success: (res: any) => {
				let token = res.header.Authorization || res.header.authorization
				if (token) {
					uni.setStorageSync("Token", token);
				}
				if (res.data.Code == 1001) {
					uni.hideLoading();
					uni.showModal({
						title: '提示',
						content: res.data.Msg,
						confirmText: '去登录',
						success: res => {
							if (res.confirm) {
								// tnNavPage('/pages/login/index', 'navigateTo')
								uni.reLaunch({
									url: '/pages/login/index'
								})
							}
						}
					})
				} else {
					resolve(res.data);
				}
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}