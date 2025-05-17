<template>
  <view class="table-page">
    <view class="uni-common-mb uni-common-pr" v-if="isOpenTable">
      <uni-table border stripe :loading="loading" emptyText="暂无更多数据"  :type="isMultipleSelect ? 'selection' : ''" @selection-change="selectionChange" :key="ParentIndex">
        <!-- 表头行 -->
        <uni-tr>
          <uni-th align="center" :width="60" v-if="isShowMoreBtn">操作</uni-th>
          <uni-th v-for="(item, index) in NewformFields" :key="index" align="center"
            :width="item.TableWidth">
            <view :class="{'text-red': item.NotEmpty}">{{ item.Label }}</view>
          </uni-th>
        </uni-tr>
        <!-- 表格数据行 -->
        <uni-tr v-for="(lsit, index) in NewChildList" :key="index">
          <uni-td align="left" :width="60" v-if="isShowMoreBtn">
            <view class="table-btn">
              <view class="">
                <view v-for="(btn, btnIndex) in MoreBtns" :key="btnIndex">
                  <button v-if="isShowBtn(btn,lsit, NewformFields, currentPermission, isType)" @click="goBtn(btn, lsit)"
                    class="uni-common-mr table-item-btn" size="mini" :type="btn.type ? btn.type : 'primary'">
                    {{ btn.Name }}
                  </button>
                </view>
              </view>
            </view>
          </uni-td>
          <block v-if="NewformFields.length > 0">
            <uni-td v-for="(item, index1) in NewformFields" :key="index1" align="left" :width="item.TableWidth" @click="goEdit(lsit.Id, 5, lsit)">
              <!-- 是否需要表内编辑 -->
              <!-- <view v-if="InTableEdit && InTableEditFields.includes(item.Id) && isType == 'edit'">
                <table-edit :field="item" :data="lsit" :DiyTableId="DiyTableId" :diyFormFields="NewformFields" :Guid="Guid" :currenTotal="total"  :key="new Date().getTime()" :listIndex="index" :ChildList="NewChildList"  />
              </view> -->
              <view>
                <view v-if="item.Component == 'ImgUpload'">
                  <block v-for="(img, index2) in lsit[item.Name]" :key="img.Id">
                    <image slot='cover' :src="img.url" class="item-Img" @click="previewImg(lsit[item.Name], index2)"></image>
                  </block>
                </view>
                <uni-tooltip :content="String(lsit[item.Name])" placement="top" v-else>
                  <view class="uni-ellipsis-3" :style="{ width: `${item.TableWidth}px` }">
                    <view class="text-center" v-html="TmpEngineTable(lsit, NewformFields, item)"></view>
                  </view>
                </uni-tooltip>
              </view>
            </uni-td>
          </block>
        </uni-tr>
      </uni-table>
    </view>
    <!-- 卡片方式 -->
     <view class="uni-common-mt" v-if="!isOpenTable && NewChildList.length > 0" :id="`card-${ParentdiyFormFields[ParentIndex].Name}`">
        <view class="work-list" v-for="(item, index) in NewChildList" :key="item.Id">
          <view class="work-item">
            <view class="uni-flex uni-justify-between ">
              <uni-badge class="uni-badge-left-margin" :text="index + 1" size="normal" />
              <view v-if="isShowMoreBtn">
                <view class="type-selector text-sm" @click="toggleDropdown(index)">
                  <text>更多操作</text>
                  <uni-icons type="down" size="20" color="#4179F7"></uni-icons>
                </view>

                <!-- 更多操作下拉菜单 -->
                <transition name="dropdown">
                  <view class="type-dropdown" v-if="activeDropdown === index">
                    <view v-for="(btn, btnIndex) in MoreBtns" :key="btnIndex">
                      <view v-if="isShowBtn(btn,item, NewformFields, currentPermission, ParentdiyFormFields[ParentIndex].Readonly ? 'view' : isType)" 
                        class="dropdown-item" @click="goBtn(btn, item)">
                        {{ btn.Name }}
                      </view>
                    </view>
                  </view>
                </transition>
              </view>
            </view>
            <view class="work-item-content" @click="goEdit(null, 5, item)">
              <cardDetail :diyFormFields="NewformFields" :detail="item" :type="isType" :is="new Date().getTime()" :InTableEdit="InTableEdit" :InTableEditFields="InTableEditFields" :DiyTableId="DiyTableId" :Guid="Guid" :currenTotal="total" />
            </view>
          </view>
        </view>
     </view>
    <view class="uni-pagination-box" v-if="NewChildList.length > 0">
      <uni-pagination show-icon :page-size="pageSize" :current="pageCurrent" :total="total" @change="change" />
    </view>
    <view v-if="NewChildList.length == 0 && !loading" class="uni-flex uni-flex-align-center flex-direction-column">
      <image src="/static/image/empty.jpg" mode="widthFix" style="width: 300rpx;"></image>
      <text class=" w22 gray" style="line-height: 20px;">暂无更多数据</text>
    </view>
    <view class="uni-common-mt" v-if="isType == 'edit' && currentPermission.includes('Add') && !ParentdiyFormFields[ParentIndex].Readonly ">
      <button type="primary" size="mini" @click="goEdit(null, 4)" plain="true" class="rounded-full w-full">新增
        <uni-icons type="plusempty" size="14" color="#007aff" />
      </button>
    </view>
  </view>
