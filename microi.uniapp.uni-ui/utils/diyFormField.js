import {
	getApiUrl
} from './api'
import {
	Microi,
	V8
} from "@/config/microi.uniapp.js"
import {
	GetServerPath,
	handleSelectData,
	initV8Init,
	RunV8Code
} from './tool'
import dayjs from 'dayjs';
//添加缓存过期时间
const expireTime = 72 * 60 * 60 * 1000; //  72小时,三天

const loadDiyTableField = async (data) => {
	data?.map((item) => {
		// 如果移动端可见AppVisible为null，则默认显示 pc端可见字段
		if (item.AppVisible == null || item.AppVisible == undefined) {
			item.AppVisible = item.Visible
		}
		item.Placeholder = item.Component?.includes('Select') ? '请选择' + item
			.Label : '请输入' + item.Label
		item.Config = JSON.parse(item.Config) // 解析Config配置
		if (item.Data && item.Data != '{}') {
			try {
				item.Data = JSON.parse(item.Data)?.map((_item) => {
					return {
						text: _item,
						value: _item,
						selected: false,
					}
				})
			} catch (error) {
				console.log(error)
				item.Data = []
			}
		} else {
			item.Data = []
		}
	}) // Placeholder输入框默认值   Data下拉选择数据
	await getSelectData(data) // 获取下拉框数据
	await handleDepartmentData(data) // 获取组织机构
}


/* 
 * 获取diy 表格字段
 * @param DiyTableId 表id，SysMenuId 菜单id
 * @returns Promise
 */
export const diyTableField = (obj) => {
	let cachekey = 'diyTableField' + JSON.stringify(obj)
	let cachedata = uni.getStorageSync(cachekey)
	if (cachedata && cachedata.expireTime > Date.now()) {
		Microi.Post(getApiUrl('getDiyFieldByDiyTables'), {
			...obj
		}, function() {}, {
			DataType: "form"
		}).then(async res => {
			//设置缓存过期时间
			const timestamp = Date.now() + expireTime;
			uni.setStorage({
				data: res.Data,
				key: cachekey,
				timestamp: timestamp,
				success: function() {
					console.log('diyTableField' + cachekey + '数据存储成功');
				}
			})
		}).catch(err => {
			reject(err)
		})
		loadDiyTableField(cachedata.value)
		return cachedata.value
	} else {
		return new Promise((resolve, reject) => {
			Microi.Post(getApiUrl('getDiyFieldByDiyTables'), {
				...obj
			}, function() {}, {
				DataType: "form"
			}).then(async res => {
				//设置缓存过期时间
				const timestamp = Date.now() + expireTime;
				uni.setStorage({
					data: {
						value: res.Data,
						expireTime: timestamp
					},
					key: cachekey,
					success: function() {
						console.log('diyTableField' + cachekey + '数据存储成功');
					}
				})
				loadDiyTableField(res.Data)
				resolve(res.Data)
			}).catch(err => {
				reject(err)
			})
		})
	}
}


//把原diyFormField子操作拆出来
const subdiyFormField = async (data) => {
	data?.map((item) => {
		// 如果移动端可见AppVisible为null，则默认显示 pc端可见字段
		if (item.AppVisible == null || item.AppVisible == undefined) {
			item.AppVisible = item.Visible
		}
		item.Placeholder = item.Component?.includes('Select') ? '请选择' + item
			.Label : '请输入' + item.Label
		item.Config = JSON.parse(item.Config) // 解析Config配置
		if (item.Data && item.Data != '{}') {
			try {
				item.Data = JSON.parse(item.Data)?.map((_item) => {
					return {
						text: _item,
						value: _item,
						selected: false,
					}
				})
			} catch (error) {
				console.log(error)
				item.Data = []
			}
		} else {
			item.Data = []
		}
		// 如果有表单V8模板引擎
		if (item.V8TmpEngineForm) {
			item.Component = 'V8TmpEngineForm'
		}
	}) // Placeholder输入框默认值   Data下拉选择数据
	await getSelectData(data) // 获取下拉框数据
	await handleDepartmentData(data) // 获取组织机构
}

/* 
 * 获取diy 表单字段
 * @param DiyTableId 表id
 * @returns Promise
 */
