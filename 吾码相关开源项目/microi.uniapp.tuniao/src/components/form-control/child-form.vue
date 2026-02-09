<template>
	<view class="work-page tn-m-lg">
		<view class="work-item">
			<scroll-view scroll-y style="height: 100%;width: 100%; padding-bottom: 100rpx;">
				<formControl ref="dynamicForm" v-if="isShow" :GetDiyFieldList="GetDiyFieldList" :formRules="formRules" :GetDiyTableList="GetDiyTableList" :FormLabelPosition="FormLabelPosition"/>
			</scroll-view>
		</view>
		<view class="sub-btn ">
			<TnButton width="100%" height="80" :disabled="isDisabled" @click="handelAddForm">提交</TnButton>
		</view>
	</view>
</template>

<script lang="ts" setup>
	import formControl from './index.vue'
	import { ref, reactive } from 'vue'
	import { GetDiyFormField, handleRules, GetListObj } from '@/utils'
	import TnButton from '@tuniao/tnui-vue3-uniapp/components/button/src/button.vue'
	import microiRequest from '@/config/api';
	import { definePropType } from '@tuniao/tnui-vue3-uniapp/utils'
	// import { useForm } from '@/stores';
	
	const props = defineProps({
		TableId: {
			type: String
		}, // 父id
    tableChildRowId: {
			type: String
		}, // 子id
    TableChildTableId: {
			type: String
		}, // 子表id
		TableChildTableData: {
			type: definePropType<any>(String),
		}, // 子表数据
		isAddBtnType: {
			type: String
		}, // 新增按钮类型
		titleChildForm: {
			type: String
		}, // 标题
	})
	const GetDiyFieldList = ref<any>([]) // 表单列表
	const formRules = ref<any>({}) // 表单必填项
	const dynamicForm = ref()
	const tableName = ref<string>()
	const tableRowId = ref<string>()
  const TableChildTableId = ref<string>()
	const emits = defineEmits(['ChildSubmitOk'])
	const isDisabled = ref<boolean>(false)
	const isShow = ref<boolean>(false)
  const GetDiyTableList = ref<any>({})
	const FormLabelPosition = ref<string>('top') // 表单对齐方式
	const arrChildForm = ref(uni.getStorageSync('useFormInfo'))
	// 获取表单字段
	const getData = async () => {
		try {
			// 如果是编辑时获取详情
      if (props.tableChildRowId) {
        tableRowId.value = props.tableChildRowId
        TableChildTableId.value = props.TableChildTableId
      } else {
        const NewGuidRes: any = await microiRequest.GetNewGuid('')
			  tableRowId.value = NewGuidRes.Data
        TableChildTableId.value = JSON.parse(props.TableChildTableData).TableChildTableId
				isShow.value = true
      }
			const res: any = await microiRequest.GetDiyTableModel({ Id: TableChildTableId.value})
			if (res.Code == 1) {
				tableName.value =  res.Data.Name
				FormLabelPosition.value = res.Data.FormLabelPosition || 'top' // 表单对齐方式
			}
			const obj: any = {
				TableId: TableChildTableId.value
			}
			GetDiyFieldList.value = await GetDiyFormField(obj) // 获取表单列表
			formRules.value = handleRules(GetDiyFieldList.value) // 获取表单必填项
			if (props.titleChildForm == '编辑') {
				const useFormInfo = uni.getStorageSync('useFormInfo')
				if (useFormInfo.length > 0) {
					const index = useFormInfo.findIndex((item: {Id: string}) => item.Id == props.tableChildRowId)
					if (index > -1) {
						isShow.value = true
						GetDiyTableList.value = GetListObj(useFormInfo[index]._RowModel, GetDiyFieldList.value, tableRowId.value)
						return
					}
				}
				const objTableRow: any = {
					TableId: props.TableChildTableId,
					_TableRowId: props.tableChildRowId
				}
				const resTableRow = await microiRequest.GetDiyTableRowModel(objTableRow);
				if (resTableRow.Code == 1) {
					isShow.value = true
					GetDiyTableList.value = GetListObj(resTableRow.Data, GetDiyFieldList.value, tableRowId.value)
				}
			}
		} catch (error) {
			console.error('获取表单列表', error);
		}
	}
	getData()
	// 提交数据
	const handelAddForm = () => {
		dynamicForm.value.formRef.validate(async (valid: any) => {
		  if (valid) {
				console.log(dynamicForm.value.formData, props.isAddBtnType)
				const data = dynamicForm.value.formData
					for (var key in data) {// 如果提交数据为json数组就转化字符串
						if (Array.isArray(data[key])) {
							data[key] = JSON.stringify(data[key])
						}
					}
					if (!props.tableChildRowId) {
						const tableObj = JSON.parse(props.TableChildTableData)
						for (var key in tableObj) {
							if (key == 'TableChildFkFieldName') {
								data[tableObj[key]] = props.TableId
							}
						}
						data.Id = tableRowId.value
					}
					console.log(data,111)
				// 如果新增提交子表格式为InTable，就不掉接口走缓存
				if (props.isAddBtnType == 'InTable') {
					if (!props.tableChildRowId) {
						data._IsInTableAdd = true
						const obj: any = {
							FormEngineKey: tableName.value,
							Id: tableRowId.value,
							_RowModel: {...data}
						}
						// userStore.setUseFormInfo(obj)
						arrChildForm.value.push(obj)
						uni.setStorageSync('useFormInfo', arrChildForm.value)
					} else {
						const useFormInfo = uni.getStorageSync('useFormInfo')
						const index = useFormInfo.findIndex((item: {Id: string}) => item.Id == tableRowId.value)
						if (index == -1) {
							submit(data)
						}
					}
					emits('ChildSubmitOk')
				} else {
					submit(data)
				}
			} else {
				uni.showToast({
				  title: '表单校验失败',
				  icon: 'none',
				})
			}
		})
	}
	const submit = async (data: any) => {
		isDisabled.value = true
				try {
					const obj: any = {
						FormEngineKey: tableName.value,
						Id: tableRowId.value,
						_FormData: {...data}
					}
					let res: any = {}
					if (!props.tableChildRowId) {
						res = await microiRequest.AddFormData(obj)
					} else {
						res = await microiRequest.UptFormData(obj)
					}
					if (res.Code == 1) {
						isDisabled.value = false
						uni.showToast({
						  title: '提交成功',
						  icon: 'none',
						})
						emits('ChildSubmitOk')
					} else {
						isDisabled.value = false
						uni.showToast({
						  title: '提交失败',
						  icon: 'none',
						})
					}
				console.error('提交成功', res);
				} catch (error) {
					console.error('获取表单列表', error);
				}
	}
</script>

<style lang="scss" scoped>
	.work-page{
		.work-item{
			height: 70vh;
		}
	}
</style>