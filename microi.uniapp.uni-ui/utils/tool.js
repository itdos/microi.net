import {
	Microi,
	V8
} from "@/config/microi.uniapp.js"
import {
	Base64
} from 'js-base64'

import {
	diyFormField,
} from '@/utils'

import Compressor from 'compressorjs';
/**
 * 替换路径
 */
export const GetServerPath = (path) => {
	if (!path) {
		return ''
	}
	let url = Microi.FileServer + path
	// 压缩图片
	// try {
	//   url = await yasuoImg(url)
	// } catch (e) {
	//   console.log('压缩图片失败：', e)
	//   return url
	// }
	return url
}
const yasuoImg = (url) => {
	return new Promise(async (resolve, reject) => {
		const blob = await dataURLtoBlob(url)
		let compressor = new Compressor(blob, {
			quality: 0.6, // 压缩质量
			success(result) {
				// resolve(result)
				const reader = new FileReader();
				reader.onload = function(e) {
					resolve(e.target.result);
				};
				reader.readAsDataURL(blob);
			},
			error(err) {
				console.error(err.message);
				reject(url)
			},
		});
	})
}
/**
 * 是否需要Base64解密
 */
export const isBase64 = (
	str
) => {
	try {
		// Base64 编码的字符串长度应该是4的倍数
		if (str.length % 4 !== 0) return false;

		// 正则表达式检查是否只包含Base64字符集中的字符
		const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
		return base64Regex.test(str);
	} catch (e) {
		// 如果解码过程中出现错误，则认为不是 Base64 编码
		return false;
	}
}
/**
 * 获取定位信息
 */
export const getLocation = () => {
	return new Promise((resolve, reject) => {
		uni.getLocation({
			type: 'gcj02', // 国家测绘局坐标系 gcj02，wgs84
			success: (res) => {
				var longitude = res.longitude.toFixed(6)
				var latitude = res.latitude.toFixed(6)
				// 根据经纬度获取位置信息
				Microi.ApiEngine.Run('ReverseGeocoding', {
					longitude: longitude,
					latitude: latitude
				}).then(res => {
					var data = res.Data.regeocode
					// 成功获取位置信息
					var addressData = {
						adddress: data.formatted_address,
						longitude: longitude,
						latitude: latitude
					}
					resolve(addressData)
				}).catch(err => {
					reject(err)
				})
			},
			fail: (err) => {
				console.log('获取定位信息失败：', err)
				reject('获取定位信息失败：请检查定位权限')
			}
		})
	})
}
/*
 * 打开选择位置
 */
export const openChooseLocation = () => {
	return new Promise((resolve, reject) => {
		uni.chooseLocation({
			success: (res) => {
				console.log('选择的位置信息：', res);
				resolve(res)
			},
			fail: (err) => {
				console.error('选择位置失败:', err);
				reject(err)
			}
		})
	})
}
/**
 * 获取地址栏参数
 */
export const getQueryParams = () => {
	const params = {};
	// #ifdef H5
	// Check if window is defined (for non-browser environments)
	if (typeof window === 'undefined' || !window.location) {
		console.log('window or window.location is not defined');
		return params;
	}

	// 获取#号之前的查询字符串部分
	const queryStringBeforeHash = window.location.search.substring(1);
	const varsBeforeHash = queryStringBeforeHash.split('&');
	varsBeforeHash.forEach((pair) => {
		const [key, value] = pair.split('=');
		if (key) {
			params[key] = decodeURIComponent(value);
		}
	});

	// 获取#号之后的哈希部分
	const hash = window.location.hash.substring(1); // 移除开头的井号
	const questionMarkIndex = hash.indexOf('?');
	if (questionMarkIndex !== -1) {
		// 获取?号之后的查询字符串部分
		const queryStringAfterHash = hash.substring(questionMarkIndex + 1);
		const varsAfterHash = queryStringAfterHash.split('&');
		varsAfterHash.forEach((pair) => {
			const [key, value] = pair.split('=');
			if (key) {
				params[key] = decodeURIComponent(value);
			}
		});
	}
	// #endif
	return params;
}
/**
 * 处理下拉框数据显示
 * @param {Array|any} data 表单数据
 * @param {Object} Config 配置项
 * @returns {string} 处理后的显示文本
 */