export const diyFormField = async (obj) => {
	let cachekey = 'diyFormField' + JSON.stringify(obj)
	// uni.removeStorageSync(cachekey)
	let cachedata = uni.getStorageSync(cachekey)
	
	if (cachedata && cachedata.expireTime > Date.now()) {
		subdiyFormField(cachedata.value) //子操作

		//异步更新缓存
		Microi.Post(getApiUrl('GetDiyField'), {
			...obj
		}, function() {}, {
			DataType: "form"
		}).then(res => {
			//设置缓存过期时间
			const timestamp = Date.now() + expireTime;
			uni.setStorage({
				data: {
					value: res.Data,
					expireTime: timestamp
				},
				key: cachekey,
				success: function() {
					console.log('diyFormField_' + cachekey + '异步更新数据存储成功');
				}
			})

		})
		// subdiyFormField(cachedata.value) //子操作
		return cachedata.value
	} else {
		return new Promise((resolve, reject) => {
			Microi.Post(getApiUrl('GetDiyField'), {
				...obj
			}, function() {}, {
				DataType: "form"
			}).then(async res => {
				//设置缓存过期时间
				const timestamp = Date.now() + expireTime;
				uni.setStorage({
					data: {
						value: res.Data,
						expireTime: timestamp
					},
					key: cachekey,
					success: function() {
						console.log('diyFormField_' + cachekey + '数据存储成功');
					}
				})
				subdiyFormField(res.Data) //子操作
				resolve(res.Data)
			}).catch(err => {
				reject(err)
			})
		})
	}


}
/* 获取diy 表单模块
 * @param DiyTableId 表id
 * @returns Promise
 */
export const DiyTableModule = (obj) => {

	let cachekey = 'DiyTableModule' + JSON.stringify(obj)
	let cachedata = uni.getStorageSync(cachekey)
	let param = { FormEngineKey: 'Diy_Table' };
	//项目上遇到错误，传了Id,又传了条件，这里getFormData优先取id
	if(obj.Id){
		param.Id = obj.Id;
	}else{
		param._SearchEqual = obj._SearchEqual;
	}
	if (cachedata && cachedata.expireTime > Date.now()) {

		Microi.FormEngine.GetFormData(param).then(res => {
			//设置缓存过期时间
			const timestamp = Date.now() + expireTime;
			uni.setStorage({
				data: {
					value: res.Data,
					expireTime: timestamp
				},
				key: cachekey,
				success: function() {
					console.log('diyFormField_' + cachekey + '数据存储成功');
				}
			})
		})
		return cachedata.value
	} else {

		return new Promise((resolve, reject) => {
			Microi.FormEngine.GetFormData(param).then(res => {
				//设置缓存过期时间
				const timestamp = Date.now() + expireTime;
				uni.setStorage({
					data: {
						value: res.Data,
						expireTime: timestamp
					},
					key: cachekey,
					success: function() {
						console.log('diyFormField_' + cachekey + '数据存储成功');
					}
				})
				resolve(res.Data)
			}).catch(err => {
				reject(err)
			})
		})
	}

}
// 表单必填项校验
export const handleRules = (arr) => {
	const GetDiyFieldRules = arr?.filter((item) => item.NotEmpty == 1) // 获取必填项
	const formRules = {}
	if (!GetDiyFieldRules) return formRules
	for (let key of GetDiyFieldRules) {
		formRules[key['Name']] = {
			rules: [{
				required: true,
				errorMessage: `请输入${key['Label']}`,
			}]
		}
	}
	return formRules
}
/* 
 * 获取diy 表单下拉框动态数据
 */
