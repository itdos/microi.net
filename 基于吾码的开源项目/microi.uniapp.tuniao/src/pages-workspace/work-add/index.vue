<template>
	<CustomPage :title="title" :is-h5-demo-page="isDemoH5Page">
		<view class="work-page ">
			<view class="work-item">
				<scroll-view scroll-y style="height: 100%;width: 100%; padding-bottom: 100rpx;">
					<formControl ref="dynamicForm" v-if="isShow" :TableId="tableRowId" :GetDiyFieldList="GetDiyFieldList"
						:formRules="formRules" :tableRowId="tableRowId" :GetDiyTableList="GetDiyTableList"
						:FormLabelPosition="FormLabelPosition" @AddBtnType="AddBtnType" />
				</scroll-view>
			</view>
			<view class="sub-btn ">
				<TnButton width="100%" height="80" :disabled="isDisabled" @click="handelAddForm">提交</TnButton>
			</view>
		</view>
	</CustomPage>
</template>

<script lang="ts" setup>
	import CustomPage from '@/components/custom-page/src/custom-page.vue'
	import { useDemoH5Page } from '@/hooks'
	import { onLoad,onShow,onHide } from '@dcloudio/uni-app';
	import microiRequest from '@/config/api';
	import { ref, reactive } from 'vue'
	import formControl from '@/components/form-control/index.vue'
	import TnButton from '@tuniao/tnui-vue3-uniapp/components/button/src/button.vue'
	import { GetDiyFormField, handleRules, GetListObj } from '@/utils'
	// import { useForm } from '@/stores';
	const userStore =  {
		useFormInfo: uni.getStorageSync('useFormInfo') || []
	}
	const { isDemoH5Page } = useDemoH5Page()
	// 接收传值
	const DiyTableId = ref<string>() // 表id
	const title = ref<string>() // 标题
	const GetDiyFieldList = ref<any>([]) // 表单列表
	const formRules = ref<any>({}) // 表单必填项
	const dynamicForm = ref()
	const tableName = ref<string>()
	const tableRowId = ref<string>()
	const isDisabled = ref<boolean>(false)
	const isShow = ref<boolean>(false)
	const GetDiyTableList = ref<any>({})
	const isAddBtnType = ref<string>()
	const FormLabelPosition = ref<string>('top') // 表单对齐方式
	onLoad((options : any) => {
		DiyTableId.value = options.DiyTableId
		title.value = options.Description
		tableRowId.value = options.TableRowId
	});
	onShow(() => {
		getData()
	})
	onHide(() => {
		console.log('onHide')
	})
	// 获取表单字段
	const getData = async () => {
		try {
			uni.showLoading({
				title: "加载中",
				mask: true
			});
			const obj: any = {
				TableId: DiyTableId.value
			}
			GetDiyFieldList.value = await GetDiyFormField(obj) // 获取表单列表
			formRules.value = handleRules(GetDiyFieldList.value) // 获取表单必填项
			if (!tableRowId.value) {
				const NewGuidRes : any = await microiRequest.GetNewGuid('')
				tableRowId.value = NewGuidRes.Data
				isShow.value = true
			} else { // 编辑时-获取详情
				const objTableRow: any = {
					TableId: DiyTableId.value,
					_TableRowId: tableRowId.value
				}
				const resTableRow = await microiRequest.GetDiyTableRowModel(objTableRow);
				if (resTableRow.Code == 1) {
					isShow.value = true
					GetDiyTableList.value = GetListObj(resTableRow.Data, GetDiyFieldList.value,tableRowId.value)
				}
			}
			const res: any = await microiRequest.GetDiyTableModel({ Id: DiyTableId.value })
			if (res.Code == 1) {
				tableName.value = res.Data.Name
				FormLabelPosition.value = res.Data.FormLabelPosition || 'top' // 表单对齐方式
			}
			uni.hideLoading();
		} catch (error) {
			console.error('获取表单列表', error);
		}
	}
	// 获取新增子表格式类型
	const AddBtnType = (e: string) => {
		isAddBtnType.value = e
	}
	// 提交子表数据
	const handelAddChildForm = async () => {
		if (isAddBtnType.value == 'InTable') {
			const res = await microiRequest.AddFormDataBatch(userStore.useFormInfo)
			console.log(res,'子表提交')
			// userStore.setUseFormInfo('null')
			uni.setStorageSync('useFormInfo', [])
		}
	}
	// 提交数据
	const handelAddForm = () => {
		dynamicForm.value.formRef.validate(async (valid : any) => {
			if (valid) {
				isDisabled.value = true
				console.log(dynamicForm.value.formData)
				const data = dynamicForm.value.formData
				for (var key in data) {
					if (Array.isArray(data[key])) {
						data[key] = JSON.stringify(data[key])
					}
				}
				try {
					const obj : any = {
						FormEngineKey: tableName.value,
						Id: tableRowId.value,
						_FormData: { ...data }
					}
					let res: any = {}
					if (!data.Id) {
						res = await microiRequest.AddFormData(obj)
					} else {
						res = await microiRequest.UptFormData(obj)
					}
					handelAddChildForm()
					if (res.Code == 1) {
						isDisabled.value = false
						uni.showToast({
							title: '提交成功',
							icon: 'none',
						})
						uni.navigateBack({
							delta: 1
						});
					} else {
						isDisabled.value = false
						uni.showToast({
							title: res.Msg,
							icon: 'none',
						})
					}
				} catch (error) {
					console.error('获取表单列表出现异常', error);
				}
			} else {
				uni.showToast({
					title: '表单校验失败',
					icon: 'none',
				})
			}
		})
	}
</script>

<style lang="scss" scoped>
	.work-page {
		position: relative;
		height: 90vh;

		.sub-btn {
			position: fixed;
			bottom: 0rpx;
			left: 20rpx;
			right: 20rpx;
			background-color: white;
			padding-bottom: 20rpx;
			z-index: 999
		}
	}
</style>