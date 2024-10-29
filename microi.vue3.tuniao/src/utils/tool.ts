import { GetTableData } from '@/utils'
import { Microi } from "@/config/microi.uniapp.js"
/**
 * 替换路径
 */
export const GetServerPath = (
  path: string,
) => {
  if (!path) {
  	return ''
  }
	return Microi.FileServer + path
}
/**
 * 处理动态列表显示数据详情
 * DiyFieldArr 表字段
 * DiyTableArr 表数据
 */
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
}
export const GetDiyList = async (DiyFieldArr: any, DiyTableArr: any, TableRowId: string) => {
	var fieldModel = []
	for (var i = 0, len = DiyFieldArr.length; i < len; i ++) {
		fieldModel[i] = DiyFieldArr[i]
		try {
			fieldModel[i]._Value = JSON.parse(DiyTableArr[fieldModel[i].Name]);
		} catch (error) {
			fieldModel[i]._Value = DiyTableArr[fieldModel[i].Name]
		}
		// 处理不同的下拉框数据内容
		let valueArr: any = []
		if (Array.isArray(fieldModel[i]._Value) && fieldModel[i].Component.includes('Select')) {
			fieldModel[i]._Value?.map((i: ListData) => {
				valueArr.push({
					Name: i.Name || i.BumenMC || i.GangweiMC || i.Xingming || i.XiangmuMC || i.ChepaiH || i.HuiyiSMC || i.Biaoti || i,
					Id: i.id || i.Id || i,
				})
			})
		} else {
			valueArr = fieldModel[i]._Value
		}
		if (fieldModel[i].Component == 'TableChild') {
			const res: any = await GetTableData(fieldModel[i].Config, TableRowId, 1, 10, DiyTableArr)
			fieldModel[i].ChildList = res.Data
			fieldModel[i].ChildListCount = res.DataCount
		}
		fieldModel[i]._Value = valueArr
	}
	return fieldModel
}
/**
 * 获取编辑表单详情处理数据里面包含json字符串
 * obj obj数据
 * GetDiyFieldList 字段数据
 * TableRowId 这条数据的id
 */
export const GetListObj = (obj: any, GetDiyFieldList: any, TableRowId: string) => {
	for (let key in obj) {
	  if (obj.hasOwnProperty(key)) {
			try {
				obj[key] = JSON.parse(obj[key]);
			} catch (error) {
				obj[key]
			}
	  }
		if (obj[key] === null) {
			obj[key] = ''; // 将值赋值为空字符串
		}
		GetDiyFieldList.forEach((item: any) => {
			if (item.Component == 'ImgUpload') {
				if (key == item.Name) {
					if (Array.isArray(obj[key])){
					} else {
						obj[key] = obj[key] ? [GetServerPath(obj[key])] : []
					}
				}
			}
			if (item.Component == 'FileUpload') {
				if (key == item.Name) {
					if (Array.isArray(obj[key])){
						obj[key] = obj[key].map((item: {Name: string; Path: string}) => {
							return {
								name: item.Name,
								url: item.Path,
								extname: item.Path.split('.')[1],
								...item
							};
						});
						item.Data = obj[key]
						console.log('FileUpload',obj[key])
					} else {
						obj[key] = obj[key] ? [GetServerPath(obj[key])] : []
					}
				}
			}
		})
	}
	const List = GetDiyFieldList.filter((item: {Component: string}) => item.Component == 'TableChild')
	List.map(async (item: {
		ChildListCount: any;Config: string; ChildList: any
}) => {
		const res:any = await GetTableData(item.Config, TableRowId, 1, 10, obj)
		const arr:any = []
		const useFormInfo = uni.getStorageSync('useFormInfo')
		useFormInfo?.forEach((item : any) => {
			arr.push(item._RowModel)
		})
		item.ChildList = [...res.Data, ...arr]
		item.ChildListCount = res.DataCount
	})
	return obj
}