export const handleSelectData = (data, Config) => {
	if (!Config?.Config) {
		return Array.isArray(data) ? data.join('，') : String(data);
	}

	const {
		SelectLabel,
		SelectSaveField
	} = Config.Config;

	if (Array.isArray(data)) {
		return data.map(item => SelectLabel ? item[SelectLabel] : item).join('，');
	}

	if (SelectSaveField && Config.Data) {
		const flatData = flattenArray(Config.Data);
		// 增加判断，如果data是对象格式，则使用data[SelectSaveField]进行比较
		if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
			const matchedItem = flatData.find(item => item[SelectSaveField] === data[SelectSaveField]);
			return matchedItem ? matchedItem[SelectLabel] : (data[SelectLabel] || String(data));
		} else {
			const matchedItem = flatData.find(item => item[SelectSaveField] === data);
			return matchedItem ? matchedItem[SelectLabel] : String(data);
		}
	}
	if (typeof data === 'object') {	
		return (SelectLabel && data) ? data[SelectLabel] : String(data);
	}
	return String(data);
}
/**
 * 初始化v8init
 * @param {Object} formdata 初始数据
 * @param {Object} diyFormFields 自定义表单字段
 * @param {string} FormMode 表单模式
 */
export const initV8Init = (formdata, diyFormFields, FormMode) => {
	deepCopyFunction(V8.Init(formdata, diyFormFields, FormMode))
}
/**
 * 执行V8函数
 * @param {string} Code 函数参数
 */
export const RunV8Code = async (Code) => {
	if (Code) {
		let v8Code = ''
		if (isBase64(Code)) {
			v8Code = Base64.decode(Code);
		} else {
			v8Code = Code;
		}
		await V8.Run(v8Code);
	}
}
/**
 * 获取当前列表权限
 * @param {Array} MenuId 菜单id
 */
export const getAuthList = (MenuId) => {
	var data = Microi.GetCurrentUser()._RoleLimits.length > 0 ? Microi.GetCurrentUser()._RoleLimits : uni
		.getStorageSync('RoleLimits')
	const RoleLimits = data.filter(item => item.FkId == MenuId)
	if (RoleLimits.length == 0) {
		return []
	}
	return RoleLimits[0] && JSON.parse(RoleLimits[0]?.Permission)
}
/**
 * 扫一扫
 */
export const scanCode = () => {
	return new Promise(async (resolve, reject) => {
		// #ifdef APP
		let status = await checkPermission();
		if (status !== 1) {
			return;
		}
		// #endif
		uni.scanCode({
			success: (res) => {
				resolve(res.result)
			},
			fail: (err) => {
				reject(err)
			}
		})
	})
}
const checkPermission = async () => {
	console.log('开始执行checkPermission函数')
	try {
		let status = permision.isIOS ? await permision.requestIOS('camera') :
			await permision.requestAndroid('android.permission.CAMERA');
		console.log('执行permision调用相机 permision.isIOS：', permision.isIOS);
		console.log('执行permision调用相机结果：', status);
		if (status === null || status === 1) {
			status = 1;
		} else {
			uni.showModal({
				content: "需要相机权限",
				confirmText: "设置",
				success: function(res) {
					if (res.confirm) {
						permision.gotoAppSetting();
					}
				}
			})
		}
		return status;
	} catch (e) {
		console.log('执行checkPermission函数出现异常：', e.message)
	}
}
/**
 * 获取浏览器定位
 */