const getSelectData = (arr) => {
	const GetDiyFieldSelect = arr?.filter((item) => item.Component?.includes('Select') || item
		.Component ==
		'Cascader' || item.Component == 'Radio' || item.Component == 'Autocomplete') // 获取下拉框
	const selectName = []
	const selectId = []
	// 获取下拉框名称、ID
	GetDiyFieldSelect?.map((item) => {
		// 如果item.Data没数据，则请求接口获取数据
		if (item.Data.length === 0) {
			selectName.push(item.Name)
			selectId.push(item.Id)
		}
	})
	if (selectName.length <= 0) return
	// 请求接口获取下拉框数据
	Microi.Post(getApiUrl('getFieldsData'), {
		FieldNames: selectName,
		FieldIds: selectId
	}, function() {}, {
		DataType: "form"
	}).then(res => {
		if (res.Data?.length > 0) {
			res.Data.map((item) => {
				const dataIndex = arr.findIndex((i) => i.Id == item.FieldId)
				const config = arr[dataIndex].Config
				// 如果是级联选择器
				if (arr[dataIndex].Component == 'Cascader') {
					arr[dataIndex].Data = replaceFieldNames(item.Result.Data, config)
				} else {
					arr[dataIndex].Data = item.Result.Data?.map((_item) => {
						return {
							text: config.SelectLabel ? _item[config
								.SelectLabel] : _item,
							value: config.SelectSaveField ? _item[config
								.SelectSaveField] : _item.Id ? _item.Id : _item,
							selected: false,
							..._item
						}
					})
				}
			})
		}
	})
}
/* 
 * 获取diy 表单组织机构动态数据
 */
export const handleDepartmentData = async (arr) => {
	const SelectList = arr?.filter((item) => item.Component == 'Department')
	const cacheData = uni.getStorageSync('GetSysDeptStep');

	if (cacheData) {
		console.log('发现GetSysDeptStep缓存', cacheData)
		SelectList?.map(async (item) => {
			const dataIndex = arr.findIndex((i) => i.Id == item.Id)
			arr[dataIndex].Data = cacheData; // 调用函数进行替换
		})
	} else {
		console.log('没发现GetSysDeptStep缓存')
		const res = await Microi.Post(getApiUrl('GetSysDeptStep'), {
			FormEngineKey: "Sys_Dept"
		})
		if (res.Code == 1) {
			SelectList?.map(async (item) => {
				const dataIndex = arr.findIndex((i) => i.Id == item.Id)
				arr[dataIndex].Data = res.Data; // 调用函数进行替换
			})
		}
	}



}
const replaceFieldNames = (data, config) => {

	// 检查数据是否为数组
	if (Array.isArray(data)) {
		// 遍历数组中的每个元素
		data.forEach((item, index) => {
			data[index] = replaceFieldNames(item, config);
		});
	} else if (typeof data === 'object' && data !== null) {
		// 创建一个新的对象来存储替换后的字段
		const newData = {};
		if (config) {
			// 替换字段名称
			if (data.hasOwnProperty(config.SelectLabel)) newData.text = data[config.SelectLabel];
			if (data.hasOwnProperty(config.SelectSaveField)) newData.value = data[config
				.SelectSaveField];
		} else {
			// 替换字段名称
			if (data.hasOwnProperty('Name')) newData.text = data.Name;
			if (data.hasOwnProperty('Id')) newData.value = data.Id;
		}

		// 递归处理子元素
		if (data.hasOwnProperty('_Child')) {
			newData.children = replaceFieldNames(data._Child, config);
		}
		// 遍历原始对象的其余属性
		Object.keys(data).forEach((key) => {
			if (!newData.hasOwnProperty(key)) {
				newData[key] = replaceFieldNames(data[key], config);
			}
		});
		return newData;
	}
	// 如果数据不是对象或数组，直接返回
	return data;
}
/*
 *处理表单提交数据
 * @param data 表单数据
 * @returns 处理后的数据
 * @diyFromfield diy表单字段
 */