</template>
<script setup>
import { ref, computed, inject, reactive, watch, nextTick, onMounted, provide, onUnmounted } from 'vue'
import { diyFormField, DiyTableModule, getApiUrl, handleRules, initV8Init, RunV8Code, handleFormDetail, getAuthList,isShowBtn,previewImg, TmpEngineTable } from '@/utils'
import TableEdit from './InTableEditFields.vue';
import cardDetail from '@/FormComponents/cardDetail.vue';
import { useStore } from 'vuex';
const store = useStore();
const Microi = inject('Microi'); // 使用注入Microi实例
const V8 = inject('V8'); // 使用注入V8实例
const props = defineProps({
  // 传入的当前自定义字段配置
  currentFieldsConfig: {
    type: Object,
    default: () => { }
  },
  // 传入的父表单数据
  ParentFormData: {
    type: Object,
    default: () => { }
  },
  isType: {
    type: String,
    default: ''
  },
  // 传入的父表单字段
  ParentdiyFormFields: {
    type: Array,
    default: () => []
  },
  ParentV8: {
    type: Object,
    default: () => { }
  },
  ParentIndex: {
    type: Number,
    default: 0
  },
  // 需要搜索的字段
  TableSearchList: {
    type: Object,
    default: () => {}
  },
  TableSearchWhere: {
    type: Array,
    default: () => []
  },
  isOpenTable: {
    type: Boolean,
    default: false
  },
})
const diyFormFields = ref([]) // 自定义字段列表
const NewformFields = ref([]) // 处理后的字段配置
const NewChildList = ref([]) // 处理后的表格数据
const pageSize = ref(5) // 每页显示条数
const pageCurrent = ref(1) // 当前页
const total = ref(0) // 总条数
const DiyTableId = ref('') // 表单ID
const loading = ref(false) // 加载状态
const createData = [
  {
    Label: '创建时间',
    Name: 'CreateTime',
    TableWidth: 180,
  }, {
    Label: '创建人',
    Name: 'UserName',
    TableWidth: 180,
  }, {
    Label: '修改时间',
    Name: 'UpdateTime',
    TableWidth: 180,
  }
]
const MoreBtns = ref([
  {
    Id: 'Detail',
    Name: '详情',
    type: 'primary'
  },
  {
    Id: 'Edit',
    Name: '编辑',
    type: 'primary'
  },
  {
    Id: 'Del',
    Name: '删除',
    type: 'warn'
  }
]) // 显示行更多按钮
const searchList = ref([]) // 搜索条件列表
const MenuId = ref('') // 模块ID
const currentPermission = ref([]) // 当前页面权限
const ChildFormId = ref('') // 子表单ID
const operate = ref('Add') // 是否显示子表单
const InTableEdit = ref(false) // 是否开启表内编辑
const InTableEditFields = ref([]) // 表内可编辑字段
const DiyTableData = ref([]) // 自定义表单数据
const emits = defineEmits(['handleEdit'])
const parentMethod = inject('parentMethod');
const childField = props.currentFieldsConfig.TableChild.PrimaryTableFieldName  // 子表主键字段
const TableChildFkFieldName = props.currentFieldsConfig.TableChildFkFieldName  // 父表外键字段
let oldChildField = props.ParentFormData[childField] // 旧的子表主键字段
let SearchEqual = {}
if (TableChildFkFieldName) {
SearchEqual[TableChildFkFieldName] = childField ? (props.ParentFormData[childField] || '') : props.ParentFormData.Id
}
let Guid = childField ? (props.ParentFormData[childField] || '') : props.ParentFormData.Id
let Search = {}
let TableSearchWhere = []
const isShowMoreBtn = ref(true) // 是否显示更多按钮
const isMultipleSelect = computed(() => {
  return props.currentFieldsConfig.OpenTable?.MultipleSelect || false;
});
const activeDropdown = ref(null) // 当前展开的下拉菜单索引

