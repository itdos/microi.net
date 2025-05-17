<template>
  <view class="container">
    <view v-if="isFormLoading" class="loading-overlay">
      <view class="spinner"></view>
      <text>加载中...</text>
    </view>
    <view v-else class="work-list">
      <uni-forms ref="valiForm" :rules="rules" :model="formData" class="flowsheet-item" label-position="left"
        label-width="80px" label-align="right">
        <block v-for="item in diyFormFields" :key="item.Id">
          <template v-if="(item.AppVisible && item.Visible)" class="uni-flex">
            <uni-forms-item v-if="item.Component && item.Component.includes('Select')" :label="item.Label"
              labelWidth="100px" :required="item.NotEmpty == 1 ? true : false" :name="item.Name">
              <zxz-uni-data-select v-model="formData[item.Name]" :localdata="item.Data" filterable
                :multiple="item.Component == 'MultipleSelect' ? true : false" :is="new Date().getTime()"
                @inputChange="handleInputChange($event, item)" @change="change($event, item)"></zxz-uni-data-select>
            </uni-forms-item>
            <view v-else-if="item.Component == 'ImgUpload'" :required="item.NotEmpty == 1 ? true : false"
              :name="item.Name">
              <uni-file-picker v-model="formData[item.Name]" file-mediatype="image"
                :limit="item.Config.ImgUpload.Multiple ? item.Config.ImgUpload.MaxCount : 1"
                :readonly="item.Readonly == 1 ? true : false"
                :sourceType="item.SourceType ? item.SourceType : ['album', 'camera']" :image-styles="imageStyles"
                @select="upFileSelect($event, item)">
                <uni-icons type="camera" size="40" color="#ccc"></uni-icons>
              </uni-file-picker>
            </view>
            <uni-forms-item v-else-if="item.Component == 'DateTime'" :label="item.Label" labelWidth="100px"
              :required="item.NotEmpty == 1 ? true : false" :name="item.Name">
              <view v-if="item.Config.DateTimeType !== 'HH:mm' && item.Config.DateTimeType !== 'HH:mm:ss'">
                <uni-datetime-picker v-model="formData[item.Name]" :type="item.Config.DateTimeType"
                  :placeholder="item.Placeholder" :disabled="item.Readonly == 1 ? true : false" :border="false"
                  :key="new Date().getTime()">
                  <!-- <view>{{ formData[item.Name] ? formData[item.Name] : item.Placeholder }}</view> -->
                  <uni-easyinput autoHeight v-model="formData[item.Name]" :placeholder="item.Placeholder"
                    :disabled="item.Readonly == 1 ? true : false" :inputBorder="false" style="pointer-events: none;" />
                </uni-datetime-picker>
              </view>
              <view v-else>
                <picker mode="time" :value="formData[item.Name]" @change="formData[item.Name] = $event.detail.value">
                  <uni-easyinput autoHeight v-model="formData[item.Name]" :placeholder="item.Placeholder"
                    :disabled="item.Readonly == 1 ? true : false" :inputBorder="false" />
                </picker>
              </view>
            </uni-forms-item>
            <uni-forms-item v-else :label="item.Label" :required="item.NotEmpty == 1 ? true : false" :name="item.Name"
              labelWidth="100px">
              <uni-easyinput v-model="formData[item.Name]" :placeholder="item.Placeholder" :inputBorder="false"
                @input="onInput($event, item)" />
            </uni-forms-item>
            <uni-forms-item v-if="formData[item.Name] == '任务检查'" label="任务执行" labelWidth="100px"
              :required="item.NotEmpty == 1 ? true : false" :name="item.Name">
              <zxz-uni-data-select v-model="formData['LaiyuanID']" :localdata="LaiyuanData" filterable
                @inputChange="handleInputChange($event, item)" @change="change($event, item)"></zxz-uni-data-select>

            </uni-forms-item>
          </template>
        </block>
      </uni-forms>
    </view>
    <view class="uni-tabbar-height"></view>
    <view class="sub-btn">
      <button type="primary" :loading="isLoading" :disabled="isFormLoading || isLoading" @click="submit">提交</button>
    </view>
    <!-- 下拉选择 -->
    <uni-popup ref="popupSelect" type="bottom" border-radius="10px 10px 0 0">
      <select-control :currentModel="currentModel" :currentFieldsConfig="currentFieldsConfig"
        :isMultiSelect="isMultiSelect" :list="selectList[selectName]" @onSelectChange="onSelectChange"
        :key="new Date().getTime()" />
    </uni-popup>
  </view>
