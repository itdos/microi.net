<template>
	<view class="container">
		<view class="work-list">
			<block v-for="item in NewformFields" :key="item.Id">
				<block v-if="item.Visible || item.Name == 'Daka'">
					<!-- 按钮 -->
					<block v-if="item.Name == 'Daka'">
						<view class="daka">
							<button class="anniu" :loading="item.Config.Button.Loading" @click="handleButton(item)">
								打 卡
								<view class="date">{{time}}</view>
							</button>
						</view>
					</block>
					<!-- 单选框 -->

					<!-- 图片上传 -->
					<view class="xuanxiang" style="padding:10rpx 2%;" v-else-if="item.Component == 'ImgUpload'">
						<uni-forms-item :label="item.Label" :required="item.NotEmpty == 1 ? true : false"
							:name="item.Name" :labelWidth="100">
							<uni-file-picker v-model="formData[item.Name]" file-mediatype="image"
								:limit="item.Config.ImgUpload.Multiple ? item.Config.ImgUpload.MaxCount : 1"
								:disabled="item.Readonly == 1 ? true : false" :sourceType="camera"
								@select="upFileSelect($event, item)" style="margin:0 0 0 280rpx;">
								<uni-icons type="camera" size="40" color="#ccc"></uni-icons>
							</uni-file-picker>
						</uni-forms-item>
					</view>

					<view class="jieguo" v-else-if="item.Name == 'DakaZT'">
						打卡状态：{{formData[item.Name] || '位置获取中...'}}
						<view class="uni-common-mt-xs">*若位置不正确，可重新点击“打卡”按钮重新获取位置</view>
					</view>
					<div class="xuanxiang" v-else-if="item.Component != 'Button'">
						<uni-forms-item v-if="item.Component == 'Radio'" :label="item.Label"
							:required="item.NotEmpty == 1 ? true : false" :name="item.Name" :labelWidth="100">
							<uni-data-checkbox v-model="formData[item.Name]" :localdata="item.Data"
								style="margin-top: 12rpx;float: right;" :disabled="item.Readonly == 1 ? true : false"
								@change="handleRadio($event, item)" />
						</uni-forms-item>
						<!-- 下拉单选/下拉多选/省市区选择 -->
						<uni-forms-item v-else-if="item.Component?.includes('Select') || item.Component == 'Address'"
							:label="item.Label" :required="item.NotEmpty == 1 ? true : false" :name="item.Name"
							:labelWidth="100">
							<template v-if="!formData[item.Name]">
								<view class="demo-uni-row" :width="730" :class="{ 'grey-bg': item.Readonly }"
									@click="!item.Readonly ? handleSelect(item) : ''">
									<view class="demo-uni-col" style="color: #999;">{{ item.Placeholder }}</view>
									<uni-icons type="right" size="20px" color="#999" />
								</view>
							</template>
							<template v-else>
								<view class="demo-uni-row" :width="730" :class="{ 'grey-bg': item.Readonly }">
									<view class="uni-flex-item" @click="!item.Readonly ? handleSelect(item) : ''">
										<view class="demo-uni-col" v-if="Array.isArray(formData[item.Name])">
											<text
												v-if="item.Component == 'Address'">{{ formData[item.Name].join('/') }}</text>
											<text v-else>{{ formData[item.Name].join(',') }}</text>
										</view>
										<view class="demo-uni-col" v-else-if="typeof (formData[item.Name]) == 'object'">
											{{
			  formData[item.Name].text }}
										</view>
										<view class="demo-uni-col" v-else>{{ formData[item.Name] }}</view>
									</view>
									<uni-icons type="clear" size="20px" color="#999" @click="handleClearSelect(item)" />
								</view>
							</template>
						</uni-forms-item>
						<!-- 多行文本 -->
						<uni-forms-item v-else-if="item.Component == 'Textarea'" :label="item.Label"
              :required="item.NotEmpty == 1 ? true : false" :name="item.Name" >
              <uni-easyinput type="textarea" autoHeight v-model="formData[item.Name]" :placeholder="item.Placeholder"
                :disabled="item.Readonly == 1 ? true : false" />
            </uni-forms-item>
						<uni-forms-item v-else :label="item.Label" :required="item.NotEmpty == 1 ? true : false"
							:name="item.Name" :labelWidth="100">
							<!-- <uni-easyinput v-model="formData[item.Name]" :placeholder="item.Placeholder"
						:disabled="item.Readonly == 1 ? true : false" @input="onInput($event, item)"  />
						 -->
							<view style="padding:15rpx 0;">{{formData[item.Name]}}</view>
						</uni-forms-item>

					</div>

				</block>
			</block>
			<!-- 下拉选择 -->
			<uni-popup ref="popupSelect" type="bottom" border-radius="10px 10px 0 0">
				<select-control :currentModel="currentModel" :currentFieldsConfig="currentFieldsConfig"
					:isMultiSelect="isMultiSelect" :list="selectList[selectName]" @onSelectChange="onSelectChange"
					:key="new Date().getTime()" />
			</uni-popup>
		</view>
	</view>
