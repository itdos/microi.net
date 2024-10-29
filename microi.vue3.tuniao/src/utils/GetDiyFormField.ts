import microiRequest from '@/config/api';
import configHttp from '@/config'
/**
 * 获取diy 表单字段
 * @param DiyTableId 表id
 * @returns Promise<void>
 */
export const GetDiyFormField = (obj: string) => {
  return new Promise<void>((resolve, reject) => {
		microiRequest.GetDiyField(obj).then(res => {
			if (res.Code == 1) {
				res.Data.map((item: { Placeholder: string; Component: string | string[]; Label: string; Data: string }) => {
					item.Placeholder = item.Component.includes('Select') ? '请选择' + item.Label : '请输入' + item.Label
					if (item.Data) {
						item.Data = JSON.parse(item.Data).map((_item: string) => {
							return {
								Id: _item,
								Name: _item,
								selected: false,
							}
						})
					}
				}) // Placeholder输入框默认值   Data下拉选择数据
				handleSelectData(res.Data) // 过滤下拉选择 获取数据
				handleDepartmentData(res.Data) // 获取组织机构
				resolve(res.Data)
			}
			uni.hideLoading();
		}).catch(err => {
			reject(err)
		})
  })
}
// 表单必填项校验
export const handleRules = (arr: any) => {
	const GetDiyFieldRules = arr.filter((item: {NotEmpty: number}) => item.NotEmpty) // 获取必填项
	const formRules: any = {}
	for (let key of GetDiyFieldRules) {
		formRules[key['Name']] = [{
			required: true,
			message: `请输入${key['Label']}`,
			trigger: ['blur','change']
		}]
	}
	return formRules
}
// 过滤下拉选择 获取数据
const handleSelectData = (arr: any) => {
	// 获取所有下拉框
	const SelectList = arr.filter((item: {Component: string}) => item.Component.includes('Select') || item.Component == 'Cascader')
	const newArrID: any = []
	const newArrName: any = []
	SelectList.map((item: {Id: string; Name: string; Data: any}) => {
		if (item.Data.length <= 0) {
			newArrID.push(item.Id)
			newArrName.push(item.Name)
		}
	})
	// 拿到下拉框的id/name查询数据
	if (newArrID.length <= 0) return
	const obj = {FieldIds:newArrID, FieldNames: newArrName,_SqlParamValue: {}}
	microiRequest.GgetFieldsData(obj).then(res => {
		if (res.Code == 1) {
			res.Data.map((FieldItem: {FieldId: string; Result: any}) => {
				const dataIndex = arr.findIndex((item: {Id: string}) => item.Id == FieldItem.FieldId)
				FieldItem.Result.Data?.map((i: ListData) => {
					arr[dataIndex].Data.push({
						Name: i.Name || i.BumenMC || i.GangweiMC || i.Xingming || i.XiangmuMC || i.ChepaiH || i.HuiyiSMC || i.Biaoti || i.KehuMC || i,
						Id: i.id || i.Id || i,
						selected: false,
						_Child: i._Child?.map((i: ListData) => {
							return {
								Name: i.Name || i.BumenMC || i.GangweiMC || i.Xingming || i.XiangmuMC || i.ChepaiH || i.HuiyiSMC || i.Biaoti || i.KehuMC || i,
								Id: i.id || i.Id || i,
							}
						})
					})
				})
			})
		}
	})
}
type ListData = {
	id: string; 
	Id: string; 
	Name: string; 
	BumenMC: string; 
	GangweiMC: string; 
	Xingming:string; 
	XiangmuMC:string;
	ChepaiH: string;
	HuiyiSMC: string;
	Biaoti: string;
	KehuMC: string;
}
// 获取组织机构
const handleDepartmentData = (arr: any) => {
	const SelectList = arr.filter((item: {Component: string}) => item.Component == 'Department')
	SelectList.map((item: {Id: string}) => {
		microiRequest.GetSysDeptStep({FormEngineKey: "Sys_Dept"}).then(res => {
			if (res.Code == 1) {
				const dataIndex = arr.findIndex((i: {Id: string}) => i.Id == item.Id)
				arr[dataIndex].Data = res.Data
			}
		})
	})
	
}
// 获取子表数据
export const GetTableData = (item: string,tableRowId: string, pagesIndex: number, pagesSize: number, DiyTableArr: any) => {
	return new Promise<void>((resolve, reject) => {
		const tableObj = JSON.parse(item)
		// console.log(tableObj,'tableObj');
		// 查询子表数据，关联主表字段判断，默认id
		let SearchEqual: any = {}
		for (var key in tableObj) {
			if (key == 'TableChildFkFieldName') {
				SearchEqual[tableObj[key]] = tableObj.TableChild.PrimaryTableFieldName ? DiyTableArr[tableObj.TableChild.PrimaryTableFieldName] : tableRowId
			}
		}
		const obj = {
			ModuleEngineKey: tableObj.TableChildSysMenuId,
			_SearchEqual: SearchEqual,
			_PageIndex: pagesIndex,
			_PageSize: pagesSize
		}
		microiRequest.GetTableData(obj).then(res => {
			if (res.Code == 1) {
				resolve(res)
			}
		}).catch(err => {
			reject(err)
		})
	})
}
/**
 * 上传图片/文件
 * @param url 文件地址
 * @param formData 其他表单字段
 * @returns Promise<void>
 */
export const UploadFile = (url: string, formData: {Path: string; Limit: boolean; Preview: boolean; }) => {
  return new Promise<void>((resolve, reject) => {
		uni.uploadFile({
			url: configHttp.uploadActionUrl,
			filePath: url,
			name: 'file',
			formData: formData,
			header: {
				Authorization: `Bearer ${uni.getStorageSync('Token')}`,
			},
			success: (res) => {
				const Updata = JSON.parse(res.data)
				if (Updata.Code == 1) {
					resolve(Updata.Data)
				} else {
					reject('上传文件发生错误')
				}
			},
			fail: (err) => {
				reject(err)
			},
		})
  })
}
/**
 * 删除表单
 * @param id 文件地址
 * @returns Promise<void>
 */
export const GoDelete = (TableId:string, Id:string, title: string)=> {
	return new Promise<void>((resolve, reject) => {
		uni.showModal({ //提醒用户更新
			title: "提示",
			content: `确认删除【${title}】？`,
			success: async (res) => {
				if (res.confirm) {
					const useFormInfo = uni.getStorageSync('useFormInfo')
					if (useFormInfo.length > 0) {
						const index = useFormInfo.findIndex((item: {Id: string}) => item.Id == Id)
						console.log(index,11112)
						if (index > -1) {
							useFormInfo.splice(index, 1)
							uni.setStorageSync('useFormInfo', useFormInfo)
							uni.showToast({
								title: '删除成功',
								icon: 'none',
							})
							resolve()
							return
						}
					}
					const obj = {
						TableId: TableId,
						Id: Id
					}
					const res = await microiRequest.DelFormData(obj);
					if (res.Code == 1) {
						uni.showToast({
							title: '删除成功',
							icon: 'none',
						})
						resolve(res)
					} else {
						uni.showToast({
							title: '删除失败',
							icon: 'none',
						})
						reject(res)
					}
				}
			}
		})
	})
}