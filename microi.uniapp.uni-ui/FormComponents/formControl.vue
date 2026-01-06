<template>
	<view class="w-full bg-white rounded-lg shadow-sm">
		<!-- 表单选项卡 - 优化滚动条和间距 -->
		<view class="w-full" v-if="formTabs[current] != '' && formTabs.length > 0">
			<scroll-view id="tab-bar" class="w-full py-2 overflow-x-auto whitespace-nowrap" :scroll-x="true"
				:show-scrollbar="false" :scroll-into-view="scrollIntoViewId">
				<view class="inline-flex space-x-1 px-1">
					<view v-for="(tab, index) in formTabs" :key="index"
						class="relative inline-block cursor-pointer transition-all duration-300 ease-in-out px-2 flex-shrink-0"
						:id="'tab-' + index" :data-current="index" v-if="!HideFormTabs.includes(tab)"
						@click="onClickItem(index)">
						<text class="text-sm py-1 whitespace-nowrap"
							:class="current == index ? 'text-blue-500 font-bold border-b-2 border-blue-500' : 'text-gray-600'">
							{{ typeof(tab) == 'string' ? tab : (tab.Name == 'none' ? '' : tab.Name) }}
						</text>
					</view>
				</view>
			</scroll-view>
		</view>

		<!-- 表单内容 -->
		<view class="p-2 " v-if="NewformFields.length > 0">
			<uni-forms ref="valiForm" :rules="NewformRules" :model="formData" class="w-full"
				:label-position="DiyTableData.FormLabelPosition == 'top' ? 'top' : 'left'"
				:label-width="DiyTableData.FormLabelPosition == 'top' ? '100%' : '180rpx'"
				:label-align="DiyTableData.FormLabelPosition == 'top' ? 'left' : 'right'">
				<block v-for="(item, index) in NewformFields" :key="index">
					<view v-if="(formTabs[current] == '' 
								|| item.Tab == formTabs[current] 
								|| item.Tab == formTabs[current].Id
								|| item.Tab == formTabs[current].Name
							)
								&& (item.AppVisible && item.Visible)" class="flex items-start mb-2 ">
						<view class="w-4 m-1">
							<uni-tooltip placement="right" v-if="item.Description">
								<template v-slot:content>
									<view class="rounded-md shadow-md text-xs w-40">
										{{ item.Description }}
									</view>
								</template>
								<uni-icons type="help-filled" size="22" class="text-gray-400" />
							</uni-tooltip>
						</view>
						<view class="flex-1">
							<!-- 输入框 数字 -->
							<uni-forms-item v-if="item.Component == 'NumberText'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<uni-number-box v-model="formData[item.Name]"
									:disabled="item.Readonly == 1 ? true : false" :max="10000000000"
									:step="getNumberStep(item.Config.NumberTextStep, item.Config.NumberTextPrecision)"
									:width="169" :height="30" @change="onInput($event, item)" />
							</uni-forms-item>
							<!-- 自动编号 -->
							<uni-forms-item v-else-if="item.Component == 'AutoNumber'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<uni-easyinput v-model="formData[item.Name]" :placeholder="item.Placeholder"
									:disabled="true" />
							</uni-forms-item>
							<!-- 多行文本 -->
							<uni-forms-item v-else-if="item.Component == 'Textarea'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<uni-easyinput type="textarea" autoHeight v-model="formData[item.Name]"
									:placeholder="item.Placeholder" :disabled="item.Readonly == 1 ? true : false"
									@change="onInput($event, item)" />
							</uni-forms-item>
							<!-- 单选框 -->
							<uni-forms-item v-else-if="item.Component == 'Radio'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<uni-data-checkbox v-model="formData[item.Name]" :localdata="item.Data"
									:disabled="item.Readonly == 1 ? true : false" @change="handleRadio($event, item)"
									class="flex flex-wrap gap-2 text-sm" />
							</uni-forms-item>
							<!-- 复选框 -->
							<uni-forms-item v-else-if="item.Component == 'Checkbox'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<uni-data-checkbox v-model="formData[item.Name]" multiple
									:localdata="item && (item.Data || [])" :disabled="item.Readonly == 1 ? true : false"
									class="flex flex-wrap gap-2 text-sm" />
							</uni-forms-item>
							<!-- 弹出表格 -->
							<uni-forms-item v-else-if="item.Component == 'OpenTable'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<button type="primary" size="mini" @click="handleOpenTable(item)"
									class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 rounded-md transition-colors duration-200 text-sm">
									{{ item.Config.OpenTable.BtnName || '请选择' }}
								</button>
							</uni-forms-item>
							<!-- 定位 -->
							<uni-forms-item v-else-if="item.Component == 'Map'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<button type="primary" size="mini" @click="handleMap(item)"
									class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 rounded-md transition-colors duration-200 flex items-center text-sm">
									<uni-icons type="location" size="14" class="mr-1" color="#fff"></uni-icons>
									选择位置
								</button>
								<view v-if="formData[item.Name]"
									class="mt-1 text-xs text-gray-700 bg-gray-50 p-1 rounded-md">
									{{ formData[item.Name].name }}{{ formData[item.Name].address }}
								</view>
							</uni-forms-item>
							<!-- 地图区域 -->
							<uni-forms-item v-else-if="item.Component == 'MapArea'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<view v-if="formData[item.Name]"
									class="text-xs text-gray-700 bg-gray-50 p-1 rounded-md">{{ formData[item.Name] }}
								</view>
							</uni-forms-item>
							<!-- 下拉单选/下拉多选/省市区选择 -->
							<uni-forms-item v-else-if="item.Component && item.Component.includes('Select')"
								:label="item.Label" :required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<view class="flex items-center rounded-md px-2 py-1 text-sm bg-gray-50"
									v-if="item.Component == 'SelectTree'" @click="handleSelect(item)">
									<view class="flex-1 text-gray-700">{{ handleSelectTreeLabel(item) }}</view>
									<uni-icons :type="formData[item.Name] ? 'clear' : 'bottom'" size="18"
										color="rgb(192, 196, 204)" @click.stop="handleClearSelect(item)"
										class="cursor-pointer" />
								</view>
								<zxz-uni-data-select v-else v-model="formData[item.Name]" :key="item.Name"
									:localdata="item.Data" :multiple="item.Component == 'MultipleSelect' ? true : false"
									:dataValue="item.Config.SelectSaveField || item.Config.SelectLabel || 'value'"
									:dataKey="item.Config.SelectLabel || 'text'"
									:disabled="item.Readonly == 1 ? true : false" filterable
									@inputChange="handleInputChange($event,item)"
									@change="handleSelectChange($event, item)"></zxz-uni-data-select>
							</uni-forms-item>
							<!-- 省市区选择 -->
							<uni-forms-item v-else-if="item.Component == 'Address'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<view
									class="flex items-center rounded-md px-2 py-1 cursor-pointer text-sm bg-gray-50 border border-gray-300"
									@click="handleSelect(item)">
									<view class="flex-1 text-gray-700">
										{{ formData[item.Name] ? formData[item.Name].join('/') : item.Placeholder }}
									</view>
									<uni-icons :type="formData[item.Name] ? 'clear' : 'bottom'" size="18" color="#999"
										@click.stop="handleClearSelect(item)" class="cursor-pointer" />
								</view>
							</uni-forms-item>
							<!-- 图片上传 -->
							<uni-forms-item v-else-if="item.Component == 'ImgUpload'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<uni-file-picker v-model="formData[item.Name]" file-mediatype="image"
									:limit="item.Config.ImgUpload.Multiple ? item.Config.ImgUpload.MaxCount : 1"
									:readonly="item.Readonly == 1 ? true : false"
									:sourceType="item.SourceType ? item.SourceType : ['album', 'camera']"
									@select="upFileSelect($event, item)"
									class="rounded-lg hover:border-blue-500 transition-colors duration-200">
									<view class="flex flex-col items-center justify-center gap-1">
										<uni-icons type="camera" size="30" color="#ccc"></uni-icons>
										<text class="text-gray-500 text-xs">点击上传图片</text>
									</view>
								</uni-file-picker>
							</uni-forms-item>
							<!-- 文件上传 -->
							<uni-forms-item v-else-if="item.Component == 'FileUpload'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<!-- #ifndef MP-LARK -->
								<view class="rounded-lg hover:border-blue-500 transition-colors duration-200">
									<uni-file-picker v-model="formData[item.Name]" file-mediatype="all"
										:limit="item.Config.FileUpload.Multiple ? item.Config.FileUpload.MaxCount : 1"
										:listStyles="listStyles" :readonly="item.Readonly == 1 ? true : false"
										@select="upFileSelect($event, item)" />
								</view>
								<!-- #endif -->
								<!-- #ifdef MP-LARK -->
								<view class="rounded-lg hover:border-blue-500 transition-colors duration-200">
									<uni-file-picker v-model="formData[item.Name]" file-mediatype="video"
										:limit="item.Config.FileUpload.Multiple ? item.Config.FileUpload.MaxCount : 1"
										:readonly="item.Readonly == 1 ? true : false"
										@select="upFileSelect($event, item)" />
								</view>
								<!-- #endif -->
							</uni-forms-item>
							<!-- 评分 -->
							<uni-forms-item v-else-if="item.Component == 'Rate'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<uni-rate v-model="formData[item.Name]" :disabled="item.Readonly == 1 ? true : false"
									disabledColor="rgb(255, 202, 62)" class="flex" size="18" />
							</uni-forms-item>
							<!-- 分割线 -->
							<view class="" v-else-if="item.Component == 'Divider'">
								<r-divider content-position="left" :customStyle="{
                color: '#3b82f6',
                borderColor: '#e5e7eb',
                margin: '0.5rem 0',
                fontWeight: 'bold',
                fontSize: '14px'
              }">{{ item.Label }}</r-divider>
							</view>
							<!-- 按钮 -->
							<uni-forms-item v-else-if="item.Component == 'Button'"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<button :type="item.Config.Button.Type" :size="item.Config.Button.Size"
									@click="handleButton(item)"
									class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 rounded-md transition-colors duration-200 inline-flex items-center text-sm">
									<uni-icons v-if="item.Config.Button.Icon" :type="item.Config.Button.Icon" size="14"
										class="mr-1"></uni-icons>
									{{ item.Label }}
								</button>
							</uni-forms-item>
							<!-- 组织机构选择/级联选择 -->
							<uni-forms-item v-else-if="item.Component == 'Department' || item.Component == 'Cascader'"
								:label="item.Label" :required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<m-cascader v-model="formData[item.Name]" :options="item.Data"
									:multiple="item.Config.Department.Multiple" :fieldProps="{
                    value: item.Config.SelectSaveField || 'Id',
                    label: item.Config.SelectLabel || 'Name',
                    children: '_Child'
                  }" placeholder="请选择" :save-full-path="item.Config.Department.EmitPath"
									:disabled="item.Readonly == 1 ? true : false"
									@change="handleChange($event, item)" />
							</uni-forms-item>
							<!-- 子表 -->
							<view v-else-if="item.Component == 'TableChild'" class="mb-4">
								<view class="font-medium text-gray-700 mb-1 text-sm border-l-4 border-blue-500 pl-2">
									{{ item.Label }}
								</view>
								<view class="rounded-lg overflow-hidden ">
									<uni-row class="w-full" :width="nvueWidth">
										<uni-col>
											<table-control :ref="setTableChildRef(index)"
												:currentFieldsConfig="item.Config" :ParentFormData="formData"
												isType="edit" :ParentdiyFormFields="formFields" :ParentV8="GetV8()"
												:ParentIndex="index" :TableSearchList="TableSearchList[item.Name]"
												:is="item.Name" @handleEdit="handleEdit($event)"
												@click="handleClickChild(item, index)" />
										</uni-col>
									</uni-row>
								</view>
							</view>
							<!-- 日期时间 -->
							<uni-forms-item v-else-if="item.Component == 'DateTime'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<view
									v-if="item.Config.DateTimeType !== 'HH:mm' && item.Config.DateTimeType !== 'HH:mm:ss'"
									class="w-full">
									<uni-datetime-picker v-model="formData[item.Name]" :type="item.Config.DateTimeType"
										:placeholder="item.Placeholder" :disabled="item.Readonly == 1 ? true : false"
										:key="new Date().getTime()" @change="changeDateTime($event, item)"
										class="rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all duration-200 text-sm" />
								</view>
								<view v-else class="w-full">
									<picker mode="time" :value="formData[item.Name]"
										@change="formData[item.Name] = $event.detail.value">
										<uni-easyinput autoHeight v-model="formData[item.Name]"
											:placeholder="item.Placeholder"
											:disabled="item.Readonly == 1 ? true : false"
											class="rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all duration-200 text-sm" />
									</picker>
								</view>
							</uni-forms-item>
							<!-- 开关 -->
							<uni-forms-item v-else-if="item.Component == 'Switch'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<switch :checked="formData[item.Name] == 1 ? true : false"
									:disabled="item.Readonly == 1 ? true : false" @change="handleSwitch($event, item)"
									class="scale-75 origin-left" />
							</uni-forms-item>
							<!-- 表单V8模版引擎 -->
							<uni-forms-item v-else-if="item.Component == 'V8TmpEngineForm'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<view v-html="getV8Content(item)" class="v8-form-engine text-sm"></view>
							</uni-forms-item>
							<!-- 富文本编辑器 -->
							<uni-forms-item v-else-if="item.Component == 'RichText'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<view class="editor-box">
									<sp-editor :editorId="item.Name" :read-only="item.Readonly == 1 ? true : false"
										:toolbar-config="{
                    excludeKeys: ['direction', 'date', 'lineHeight', 'letterSpacing', 'listCheck', 'video', 'export'],
                    iconSize: '16px'
                  }" @init="initEditor" @input="inputOver" @upinImage="upinImage" @addLink="addLink"></sp-editor>
								</view>
							</uni-forms-item>
							<!-- 文本联想输入框 -->
							<uni-forms-item v-else-if="item.Component == 'Autocomplete'" :label="item.Label"
								:required="item.NotEmpty == 1 ? true : false" :name="item.Name">
								<uni-auto-complete v-model="formData[item.Name]" :placeholder="item.Placeholder"
									:fetch-suggestions="Array.isArray(item.Data) ? item.Data : []"
									:label-field="item.Config?.SelectLabel || 'text'"
									:value-field="item.Config?.SelectSaveField || 'value'"
									:disabled="item.Readonly == 1 ? true : false"
									@select="handleSelectAutocomplete($event, item)"
									@input="handleInputAutocomplete($event, item)"
									@blur="handleBlurAutocomplete($event, item)" class="text-sm" />
							</uni-forms-item>
							<uni-forms-item v-else :label="item.Label" :required="item.NotEmpty == 1 ? true : false"
								:name="item.Name">
								<uni-easyinput v-model="formData[item.Name]" :placeholder="item.Placeholder"
									:disabled="item.Readonly == 1 ? true : false" @input="onInput($event, item)"
									class="rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all duration-200 text-sm" />
							</uni-forms-item>
						</view>
					</view>
				</block>
			</uni-forms>
		</view>
		<!-- 下拉选择 -->
		<uni-popup ref="popupSelect" type="bottom" border-radius="16px 16px 0 0">
			<select-control :currentModel="currentModel" :currentFieldsConfig="currentFieldsConfig"
				:isMultiSelect="isMultiSelect" :list="selectList[selectName]" @onSelectChange="onSelectChange"
				:key="new Date().getTime()" />
		</uni-popup>
		<!-- 新增/编辑子表弹窗 -->
		<uni-popup ref="popupTable" type="bottom" border-radius="16px 16px 0 0">
			<view class="w-full h-screen flex items-end">
				<view class="w-full bg-white rounded-t-2xl h-4/5 relative">
					<view class="text-right right-5 top-4 cursor-pointer pr-3 pt-3" @click="ChildTableClose()">
						<uni-icons type="closeempty" size="24px" color="#999" />
					</view>
					<view class="h-[calc(100%-60px)] overflow-auto rounded-xl">
						<child-table v-if="showTableChild" :currentFieldsConfig="currentFieldsConfig"
							:ParentFormData="formData" :isType="isChildType" :ChildFormId="ChildFormId"
							:ChildDiyTableId="ChildDiyTableId" :key="new Date().getTime()"
							@ChildSubmitOk="ChildSubmitOk" :isChildTable="true" />
					</view>
				</view>
			</view>
		</uni-popup>
		<!-- 打开选择弹窗 -->
		<uni-popup ref="popupOpenTable" type="bottom" border-radius="16px 16px 0 0">
			<view class=" h-screen flex items-end">
				<view class="w-full bg-white rounded-t-2xl h-4/5 p-3 relative">
					<view class=" right-5 top-4 cursor-pointer text-right" @click="popupOpenTable.close()">
						<uni-icons type="closeempty" size="24px" color="#999" />
					</view>
					<view class="h-[calc(100%-100px)] overflow-auto">
						<table-control :currentFieldsConfig="currentFieldsConfig" :ParentFormData="formData"
							isType="edit" :ParentdiyFormFields="formFields" :ParentV8="GetV8()"
							:TableSearchList="TableSearchList[currentModel.Name]"
							:TableSearchWhere="TableSearchWhere[currentModel.Name]" :isOpenTable="true"
							:key="new Date().getTime()" />
					</view>
					<view class="mt-3">
						<button type="primary" @click="submitOpenTable"
							class="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-md transition-colors duration-200 text-sm">
							提交
						</button>
					</view>
				</view>
			</view>
		</uni-popup>
		<!-- 省市区选择 -->
		<cc-city-picker :themeColor="themeColor" ref="mpvueCityPicker" :pickerValueDefault="cityPickerValueDefault"
			@onCancel="onCancel" @onConfirm="onConfirm"></cc-city-picker>
		<!-- 下拉树选择器 currentFieldsConfig.SelectTree && currentFieldsConfig.SelectTree.Multiple-->
		<ba-tree-picker ref="treePicker" :multiple="false" :localdata="selectList[selectName]" title="请选择"
			:valueKey="currentFieldsConfig.SelectSaveField" :textKey="currentFieldsConfig.SelectLabel"
			childrenKey="_Child" @select-change="selectChange" />
	</view>