// 获取数据
const GetData = async () => {
  Microi.ShowLoading('加载中···')
  NewChildList.value = []
  loading.value = true
  let res = {}
  // 判断是否走虚拟报表
  if (DiyTableData.value && DiyTableData.value.ReportId && DiyTableData.value.DataSourceId) {
    console.log('走虚拟报表接口引擎')
    res = await Microi.Post(getApiUrl('ReportEngine'), {
      ModuleEngineKey: MenuId.value,
      DataSourceKey: DiyTableData.value.DataSourceId,
      _PageIndex: pageCurrent.value,
      _PageSize: pageSize.value,
      _SearchEqual: SearchEqual,
      _Search: Search,
      _Where: TableSearchWhere,
    })
  } else {
    res = await Microi.FormEngine.GetTableData({
      ModuleEngineKey: props.currentFieldsConfig.TableChildSysMenuId || props.currentFieldsConfig.OpenTable.SysMenuId,
      _PageIndex: pageCurrent.value,
      _PageSize: pageSize.value,
      _SearchEqual: SearchEqual,
      _Search: Search,
      _Where: TableSearchWhere,
    });
  }
  if (res.Code == 1) {
    Microi.HideLoading()
    loading.value = false
    var data = await Promise.all(res.Data.map(item => handleFormDetail(item, diyFormFields.value)));
    NewChildList.value = data
    total.value = res.DataCount
    V8.CurrentTableData = NewChildList.value; // 当前表格数据
  } else {
    Microi.HideLoading()
    loading.value = false
  }
  nextTick(async () => {
    if (NewChildList.value.length > 0) {
      // 执行表单初始化事件
      initV8Init(NewChildList.value[0], diyFormFields.value);
      // await RunV8Code(DiyTableData.value.InFormV8)
      // 处理表单验证规则
      const data = []
      // 循环对象，获取字段配置
      for (let key in V8.Field) {
        if (V8.Field[key].Name) {
          data.push(V8.Field[key])
        }
      }
      NewformFields.value = data
    }
  })
}
// 获取当前模块设计数据
const getFormMenuData = async () => {
  Microi.ShowLoading('加载中···')
  const res = await Microi.FormEngine.GetFormData({
    FormEngineKey: 'Sys_Menu',
    Id: props.currentFieldsConfig.TableChildSysMenuId || props.currentFieldsConfig.OpenTable.SysMenuId
  })
  if (res.Code == 1) {
    Microi.HideLoading()
    MenuId.value = res.Data.Id // 模块ID
    DiyTableId.value = res.Data.DiyTableId // 表单ID
    DiyTableData.value = await DiyTableModule({Id: DiyTableId.value}) // 获取自定义表单
    // 是否开启表内编辑
    InTableEdit.value = props.ParentdiyFormFields[props.ParentIndex].Readonly ? false : res.Data.InTableEdit
    // 表内可编辑字段
    InTableEditFields.value = JSON.parse(res.Data.InTableEditFields)
    const MoreBtns1 = JSON.parse(res.Data.MoreBtns)
    MoreBtns.value = MoreBtns1.concat(MoreBtns.value) // 显示行更多按钮
    searchList.value = JSON.parse(res.Data.SearchFieldIds) // 搜索条件列表
    const NotShowFields = JSON.parse(res.Data.NotShowFields) // 不显示的字段
    let SelectFields = JSON.parse(res.Data?.SelectFields)?.map(item => item.Id)
    let NotSelectFields = []
    if (SelectFields?.length > 0) {
      NotSelectFields = SelectFields.concat(createData.map(item => item.Name)) // 查询列的字段
    }
    const formFields = await diyFormField({ TableId: DiyTableId.value }) // 获取表单字段
    const arr = formFields?.concat(createData)
    // 过滤查询里面不显示字段的数据
    if (NotShowFields?.length > 0) { // 如果有不显示的字段，则过滤掉
      NotSelectFields = NotSelectFields.filter(item => !NotShowFields.includes(item))
      // diyFormFields.value = arr.filter(item => !NotShowFields.includes(item.Id || item.Name))
    }
    if (NotSelectFields?.length > 0) { // 如果有查询列的字段，则过滤掉
      // const selectArr = SelectFields.concat(createData.map(item => item.Name))
      diyFormFields.value = arr.filter(item => NotSelectFields.includes(item.Id || item.Name))
    } else if (NotShowFields?.length > 0) { // 如果有不显示的字段，则显示全部字段
      diyFormFields.value = arr.filter(item => !NotShowFields.includes(item.Id || item.Name))
    } else {
      diyFormFields.value = arr
    }
    getPageAuth()
    nextTick(() => {
      NewformFields.value = diyFormFields.value
      // 存储子表新增模式
      const obj = {
        DiyTableId: DiyTableId.value,
        AddBtnType: JSON.parse(res.Data.DiyConfig)?.AddBtnType || '',
      }
      store.commit('tableEdit/SET_CHILD_SYS_MENU', obj)

    })
  }
  Microi.HideLoading()
}