export const getBrowserLocation = () => {
	return new Promise((resolve, reject) => {
		AMap.plugin('AMap.Geolocation', function() {
			var geolocation = new AMap.Geolocation({
				enableHighAccuracy: true, //是否使用高精度定位，默认:true
				timeout: 10000, //超过10秒后停止定位，默认：5s
				position: 'RB', //定位按钮的停靠位置
				offset: [10, 20], //定位按钮与设置的停靠位置的偏移量，默认：[10, 20]
				zoomToAccuracy: true, //定位成功后是否自动调整地图视野到定位点

			});
			geolocation.getCurrentPosition(function(status, result) {
				console.log('获取浏览器定位成功：', status, result)
				if (status == 'complete') {
					var longitude = result.position.lng
					var latitude = result.position.lat
					// 根据经纬度获取位置信息
					Microi.ApiEngine.Run('ReverseGeocoding', {
						longitude: longitude,
						latitude: latitude
					}).then(res => {
						// console.log('获取位置信息成功：' ,res)
						var data = res.Data.regeocode
						// 成功获取位置信息
						var addressData = {
							adddress: data.formatted_address,
							longitude: longitude,
							latitude: latitude
						}
						resolve(addressData)
					}).catch(err => {
						console.log('获取位置信息失败：', err)
						reject(err)
					})
				} else {
					reject(result)
				}
			});
		});
	})
}
/*
 * 转换图片链接为blob对象
 * @param {string} path 图片链接
 * returns {Promise}
 */
const dataURLtoBlob = (path) => {
	return new Promise((resolve, reject) => {
		// 使用fetch API获取Blob对象
		fetch(path)
			.then(response => {
				// 确保响应是一个Blob
				if (response.blob) {
					return response.blob();
				}
				throw new Error('响应不是Blob类型');
			})
			.then(blob => {
				resolve(blob);
			})
			.catch(error => {
				reject(error);
			});
	})
}
/*
 * 上传文件
 * @param {string} file 文件对象
 * @param {Object} item 上传配置
 * @returns {Promise}
 */
export const uploadFile = (file, item) => {
	return new Promise((resolve, reject) => {
		let formFileData = {}
		// 如果是图片
		if (item.Component == 'ImgUpload') {
			formFileData = {
				// 其他表单字段
				'Path': '/img',
				'Limit': item.Config?.ImgUpload?.Limit || 10,
				'Preview': item.Config?.ImgUpload?.Preview || false,
			}
		} else { // 文件上传
			formFileData = {
				// 其他表单字段
				'Path': '/file',
				'Limit': item.Config.FileUpload.Limit || 10,
				'Preview': item.Config.FileUpload.Preview || false,
			}
		}
		let data = []
		console.log('上传文件：', file)
		file.forEach(async (path) => {
			// const newPath = await compressImg(path)
			// 压缩图片 ，先转换
			// const newPath = await dataURLtoBlob(path)
			// new Compressor(newPath, {
			//   quality: 0.6,
			//   success: (result) => {
			//     // blob转换连接
			//     const url = URL.createObjectURL(result)
			//     // 上传文件
			//     Microi.Upload({ ...formFileData, 'File': url }).then(res => {
			//       if (res.Code == 1) {
			//         data.push({
			//           'Path': res.Data.Path,
			//           'Name': res.Data.Name,
			//           'Size': res.Data.Size,
			//           'CreateTime': res.Data.CreateTime,
			//           'Id': res.Data.Id,
			//           'url': GetServerPath(res.Data.Path),
			//           'name': res.Data.Name,
			//           'extname': res.Data.Path.split('.')[1],
			//         })
			//         resolve({Code: 1, Data: data})
			//       } else {
			//         reject({Code: 0, Msg: res.Msg})
			//       }
			//     })
			//   },
			//   error: (err) => {
			//     console.log('压缩图片失败：', err)
			//   },
			// });
			// 上传文件
			Microi.Upload({
				...formFileData,
				'File': path
			}).then(res => {
				if (res.Code == 1) {
					data.push({
						'Path': res.Data.Path,
						'Name': res.Data.Name,
						'Size': res.Data.Size,
						'CreateTime': res.Data.CreateTime,
						'Id': res.Data.Id,
						'url': GetServerPath(res.Data.Path),
						'name': res.Data.Name,
						'extname': res.Data.Path.split('.')[1],
					})
					resolve({
						Code: 1,
						Data: data
					})
				} else {
					reject({
						Code: 0,
						Msg: res.Msg
					})
				}
			})
		})
	})
}
/*
 * 压缩图片
 * @param {string} url 地址
 * returns {Promise}
 */
