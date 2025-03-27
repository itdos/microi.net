var jweixin = require('jweixin-module');
export default {
	//判断是否在微信中    
	isWechat: function() {
		var ua = window.navigator.userAgent.toLowerCase();
		if (ua.match(/micromessenger/i) == 'micromessenger') {
			//console.log('是微信客户端')  
			return true;
		} else {
			//console.log('不是微信客户端')  
			return false;
		}
	},
	// 初始化
	initJssdk: function(callback) {
		// 记录进入app时的url
		if (typeof window.entryUrl === 'undefined' || window.entryUrl === '') {
			window.entryUrl = location.href.split('#')[0]
		}
		let isiOS = !!navigator.userAgent.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/); //ios终端
		// 进行签名的时候  Android 不用使用之前的链接， ios 需要
		let signLink = isiOS ? window.entryUrl : location.href.split('#')[0];
		// console.warn('-----------当前签名url--------------')
		// console.warn(signLink)
		// var uri = encodeURIComponent(location.href.split('#')[0]); //获取当前url然后传递给后台获取授权和签名信息
		var uri = encodeURIComponent(signLink); //获取当前url然后传递给后台获取授权和签名信息
		//服务端进行签名
		uni.request({
			url: 'https://xxx.com/api/WechatScript/getSignPackage', //你的接口地址  
			data: {
				url: uri
			},
			success: (res) => {
				// console.log(res)
				console.log('------签名返回数据------')
				console.log(res.data.data)
				//返回需要的参数appId,timestamp,noncestr,signature等  
				//注入config权限配置
				jweixin.config({
					debug: false,
					appId: res.data.data.appId,
					timestamp: res.data.data.timestamp,
					nonceStr: res.data.data.nonceStr,
					signature: res.data.data.signature,
					jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData', 'editAddress', 'chooseImage',
						'onMenuShareAppMessage', 'onMenuShareTimeline', 'chooseImage', 'previewImage', 'uploadImage',
						'downloadImage', 'chooseWXPay'
					]
				});
				jweixin.ready(function() {
					console.log('config注入成功')
					// window.alert('签名的URL：'+ signLink)
					if (callback) {
						callback();
					}
				})
			}
		})
	},
	//在需要定位页面调用  
	getlocation: function(callback) {
		if (!this.isWechat()) {
			//console.log('不是微信客户端')  
			return;
		}
		this.initJssdk(function(res) {
			jweixin.ready(function() {
				jweixin.getLocation({
					type: 'gcj02', // 默认为wgs84的gps坐标，如果要返回直接给openLocation用的火星坐标，可传入'gcj02'  
					success: function(res) {
						// console.log(res);  
						callback(res)
					},
					fail: function(res) {
						console.log(res)
					},
					// complete:function(res){  
					//     console.log(res)  
					// }  
				});
			});
		});
	},
	openlocation: function(data, callback) { //打开位置  
		if (!this.isWechat()) {
			//console.log('不是微信客户端')  
			return;
		}
		this.initJssdk(function(res) {
			jweixin.ready(function() {
				jweixin.openLocation({ //根据传入的坐标打开地图  
					latitude: data.latitude,
					longitude: data.longitude
				});
			});
		});
	},
	chooseImage: function(callback) { //选择图片  
		if (!this.isWechat()) {
			//console.log('不是微信客户端')  
			return;
		}
		//console.log(data);  
		this.initJssdk(function(res) {
			jweixin.ready(function() {
				jweixin.chooseImage({
					count: 1,
					sizeType: ['compressed'],
					sourceType: ['album'],
					success: function(res) {
						callback(res)
					}
				})
			});
		});
	},
	//微信支付  
	wxpay: function(params = {}) {
		if (!this.isWechat()) {
			//console.log('不是微信客户端')  
			return;
		}
		this.initJssdk(function() {
			// console.log(params)
			jweixin.chooseWXPay({
				timestamp: params.data.timeStamp, // 支付签名时间戳，注意微信jssdk中的所有使用timestamp字段均为小写。但最新版的支付后台生成签名使用的timeStamp字段名需大写其中的S字符  
				nonceStr: params.data.nonceStr, // 支付签名随机串，不长于 32 位  
				package: params.data.package, // 统一支付接口返回的prepay_id参数值，提交格式如：prepay_id=\*\*\*）  
				signType: params.data.signType, // 签名方式，默认为'SHA1'，使用新版支付需传入'MD5'  
				paySign: params.data.paySign, // 支付签名  
				success: function(res) {
					// console.log(res);  
					// console.log('微信JSAPI返回支付成功')
					params.success(res)
				},
				cancel: function(res) {
					params.fail(res)
					// console.log('微信JSAPI返回支付失败')
				},
				// complete:function(res){  
				//     console.log(res)  
				// }  
			});

		});
	},
	//在需要自定义分享的页面中调用
	share: function(data) {
		//每次都需要重新初始化配置，才可以进行分享  
		this.initJssdk(function() {
			var shareData = {
				title: data && data.title ? data.title : '今实贸易商行',
				desc: data && data.desc ? data.desc : '零钱提现',
				link: data && data.link ? data.link : window.location.href,
				imgUrl: data && data.imgUrl ? data.imgUrl : 'https://vkceyugu.cdn.bspapp.com/VKCEYUGU-weitao/d724aa70-eac6-11ea-b680-7980c8a877b8.jpg',
				success: function(res) {
					//用户点击分享后的回调，这里可以进行统计，例如分享送金币之类的  
					// request.post('/api/member/share');
					console.log('设置成功')
				},
				cancel: function(res) {}
			};
			//分享给朋友接口  
			jweixin.onMenuShareAppMessage(shareData);
			//分享到朋友圈接口  
			jweixin.onMenuShareTimeline(shareData);
		});
	},
	// 选择通讯地址
	chooseAddress: function(callback) {
		this.initJssdk(function() {
			jweixin.openAddress({
				success: function(res) {
					callback(res)
				}
			})
		})
	}
}
