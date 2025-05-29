<template>
  <view>
    <uni-forms ref="valiForm" :model="formData" class="flowsheet-item" label-position="top" :key="forceRenderKey">
      <!-- 单选框 -->
      <view v-if="item.Component == 'Radio'">
        <uni-data-checkbox v-model="formData[item.Name]" :localdata="item.Data"  :key="new Date().getTime()"
          :disabled="item.Readonly == 1 ? true : false" @change="changeRadio($event, item)" />
      </view>
      <!-- 文本框 -->
      <view v-else-if="item.Component == 'Text'" class="width200">
          <uni-easyinput v-model="formData[item.Name]" :placeholder="item.Placeholder" 
          :disabled="item.Readonly == 1 ? true : false" />
      </view>
      <!-- 下拉框 -->
      <view v-else-if="item.Component == 'Select'" class="width200">
        <zxz-uni-data-select v-model="formData[item.Name]"
              :key="item.Name"
              :localdata="item.Data" 
              :multiple = "item.Component == 'MultipleSelect' ? true : false"
              :dataValue="item.Config.SelectSaveField || 'value'"
              :dataKey="item.Config.SelectLabel || 'text'"
              :disabled="item.Readonly == 1 ? true : false"
              filterable 
              @inputChange="handleInputChange($event,item)"
              @change="handleSelectChange($event, item)"></zxz-uni-data-select>
      <!-- <picker @change="bindPickerChange($event, item)" :key="new Date().getTime()"
      :value="formData[item.Name]" :range="item.Data" range-key="text" :disabled="item.Readonly == 1 ? true : false">
        <view class="uni-input uni-border">{{formData[item.Name] || item.Placeholder}}</view>
      </picker> -->
      </view>
      <!-- 多选框 -->
      <view v-else-if="item.Component == 'MultipleSelect'" class="width200">
        <zxz-uni-data-select v-model="formData[item.Name]"
              :key="item.Name"
              :localdata="item.Data" 
              :multiple = "item.Component == 'MultipleSelect' ? true : false"
              :dataValue="item.Config.SelectSaveField || 'value'"
              :dataKey="item.Config.SelectLabel || 'text'"
              :disabled="item.Readonly == 1 ? true : false"
              filterable 
              @inputChange="handleInputChange($event,item)"
              @change="handleSelectChange($event, item)"></zxz-uni-data-select>
      </view>
      <!-- 上传图片 -->
      <view v-else-if="item.Component == 'ImgUpload'" class="uni-flex">
        <uni-file-picker v-model="formData[item.Name]" file-mediatype="image"  :key="new Date().getTime()"
          :limit="item.Config.ImgUpload.Multiple ? item.Config.ImgUpload.MaxCount : 1"
          :disabled="item.Readonly == 1 ? true : false"
          :sourceType="item.SourceType ? item.SourceType : ['album', 'camera']"
          :imageStyles="imageStyles"
          @select="upFileSelect($event, item)"
          @delete="upFileDelete($event, item)">
          <uni-icons type="camera" size="40" color="#ccc"></uni-icons>
        </uni-file-picker>
      </view>
      <!-- 上传文件 -->
       <view v-else-if="item.Component == 'FileUpload'" class="uni-flex">
        <uni-file-picker v-model="formData[item.Name]" file-mediatype="all"
          :limit="item.Config.FileUpload.Multiple ? item.Config.FileUpload.MaxCount : 1"
          :disabled="item.Readonly == 1 ? true : false" @select="upFileSelect($event, item)" />
       </view>
        
      <!-- 日期时间 -->
      <view v-else-if="item.Component == 'DateTime'" class="width200" >
        <view v-if="item.Config.DateTimeType !== 'HH:mm' && item.Config.DateTimeType !== 'HH:mm:ss'">
          <uni-datetime-picker v-model="formData[item.Name]" :type="item.Config.DateTimeType"
            :placeholder="item.Placeholder" :disabled="item.Readonly == 1 ? true : false"
            :key="new Date().getTime()"
            @change="changeDateTime($event, item)" />
        </view>
        <view v-else>
          <picker mode="time" :value="formData[item.Name]" @change="formData[item.Name] = $event.detail.value">
            <uni-easyinput autoHeight v-model="formData[item.Name]" :placeholder="item.Placeholder"
              :disabled="item.Readonly == 1 ? true : false" />
          </picker>
        </view>
      </view>
       <!-- 输入框 数字 -->
       <view v-else-if="item.Component == 'NumberText'" class="width200" >
          <uni-number-box v-model="formData[item.Name]" :disabled="item.Readonly == 1 ? true : false" :max="10000000000" :step="getNumberStep(item.Config.NumberTextStep, item.Config.NumberTextPrecision)" :width="200" @change="onInput($event, item)" />
        </view>
        <!-- 多行文本 -->
        <view v-else-if="item.Component == 'Textarea'" class="width200" >
            <uni-easyinput type="textarea" autoHeight v-model="formData[item.Name]" :placeholder="item.Placeholder"
              :disabled="item.Readonly == 1 ? true : false" @change="onInput($event, item)" />
          </view>
        <!-- 组织机构选择/级联选择 -->
        <view v-else-if="item.Component == 'Department' || item.Component == 'Cascader'"  class="width200">
            <m-cascader
              v-model="formData[item.Name]"
              :options="item.Data"
              :multiple="item.Config.Department.Multiple"
              :fieldProps="{
                value: item.Config.SelectSaveField || 'Id',
                label: item.Config.SelectLabel || 'Name',
                children: '_Child'
              }"
              placeholder="请选择"
              :save-full-path="item.Config.Department.EmitPath"
              :disabled="item.Readonly == 1 ? true : false"
              @change="handleChange($event, item)"
            />
        </view>
        <!-- 文本联想输入框 -->
        <view v-else-if="item.Component == 'Autocomplete'" class="width200">
          <uni-auto-complete
            v-model="formData[item.Name]"
            :placeholder="item.Placeholder"
            :fetch-suggestions="Array.isArray(item.Data) ? item.Data : []"
            :label-field="item.Config?.SelectLabel || 'text'"
            :value-field="item.Config?.SelectSaveField || 'value'"
            :disabled="item.Readonly == 1 ? true : false"
            @select="handleSelectAutocomplete($event, item)"
            @input="handleInputAutocomplete($event, item)"
            @blur="handleBlurAutocomplete($event, item)"
          />
        </view>
      <view v-else>
        {{ formData[item.Name] }}
      </view>
    </uni-forms>
  </view>