// 分页
const change = (page) => {
  pageCurrent.value = page.current
  uni.setStorageSync('isChildType', '')
  GetData()
}
// 表内编辑提交更新数据
const handleEditOK = () => {
  console.log('handleInTableEditOK')
  GetData()
}
// 注入父组件方法
provide('handleEditOK', handleEditOK)
// 操作
const goEdit = (id, type, row) => {
  console.log('goEdit', id, type)
  if (type == 1) { // 编辑
    // emits('handleEdit',{id:id, DiyTableId: DiyTableId.value, type: 'edit'})
    parentMethod({ id: id, DiyTableId: DiyTableId.value, type: 'Edit' })
    uni.setStorageSync('isChildType', 'Edit')
  } else if (type == 2) { // 删除
    parentMethod({ id: id, DiyTableId: DiyTableId.value, type: 'Del' })
    uni.setStorageSync('isChildType', 'Del')
    uni.showModal({
      title: "提示",
      content: `确认删除？`,
      success: async (res) => {
        if (res.confirm) {
          const res = await Microi.FormEngine.DelFormData({
            TableId: DiyTableId.value,
            Id: id
          })
          if (res.Code == 1) {
            uni.showToast({
              title: '删除成功',
              icon: 'none',
            })
            GetData()
          } else {
            uni.showToast({
              title: '删除失败',
              icon: 'none'
            })
          }
        }
      }
    })
  } else if (type == 3) { // 详情
    uni.setStorageSync('isChildType', '')
    Microi.RouterPush(`/pages/workbench/work-detail/index?DiyTableId=${DiyTableId.value}&Id=${id}`, true)
  } else if (type == 4) { // 新增
    // emits('handleEdit',{id:null, DiyTableId: DiyTableId.value, type: 'add'})
    parentMethod({ id: id, DiyTableId: DiyTableId.value, type: 'Add' })
    uni.setStorageSync('isChildType', 'Add')
  } else {
    uni.setStorageSync('isChildType', '')
    V8.TableRowSelected = row;
    // console.log('V8.TableRowSelected', props.currentFieldsConfig.TableChildRowClickV8)
    // 执行行点击V8事件
    initV8Init(row, NewformFields.value, 'Edit')
    RunV8Code(props.currentFieldsConfig.TableChildRowClickV8)
  }
}
// 点击更多按钮
const goBtn = (btn, formData) => {
  if (btn.V8Code) {
    initV8Init(formData, NewformFields.value);
    RunV8Code(btn.V8Code);
  }
  // 如果是编辑按钮，则去编辑
  if (btn.Id == 'Edit') {
    goEdit(formData.Id, 1)
  } else if (btn.Id == 'Del') {
    goEdit(formData.Id, 2)
  } else if (btn.Id == 'Detail') {
    goEdit(formData.Id, 3)
  }
  // 关闭下拉框
  activeDropdown.value = null
}
// 打开表单
const OpenForm = (formData, type) => {
  console.log('OpenForm', formData, type)
  initV8Init(formData, NewformFields.value, type);
  if (type == 'Edit') {
    goEdit(formData.Id, 1)
  }
}
// 获取当前页面权限
const getPageAuth = () => {
  currentPermission.value = getAuthList(MenuId.value)
  const showAction = computed(() => {
    return MoreBtns.value.some(item => {
      if (item.Id == 'Detail') {
        return !currentPermission.value.includes('NoDetail')
      } else {
        return currentPermission.value.includes(item.Id)
      }
    })
  })
  isShowMoreBtn.value = showAction.value
}

