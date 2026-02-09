<template>
  <view class="container">
    <view class="work-list" >
      <formControl ref="formChild" v-if="isShow" :formFields="diyFormFields" :DiyTableData="DiyTableData" :formRules="formRules" :formDetail="formDetail" :FormMode="type" :ParentV8="ParentV8" />
    </view>
    <view class="sub-btn">
      <button type="primary" @click="submit">提交</button>
    </view>
  </view>
</template>

<script setup>
import { onLoad, onShow } from '@dcloudio/uni-app';
import { ref, reactive, inject } from 'vue'
import { diyFormField, DiyTableModule, getApiUrl, handleRules, handleFormSubmit, handleFormDetail, RunV8Code } from '@/utils'
import formControl from './formControl.vue'
import { nextTick } from '../wxcomponents/vant/common/utils';
const Microi = inject('Microi'); // 使用注入Microi实例
const V8 = inject('V8'); // 使用注入V8实例
const DiyTableId = ref('') // 自定义表单ID
const diyFormFields = ref([]) // 自定义表单字段
const DiyTableData = ref({}) // 自定义表单数据
const formChild = ref(null) // 表单子组件实例
const formRules = ref({}) // 表单验证规则
const isShow = ref(false) // 是否显示自定义表单
const formDetail = ref({}) // 表单详情数据
const type = ref('') // 新增或编辑
// 表单详情id
const formId = ref('')
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
  ParentV8: {
    type: Object,
    default: () => {}
  }
})
const emits = defineEmits(['ChildSubmitOk']) // 自定义表单提交事件
DiyTableId.value = props.currentFieldsConfig.TableChildTableId || props.ChildDiyTableId
type.value = props.isType
formId.value = props.ChildFormId
// 获取自定义表单字段
const getDiyFormFields = async () => {
  Microi.ShowLoading('加载中···')
  const formFields = await diyFormField({TableId: DiyTableId.value}) // 获取表单字段
  diyFormFields.value = formFields
  DiyTableData.value = await DiyTableModule({Id: DiyTableId.value}) // 获取自定义表单
  formRules.value = await handleRules(formFields) // 处理表单验证规则
  if (type.value === 'Add') {
    const NewGuidRes = await Microi.Post(getApiUrl('GetNewGuid'), {})
    formDetail.value.Id = NewGuidRes.Data // 获取表ID
    const childField = props.currentFieldsConfig.TableChild.PrimaryTableFieldName  // 子表主键字段
    const TableChildFkFieldName = props.currentFieldsConfig.TableChildFkFieldName  // 父表外键字段
    formDetail.value[TableChildFkFieldName] = childField ? props.ParentFormData[childField] : props.ParentFormData.Id
    // 查看是否有默认值
    formFields.map(item => {
      if (item.DefaultValue) {
        formDetail.value[item.Name] = item.DefaultValue
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
  }
}
// 提交表单
const submit = async () => {
  console.log('success',formChild.value.formData);
  formChild.value.valiForm.validate().then(async (res) => {
    new Promise(resolve => {
        RunV8Code(DiyTableData.value.SubmitFormV8) // 表单提交执行v8code
        resolve()
    }).then(() => {
      uni.showToast({
        title: '提交成功',
        icon:'success',
        duration: 2000
      })
      nextTick(() => {
        if (type.value === 'Add') {
          AddFormData()
        } else {
          EditFormData()
        }
      })
    })
    new Promise(resolve => {
    RunV8Code(DiyTableData.value.OutFormV8) // 表单提交执行v8code
      resolve()
    }).then(() => {
    })

  }).catch(err => {
    console.log('err', err);
  })

}
// 新增提交
const AddFormData = async () => {
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
  console.log('新增成功', res)
  if (res.Code == 1) {
    uni.showToast({
      title: '新增成功',
      icon: 'success',
      duration: 2000
    })
    emits('ChildSubmitOk')
  } else {
    uni.showToast({
      title: '新增失败',
      icon: 'none',
      duration: 2000
    })
  }
}
// 编辑提交
const EditFormData = async () => {
  Microi.ShowLoading('加载中···')
  const formData = handleFormSubmit(formChild.value.formData, diyFormFields.value)
  console.log('formData', formData);
  const obj = {
    FormEngineKey: DiyTableData.value.Name,
    Id: formDetail.value.Id,
    _RowModel: formData
  }
  const res = await Microi.FormEngine.UptFormData(obj)
  Microi.HideLoading()
  console.log('编辑成功', res)
  if (res.Code == 1) {
    uni.showToast({
      title: '编辑成功',
      icon: 'success',
      duration: 2000
    })
    emits('ChildSubmitOk')
  } else {
    uni.showToast({
      title: '编辑失败',
      icon: 'none',
      duration: 2000
    })
  }
}


getDiyFormFields()

</script>

<style scoped>
.container {
  height: 80%;
  position: relative;
}
.work-list {
  height: 100%;
  overflow: auto;
  padding-bottom: 50rpx;
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
</style>