</template>

<script setup>
import { ref, inject, nextTick, watch, computed, onMounted, reactive  } from 'vue'
import { initV8Init,RunV8Code,uploadFile, handleFormSubmit, remoteSearchSelect, handleArrayObj, getNumberStep } from '@/utils'
import { useStore } from 'vuex';
const store = useStore();
const Child_Sys_Menu = store.state.tableEdit.Child_Sys_Menu; // 系统菜单配置
const ChildTableDataEdit = store.state.tableEdit.Child_TableData_Edit; // 子表数据编辑
const Microi = inject('Microi'); // 使用注入Microi实例
const V8 = inject('V8'); // 使用注入V8实例
const props = defineProps({
  // 字段配置项
  field: {
    type: Object,
    default: ''
  },
  // 表单数据
  data: {
    type: Object,
    default: {}
  },
  // 表单ID
  DiyTableId: {
    type: String,
    default: ''
  },
  // 表单字段
  diyFormFields: {
    type: Array,
    default: []
  },
  // 关联主表Id
  Guid: {
    type: String,
    default: ''
  },
  // 总数
  currenTotal: {
    type: Number,
    default: 0
  },
  // 列表索引
  listIndex: {
    type: Number,
    default: 0
  },
  // 列表数据
  ChildList: {
    type: Array,
    default: []
  },
})
const item = ref({})
const formData = ref({})
const forceRenderKey = ref(0) // Add a key for forcing re-render
const handleEditOK = inject(['handleEditOK'])
const imageStyles = {
        width: 65,
        height: 65,
      }