export const handleFormSubmit = (data, diyFromfield) => {
	const newData = {
		...data
	}
	diyFromfield.map((item) => {
		// 如果是图片上传
		if (item.Component == 'ImgUpload') {
			// 如果是多张图片
			if (item.Config.ImgUpload.Multiple) {
				newData[item.Name] = JSON.stringify(data[item.Name])
			} else {
				newData[item.Name] = data[item.Name] ? data[item.Name][0]?.Path : ''
			}
		}
		// 如果是下拉选择
		else if (item.Component.includes('Select')) {
			// 数组类型
			if (Array.isArray(data[item.Name])) {
				newData[item.Name] = JSON.stringify(data[item.Name])
			} else if (typeof data[item.Name] === 'object' && data[item.Name] !==
				null) { // 对象类型
				// 判断保存字段类型
				if (data[item.Name] && item.Config.SelectSaveField) {
					newData[item.Name] = data[item.Name][item.Config.SelectSaveField]
				} else {
					newData[item.Name] = data[item.Name].value
				}
			} else {
				newData[item.Name] = data[item.Name]
			}
		}
		// 如果是日期
		else if (item.Component == 'DateTime') {
			// 年月日时分
			if (item.Config.DateTimeType == "datetime_HHmm" && data[item.Name]) {
				newData[item.Name] = dayjs(data[item.Name]).format('YYYY-MM-DD HH:mm')
			} else {
				newData[item.Name] = data[item.Name]
			}
		} else {
			// 如果是数组或对象
			if (Array.isArray(data[item.Name]) || (typeof data[item.Name] === 'object' && data[
					item
					.Name] !== null)) {
				newData[item.Name] = JSON.stringify(data[item.Name])
			} else {
				newData[item.Name] = data[item.Name]
			}
		}
	})
	return newData
}
// 预处理字段配置，构建映射表
const preprocessConfig = (diyFromfield) => {
	const configMap = new Map();
	diyFromfield.forEach(item => {
		const {
			Name,
			Component,
			Config
		} = item;
		configMap.set(Name, {
			...item
		});
	});
	return configMap;
};
/*
 *处理表单详情数据
 * @param data 表单数据
 * @returns 处理后的数据
 * @diyFromfield diy表单字段
 * @type 类型 Edit
 */
export const handleFormDetail = async (data, diyFromfield, type) => {
	const newData = {};
	const configMap = preprocessConfig(diyFromfield);
	for (let key in data) {
		let value = data[key];
		try {
			value = JSON.parse(value);
		} catch (error) {
			// 继续使用原始数据
		}
		newData[key] = value;
		const config = configMap.get(key);
		if (config) {
			switch (config.Component) {
				case 'Checkbox':
					newData[key] = Array.isArray(value) ? [...value] : [];
					break;
				case 'ImgUpload':
				case 'FileUpload':
					const isMultiple = config.Config[config.Component].Multiple; // 是否多选
					const isAnonymous = config.Config[config.Component].Limit; // 是否匿名
					if (isMultiple) {
						try {
							if (value) {
								const processedFiles = await Promise.all(value.map(async item => {
									const url = isAnonymous ? await getPrivateFileUrl({
										FilePathName: item.Path,
										HDFS: Microi.SysConfig.HDFS,
										FormEngineKey: config.TableName,
										FormDataId: data.Id,
										FieldId: config.Id,
									}) : GetServerPath(item.Path);
									return {
										url,
										name: item.Name,
										extname: item.Path.split('.')[1],
										CreateTime: item.CreateTime,
										Id: item.Id,
										Name: item.Name,
										Path: item.Path,
										Size: item.Size,
									};
								}));
								newData[key] = processedFiles;
							} else {
								newData[key] = [];
							}
						} catch (error) {
							newData[key] = [];
						}
					} else {
						newData[key] = value && typeof value === 'string' ? [{
							url: isAnonymous ? await getPrivateFileUrl({
								FilePathName: value,
								HDFS: Microi.SysConfig.HDFS,
								FormEngineKey: config.TableName,
								FormDataId: data.Id,
								FieldId: config.Id,
							}) : GetServerPath(value),
							name: value,
							extname: value.split('.').length > 1 ? value.split('.')[1] : ''
						}] : [];
					}
					break;
			}
		}
	}
	return newData;
};
/*
 远程搜索下拉框数据
 @param obj 条件数据
 @returns Promise
 */
export const remoteSearchSelect = (obj, config) => {
	return new Promise((resolve, reject) => {
		Microi.Post(getApiUrl('getDiyFieldSqlData'), obj, function() {}, {
				DataType: "form"
			})
			.then(res => {
				const data = res.Data?.map((_item) => {
					return {
						text: config.SelectLabel ? _item[config.SelectLabel] : _item,
						value: config.SelectSaveField ? _item[config
							.SelectSaveField] : _item,
						selected: false,
						..._item
					}
				})
				resolve(data)
			}).catch(err => {
				reject(err)
			})
	})
}
/*
	获取私有文件url
	@param obj 条件数据
	@returns Promise
*/
export const getPrivateFileUrl = (obj) => {
	return new Promise((resolve, reject) => {
		Microi.Post(Microi.Api.GetPrivateFileUrl, obj, function() {}, {
			DataType: "form"
		}).then(res => {
			resolve(res.Data)
		}).catch(err => {
			reject(err)
		})
	})
}