</template>

<script setup>
	import permision from "@/common/permission.js"
	import {
		ref,
		reactive,
		inject,
		onMounted,
		watch,
		nextTick,
		provide,
		computed
	} from 'vue'
	import {
		getNumberStep,
		remoteSearchSelect,
		isBase64,
		getLocation,
		handleRules,
		deepCopyFunction,
		openChooseLocation,
		uploadFile,
		handleArrayObj,
		flattenArray,
		TmpEngineTableForm
	} from '@/utils'
	import TableControl from './tableControl'
	import SelectControl from './selectControl.vue'
	import ChildTable from './workAdd.vue'
	// import ChildTable from '@/pages/workbench/work-add/index.vue';
	import {
		Base64
	} from 'js-base64'
	import dayjs from 'dayjs';
	import baTreePicker from "@/components/ba-tree-picker/ba-tree-picker.vue"
	import MCascader from '@/components/m-cascader/m-cascader.vue'
	import {
		setFormField
	} from '@/utils/formFieldUtils'
	const props = defineProps({
		// 表单字段
		formFields: {
			type: Array,
			default: () => []
		},
		// 自定义表单数据
		DiyTableData: {
			type: Object,
			default: () => {}
		},
		// 表单验证规则
		formRules: {
			type: Object,
			default: () => {}
		},
		// 表单详情
		formDetail: {
			type: Object,
			default: () => {}
		},
		// 表单类型
		FormMode: {
			type: String,
			default: 'Add'
		},
	})
	const V8 = inject('V8') // 使用注入V8实例
	const ParentV8 = ref(null) // 加载状态ParentV8
	const Microi = inject('Microi'); // 使用注入Microi实例
	const formData = ref(props.formDetail) // 表单数据
	const valiForm = ref(null)
	const scrollIntoViewId = ref('') // 滚动到指定元素
	const tabs = JSON.parse(props.DiyTableData.Tabs || '[]')
	console.log('Microi:tabs', tabs)
	const formTabs = tabs.map((item) => {
		//2025-12-22 Anderson：tabs也可能是一个[{}]
		if (typeof(item) == 'string') {
			if (!item || item.Name == 'none') {
				return ''
			}
			return item.Name || ''
		} else {
			return item;
		}
	}) // 表单分组
	console.log('Microi:formTabs', formTabs)
	props.formFields.forEach((item) => {
		//2025-12-22 Anderson
		// 如果没分组，就默认第一个分组
		if (!item.Tab) {
			if (typeof(formTabs[0]) == 'string') {
				item.Tab = formTabs[0];
			} else {
				item.Tab = formTabs[0].Id;
			}
		}
	})

	const current = ref(0) // 当前分组
	// 弹窗显示
	const popupSelect = ref(null)
	const selectList = reactive({}) // 下拉框列表
	const selectName = ref('') // 下拉框名称
	let isMultiSelect = false // 是否多选
	const nvueWidth = ref(730)
	const HideFormTabs = reactive([])
	// 当前字段配置
	let currentFieldsConfig = reactive({})
	let currentModel = reactive({}) // 当前字段配置
	const showTableChild = ref(false) // 是否显示子表
	const tableChild = ref(null) // 子表格实例
	const isChildType = ref('') // 新增还是编辑
	const ChildFormId = ref('') // 子表表单ID
	const ChildDiyTableId = ref('') // 子表自定义表单ID
	const cityPickerValueDefault = ref([0, 0, 0]) // 省市区选择默认值
	const themeColor = ref('#0BBBEF') // 主题色
	const mpvueCityPicker = ref(null) // 省市区选择实例
	const NewformRules = ref(props.formRules) // 表单验证规则
	const NewformFields = ref(props.formFields) // 表单字段
	const tableChildRefs = NewformFields.value.map(() => ref(null)); // 创建一个引用数组
	const popupTable = ref(null) // 新增/编辑子表弹窗
	// 父表中对子表操作：TableSearchAppend
	const TableSearchList = ref({})
	const TableSearchWhere = ref([])
	const popupOpenTable = ref(null) // 打开选择弹窗
	const treePicker = ref(null) // 下拉树选择器
	// 上传文件样式
	const listStyles = {
		// 是否显示边框
		border: true,
		// 是否显示分隔线
		dividline: true,
		// 线条样式
		borderStyle: {
			width: 1,
			color: 'blue',
			style: 'dashed',
			radius: 2
		},
	}
	// 动态设置ref的函数
	const setTableChildRef = (index) => {
		return (el) => {
			if (el) tableChildRefs[index].value = el; // 将组件实例存储到ref数组中
		}
	}
	// 点击分组切换
	const onClickItem = (e) => {
		current.value = e
		scrollIntoViewId.value = 'tab-' + e
	}

	const emit = defineEmits(['update:formFields'])

	// 在数据更新后触发emit
	const fetchData = async () => {
		// 模拟异步获取数据
		await new Promise((resolve) => setTimeout(resolve, 1000));
		// 数据获取成功后触发更新事件
		NewformFields.value = [...NewformFields.value]

		// 确保响应式更新 - 使用 nextTick 确保 DOM 更新
		nextTick(() => {
			emit('update:formFields', NewformFields.value)
		})
	};
	fetchData();
	// 监听表单详情
	watch(() => props.formDetail, (newVal, oldVal) => {
		formData.value = newVal
	})
	const GetV8 = () => {
		return ParentV8.value
	}
	const FormSet = (fieldName, value, field) => {
		// console.log('FormSet', fieldName, value, field)
		if (formData.value.hasOwnProperty(fieldName)) {
			formData.value[fieldName] = value
		} else {
			formData.value = {
				...formData.value,
				[fieldName]: value
			}
		}
	}
	/**
	 * 设置字段值的函数
	 * @param {string} fieldName - 字段名称
	 * @param {string} value - 值的键名，支持点号格式（如：Config.Button.Loading）
	 * @param {any} field - 要设置的值
	 */
	const FieldSet = (fieldName, value, field) => {
		// 更新表单字段
		NewformFields.value = setFormField(fieldName, value, field, V8, NewformFields.value, NewformRules.value)
		// 确保响应式更新 - 使用 nextTick 确保 DOM 更新
		nextTick(() => {
			// 触发表单字段更新事件
			emit('update:formFields', NewformFields.value)
		})
	}

	// 隐藏tab
	const HideFormTab = (value) => {
		HideFormTabs.push(value)
	}
	// 显示tab
	const ShowFormTab = (value) => {
		HideFormTabs.splice(HideFormTabs.indexOf(value), 1)
	}
	// 下拉框点击
	const handleSelect = (item) => {
		currentFieldsConfig = item.Config
		currentModel = item
		selectName.value = item.Name
		console.log('currentModel', V8.Field[item.Name], V8)
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
		} else if (item.Component == 'SelectTree') { // 树形下拉框
			treePicker.value._show()
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
				V8.ThisValue = e.text
			} else {
				V8.FormSet(selectName.value, e)
				V8.ThisValue = e
			}
			popupSelect.value.close()
			RunV8Code(currentModel.Config.V8Code)
		}
	}
	// 下拉框点击搜索
	const handleInputChange = async (value, item) => {
		// 如果开启远程搜索
		console.log('Microi：是否开启远程搜索', item.Config.DataSourceSqlRemote)
		if (item.Config.DataSourceSqlRemote) {
			console.log('Microi：远程搜索：_Keyword', value)
			const res = await remoteSearchSelect({
				_FieldId: item.Id,
				_Keyword: value,
			}, item.Config)
			//2025-12-22:anderson修复bug
			// item.Data = handleArrayObj(item.Data, res, 'Id')
			item.Data = res;
			console.log('Microi：远程搜索结果res：', res)
		}
	}
	// 下拉框选择
	const handleSelectChange = async (value, item) => {
		// console.log('handleInputChange', value, item)
		if (!value) return
		// 如果是普通数据
		if (item.Config.DataSource == 'Data') {
			V8.FormSet(item.Name, value.text)
			V8.ThisValue = value.text
			RunV8Code(item.Config.V8Code)
			return
		} else {
			V8.ThisValue = value
			V8.FormSet(item.Name, value)
			await RunV8Code(item.Config.V8Code)
		}

	}
	// 树形下拉框选择
	const selectChange = (values, names, data) => {
		console.log('selectChange', values, names, data)
		V8.FormSet(selectName.value, data)
		V8.ThisValue = data
		RunV8Code(currentFieldsConfig.V8Code)
	}
	// 处理下拉数显示数据格式
	const handleSelectTreeLabel = (item) => {
		const value = formData.value[item.Name];
		console.log('handleSelectTreeLabel', value, )
		if (!value) {
			return item.placeholder || '请选择';
		}
		// 如果是对象
		if (typeof value === 'object') {
			return value[item.Config.SelectLabel];
		}
		const flattenedData = flattenArray(item.Data);
		const matchedItem = flattenedData.find(i => i[item.Config.SelectSaveField] === value);
		return matchedItem ? matchedItem[item.Config.SelectLabel] : value;
	}
	// 输入框输入
	const onInput = (e, item) => {
		V8.FormSet(item.Name, e)
		V8.ThisValue = e
		RunV8Code(item.Config.V8Code)
	}
	// 按钮点击
	const handleButton = async (item) => {
		// 给V8注入getLocation方法 如果需要打卡定位功能
		V8.getLocation = getLocation
		RunV8Code(item.Config.V8Code)
	}
	// 单选点击
	const handleRadio = (e, item) => {
		RunV8Code(item.Config.V8Code)
	}
	// 时间日期
	const changeDateTime = (e, item) => {
		console.log(e)
		if (item.Config.DateTimeType == "datetime_HHmm") {
			V8.FormSet(item.Name, dayjs(e).format('YYYY-MM-DD HH:mm'))
		}
		V8.ThisValue = e
		nextTick(() => {
			RunV8Code(item.Config.V8Code)
		})
	}
	// 点击开关
	const handleSwitch = (e, item) => {
		V8.FormSet(item.Name, e.detail.value)
		V8.ThisValue = e
		RunV8Code(item.Config.V8Code)
	}
	// 输入联想
	const handleInputAutocomplete = async (e, item) => {
		console.log('handleInputAutocomplete', e, item)
		if (!e) return

		// 如果开启远程搜索
		if (item.Config?.DataSourceSqlRemote) {
			const res = await remoteSearchSelect({
				_FieldId: item.Id,
				_Keyword: e,
			}, item.Config)

			item.Data = handleArrayObj(item.Data, res, item.Config?.SelectLabel || 'Id')

		}
		V8.ThisValue = e
	}
	const handleBlurAutocomplete = (e, item) => {
		RunV8Code(item.Config.V8Code)
	}
	// 点击文本联想选择
	const handleSelectAutocomplete = (e, item) => {
		V8.FormSet(item.Name, e[item.Config?.SelectLabel || 'Id'])
		V8.ThisValue = e
	}
	// 上传文件
	const upFileSelect = async (e, item) => {
		const url = e.tempFilePaths
		const res = await uploadFile(url, item)
		if (res.Code == 1) {
			// 如果有值，就追加，没有就赋值
			if (formData.value[item.Name]) {
				V8.FormSet(item.Name, formData.value[item.Name].concat(res.Data))
			} else {
				V8.FormSet(item.Name, res.Data)
			}
		}
	}
	const handleChange = (e, item) => {
		V8.FormSet(item.Name, e)
		V8.ThisValue = e
		RunV8Code(item.Config.V8Code)
		console.log('handleChange', e, item)
	}
	// 部门选择
	const oncDepartment = (e, item) => {
		console.log(e)
		currentModel = item
	}
	// 子表编辑
	const handleEdit = (event) => {
		console.log('handleEdit', event)
		isChildType.value = event.type
		ChildFormId.value = event.id
		ChildDiyTableId.value = event.DiyTableId
		// showTableChild.value = true
		// popupTable.value.open()
	}
	// 从祖先组件注入 state
	provide('parentMethod', handleEdit);
	// 子表新增/编辑弹窗
	const handleClickChild = (item, index) => {
		isChildType.value = uni.getStorageSync('isChildType')
		console.log('Clicked child component ref:', isChildType.value);
		if (isChildType.value == 'Del' || isChildType.value == '') return;
		currentFieldsConfig = item.Config
		currentModel = item
		tableChild.value = tableChildRefs[index].value
		showTableChild.value = true
		popupTable.value.open()
	}
	// 子表弹窗关闭
	const ChildTableClose = () => {
		popupTable.value.close()
		isChildType.value = ''
		uni.setStorageSync('isChildType', '')
	}
	// 子表提交啦
	const ChildSubmitOk = async () => {
		isChildType.value = ''
		uni.setStorageSync('isChildType', '')
		// 子表提交后刷新表单（不执行表单进入事件）
		await initForm(false)
		popupTable.value.close()
		showTableChild.value = false
		// 刷新数据
		nextTick(() => {
			tableChild.value.GetData()
		})
	}
	// 父组件刷新表单
	const ParentReloadForm = inject('ParentReloadForm')
	// 刷新表单
	const ReloadForm = (formData, value) => {
		ParentReloadForm(formData, value) // 向父传递
	}
	// 父组件刷新子表
	const ReloadChildTable = (formData, value) => {
		// 如果子表是隐藏的，则不刷新
		const index = NewformFields.value.findIndex(i => i.Name == formData.Name && i.AppVisible)
		if (index > -1) {
			tableChildRefs[index].value.GetData()
		}
	}
	// 省市区选择
	const onCancel = () => {
		console.log('取消')
	}
	const onConfirm = (e) => {
		console.log('确认', e)
		cityPickerValueDefault.value = e.value
		V8.FormSet(currentModel.Name, e.label.split('-'))
	}
	// 选择位置
	const handleMap = async (item) => {
		const location = await openChooseLocation()
		console.log('选择位置', location)
		if (!location.longitude) {
			Microi.Tips('请选择位置', false)
			return
		}
		V8.FormSet(item.Name, location)
		V8.FormSet(`${item.Name}_Lng`, location.longitude)
		V8.FormSet(`${item.Name}_Lat`, location.latitude)
	}
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
	// 扫码
	const scanCode = () => {
		console.log('开始执行scan函数')
		// #ifdef APP
		return new Promise((resolve, reject) => {
			let status = checkPermission();
			// if (status !== 1) {
			//     return;
			// }
			uni.scanCode({
				success: (res) => {
					console.log('uni.scanCode成功：', res.result);
					// console.log('uni.scanCode callback', callback);
					// if(callback)
					{
						try{
							// callback(res.result);
							V8.ScanCodeRes = res.result
							console.log('执行uni.scanCode callback回调结束！');
							resolve()
						}catch(e){
							console.log('执行uni.scanCode callback回调失败：', e.message);
						}
					}
				},
				fail: (err) => {
					console.log('uni.scanCode失败：', err);
					// callback(err);
					// 需要注意的是小程序扫码不需要申请相机权限
				}
			});
		})
		// #endif
		
		// #ifndef APP
		return new Promise((resolve, reject) => {
			uni.navigateTo({
				url: '/FormComponents/scanCode', // 扫码页面的路径
				events: {
					// 定义一个回调事件，这里命名为 'scanSuccess'
					'scanSuccess': function(data) {
						// 处理扫码结果
						console.log('Scanned data:', data);
						V8.ScanCodeRes = data
						resolve()
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
		// #endif
	}
	// 执行v8code
	const RunV8Code = async (Code) => {
		V8.Init(formData.value, NewformFields.value, props.FormMode);
		V8.FormSet = FormSet;
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
	// 父对子表的操作，搜索
	const TableSearchAppend = (item, obj) => {
		TableSearchList.value[item.Name] = obj;
	}
	// 父对子表的操作，搜索
	const TableSearchSet = (item, obj) => {
		TableSearchList.value[item.Name] = obj;
	}
	// 父对子表的操作，搜索
	const AppendSearchChildTable = (item, obj) => {
		TableSearchList.value[item.Name] = obj;
	}
	// 父对子表的操作，搜索
	const OpenTableSetWhere = (item, obj) => {
		TableSearchWhere.value[item.Name] = obj;
	}
	// 打开表格
	const handleOpenTable = async (item) => {
		currentFieldsConfig = item.Config
		currentModel = item
		console.log('handleOpenTable', item)
		// 弹出前V8事件
		await RunV8Code(currentFieldsConfig.OpenTable.BeforeOpenV8)
		popupOpenTable.value.open()
	}
	// 弹出表格后父对子操作提交
	const submitOpenTable = async () => {
		// 提交后V8事件
		popupOpenTable.value.close()
		TableSearchList.value = {}
		await RunV8Code(currentFieldsConfig.OpenTable.SubmitV8)
	}

	// 富文本编辑器初始化
	const initEditor = (editor, id) => {
		// console.log('initEditor', editor, id)
		editor.setContents({
			html: formData.value[id] || ''
		})
	}
	// 获取输入内容
	const inputOver = (e, id) => {
		// console.log('inputOver', e,id)
		V8.FormSet(id, e.html)
		V8.ThisValue = e.html
	}
	// 上传图片
	const upinImage = (tempFiles, editorCtx, id) => {
		// console.log('upinImage', tempFiles, editorCtx, id)
		tempFiles.forEach(async (file) => {
			const res = await Microi.Upload({
				'File': file.path
			}, function() {}, {
				DataType: "form"
			})
			if (Microi.CheckResult(res)) {
				editorCtx.insertImage({
					src: Microi.FileServer + res.Data.Path,
					width: '80%', // 默认不建议铺满宽度100%，预留一点空隙以便用户编辑
					success: function() {}
				})
			}
		})
	}

	// 点击链接
	const addLink = (e) => {
		console.log('addLink', e)
	}
	onMounted(async () => {
		await initForm()
	})
	// 初始化表单
	const initForm = async (executeInFormV8 = true) => {
		V8.FormSet = FormSet;
		V8.FieldSet = FieldSet;
		V8.HideFormTab = HideFormTab
		V8.ShowFormTab = ShowFormTab
		V8.TableSearchAppend = TableSearchAppend
		V8.TableSearchSet = TableSearchSet
		V8.AppendSearchChildTable = AppendSearchChildTable
		V8.OpenTableSetWhere = OpenTableSetWhere
		V8.ReloadForm = ReloadForm
		V8.TableRefresh = ReloadChildTable
		let initParentV8 = deepCopyFunction(V8.Init(formData.value, props.formFields, props.FormMode));
		ParentV8.value = {
			...initParentV8
		};

		// 根据标识决定是否执行表单进入事件
		if (executeInFormV8) {
			await RunV8Code(props.DiyTableData.InFormV8) // 表单初始化执行v8code
		}

		V8.Method.ScanCode = scanCode; // 扫描二维码
		console.log('ParentV8', formData.value, ParentV8.value)
		nextTick(async () => {
			NewformRules.value = await handleRules(NewformFields.value) // 处理表单验证规则
		})
	}
	// 子组件导出方法，才能在父组件拿到子组件的实例里使用
	defineExpose({
		valiForm,
		formData
	});

	// 处理V8模板内容的显示
	const getV8Content = (item) => {
		const value = formData.value[item.Name]
		return TmpEngineTableForm(item.V8TmpEngineForm)
	}
</script>

<style>
	/* 保留一些必要的自定义样式 */
	::v-deep .is-disabled {
		color: black;
	}

	::v-deep .uni-date-editor--x__disabled {
		opacity: 1;
	}

	::v-deep .uni-date-x {
		color: black;
		background: #F7f7f7;
	}

	::v-deep .uni-forms-item__label {
		font-size: 26rpx;
		color: #666;
		text-align: right;
	}

	/* 必要的编辑器样式 */
	.v8-form-engine {
		overflow-wrap: break-word;
		white-space: normal;
	}

	::v-deep .uni-forms-item {
		margin-bottom: 10px !important;
	}

	.editor-box {
		border: 1px solid #DCDFE6;
		height: 780rpx;
		width: 100%;
	}
</style>