</template>

<script setup>
	import {
		onLoad,
		onShow
	} from '@dcloudio/uni-app';
	import {
		ref,
		reactive,
		inject,
		nextTick,
		onMounted
	} from 'vue'
	import {
		diyFormField,
		remoteSearchSelect,
		DiyTableModule,
		getApiUrl,
		handleRules,
		handleFormSubmit,
		handleFormDetail,
		RunV8Code,
		getLocation,
		uploadFile
	} from '@/utils'
	import formControl from '@/FormComponents/formControl.vue'
	import SelectControl from '@/FormComponents/selectControl.vue'
	const props = defineProps({
		// 传入的当前自定义字段配置
		currentFieldsConfig: {
			type: Object,
			default: () => {}
		},
		// 传入的父表单数据
		ParentFormData: {
			type: Object,
			default: () => {}
		},
		// 传入的自定义表单
		OpenAnyFormData: {
			type: Object,
			default: {}
		},
		// 新增或编辑
		isType: {
			type: String,
			default: ''
		},
		ChildFormId: {
			type: String,
			default: ''
		},
		ChildDiyTableId: {
			type: String,
			default: ''
		},
	})
	// 弹窗显示


	const popupSelect = ref(null)
	const selectList = reactive({}) // 下拉框列表
	const selectName = ref('') // 下拉框名称
	let isMultiSelect = false // 是否多选
	const nvueWidth = ref(730)
	// 当前字段配置
	const Microi = inject('Microi'); // 使用注入Microi实例
	const V8 = inject('V8') // 表单提交执行v8code
	const DiyTableId = ref('') // 自定义表单ID
	const diyFormFields = ref([]) // 自定义表单字段
	const DiyTableData = ref({}) // 自定义表单数据
	const formChild = ref(null) // 表单子组件实例
	const formRules = ref({}) // 表单验证规则
	const formData = ref({}) //表单
	const isShow = ref(false) // 是否显示自定义表单
	const formDetail = ref({}) // 表单详情数据
	const type = ref('Add') // 新增或编辑
	const ParentV8 = ref(null) // 加载状态ParentV8
	let currentFieldsConfig = reactive({})
	let currentModel = reactive({}) // 当前字段配置
	let camera = ref(['camera']) //只调用相机
	// 表单详情id
	const formId = ref('')
	let OpenAnyFormData = props.OpenAnyFormData || {}
	const emits = defineEmits(['ChildSubmitOk']) // 自定义表单提交事件
	const NewformFields = ref([])
	// 关键字搜索
	var hh = new Date().getHours();
	var mm = new Date().getMinutes();
	var ss = new Date().getSeconds();
	const time = (hh > 9 ? hh : '0' + hh) + ':' +
		(mm > 9 ? mm : '0' + mm) + ':' +
		(ss > 9 ? ss : '0' + ss);


	let diyFormFieldKey = `diyFormField_${DiyTableId.value}_${OpenAnyFormData?.TableName}_${OpenAnyFormData?.SelectFields}`


	// 获取自定义表单字段
	const getDiyFormFields = async () => {
		Microi.ShowLoading('加载中···')

		let formFields = await diyFormField({
			TableId: DiyTableId.value,
			TableName: OpenAnyFormData?.TableName,
			_SelectFields: OpenAnyFormData?.SelectFields
		})
		diyFormFields.value = formFields
		DiyTableData.value = await DiyTableModule({
			Id: DiyTableId.value,
			_SearchEqual: {
				Name: OpenAnyFormData?.TableName
			}
		}) // 获取自定义表单
		formRules.value = await handleRules(formFields) // 处理表单验证规则
		initForm()
		if (type.value === 'Add') {
			const NewGuidRes = await Microi.Post(getApiUrl('GetNewGuid'), {})
			formDetail.value.Id = NewGuidRes.Data // 获取表ID
			// 查看是否有默认值
			formFields.map(item => {
				if (item.DefaultValue) { // 表单默认值
					formDetail.value[item.Name] = item.DefaultValue
				} else if (props.currentFieldsConfig) { // 自定义字段默认值-关联子表
					const childField = props.currentFieldsConfig.TableChild.PrimaryTableFieldName // 子表主键字段
					const TableChildFkFieldName = props.currentFieldsConfig.TableChildFkFieldName // 父表外键字段
					formDetail.value[TableChildFkFieldName] = childField ? props.ParentFormData[
						childField] : props.ParentFormData.Id // 父表外键字段赋值
				} else { // 自定义字段默认值
					formDetail.value[item.Name] = ''
				}
			})
		} else { // 编辑
			await getDetail()
		}
		setTimeout(() => {
			isShow.value = true
		}, 100)
		Microi.HideLoading()
	}
	// 获取数据详情
	const getDetail = async () => {
		const res = await Microi.FormEngine.GetFormData({
			FormEngineKey: DiyTableData.value.Name,
			Id: formId.value
		})
		if (res.Code == 1) {
			formDetail.value = await handleFormDetail(res.Data, diyFormFields.value, 'Edit')
			console.log('获取数据详情', formDetail.value)
		}
	}
	// 提交表单
	const submit = async () => {
		console.log('success', formChild.value.formData);
		formChild.value.valiForm.validate().then(async (res) => {
			// new Promise(resolve => {
			//     RunV8Code(DiyTableData.value.SubmitFormV8,SubmitCallback) // 表单提交执行v8code
			//     console.log('表单提交执行v8code', V8.Result)
			//     resolve()
			// }).then(() => {
			//   uni.showToast({
			//     title: '提交成功',
			//     icon:'success',
			//     duration: 2000
			//   })
			await RunV8Code(DiyTableData.value.SubmitFormV8);
			nextTick(() => {
				if (OpenAnyFormData.EventReplace) {
					console.log('替换事件', OpenAnyFormData.EventReplace)
					OpenAnyFormData.EventReplace.Submit(V8, formChild.value.formData,
						SubmitCallback)
				} else {
					if (type.value === 'Add') {
						AddFormData(SubmitCallback)
					}
					if (type.value === 'Edit') {
						EditFormData(SubmitCallback)
					}
				}
			})
			// })
			await RunV8Code(DiyTableData.value.OutFormV8) // 表单提交执行v8code
			resolve()

		}).catch(err => {
			console.log('err', err);
		})

	}
	const SubmitCallback = (result) => {
		console.log('表单提交回调', result)
		if (result.Code == 1) {
			// 子表弹窗进来提交
			if (props.currentFieldsConfig || OpenAnyFormData.EventReplace) {
				emits('ChildSubmitOk')
			} else {
				setTimeout(() => {
					uni.navigateBack()
				}, 100)
			}
		}
	}
	// 新增提交
	const AddFormData = async (callback) => {
		Microi.ShowLoading('加载中···')
		const formData = handleFormSubmit(formChild.value.formData, diyFormFields.value)
		console.log('formData', formData);
		const obj = {
			FormEngineKey: DiyTableData.value.Name,
			Id: formDetail.value.Id,
			_RowModel: formData
		}
		const res = await Microi.FormEngine.AddFormData(obj)
		Microi.HideLoading()
		if (res.Code == 1) {
			uni.showToast({
				title: '新增成功',
				icon: 'success',
				duration: 2000
			})
		} else {
			uni.showToast({
				title: '新增失败',
				icon: 'none',
				duration: 2000
			})
		}
		callback(res)
	}
	// 编辑提交
	const EditFormData = async (callback) => {
		Microi.ShowLoading('加载中···')
		const formData = handleFormSubmit(formChild.value.formData, diyFormFields.value)
		console.log('formData', formData);
		// return
		const obj = {
			FormEngineKey: DiyTableData.value.Name,
			Id: formDetail.value.Id,
			_RowModel: formData
		}
		const res = await Microi.FormEngine.UptFormData(obj)
		Microi.HideLoading()
		if (res.Code == 1) {
			uni.showToast({
				title: '编辑成功',
				icon: 'success',
				duration: 2000
			})

		} else {
			uni.showToast({
				title: '编辑失败',
				icon: 'none',
				duration: 2000
			})
		}
		callback(res)
	}
	// V8刷新表单数据
	const ReloadForm = () => {
		getDetail()
		console.log('刷新表单数据', formDetail.value)
		nextTick(() => {
			formChild.value.formData = reactive(formDetail.value)
		})
	}
	// 下拉框点击
	const handleSelect = (item) => {
		currentFieldsConfig = item.Config
		currentModel = item
		selectName.value = item.Name
		console.log('Data', currentFieldsConfig, item.Data, formData.value)
		selectList[item.Name] = item.Data?.map((i) => {
			i.selected = false
			i.text = i.text || i[currentFieldsConfig.SelectLabel]
			i.value = currentFieldsConfig.SelectSaveField ? i[currentFieldsConfig.SelectSaveField] : (i.Id || i
				.value || i.text)
			return i
		})

		if (item.Component == 'Address') {
			mpvueCityPicker.value.show();
			// mpvueCityPicker.value = true
		} else {
			if (item.Component == 'MultipleSelect') { // 多选
				isMultiSelect = true
			} else {
				isMultiSelect = false
			}
			popupSelect.value.open()
		}
	}
	// 下拉框清空
	const handleClearSelect = (item) => {
		if (selectList[item.Name]) {
			selectList[item.Name] = currentModel.Data.map((i) => {
				i.selected = false
				return i
			})
		}
		V8.FormSet(item.Name, '')
	}

	// 确认下拉框
	const onSelectChange = (e) => {
		if (e == 'close') {
			popupSelect.value.close()
		} else {
			// 如果是普通数据
			if (currentModel.Config.DataSource == 'Data') {
				V8.FormSet(selectName.value, e.text)
			} else {
				V8.FormSet(selectName.value, e)
			}
			popupSelect.value.close()
			RunV8Code(currentModel.Config.V8Code)
		}
	}
	// 单选点击
	const handleRadio = (e, item) => {
		RunV8Code(item.Config.V8Code)
	}
	// 按钮点击
	const handleButton =  (item) => {
		console.log('按钮点击', item)
		// 给V8注入getLocation方法 如果需要打卡定位功能
		V8.getLocation = getLocation
		V8.AppRoutePush = AppRoutePush
		 RunV8Code(item.Config.V8Code)
	}
	const AppRoutePush = (url) => {
		uni.redirectTo({
			url: url
		});
	}
	// 上传图片
	const upFileSelect = async (e, item) => {
		const res = await uploadFile(e.tempFilePaths, item)
		if (res.Code == 1) {
			// 如果有值，就追加，没有就赋值
			if (formData.value[item.Name]) {
				formData.value[item.Name] = [...formData.value[item.Name], ...res.Data]
			} else {
				formData.value[item.Name] = res.Data
			}
		}
	}
	//  删除图片
	const upFileDelete = (e, item) => {
		const index = formData.value[item.Name].findIndex(item => item.Url == e.url)
		if (index > -1) {
			formData.value[item.Name].splice(index, 1)
		}
	}
	/**
	 * 设置字段值的函数
	 * @param {string} fieldName - 字段名称
	 * @param {string} value - 值的键名，支持点号格式（如：Config.Button.Loading）
	 * @param {any} field - 要设置的值
	 */
	const FieldSet = (fieldName, value, field) => {
		console.log('FieldSet', fieldName, value, field)
		// 处理点号格式的情况（如：Config.Button.Loading）
		if (value.includes('.')) {
			// 将点号分隔的字符串拆分成数组
			const keys = value.split('.');
			// 取出最后一个键名
			const lastKey = keys.pop();
			// 初始化对象结构
			let obj = {};
			let current = obj;
			
			// 构建嵌套对象结构
			keys.forEach((key, index) => {
				current[key] = {};
				current = current[key];
			});
			// 设置最终值
			current[lastKey] = field;
			
			// 更新 V8.Field，保留原有数据
			if (V8.Field.hasOwnProperty(fieldName)) {
				// 如果字段已存在，递归合并对象
				const mergeObjects = (target, source) => {
					for (let key in source) {
						if (source[key] instanceof Object && !Array.isArray(source[key])) {
							target[key] = target[key] || {};
							mergeObjects(target[key], source[key]);
						} else {
							target[key] = source[key];
						}
					}
				};
				
				const updatedField = { ...V8.Field[fieldName] };
				mergeObjects(updatedField, obj);
				V8.Field[fieldName] = updatedField;
			} else {
				// 如果字段不存在，创建新字段
				V8.Field[fieldName] = {
					Name: fieldName,  // 添加 Name 字段
					...obj
				}
			}
		} else {
			// 处理普通格式的情况
			if (V8.Field.hasOwnProperty(fieldName)) {
				V8.Field[fieldName][value] = field;
			} else {
				V8.Field[fieldName] = {
					Name: fieldName,  // 添加 Name 字段
					[value]: field
				}
			}
		}
		
		// 特殊处理 Data 类型的值
		if (value === 'Data') {
			const currentFieldsConfig = V8.Field[fieldName].Config;
			field = field?.map((i) => {
				i.selected = false;
				i.text = i.text || i[currentFieldsConfig?.SelectLabel];
				i.value = i.value || i[currentFieldsConfig?.SelectSaveField];
				return i;
			});
		}
		
		// 更新 NewformFields
		const existingFieldIndex = NewformFields.value.findIndex(i => i.Name === fieldName);
		if (existingFieldIndex !== -1) {
			// 字段已存在的情况
			const existingField = { ...NewformFields.value[existingFieldIndex] };
			if (value.includes('.')) {
				// 处理点号格式
				const keys = value.split('.');
				let current = existingField;
				
				// 递归创建或更新嵌套对象
				keys.forEach((key, index) => {
					if (index === keys.length - 1) {
						current[key] = field;
					} else {
						current[key] = current[key] || {};
						current = current[key];
					}
				});
			} else {
				// 普通格式直接设置值
				existingField[value] = field;
			}
			// 更新数组中的对象
			NewformFields.value.splice(existingFieldIndex, 1, existingField);
		} else {
			// 字段不存在的情况
			const newField = { Name: fieldName };
			if (value.includes('.')) {
				// 处理点号格式
				const keys = value.split('.');
				let current = newField;
				
				// 构建嵌套对象
				keys.forEach((key, index) => {
					if (index === keys.length - 1) {
						current[key] = field;
					} else {
						current[key] = {};
						current = current[key];
					}
				});
			} else {
				// 普通格式
				newField[value] = field;
			}
			
			// 添加新字段
			NewformFields.value = [...NewformFields.value, newField];
		}
	}
	const FormSet = (fieldName, value, field) => {
		formData.value[fieldName] = value
	}
	onLoad((options) => {
		if (props.currentFieldsConfig) {
			DiyTableId.value = props.currentFieldsConfig.TableChildTableId || props.ChildDiyTableId
			type.value = props.isType || 'Add'
			formId.value = props.ChildFormId
		} else {
			DiyTableId.value = options.DiyTableId
			type.value = options.type || 'Add'
			formId.value = options.Id
		}
		getDiyFormFields()
		// V8.Init(formDetail.value, diyFormFields.value, type.value); // 初始化v8环境
		// RunV8Code(DiyTableData.value.InFormV8) // 表单初始化执行v8code
		if (type.value === 'Edit') {
			uni.setNavigationBarTitle({
				title: '编辑'
			})
		}
	})
	const initForm = () => {
		V8.FormSet = FormSet;
		V8.FieldSet = FieldSet
		V8.getLocation = getLocation
		V8.Init(formData.value, diyFormFields.value, type.value)
		RunV8Code(DiyTableData.value.InFormV8) // 表单初始化执行v8code
		nextTick(() => {
			// 处理表单验证规则
			const data = []
			// 循环对象，获取字段配置
			for (let key in V8.Field) {
				data.push(V8.Field[key])
			}
			NewformFields.value = data

		})
	}
