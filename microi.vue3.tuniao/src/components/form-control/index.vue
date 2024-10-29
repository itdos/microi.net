<template>
	<view class="flowsheet-page">
		<TnForm ref="formRef" :model="formData" :rules="formRules" :label-position="FormLabelPosition">
			<block class="flowsheet-item tn-pb-lg" v-for="(item, index) in NewGetDiyFieldList" :key="index">
				<block v-if="item.Visible">
				<!-- 分割线 -->
				<view v-if="item.Component == 'Divider'" class="flowsheet-separator tn-mb tn-type-primary_text">{{ item.Label }}</view>
				<TnFormItem v-else :label="item.Label" :prop="item.Name" :label-width="item.TableWidth">
					<!-- 输入框 数字-->
					<TnInput v-if="item.Component == 'NumberText'" v-model="formData[item.Name]" type="number"
						:placeholder="item.Placeholder" clearable :disabled="item.Readonly == 1 ? true : false" />
					<!-- 自动编号 -->
					<TnInput v-else-if="item.Component == 'AutoNumber'" v-model="formData[item.Name]"
						:placeholder="item.Placeholder" clearable :disabled="true" />
					<!-- 多行文本 -->
					<TnInput v-else-if="item.Component == 'Textarea'" type="textarea" v-model="formData[item.Name]"
						:placeholder="item.Placeholder" clearable :disabled="item.Readonly == 1 ? true : false" />
					<!-- 下拉框/日期/地区/联级/组织机构 -->
					<view :class="{'tn-gray-light_bg' : item.Readonly}"
						v-else-if="item.Component.includes('Select') || item.Component == 'DateTime' || item.Component == 'Address' || item.Component == 'Cascader' || item.Component == 'Department'">
						<TnInput type="select" v-model="formData[item.Name]" :disabled="item.Readonly == 1 ? true : false"
							:placeholder="item.Placeholder" right-icon="down-triangle" clearable @click="handleInput(item)" />
					</view>
					<!-- 单选框 -->
					<TnRadioGroup v-else-if="item.Component == 'Radio'" v-model="formData[item.Name]">
						<TnRadio v-for="(val, ind) in item.Data" :key="ind" :label="val.Name">{{val.Name}}</TnRadio>
					</TnRadioGroup>
					<!-- 复选框 -->
					<TnCheckboxGroup v-else-if="item.Component == 'Checkbox'" v-model="formData[item.Name]">
						<TnCheckbox v-for="(val, ind) in item.Data" :key="ind" :label="val.Name">{{val.Name}}</TnCheckbox>
					</TnCheckboxGroup>
					<!-- 开关 -->
					<TnSwitch v-else-if="item.Component == 'Switch'" v-model="formData[item.Name]"
					:inactive-value="0"
          :active-value="1" />
					<!-- 评分 -->
					<TnRate v-else-if="item.Component == 'Rate'" v-model="formData[item.Name]" />
					<!-- 上传图片 -->
					<TnImageUpload v-else-if="item.Component == 'ImgUpload'" v-model="formData[item.Name]"
						:custom-upload-handler="customUploadHandle" :limit="1" />
					<!-- 上传文件 -->
					<view class="example-body" v-else-if="item.Component == 'FileUpload'">
						<uni-file-picker limit="5" file-mediatype="all" v-model="formData[item.Name]"
							@select="upFileSelect($event,item)">
							<TnButton width="100%" height="80" bg-color="#e1e1e1">选择文件</TnButton>
						</uni-file-picker>
					</view>
					<!-- 子表格 -->
					<view class="" v-else-if="item.Component == 'TableChild'">
						<view class="tn-mb-sm">
							<TableControl :ChildList="item.ChildList" :TableChildTableData="item.Config" type="edit" 
							:ChildListCount="item.ChildListCount" :TableRowId="tableRowId" :formData="formData" @handlEdit="handlEdit($event,item)" @AddBtnType="AddBtnType" />
						</view>
						<TnButton width="100%" height="80" bg-color="#e1e1e1" @click="handleInput(item)">新增</TnButton>
					</view>
					<!-- 分割线 -->
					<view class="form-Divider" v-else-if="item.Component == 'Divider'">
					</view>
					<!-- 按钮 -->
					<view class="" v-else-if="item.Component == 'Button'">
						<TnButton @click="ButtonComponentClick(item)">{{item.Label}}</TnButton>
					</view>
					<!-- 单行/多行 文本 -->
					<TnInput v-else v-model="formData[item.Name]" :placeholder="item.Placeholder"
						:disabled="item.Readonly == 1 ? true : false" clearable />
				</TnFormItem>
			</block>
			</block>
		</TnForm>
		<!-- 日期 -->
		<TnDateTimePicker v-model:open="show.picker" mode="date" @confirm="confirmPicker" />
		<!-- 下拉单选 -->
		<TnPicker label-key="Name" value-key="Id" v-model:open="show.select" :data="selectList.selectData"
			@confirm="confirmValue" />
		<!-- 下拉多选 -->
		<TnPopup v-model="show.MultiSelect" open-direction="bottom" height="50%">
			<view class="popup-content tn-m-lg">
				<view class="item">
					<text>请选择</text>
				</view>
				<scroll-view class="popup-list tn-pb-lg" scroll-y>
					<view class="tn-mt-lg" v-for="(item,index) in selectList.multipleSelectData" :key="index"
						@click="handleMultipleSelect(index)">
						<text>{{item.Name}}</text>
						<TnIcon v-if="item.selected" name="check" color="#2979ff" size="32" />
					</view>
				</scroll-view>
			</view>
		</TnPopup>
		<!-- 地区选择 -->
		<TnRegionPicker v-model:open="show.Address" @confirm="confirmAddress" />
		<!-- 子表 -->
		<TnPopup v-model="show.TableChild" open-direction="bottom" :close-btn="true" :overlay-closeable="false">
			<ChildForm v-if="show.TableChild" :TableId="TableId" :tableChildRowId="tableChildRowId" :TableChildTableId="TableChildTableId" :TableChildTableData="TableChildTableData"
				:isAddBtnType="isAddBtnType" :titleChildForm="titleChildForm"	@ChildSubmitOk="ChildSubmitOk" />
		</TnPopup>
		<!-- 组织机构 -->
		<TnPicker label-key="Name" value-key="Id" children-key="_Child" v-model:open="show.Department" :data="selectList.DepartmentData"
			@confirm="confirmDepartmentValue" />
	</view>