export const compressImg = (url) => {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.src = url;
		img.onload = () => {
			const canvas = document.createElement('canvas') // 创建Canvas对象(画布)
			const context = canvas.getContext('2d')
			// 默认按比例压缩
			let cw = img.width
			let ch = img.height
			let w = img.width
			let h = img.height
			canvas.width = w
			canvas.height = h
			if (cw > 600 && cw > ch) {
				w = 600
				h = (600 * ch) / cw
				canvas.width = w
				canvas.height = h
			}
			if (ch > 600 && ch > cw) {
				h = 600
				w = (600 * cw) / ch
				canvas.width = w
				canvas.height = h
			}
			// 生成canvas
			let base64 // 创建属性节点
			context.clearRect(0, 0, 0, w, h)
			context.drawImage(img, 0, 0, w, h)
			base64 = canvas.toDataURL()
			resolve(base64)
			return base64
		}
		img.onerror = (error) => {
			reject(error);
			console.log('压缩图片失败：', error)
			return url
		};
	})
}
/*
 * 深拷贝函数
 * @param {Function} func 函数对象
 * @returns {Function}
 */
export const deepCopyFunction = (func) => {
	// 创建一个新的函数实例
	const newFunc = function(formData, type) {
		func.call(this, formData, type);
	};

	// 复制函数的属性
	Object.assign(newFunc, func);

	return newFunc;
}
/* 判断是否显示隐藏按钮
 * @param {Object} btn 按钮配置
 * @param {Object} formData 表单数据
 * @param {Object} diyFormFields 自定义表单字段
 * @param {Array} currentPermission 当前用户权限
 * @returns {boolean}
 */
export const isShowBtn = (btn, formData, diyFormFields, currentPermission, isType) => {
	// 是否需要执行V8CodeShow
	if (isType == 'edit') {
		if (btn.V8CodeShow) { // 执行条件
			let initParentV8 = deepCopyFunction(V8.Init(formData, diyFormFields));
			// 如果没有父就添加
			if (V8.ParentV8 === undefined || V8.ParentV8 === null || Object.keys(V8.ParentV8).length === 0) {
				V8.ParentV8 = initParentV8;
			}
			initV8Init(formData, diyFormFields);
			RunV8Code(btn.V8CodeShow);
			return V8.Result && (currentPermission.includes(btn.Id) || V8.CurrentUser.Level >= 999)
		} else {
			return currentPermission.includes(btn.Id)
		}
	} else if (btn.Id == 'Detail') {
		return !currentPermission.includes('NoDetail')
	} else {
		return currentPermission.includes(btn.Id) && isType != 'view'
	}
}
/*
 * 处理TmpEngineForm
 * @param {string} V8TmpEngineForm 表单引擎处理函数
 * @returns {string}
 */
export const TmpEngineTableForm = (V8TmpEngineForm) => {
	RunV8Code(V8TmpEngineForm)
	return V8.Result
}
/*
 * 处理TmpEngineTable
 * @param {Object} formData 表单数据
 * @param {Object} diyFormFields 自定义表单字段
 * @param {Object} item 表单项配置
 * @returns {string}
 */
export const TmpEngineTable = (formData, diyFormFields, item) => {
	// 如果有表格引擎处理数据
	if (item.V8TmpEngineTable) {
		initV8Init(formData, diyFormFields)
		RunV8Code(item.V8TmpEngineTable)
		return V8.Result
	} else if (item.Component && item.Component.includes('Select')) {
		const value = handleSelectData(formData[item.Name], item)
		return V8.IsNull(value) ? '' : value
	} else {
		return formData[item.Name] ?? ''
	}
}
/*
 * 处理字段值
 * @param {string} str 字段值
 * @returns {boolean} 布尔值
 */
export const handleFieldValue = (str) => {
	if (str == null || str === '' || str === undefined || str === "null" || str === "undefined" || str === "[]") {
		return true
	}
}
/*
 * 预览图片
 * @param {string} list 图片地址
 * @param {number} index 索引
 */