</template>
<script setup>
import { onLoad, onShow } from '@dcloudio/uni-app';
import { ref, reactive, inject, nextTick, onMounted } from 'vue';
import { diyFormField, DiyTableModule, getApiUrl, handleRules, handleFormSubmit, RunV8Code, uploadFile, remoteSearchSelect, handleArrayObj, deepCopyFunction, initV8Init } from '@/utils'
import { assign } from 'qs/lib/utils';
import SelectControl from '@/FormComponents/selectControl.vue'
const Microi = inject('Microi')
const V8 = inject('V8')
const isLoading = ref(false)
const rules = ref({})
const formData = ref({})
const valiForm = ref(null)
const popupSelect = ref(null)
// 当前字段配置
let currentFieldsConfig = reactive({})
let currentModel = reactive({}) // 当前字段配置
let selectName = ref('') // 当前字段名称
let selectList = reactive({}) // 下拉列表
let isMultiSelect = false // 是否多选
const imageStyles = {
  "height": 100,	// 边框高度
  "width": 100,	// 边框宽度
  "border": { // 如果为 Boolean 值，可以控制边框显示与否
    "color": "#eee",		// 边框颜色
    "width": "1px",		// 边框宽度
    "style": "solid", 	// 边框样式
    "radius": "10px" 		// 边框圆角，支持百分比
  }
}
const LaiyuanData = ref([])
// 获取自定义表单字段
const diyFormFields = ref([])
const DiyTableData = ref({})
const DiyTableId = ref('c37ba377-466d-4419-b155-7de7dedc2f57')
const SelectFields = ['RenwuMC', 'RenwuDJ', 'RenwuFL', 'WeixiuRY', 'Laiyuan', 'ZhenggaiJSSJ', 'Tupian', 'YichangMS', 'ZhenggaiZT', 'ZhenggaiKSSJ']
const getDiyFormFields = async () => {
  diyFormFields.value = await diyFormField({
    TableId: DiyTableId.value,
    // _SelectFields: SelectFields
  })
  rules.value = await handleRules(diyFormFields.value) // 处理表单验证规则
  // 找到来源字段，并赋值
  const LaiyuanIndex = diyFormFields.value.findIndex(item => item.Name == 'Laiyuan')
  if (LaiyuanIndex > -1) {
    diyFormFields.value[LaiyuanIndex].Data = [
      {
        text: '手工单',
        value: '手工单'
      },
      {
        text: '任务检查',
        value: '任务检查'
      }
    ]
  }
  DiyTableData.value = await DiyTableModule({ Id: DiyTableId.value }) // 获取自定义表单
  const NewGuidRes = await Microi.Post(getApiUrl('GetNewGuid'), {})
  formData.value.Id = NewGuidRes.Data // 获取表ID
  // 查看是否有默认值
  diyFormFields.value.forEach(item => {
    if (item.DefaultValue) {
      formData.value[item.Name] = item.DefaultValue
    } else {
      formData.value[item.Name] = null
    }
  })
  console.log('formData', formData.value)
  console.log('diyFormFields', diyFormFields.value)
}
const FormSet = (fieldName, value, field) => {
  console.log('FormSet', fieldName, value, field)
  if (formData.value.hasOwnProperty(fieldName)) {
    formData.value[fieldName] = value
  } else {
    formData.value = {
      ...formData.value,
      [fieldName]: value
    }
  }
}
const FieldSet = (fieldName, value, field) => {
  console.log('FieldSet', fieldName, value, field)
  // 判断fieldName是否存在
  if (V8.Field.hasOwnProperty(fieldName)) {
    V8.Field[fieldName][value] = field;
  } else {
    V8.Field = {
      ...V8.Field,
      [fieldName]: {
        [value]: field
      }
    }
  }
  // 如果value 是Data 处理下数据格式
  if (value == 'Data') {
    const currentFieldsConfig = V8.Field[fieldName].Config
    field = field?.map((i) => {
      i.selected = false
      i.text = i.text || i[currentFieldsConfig?.SelectLabel]
      i.value = i.value || i[currentFieldsConfig?.SelectSaveField]
      return i
    })
  }
  if (diyFormFields.value.filter(i => i.Name == fieldName)?.[0]?.hasOwnProperty(value)) {
    diyFormFields.value.filter(i => i.Name == fieldName)[0][value] = field;
  } else {
    diyFormFields.value = [...diyFormFields.value, { Name: fieldName, [value]: field }]
  }
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
const change = async (value, item) => {
  console.log('handleInputChange', value)
  V8.ThisValue = value
  await RunV8Code(item.Config.V8Code)
}
// 输入框输入
const onInput = async (e, item) => {
  V8.FormSet(item.Name, e)
  V8.ThisValue = e
  await RunV8Code(item.Config.V8Code)
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
    i.value = currentFieldsConfig.SelectSaveField ? i[currentFieldsConfig.SelectSaveField] : (i.Id || i.value || i.text)
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
      V8.ThisValue = e.text
    } else {
      V8.FormSet(selectName.value, e)
      V8.ThisValue = e
    }
    popupSelect.value.close()
    RunV8Code(currentModel.Config.V8Code)
  }
}
// 表单数据提交
const submit = async () => {
  // 如果选择的是手工单，则清空来源字段
  if (formData.value.Laiyuan == '手工单') {
    formData.value.LaiyuanID = ''
  }
  console.log('formData', formData.value)
  valiForm.value.validate().then(async (res) => {
    initV8Init(formData.value, diyFormFields.value, 'Add')
    await RunV8Code(DiyTableData.value.SubmitFormV8); // 表单提交前执行v8code
    console.log('表单提交执行v8code', V8.Result)
    if (V8.Result === false) return
    await AddFormData(SubmitCallback)
  }).catch((err) => {
    console.log(err)
    uni.showToast({
      title: err[0].errorMessage,
      icon: 'none',
      duration: 2000
    })
  })
}
const SubmitCallback = async (result) => {
  console.log('表单提交回调', result)
  initV8Init(formData.value, diyFormFields.value, 'Add')
  await RunV8Code(DiyTableData.value.OutFormV8) // 表单离开后提交执行v8code
  if (result.Code == 1) {
    isLoading.value = false
    uni.showToast({
      title: '提交成功',
      icon: 'success',
      duration: 2000
    })
    Microi.RouterPush('status/success?status=0')
    // 等待两秒钟后返回上一页
    setTimeout(() => {
      const pages = getCurrentPages();
      if (pages.length > 2) {
        setTimeout(() => {
          uni.navigateBack({ delta: 2 });
        }, 2000);
      } else {
        uni.switchTab({ url: '/pages/naviBar/workbench/index' })
      }
    }, 2000)  // 延迟（2秒）
  } else {
    uni.showToast({
      title: result.Msg || '提交失败',
      icon: 'none',
      duration: 2000
    })
    isLoading.value = false
  }
}
// 新增提交
const AddFormData = async (callback) => {
  Microi.ShowLoading('加载中···')
  isLoading.value = true
  const data = handleFormSubmit(formData.value, diyFormFields.value)
  console.log('formData', data);
  const obj = {
    FormEngineKey: DiyTableData.value.Name,
    Id: formData.value.Id,
    _RowModel: data
  }
  const res = await Microi.FormEngine.AddFormData(obj)
  Microi.HideLoading()
  callback(res)
}
const isFormLoading = ref(true); // 默认处于加载状态
onMounted(async () => {
  isFormLoading.value = true;
  await getDiyFormFields()
  await initForm()
  getLaiyuanData()
  isFormLoading.value = false; // 加载完成
})
// 初始化表单
const initForm = async () => {
  V8.FormSet = FormSet;
  V8.FieldSet = FieldSet;
  let initParentV8 = deepCopyFunction(V8.Init(formData.value, diyFormFields.value, 'Add'));
  await RunV8Code(DiyTableData.value.InFormV8) // 表单初始化执行v8code
  console.log('ParentV8', V8)
}
// 获取任务执行数据
const getLaiyuanData = async () => {
  const res = await Microi.FormEngine.GetTableData({
    TableName: 'diy_MessionSend_execute',
  })
  if (res.Code == 1) {
    const data = res.Data.map(i => {
      return {
        text: i.RenwuMC,
        value: i.Id
      }
    })
    LaiyuanData.value = data
  }
}
</script>
<style scoped>
.container {
  padding: 20px;
  background: #fff;
}

.demo-uni-row {
  padding: 5px 10px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

::v-deep .uni-forms-item {
  border-bottom: 0.5px solid rgba(221, 221, 221, 1);
  padding-bottom: 20rpx;
  margin-bottom: 20rpx;
}

::v-deep .uni-easyinput__placeholder-class,
::v-deep .uni-select__input-placeholder {
  font-size: 15px;
}

::v-deep .uni-select {
  border: none;
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

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  /* Light gray */
  border-top: 4px solid #007aff;
  /* Blue */
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>