</template>

<script lang="ts" setup>
	import TnForm from '@tuniao/tnui-vue3-uniapp/components/form/src/form.vue'
	import TnFormItem from '@tuniao/tnui-vue3-uniapp/components/form/src/form-item.vue'
	import TnInput from '@tuniao/tnui-vue3-uniapp/components/input/src/input.vue'
	import TnRadio from '@tuniao/tnui-vue3-uniapp/components/radio/src/radio.vue'
	import TnRadioGroup from '@tuniao/tnui-vue3-uniapp/components/radio/src/radio-group.vue'
	import TnDateTimePicker from '@tuniao/tnui-vue3-uniapp/components/date-time-picker/src/date-time-picker.vue'
	import TnPicker from '@tuniao/tnui-vue3-uniapp/components/picker/src/picker.vue'
	import TnCheckbox from '@tuniao/tnui-vue3-uniapp/components/checkbox/src/checkbox.vue'
	import TnCheckboxGroup from '@tuniao/tnui-vue3-uniapp/components/checkbox/src/checkbox-group.vue'
	import TnSwitch from '@tuniao/tnui-vue3-uniapp/components/switch/src/switch.vue'
	import TnRate from '@tuniao/tnui-vue3-uniapp/components/rate/src/rate.vue'
	import TnRegionPicker from '@tuniao/tnui-vue3-uniapp/components/region-picker/src/region-picker.vue'
	import TnImageUpload from '@tuniao/tnui-vue3-uniapp/components/image-upload/src/image-upload.vue'
	import TnButton from '@tuniao/tnui-vue3-uniapp/components/button/src/button.vue'
	import TnPopup from '@tuniao/tnui-vue3-uniapp/components/popup/src/popup.vue'
	import type { ImageUploadCustomFunction, ImageUploadFile } from '@tuniao/tnui-vue3-uniapp'
	import { definePropType } from '@tuniao/tnui-vue3-uniapp/utils'
	import { ref, reactive, watch } from 'vue'
	import type { TnFormInstance } from '@tuniao/tnui-vue3-uniapp'
	import { GetServerPath } from '@/utils'
	import ChildForm from './child-form.vue'
	import TableControl from '@/components/table-control/index.vue'
	import { UploadFile, GetTableData, GoDelete } from '@/utils'
	import { Microi, V8 } from "@/config/microi.uniapp.js"
	import { Base64 } from 'js-base64';
	import permision from "@/common/permission.js"
	import { onMounted} from 'vue'
	const emits = defineEmits(['AddBtnType'])
	const props = defineProps({
		TableId: {
			type: String
		},
		GetDiyFieldList: {
			type: definePropType<any[]>(Array),
			default: () => [],
		}, // 表单字段
		formRules: {
			type: Object,
			default: () => {}
		}, // 表单校验
		tableRowId: {
			type: String,
			default: () => ''
		}, // 表id
		// 详情数据
		GetDiyTableList: {
			type: definePropType<any>(Object),
			default: () => {},
		},
		// 表单对齐方式
		FormLabelPosition: {
			type: String,
			default: 'top'
		},
	})
	const NewGetDiyFieldList = ref(props.GetDiyFieldList);
	const formRef = ref<TnFormInstance>()
	const formData = ref<any>({}) // 表单
	const tableChildRowId = ref<string>() // 子表编辑时获取详情id
	const TableChildTableId = ref<string>() // 子表编辑时获取字段id
	const isAddBtnType = ref<string>()
	// 弹窗显示
	const show = reactive({
		picker: false,
		select: false,
		Address: false,
		TableChild: false,
		MultiSelect: false,
		Department: false
	})
	const currSelectName = ref() // 点击当前的下拉name
	// 下拉框列表
	const selectList : any = reactive({
		selectData: [], // 下拉单选
		multipleSelectData: [] ,// 下拉多选
		DepartmentData: [] // 组织机构
	})
	const TableChildTableData = ref<any>() // 子表Data
	const titleChildForm = ref<string>('新增')
	// 监听传递的数据变化
	watch(
		() => props.GetDiyFieldList,
		(newVal) => {
			NewGetDiyFieldList.value = newVal;
		}
	);
	if (props.GetDiyTableList) {
		formData.value = props.GetDiyTableList
	}
	// 点击显示下拉选择
	const handleInput = (model : { Component : string; Data : any; Name : string; Config : string; Readonly : Number }) => {
		if (model.Readonly == 1) return // 是否可以编辑
		if (model.Component == "DateTime") { // 时间日期
			show.picker = true;
		} else if (model.Component == "Address") { // 地区
			show.Address = true;
		} else if (model.Component == "TableChild") { // 子表
			TableChildTableData.value = model.Config
			tableChildRowId.value = ''
			titleChildForm.value = '新增'
			show.TableChild = true;
		} else if (model.Component == "MultipleSelect") { // 下拉多选
			show.MultiSelect = true;
			// 编辑时给下拉数据赋值
			if (formData.value[model.Name]) {
				for (let i = 0; i < formData.value[model.Name].length; i++) {
				  const arrayValue = formData.value[model.Name][i];
				  // 在 jsonArray 中查找匹配的对象
				  const matchedObj = model.Data.find((obj: {Name: string}) => obj.Name === arrayValue);
				  if (matchedObj) {
				    // 找到匹配的对象时，修改对应的值
				    matchedObj.selected = true;
				  }
				}
			}
			selectList.multipleSelectData = model.Data
		} else if (model.Component == "Department") { // 组织机构
			show.Department = true;
			selectList.DepartmentData = model.Data
		} else { // 其他下拉选择
			show.select = true;
			selectList.selectData = model.Data
		}
		console.log(model.Data, 'model.Data', model.Component)
		currSelectName.value = model.Name
	}
	// 选择下拉值
	const confirmValue = (value : string | number | Array<string | number>, item : any) => {
		formData.value[currSelectName.value] = item.Name
	}
	// 选择日期
	const confirmPicker = (value : string) => {
		formData.value[currSelectName.value] = value
	}
	// 选择地区
	const confirmAddress = (value : string[], item : any) => {
		const address = item.map((i : { name : string }) => i.name)
		formData.value[currSelectName.value] = address
	}
	// 选择下拉多选
	const handleMultipleSelect = (index : string | number) => {
		selectList.multipleSelectData[index].selected = !selectList.multipleSelectData[index].selected
		const arr = selectList.multipleSelectData.filter((i : { selected : boolean }) => i.selected)
		formData.value[currSelectName.value] = arr.map((i : { Name : string }) => i.Name)
	}
	// 选择组织机构
	const confirmDepartmentValue = (value : string | number | Array<string | number>, item : any) => {
		const arr = item.map((i : { Name : string }) => i.Name)
		formData.value[currSelectName.value] = arr.join('-')
	}
	// 上传图片
	const customUploadHandle : ImageUploadCustomFunction = (
		file : ImageUploadFile
	) => {
		return new Promise((resolve, reject) => {
			const url = (file as UniApp.ChooseImageSuccessCallbackResultFile).path
			const formData = {
				// 其他表单字段
				'Path': '/img',
				'Limit': false,
				'Preview': false
			}
			UploadFile(url, formData).then((res : any) => {
				resolve(GetServerPath(res.Path))
			}).catch(err => {
				reject(err)
			})
		})
	}
	// 上传文件
	const upFileSelect = async (e : any, item : { Data : any; Name : string }) => {
		const url = e.tempFiles.file
		const formFileData = {
			// 其他表单字段
			'Path': '/file',
			'Limit': false,
			'Preview': false
		}
		const res : any = await UploadFile(url, formFileData)
		const obj = {
			CreateTime: res.CreateTime,
			Id: res.Id,
			Name: res.Name,
			Path: GetServerPath(res.Path),
			url: GetServerPath(res.Path),
			name: res.Name,
			extname: res.Path.split('.')[1],
		}
		item.Data.push(obj)
		formData.value[item.Name] = item.Data
	}
	// 子表提交啦
	const ChildSubmitOk = async () => {
		show.TableChild = false
		getChildTableData()
	}
	// 子表点击编辑操作啦
	const handlEdit = async (e:{item:{TableId:string;Value:string},id:string,type: number},row:{Config:string; Name:string;}) => {
    TableChildTableId.value = e.item.TableId
    tableChildRowId.value = e.id
		TableChildTableData.value = row.Config
		currSelectName.value = row.Name // 点击当前编辑name
		// e.type 1 编辑 2 删除 3 详情
		if (e.type == 1) {
			titleChildForm.value = '编辑'
			show.TableChild = true;
		} else if (e.type == 2) {
			console.log(e,'删除')
			await GoDelete(e.item.TableId, e.id, e.item.Value)
			getChildTableData()
		}
	}
	// 获取当前操作的子表数据
	const getChildTableData = async () => {
		const index = NewGetDiyFieldList.value.findIndex(f => f.Name == currSelectName.value)
		const res:any = await GetTableData(TableChildTableData.value, props.tableRowId, 1, 10, formData.value)
		const arr:any = []
		const useFormInfo = uni.getStorageSync('useFormInfo')
		useFormInfo?.forEach((item : any) => {
			arr.push(item._RowModel)
		})
		NewGetDiyFieldList.value[index].ChildList = [...res.Data, ...arr]
		NewGetDiyFieldList.value[index].ChildListCount = res.DataCount
	}
	// 获取新增子表格式类型
	const AddBtnType = (e: string) => {
		isAddBtnType.value = e
		emits('AddBtnType', e)
	}
	// 子组件导出方法，才能在父组件拿到子组件的实例里使用
	defineExpose({ formRef, formData });
	//-----
	const FormSet = (fieldName : string, value : any, field : any) => {
		formData.value[fieldName] = value
	}
	// #ifdef APP
	const checkPermission = async () => {
		console.log('开始执行checkPermission函数')
		try{
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
		}catch(e){
			console.log('执行checkPermission函数出现异常：', e.message)
		}
		
	}
	// #endif
	const scan = async (callback : any) => {
		console.log('开始执行scan函数')
		// #ifdef APP
		let status = await checkPermission();
		if (status !== 1) {
		    return;
		}
		// #endif
		uni.scanCode({
			success: (res) => {
				console.log('uni.scanCode成功：', res.result);
				console.log('uni.scanCode callback', callback);
				if(callback){
					try{
						callback(res.result);
						console.log('执行uni.scanCode callback回调结束！');
					}catch(e){
						console.log('执行uni.scanCode callback回调失败：', e.message);
					}
				}
			},
			fail: (err) => {
				console.log('uni.scanCode失败：', err);
				callback(err);
				// 需要注意的是小程序扫码不需要申请相机权限
			}
		});
	}
	const ButtonComponentClick = (field : any) => {
		console.log('调用ButtonComponentClick函数');
		if(field && field.Config){
			var config = {};
			if(typeof(field.Config) == 'string'){
				config = JSON.parse(field.Config);
			}else if(typeof(field.Config) == 'object'){
				config = field.Config;
			}
			if(config.V8Code){
				var v8Code = '';
				try{
					v8Code = Base64.decode(config.V8Code);
				}catch(e){
					v8Code = config.V8Code;
				}
				//虽然通过V8.Init()传入了formData.value，但实际上microi.net.uniapp.js里面的FormSet并不能对formData做更新
				V8.FormSet = FormSet;
				//可以在此扩展更多的函数，比如说打开子表，但由于此页面是最底层页面，需要在外层页面扩展
				console.log('开始执行V8.Run(v8Code)');
				V8.Run(v8Code);
				console.log('执行完毕V8.Run(v8Code)');
			}
		}
	}
	onMounted(() => {
		// console.log('onMounted before V8:', JSON.stringify(V8));
		// console.log('onMounted before NewGetDiyFieldList:', JSON.stringify(NewGetDiyFieldList.value));
		// console.log('onMounted before formData:', JSON.stringify(formData.value));
		V8.Init(formData.value, NewGetDiyFieldList.value);
		// console.log('onMounted after V8 :',JSON.stringify(V8));
		V8.Method.ScanCode = scan;
		V8.FormSet = FormSet;
	})
</script>

<style lang="scss" scoped>
	.flowsheet-page {
		.form-Divider {
			background-color: #dcdfe6;
			position: relative;
			height: 2rpx;
			width: 100%;
		}

		.popup-content {
			height: 100%;

			.popup-list {
				overflow-y: scroll;
				height: 100%;
			}
		}
	}
</style>