</script>

<style lang="scss" scoped>
	page {
		background-color: #f6f6f6;
	}

	.container {
		width: 100%;
	}

	.work-list {
		width: 710rpx;
		min-height: 520rpx;
		margin: 0 auto;
		position: relative;
		padding-top: 650rpx;
		padding-bottom: 20px;
	}

	.daka {
		top: 25rpx;
		left: 0;
		width: 100%;
		padding: 120rpx 0;
		position: absolute;
		border-radius: 20rpx;
		background-image: linear-gradient(to bottom, #4576ff, #99b5ff);
		box-shadow: 0 0 15rpx #ccc;

	}

	.anniu {
		width: 360rpx;
		height: 360rpx;
		line-height: 360rpx;
		border-radius: 360rpx;
		background-color: #fff;
		color: #000;
		text-align: center;
		font-size: 86rpx;
		margin: 0 auto;
		font-weight: bold;
		box-shadow: 0 0 12rpx #5080ff;
		color: #4576ff;
	}

	.anniu .date {
		font-size: 28rpx;
		color: #bbb;
		padding: 22rpx 0 0;
		font-weight: normal;
	}

	.jieguo {
		position: absolute;
		top: 510rpx;
		left: 0;
		width: 100%;
		text-align: center;
		color: #fff;
		font-size: 24rpx;
		z-index: 5;
	}

	.xuanxiang {
		padding: 1% 2%;
		background-color: #fff;
		border-radius: 10rpx;
		margin: 0 0 3%;
	}

	.sub-btn {
		position: fixed;
		bottom: 0rpx;
		left: 0;
		right: 0;
		background-color: white;
		padding: 20rpx;
		z-index: 3
	}

	.popup-box {
		height: 100vh;
		display: flex;
		align-items: flex-end;
		width: 100%;
	}

	.popup-content {
		width: 100%;
		background: #fff;
		height: 75vh;
		border-radius: 10px 10px 0 0;
		padding: 20px;
		box-sizing: border-box;
	}

	.popup-content-child {
		padding: 0;

		.popup-close {
			right: 10px;
			top: 10px;
		}
	}

	.popup-search {
		margin-bottom: 20rpx;
	}

	.popup-list {
		overflow-y: scroll;
		height: 70%;
		margin-bottom: 50px;
	}

	.popup-close {
		position: relative;
		right: -10px;
		top: -10px;
		text-align: right;
	}

	.popup-btn {
		position: absolute;
		bottom: 20rpx;
		left: 20rpx;
		right: 20rpx;
	}

	.demo-uni-row {
		padding: 10px;
		border-radius: 5px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.footer {
		width: 100%;
		bottom: 0;
		background-color: #fff;
		position: fixed;
		z-index: 1;
		border-top-left-radius: 100rpx;
		border-top-right-radius: 100rpx;
		box-shadow: #ddd 0 0 8rpx;
	}

	.uni-forms-item {
		margin-bottom: 0;
		padding-bottom: 0;
	}
</style>