onMounted(() => {
  nextTick(() => {
    formData.value = props.data
    item.value = props.field
    // console.log('表单数据'+item.value.Label, item.value, V8.Field)
    // 判断新增提交模式
    if (Child_Sys_Menu[props.DiyTableId] == "InTable") {
    if (formData.value[item.value.Name] && (V8.ParentForm.ZidongTXYG == 1 || V8.ParentForm.ZidongTXYG == true)) {
      isAddMode()
    }
    const requiredData = props.diyFormFields.filter(item => item.NotEmpty).map(item => item.Name)
    store.commit('tableEdit/SET_CHILD_TABLE_REQUIRED', {requiredData: requiredData, TableId: props.DiyTableId}) // 设置子表必填项
    }
    // Force a re-render after data is set
    forceUpdate()
  })
})

// 初始化表单数据
const initFormData = () => {
  initV8Init(formData.value,props.diyFormFields, 'Edit') // 初始化v8环境
  V8.FormSet = FormSet
  forceUpdate() // Force update after initialization
}

// Force component to re-render
const forceUpdate = () => {
  forceRenderKey.value += 1
  if (item.value.Data?.length == 0) {
    item.value = V8.Field[item.value.Name]
  }
}

//处理提交数据
const handleSubmitData = () => {
  const data = JSON.parse(JSON.stringify(formData.value))
  console.log('处理提交数据', data)
  // 处理这条数据更新到V8.CurrentTableData
  const index = V8.CurrentTableData.findIndex(item => item.Id == formData.value.Id)
  // if (index > -1) {
  //   V8.CurrentTableData[index] = {
  //    ...V8.CurrentTableData[index],
  //    ...data
  //   }
  // }
  console.log('处理提交数据V8.CurrentTableData',index, V8.CurrentTableData)
  const form = handleFormSubmit(data,props.diyFormFields) // 处理表单数据
    const obj = {
      TableId: props.DiyTableId,
      Id: formData.value.Id,
      _FormData: {
        ...form,
      }
    }
    return obj
}
const FormSet = (fieldName, value, field) => {
  console.log('FormSet111', fieldName, value)
  if(formData.value.hasOwnProperty(fieldName)) {
    formData.value[fieldName] = value
  } else {
    formData.value = {
     ...formData.value,
      [fieldName]: value
    }
  }
}
// 如果是表内新增模式
const isAddMode = async () => {
  let obj = await handleSubmitData()
  store.commit('tableEdit/SET_CHILD_TABLE_DATA_EDIT', {obj: obj, Name: item.value.Name, parentId: V8.ParentV8.Form.Id, Guid: props.Guid})
  const tableEditCount = countChildTableDataEdit()
  V8.tableEditCount = {Count: tableEditCount, total: props.currenTotal}
  initV8Init(formData.value,props.diyFormFields, 'Edit') // 初始化v8环境
  await RunV8Code(item.value.Config.V8Code) // 表单提交执行v8code
}