export const previewImg = (list, index) => {
	const ulrs = list.map((item) => item.url)
	uni.previewImage({
		urls: ulrs,
		current: index
	})
}
// 扫码
export const scanCodeH5 = () => {
	return new Promise((resolve, reject) => {
		uni.navigateTo({
			url: '/FormComponents/scanCode', // 扫码页面的路径
			events: {
				// 定义一个回调事件，这里命名为 'scanSuccess'
				'scanSuccess': function(data) {
					// 处理扫码结果
					console.log('Scanned data:', data);
					V8.ScanCodeRes = data
					resolve(data)
				}
			},
			success: function(res) {
				console.log('navigateTo success', res);
			},
			fail: function(err) {
				console.error('navigateTo fail', err);
			}
		});
	})
}
// 合并数组对象并处理数组对象重复
export const handleArrayObj = (array1, array2, key) => {
	return array1.concat(array2).reduce((unique, item) => {
		return unique.find(i => i[key] === item[key]) ? unique : [...unique, item];
	}, []);
}

/**
 * 将嵌套的JSON数组对象平铺成一维数组
 * @param {Array} array 需要平铺的数组
 * @param {string} childrenKey 子节点的键名，默认为'_Child'
 * @returns {Array} 平铺后的一维数组
 */
export const flattenArray = (array, childrenKey = '_Child') => {
	let result = [];

	if (!Array.isArray(array)) {
		return result;
	}
	array.forEach(item => {
		// 创建当前项的副本，移除children属性
		const {
			[childrenKey]: _Child, ...itemWithoutChildren
		} = item;

		// 将当前项添加到结果数组
		result.push(itemWithoutChildren);

		// 如果有子项，递归处理
		if (_Child && Array.isArray(_Child) && _Child.length > 0) {
			result = result.concat(flattenArray(_Child, childrenKey));
		}
	});
	return result;
}

//滚动获取缓存页面信息，既实现缓存，又能最大限度降低缓存带来的数据不一致（李赛赛 2024-12-06）
export const getCacheFormData = async (FormEngineKey, Id) => {
	let cachekey = `${FormEngineKey}_${Id}`;
	let fromData = uni.getStorageSync(cachekey)
	if (!fromData) {
		//缓存不存在，同步走接口并缓存
		const res = await Microi.FormEngine.GetFormData({
			FormEngineKey: FormEngineKey,
			Id: Id
		})
		if (res.Code !== 1) {
			throw new Error('获取数据失败');
		}
		fromData = res.Data
		uni.setStorage({
			key: cachekey,
			data: res.Data
		})
	} else {
		//若缓存已存在，异步拉一次接口，跟新到最新缓存，下次进入直接走新缓存，切不会阻塞
		Microi.FormEngine.GetFormData(FormEngineKey, {
			Id: Id
		}, function(result) {
			uni.setStorage({
				key: cachekey,
				data: result.Data
			})
		})
	}
	return fromData
}

/**
 * 获取数字输入框的step值
 * @param {number} step 步长配置值
 * @param {number} precision 精度配置值
 * @returns {number} 返回对应的step值
 */
export const getNumberStep = (step, precision) => {
	if (!precision) return step;
	// 保留precision位小数，并转为数字
	return Number(Math.pow(0.1, precision).toFixed(precision));
}

/**
 * 获取当前应用版本号
 * @returns {string} 版本号
 */
export const getCurrentVersion = () => {
  let version = '1.0.0'
  const systemInfo = uni.getSystemInfoSync()
  // 应用程序版本号
  // 条件编译，只在APP渲染
  // #ifdef APP
  version = systemInfo.appWgtVersion;
  // #endif
  // #ifdef H5
  version = systemInfo.appVersion;
  // #endif
  // 条件编辑只在微信小程序显示
  // #ifdef MP-WEIXIN
  const accountInfo = wx.getAccountInfoSync();
  version = accountInfo.miniProgram.version // 小程序 版本号
  // #endif

  return version
}
/**
 * 获取文件类型
 * @param {string} extname 文件扩展名
 * @returns {boolean} 是否是图片
 */
export const getFileType = (extname) => {
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
  return imageExts.includes(extname);
}