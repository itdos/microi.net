<template>
  <view class="container" v-if="isShow" :style="containerStyle" @scroll="handleScroll">
    <view class="work-list">
      <formControl ref="formChild" v-if="isShow" 
        v-model:formFields="diyFormFields"
        :DiyTableData="DiyTableData" 
        :formRules="formRules" 
        :formDetail="formDetail" 
        :FormMode="type"  />
    </view>
    <view class="sub-btn" v-if="isShowBtn && type != 'View'" :style="buttonStyle">
      <button type="primary" :loading="isLoading" @click="submit" class="rounded-full">提交</button>
    </view>
  </view>
</template>

<script setup>
import { onLoad, onShow, onPageScroll } from '@dcloudio/uni-app';
import { ref, reactive, inject, nextTick, onMounted, provide, computed, onBeforeUnmount } from 'vue'
import { diyFormField, DiyTableModule, getApiUrl, handleRules, handleFormSubmit, handleFormDetail, RunV8Code,initV8Init,handleFieldValue } from '@/utils'
import formControl from '@/FormComponents/formControl.vue'
import { useStore } from 'vuex';
const store = useStore();
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
  isChildTable: {
    type: Boolean,
    default: false
  }
})
const Microi = inject('Microi'); // 使用注入Microi实例
const V8 = inject('V8') // 表单提交执行v8code
const DiyTableId = ref('') // 自定义表单ID
const diyFormFields = ref([]) // 自定义表单字段
const DiyTableData = ref({}) // 自定义表单数据
const formChild = ref(null) // 表单子组件实例
const formRules = ref({}) // 表单验证规则
const isShow = ref(false) // 是否显示自定义表单
const formDetail = ref({}) // 表单详情数据
const type = ref('Add') // 新增或编辑
const ParentV8 = ref(null) // 加载状态ParentV8
// 表单详情id
const formId = ref('')
let OpenAnyFormData = V8.OpenAnyFormData || {}
const emits = defineEmits(['ChildSubmitOk']) // 自定义表单提交事件
const isWF = ref(false) // 是否是工作流
const WorkData = ref({}) // 工作流数据
const isLoading = ref(false) // 提交按钮loading
const isShowBtn = ref(true) // 是否显示提交按钮
const StartWorkData = ref({}) // 工作流初始节点数据
const NoticeFields = ref([]) // 通知字段
const isAtBottom = ref(false);
const buttonStyle = computed(() => {
  return {
    backgroundColor: isAtBottom.value ? 'transparent' : 'white',
  }
});

// 处理滚动事件
const handleScroll = (e) => {
  const { scrollTop, scrollHeight } = e.target;
  const clientHeight = e.target.clientHeight;
  
  // 判断是否滚动到底部（考虑一定的容差）
  isAtBottom.value = (scrollTop + clientHeight >= scrollHeight - 50);
};

// 页面滚动事件处理函数
onPageScroll(({ scrollTop }) => {
  // 获取页面高度
  const windowHeight = uni.getSystemInfoSync().windowHeight;
  // 获取内容高度 (通过估算，因为在onPageScroll中不能使用同步查询)
  const pageHeight = document.body ? document.body.scrollHeight : 1000;
  
  // 判断是否滚动到底部
  isAtBottom.value = (scrollTop + windowHeight >= pageHeight - 50);
});