// 计算子表数据编辑中必填项已经填写的数量
const countChildTableDataEdit = () => {
  const { Child_TableData_Edit } = store.state.tableEdit
  const tableData = Child_TableData_Edit[V8.ParentV8.Form.Id][props.Guid]
  // 必填项
  const requiredData = props.diyFormFields.filter(item => item.NotEmpty).map(item => item.Name)
  let count = 0 // 已填写的必填项数量
  tableData.map(item => {
    if (requiredData) {
      const { _FormData } = item
      // 判断_FormData中必填项的数据是否都有值，有值则count++
      const notEmpty = requiredData.filter(item => _FormData[item] === undefined || _FormData[item] === null || _FormData[item] === '' || _FormData[item] === 'null' || _FormData[item] === 'undefined' || _FormData[item] === "[]")
      if (notEmpty.length === 0) {
        count++
      }
    }
  })
  return count
}
// 提交表单编辑
const submitForm = async () => {
  // ReloadForm()
  // 判断新增提交模式 如果是表内新增
  if (Child_Sys_Menu[props.DiyTableId] == "InTable") {
    console.log('InTable', V8.Form)
    isAddMode()
    return
  }
  // 判断是否是流程表单 表内编辑
  if (Child_Sys_Menu[props.DiyTableId] == "InTableFlow") {
    console.log('InTableFlow', V8.Form)
    return
  }
  // 其他表内编辑直接提交 模式
  initV8Init(formData.value,props.diyFormFields, 'Edit') // 初始化v8环境
  await RunV8Code(item.value.Config.V8Code) // 表单提交执行v8code
  if (V8.Result === false) return
  // 如果是数组就转换成字符串
  let obj = handleSubmitData()
  console.log('表单提交执行v8code',obj)
  const res = await Microi.FormEngine.UptFormData(obj)
  if (res.Code == 1) {
    Microi.Tips('保存成功')
    handleEditOK()
  } else {
    Microi.Tips('保存失败')
  }
}
// 上传图片
const upFileSelect = async (e, item) => {
  const res = await uploadFile(e.tempFilePaths, item)
  if (res.Code == 1) {
    // 如果有值，就追加，没有就赋值
    if (formData.value[item.Name]) {
      formData.value[item.Name] = [...formData.value[item.Name],...res.Data]
    } else {
      formData.value[item.Name] = res.Data
    }
    submitForm()
  }
}
//  删除图片
const upFileDelete = (e, item) => {
  // console.log('删除图片',formData.value[item.Name], e)
  const index = formData.value[item.Name].findIndex(item => item.Url == e.url)
  if (index > -1) {
    formData.value[item.Name].splice(index, 1)
  }
  submitForm()
}
// 单选框值变更
const changeRadio = (e, item) => {
  formData.value[item.Name] = e.detail.value
  submitForm()
}

// 下拉框值变更
const changeSelect = (e, item) => {
  const { Data } = item
  const index = Data.findIndex(item => item.value == e)
  formData.value[item.Name] = e
  V8.ThisValue = Data[index]
  V8.FormSet = FormSet
  initV8Init(formData.value,props.diyFormFields, 'Edit') // 初始化v8环境
  RunV8Code(item.Config.V8Code) // 表单提交执行v8code
  submitForm()
}
// 绑定picker值变更
const bindPickerChange = (e,item) => {
  const index = e.detail.value
  const { Data } = item
  formData.value[item.Name] = Data[index].text
  V8.ThisValue = Data[index]
  V8.FormSet = FormSet
  initV8Init(formData.value,props.diyFormFields, 'Edit') // 初始化v8环境
  RunV8Code(item.Config.V8Code) // 表单提交执行v8code
}
// 日期时间值变更
const changeDateTime = (e, item) => {
  console.log('changeDateTime', e, item)
  formData.value[item.Name] = e
  submitForm()
}
// 输入框值变更
const onInput = (e, item) => {
  formData.value[item.Name] = e
  submitForm()
}
// 下拉框点击搜索
const handleInputChange = async (value, item) => {
// 如果开启远程搜索
if (item.Config.DataSourceSqlRemote) {
      const res = await remoteSearchSelect({
        _FieldId: item.Id,
        _Keyword: value,
      }, item.Config)
      item.Data = handleArrayObj(item.Data, res, 'Id')
    }
}
// 下拉框选择
const handleSelectChange = async (value, item) => {
  // console.log('handleInputChange', value, item)
  if (!value) return
  // 如果是普通数据
  if (item.Config.DataSource == 'Data') {
    formData.value[item.Name] = value.text
    V8.ThisValue = value.text
    RunV8Code(item.Config.V8Code)
  } else {
    V8.ThisValue = value
    formData.value[item.Name] = value
    await RunV8Code(item.Config.V8Code)
  }
  submitForm()
}
// 组织机构选择/级联选择值变更
const handleChange = (e, item) => {
  formData.value[item.Name] = e
  V8.ThisValue = e
  RunV8Code(item.Config.V8Code)
  submitForm()
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
  formData.value[item.Name] = e[item.Config?.SelectLabel || 'Id']
  V8.ThisValue = e
}
</script>

<style scoped>
.width200{
  width: 200px;
}
</style>