// 选择变化
const selectionChange = (selection) => {
  const arr = selection.detail.index.map(item => NewChildList.value[item])
  V8.TableRowSelected = arr;
}

// 切换下拉菜单显示状态
const toggleDropdown = (index) => {
  activeDropdown.value = activeDropdown.value === index ? null : index
}

// 点击其他地方关闭下拉菜单
const closeDropdown = (e) => {
  if (!e.target.closest('.type-selector') && !e.target.closest('.type-dropdown')) {
    activeDropdown.value = null
  }
}

onMounted(() => {
nextTick(() => {
  setTimeout(async() => {
    Search = props.TableSearchList
    TableSearchWhere = props.TableSearchWhere
    NewChildList.value = []
    if (TableChildFkFieldName) {
      SearchEqual[TableChildFkFieldName] = childField ? (props.ParentFormData[childField] || '') : props.ParentFormData.Id
    }
    await getFormMenuData()
    await GetData()
    V8.OpenForm = OpenForm;
    V8.ParentForm = props.ParentFormData;
    V8.InitParentV8(props.ParentFormData, props.ParentdiyFormFields); // 初始化父表单数据
    V8.ParentV8 = props.ParentV8; // 初始化父表单数据
  })
  // 监听ParentFormData变化
  watch(() => props.ParentFormData, (newValue, oldValue) => {
    // console.log('table11', props)
    V8.CurrentTableData = NewChildList.value; // 当前表格数据
    V8.ParentV8 = props.ParentV8; // 初始化父表单数据
    V8.InitParentV8(newValue, props.ParentdiyFormFields); // 初始化父表单数据
    if (newValue[childField] != oldChildField) {
      oldChildField = newValue[childField] // 旧的子表主键字段
      if (TableChildFkFieldName) {
      SearchEqual[TableChildFkFieldName] = childField ? newValue[childField] : newValue.Id
      }
      Guid = childField ? newValue[childField] : newValue.Id
      GetData()
    }
  }, { deep: true })
})
document.addEventListener('click', closeDropdown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
})

defineExpose({
  GetData
})
</script>
<style lang="scss" scoped>
.table-btn {
  flex-wrap: wrap;
}
.table-item-btn{
  width: 65px;
}
.item-Img {
  width: 80px;
  height: 80px;
}
.text-red{
  color: red;
}
.work-list {
  margin: 0 2px 20rpx 2px;
  background: #F5F8FF;
  border-radius: 10rpx;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 25rpx;
}
.type-selector {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.3s;
  
  &:hover {
    background-color: rgba(65, 121, 247, 0.1);
  }
}

.type-dropdown {
  position: absolute;
  right: 25rpx;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  margin-top: 4px;
  min-width: 100px;
}

.dropdown-item {
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.3s;
  
  &:hover {
    background-color: rgba(65, 121, 247, 0.1);
  }
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.3s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>