// 获取自定义表单字段
const getDiyFormFields = async () => {
  Microi.ShowLoading('加载中···')
  const formFields = await diyFormField({TableId: DiyTableId.value, TableName: OpenAnyFormData?.TableName, _SelectFields: OpenAnyFormData?.SelectFields}) // 获取表单字段
  diyFormFields.value = formFields
  DiyTableData.value = await DiyTableModule({Id: DiyTableId.value, _SearchEqual: {Name: OpenAnyFormData?.TableName}}) // 获取自定义表单
  if (!DiyTableData.value) return Microi.HideLoading()
  V8.TableName = DiyTableData.value?.Name || OpenAnyFormData?.TableName // 表单表名
  V8.TableId = DiyTableId.value // 表单ID
  formRules.value = await handleRules(formFields) // 处理表单验证规则
  if (type.value === 'Add') {
    const NewGuidRes = await Microi.Post(getApiUrl('GetNewGuid'), {})
    formDetail.value.Id = NewGuidRes.Data // 获取表ID
    // 查看是否有默认值
    formFields.map(item => {
      if (item.DefaultValue) { // 表单默认值
        formDetail.value[item.Name] = item.DefaultValue
      } else if (props.currentFieldsConfig) { // 自定义字段默认值-关联子表
        const childField = props.currentFieldsConfig.TableChild?.PrimaryTableFieldName  // 子表主键字段
        const TableChildFkFieldName = props.currentFieldsConfig?.TableChildFkFieldName  // 父表外键字段
        formDetail.value[TableChildFkFieldName] = childField ? props.ParentFormData[childField] : props.ParentFormData.Id // 父表外键字段赋值
        if (props.currentFieldsConfig.TableChildCallbackField){ // 自定义字段默认值-回调函数-回写子表数据
          const callbackField = JSON.parse(props.currentFieldsConfig.TableChildCallbackField)
          callbackField.map(item => {
            formDetail.value[item.Child] = V8.ParentForm[item.Father]
          })
        }
      } else{ // 自定义字段默认值
        formDetail.value[item.Name] = item.Component == 'Checkbox' ? [] : null;
      }
    })
    await GetStartNode() // 获取工作流初始节点
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
    FormEngineKey: DiyTableData.value?.Name,
    Id: formId.value
  })
  if (res.Code == 1) {
    formDetail.value = await handleFormDetail(res.Data, diyFormFields.value, 'Edit')
    console.log('获取数据详情',formDetail.value)
  }
}
// 提交表单
const submit = async () => {
  isLoading.value = true
  let shouldContinue = await UptChildData() // 批量修改子表数据
  if (!shouldContinue) return
  initV8Init(formChild.value.formData,diyFormFields.value, type.value)
  formChild.value.valiForm.validate().then(async (res) => {
    await RunV8Code(DiyTableData.value.SubmitFormV8);
    console.log('表单提交执行v8code',V8.Result)
    if (V8.Result === false) return
    nextTick(async() => {
      // 如果有替换事件并且不是子表提交，则执行替换事件
      if (OpenAnyFormData.EventReplace && !props.isChildTable) {
        const formData = handleFormSubmit(formChild.value.formData, diyFormFields.value)
        console.log('替换事件', OpenAnyFormData.EventReplace,formData)
        V8.Form = formData
        OpenAnyFormData.EventReplace.Submit(V8, formData, SubmitCallback)
      } else {
        if (type.value === 'Add') {
          await AddFormData(SubmitCallback)
        } 
        if (type.value === 'Edit') {
          await EditFormData(SubmitCallback)
        }
      }
      
    })
  }).catch(err => {
    isLoading.value = false
    uni.showToast({
      title: err[0].errorMessage,
      icon: 'none',
      duration: 2000
    })
  })

}
const SubmitCallback = async (result) => {
  console.log('表单提交回调', result)
  initV8Init(formChild.value.formData,diyFormFields.value, type.value)
  await RunV8Code(DiyTableData.value.OutFormV8) // 表单离开后提交执行v8code
  if (result.Code == 1) {
    if (type.value === 'Add' && !props.isChildTable) { // 如果是新增并且不是子表，这发送流程数据
      const wfRes = await SubmitWF(formChild.value.formData) // 提交工作流程
      if (wfRes.Code != 1) {
        uni.showToast({
          title: wfRes.Msg || '提交失败',
          icon: 'none',
          duration: 2000
        })
        isLoading.value = false
        return
      }
    }
    isLoading.value = false
    uni.showToast({
      title: '提交成功',
      icon: 'success',
      duration: 2000
    })
    // 子表弹窗进来提交
    if (props.currentFieldsConfig) {
      emits('ChildSubmitOk')
    } else {
      setTimeout(() => {
        uni.navigateBack()
      }, 500)
    }
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
  // formChild.value.formData
  const formData = handleFormSubmit(V8.Form, diyFormFields.value)
  console.log('formData', formData);
  const obj = {
    FormEngineKey: DiyTableData.value.Name,
    Id: formDetail.value.Id,
    _RowModel: formData
  }
  const res = await Microi.FormEngine.AddFormData(obj)
  Microi.HideLoading()
  callback(res)
}
// 编辑提交
const EditFormData = async (callback) => {
  Microi.ShowLoading('加载中···')
  const formData = handleFormSubmit(V8.Form, diyFormFields.value)
  console.log('formData', formData);
  // return
  const obj = {
    FormEngineKey: DiyTableData.value.Name,
    Id: formDetail.value.Id,
    _RowModel: formData
  }
  const res = await Microi.FormEngine.UptFormData(obj)
  Microi.HideLoading()
  callback(res)
}
// 批量修改/新增子表数据
const UptChildData = async () => {
  return new Promise( async (resolve) => {
    let hasMissingRequiredField = false; // 用于跟踪是否有必填项未填写
    const { Child_TableData_Edit, Child_Table_Required } = store.state.tableEdit
    const currentFormChild = Child_TableData_Edit[formChild.value.formData.Id]
    const arrlist = []
    for (const key in currentFormChild) {
      for (const key1 in currentFormChild[key]) {
        arrlist.push(currentFormChild[key][key1])
      }
    }
    if (arrlist.length === 0) {
      resolve(true)
      return true;
    }
    // 查看数据中必填项没填写，则提示
    arrlist.forEach(item => {
      if (Child_Table_Required[item.TableId]) {
        const requiredFields = Child_Table_Required[item.TableId]
        requiredFields.forEach(field => {
          if (handleFieldValue(item._FormData[field])) {
          // if (item._FormData[field] == null || item._FormData[field] === '' || item._FormData[field] === undefined || item._FormData[field] === "null" || item._FormData[field] === "undefined" || item._FormData[field] === "[]") {
            hasMissingRequiredField = true; // 标记有必填项未填写
            console.log('必填项未填写',item,field)
          }
        })
      }
    })
    if (hasMissingRequiredField) {
      // 如果有必填项未填写，则不执行后续的接口调用
      uni.showToast({
        title: `请填写必填项`,
        icon: 'none',
        duration: 2000
      })
      isLoading.value = false
      resolve(false)
      return false;
    } else {
      // 如果所有必填项都已填写，执行接口调用
      let res = {}
      if (type.value === 'Add') {
        res = await Microi.FormEngine.AddFormDataBatch(arrlist)
      }
      if (type.value === 'Edit') {
        res = await Microi.FormEngine.UptFormDataBatch(arrlist)
      }
      console.log('批量新增子表数据结果',res)
      if (res.Code == 1) {
        resolve(true)
      } else {
        uni.showToast({
          title: '批量新增子表数据失败',
          icon: 'none',
        })
      }
    }
  })
}
// V8刷新表单数据
const ReloadForm = (formData,value) => {
  if (value === 'View') {
    isShowBtn.value = false
  }
}
// 从祖先组件注入 state
provide('ParentReloadForm', ReloadForm);
// 获取开始节点信息 - 流程发起
const GetStartNode = async () => {
  if (!isWF.value) return
  const res = await Microi.Post(getApiUrl('getStartWFNode'), {
    FlowDesignId: WorkData.value.FlowDesignId,
  }, function() {}, {
			DataType: "form"
		})
  if (res.Code == 1) {
    StartWorkData.value = res.Data
    const FieldsConfig = JSON.parse(StartWorkData.value.FieldsConfig)
    NoticeFields.value = FieldsConfig.filter(i => i.Notice) // 通知字段
  }
}
// 转换通知字段格式
const transformNoticeFields = (fields) => {
  if (!fields || !Array.isArray(fields)) return []
  return fields.map(field => ({
    Id: field.Id,
    Name: field.Name,
    Label: field.Label,
    Value: V8.Form[field.Name] || ''
  })).filter(item => item.Value !== '')
}
// 提交工作流程
const SubmitWF = async (formData) => {
  return new Promise( async (resolve) => {
    console.log('提交工作流程', isWF.value,WorkData.value)
    if (!isWF.value) return resolve({Code: 1, Msg: '无工作流数据'})
    // 开始V8流程
    if (StartWorkData.value.StartV8) {
      await RunV8Code(StartWorkData.value.StartV8)
    }
    // 表单提交
    let params = {
      FlowDesignId: WorkData.value.FlowDesignId, //流程图Id，必传
      FormData: JSON.stringify(formData),//可选，也可以传入{} object类型，内部会自动序列化
      TableRowId: formData.Id ,//数据Id（Form.Id），必传
      ApprovalIdea: '', //填写的意见，可选
      ForceSelectUsers: V8.WF.ForceSelectUsers || [], //强制选择的用户，可选
      NoticeFields: JSON.stringify(transformNoticeFields(NoticeFields.value)) // 通知字段
    }
    const res = await Microi.Post(getApiUrl('StartWork'), params, function(){
    },{DataType: "form"})
    console.log('提交工作流程结果', res)
    // 结束V8流程
    if (StartWorkData.value.EndV8) {
      await RunV8Code(StartWorkData.value.EndV8)
    }
    resolve(res)
  }).catch(err => {
    console.log('提交工作流程失败', err)
    return {Code: 0, Msg: '提交工作流程失败'}
  })
}
onLoad((options) => {
  if (props.currentFieldsConfig) {
    DiyTableId.value = props.currentFieldsConfig.TableChildTableId || props.ChildDiyTableId
    type.value = props.isType || 'Add'
    formId.value = props.ChildFormId
  } 
  else if (options.leixing == 'OpenAnyForm') {
    OpenAnyFormData = V8.OpenAnyFormData
    DiyTableId.value = OpenAnyFormData.TableId
    type.value = OpenAnyFormData.FormMode || 'Add'
    formId.value = OpenAnyFormData.Id
  }
  else {
    DiyTableId.value = options.DiyTableId
    type.value = options.type || 'Add'
    formId.value = options.Id
  }

  isWF.value = options.isWF ?JSON.parse(options.isWF) : false
  WorkData.value = options.WorkData ? JSON.parse(options.WorkData) : {}
  if (type.value === 'Edit') {
    uni.setNavigationBarTitle({
    title: '编辑'
    })
  }
  getDiyFormFields()
})

const containerStyle = computed(() => {
  if (props.isChildTable) {
    return {
      overflowY: 'scroll',
      height: '100%',
      backgroundImage: 'none'
    }
  } else {
    return {
      padding: '10px'
    }
  }
})
</script>

<style scoped>
.container {
  padding: 10px;
  background: #fff;
  background-image: url('@/pages/tools/kaoqin/images/bg.jpg');
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
  min-height: 100vh;
  /* Base styles that apply to all containers */
}
.work-list{
  overflow-y: auto;
  padding-bottom: 5rem;
  overflow-x: hidden;
  overflow: visible;
}
.sub-btn {
  position: fixed;
  bottom: 0rpx;
  left: 0;
  right: 0;
  padding: 20rpx;
  z-index: 3;
  transition: background-color 0.3s ease;
}
</style>