<template>
  <view class="container">
    <block v-if="diyFormFields.length > 0 && isShow" >
      <block v-if="DiyTableData.Name == 'Diy_Notice'" class="apply_detail_item">
        <view class="detail_title">
          {{ detail.Biaoti || '' }}
        </view>
        <view class="detail_date">发布时间：{{detail.CreateTime||''}}</view>
        <view class="detail_content" v-html="detail.Neirong || ''"></view>
      </block>
      <block v-else>
        <view class="work-list">
          <cardDetail :diyFormFields="diyFormFields" :detail="detail" :type="typeModel" :InTableEdit="InTableEdit" :InTableEditFields="InTableEditFields" :DiyTableId="DiyTableId" :Guid="detail.Id" :TableSearchList="TableSearchList" :DiyTableData="DiyTableData" :FieldsConfig="FieldsConfig" :ParentV8="ParentV8" />
        </view>
      </block>
    </block>
    <template v-if="FlowType && diyFormFields.length > 0 && isShow">
      <flow-detail :wkHistoryData="wkHistoryData" :UserPublicInfo="UserPublicInfo" />
    </template>
    <view class="uni-tabbar-height"></view>
    <view class="uni-flex sub-btn" v-if="FlowType != 'WFWork' && diyFormFields.length > 0 && FlowState == 'Running' && StartWorkData.AllowRecall == 1">
      <button type="gray" @click="showRecallDialog()" style="width: 50%; margin-left: 10px;">撤回</button>
    </view>
    <view class="uni-flex sub-btn" v-if="FlowType == 'WFWork' && diyFormFields.length > 0 && isShow && WorkState == 'Todo'">
      <button type="gray" @click="clickAgree('Disagree')" style="width: 50%;margin-right: 10px;color:#888;">拒绝</button>
      <button type="gray" @click="clickAgree('Transfer')" style="width: 50%; margin-left: 10px;" v-if="StartWorkData.AllowHandOver == 1">移交</button>
	  <button type="primary" @click="clickAgree('Agree')" style="width: 100%; ">同意</button>
    </view>
    <movable-area class="movable-container">
			<movable-view class="movable-fab" direction="all" :x="initialX" :y="initialY" :inertia="true" :out-of-bounds="false" :damping="50">
				<uni-fab ref="fab" :pattern="pattern" :content="newContent" horizontal="right" vertical="bottom"
			direction="horizontal" @trigger="trigger" v-if="newContent.length > 0" />
			</movable-view>
		</movable-area>
    <uni-popup ref="popupTable" type="bottom" border-radius="10px 10px 0 0">
      <view class="popup-box">
        <view class="popup-content uni-common-pb">
          <view class="popup-close" @click="popupTable.close()">
            <uni-icons type="closeempty" size="30px" color="#999" /> 
          </view>
          <child-form :OpenAnyFormData="OpenAnyFormData" @ChildSubmitOk="ChildSubmitOk" />
        </view> 
      </view>
    </uni-popup>
    <!-- 处理流程弹窗 -->
    <uni-popup ref="showNormalPopup" type="bottom" border-radius="10px 10px 0 0">
      <view class="popup-box">
        <view class="popup-content uni-common-pb" style="height: auto;">
          <view class="popup-close" @click="showNormalPopup.close()">
            <uni-icons type="closeempty" size="30px" color="#999" /> 
          </view>
          <view class="uni-common-p">
            <view class="uni-common-mt" v-if="CurrentApprovalType == 'Disagree'">
              <uni-combox :candidates="ReturnNodeData" placeholder="请选择退回节点" v-model="ReturnNode"></uni-combox>
            </view>
            <view class="uni-common-mt" v-if="CurrentApprovalType == 'Transfer'">
              <!-- <uni-combox :candidates="UserData" placeholder="指定移交人" v-model="TransferUserId"></uni-combox> -->
              <zxz-uni-data-select v-model="TransferUserId"
              :localdata="UserData" 
              :multiple = "true"
              dataValue="Id"
              dataKey="Name"
              filterable 
              @change="handleSelectChange"></zxz-uni-data-select>
            </view>
            <view class="uni-common-mt">
              <uni-easyinput type="textarea" autoHeight v-model="Comment" placeholder="请输入意见/评论" />
            </view>
            <view class="uni-common-mt">
              <button type="primary" @click="clickSendWork" :loading="BtnLoading">确认{{CurrentApprovalType == 'Agree' ? '同意' : '拒绝'}}</button>
            </view>
          </view>
        </view> 
      </view>
    </uni-popup>
     <!-- 撤回弹窗 -->
     <uni-popup ref="recallPopup" type="dialog">
      <uni-popup-dialog type="info" cancelText="关闭" confirmText="同意" title="撤回工作" content="确认撤回吗？" @confirm="submitRecall"
					@close="closeRecallDialog"></uni-popup-dialog>
      <!-- <uni-popup-dialog 
        title="撤回工作" 
        :before-close="true" 
        @confirm="submitRecall" 
        @close="closeRecallDialog">
        <view class="dialog-content">
          <view class="input-item">
            <text>撤回原因：</text>
            <textarea v-model="recallForm.ApprovalIdea" placeholder="请输入撤回原因" class="recall-textarea"></textarea>
          </view>
        </view>
      </uni-popup-dialog> -->
    </uni-popup>
  </view>
</template>

<script setup>
import { onLoad, onShow } from '@dcloudio/uni-app';
import { ref, reactive, inject } from 'vue'
import { diyFormField, DiyTableModule, handleFormDetail, getAuthList, deepCopyFunction, RunV8Code, getApiUrl, handleFormSubmit } from '@/utils'
import { setFormField } from '@/utils/formFieldUtils'
import cardDetail from '@/FormComponents/cardDetail.vue';
import childForm from '../work-add/index.vue';
import flowDetail from '@/FormComponents/flowDetail.vue';
import { useStore } from 'vuex';
const store = useStore();
const Microi = inject('Microi'); // 使用注入Microi实例
const userInfo = ref(Microi.GetCurrentUser()) // 用户信息
const V8 = inject('V8'); // 使用注入Microi实例
const diyFormFields = ref([]); // 自定义表单字段
const detail = ref({}); // 详情数据
const DiyTableId = ref('') // 自定义表单ID
const Id = ref('') // 详情ID
const typeModel = ref('View')
let DiyTableData = {} // 自定义表单数据
const isShow = ref(false) // 是否显示详情
const currentPermission = ref([]) // 当前用户权限
const MenuId = ref('') // 菜单ID
const FlowId = ref('') // 流程ID
const WorkId = ref('') // 工作ID
const FlowType = ref('') // 流程类型
const NodeId = ref('') // 流程节点ID
const StartWorkData = ref({}) // 工作流节点数据
const content = [{
						iconPath: '/static/icons/fab.png',
						selectedIconPath: '/static/icons/fab.png',
						text: '编辑',
            value: 'Edit',
						active: false
					},
					{
						iconPath: '/static/icons/fab.png',
						selectedIconPath: '/static/icons/fab.png',
						text: '删除',
            value: 'Del',
						active: false
					}
				]
const newContent = ref([]) // 过滤后的按钮
const pattern = {
  color: '#7A7E83',
  backgroundColor: '#fff',
  selectedColor: '#007AFF',
  buttonColor: '#007AFF',
  iconColor: '#fff',
  icon: 'compose'
} // 按钮模式
const TableSearchList = ref({}) // 父对子表的操作，搜索列表
const popupTable = ref(null) // 新增子表弹窗
const OpenAnyFormData = ref({}) // 打开任意表单数据
const showNormalPopup = ref(null) // 处理流程弹窗
const CurrentApprovalType = ref('') // 当前审批类型
const ReturnNodeData = ref([]) // 退回节点数据
const FieldsConfig = ref([]) // 字段配置
const InTableEdit = ref(false) // 是否开启表内编辑
const InTableEditFields = ref([]) // 表内可编辑字段
const NoticeFields = ref([]) // 通知字段
const Comment = ref('') // 意见/评论
const ReturnNode = ref('') // 退回节点
const BackNodes = ref([]) // 退回节点数据
const BtnLoading = ref(false) // 按钮加载
const wkHistoryData = ref([]) // 流程历史记录
const UserPublicInfo = ref([]) // 流程历史记录-用户信息
const FlowState = ref('') // 流程进度状态
const UserData = ref([]) // 用户数据
const TransferUserId = ref([]) // 指定移交人
const ParentV8 = ref(null) // 父级v8环境
const WorkState = ref('') // 工作状态
// 撤回相关数据
const recallPopup = ref(null)
const recallForm = reactive({
  WorkId: '',
  FlowId: '',
  ApprovalIdea: ''
})
// 悬浮按钮初始位置
const initialX = ref(uni.getSystemInfoSync().windowWidth - 100)
const initialY = ref(uni.getSystemInfoSync().windowHeight - 100)
// 获取数据详情
const getDetail = async () => {
  let ApiReplace = JSON.parse(DiyTableData.ApiReplace)
  let res = {}
  let obj = {
    FormEngineKey: DiyTableData.Name,
    Id: Id.value
  }
  // 如果查询接口有替换参数，则替换
  if (ApiReplace && ApiReplace.Select) {
    res = await Microi.Post(ApiReplace.Select, obj, function(){
    },{DataType: "form"})
  } else {
    res = await Microi.FormEngine.GetFormData(obj)
  }
  if (res.Code == 1) {
    detail.value = await handleFormDetail(res.Data, diyFormFields.value)
    await initV8()
    // 先获取流程表单数据（这会设置 NodeId）
    await getFlowFormData()
    // 再获取流程配置
    await getFlowConfig()
    // 最后再显示表单
    isShow.value = true
  } else if (res.Code == 2) {
    uni.showModal({
      title: '提示',
      content: '数据不存在',
      showCancel: false,
      success: (res) => {
        if (res.confirm) {
          deleteFlowData()
          setTimeout(() => {
          uni.navigateBack()
          }, 500)
        }
      }
    })
  } else {
    uni.showToast({
      title: '获取详情失败',
      icon: 'none'
    })
  }
}
// 如果数据不存在，则删除这条流程数据
const deleteFlowData = async () => {
  const res = await Microi.ApiEngine.Run('deleteFlow',{
    Id: Id.value
  })
}
// 表单初始化执行v8code
const initV8 = async () => {
  V8.TableSearchAppend = TableSearchAppend // 绑定父对子表的操作，搜索
  V8.TableSearchSet = TableSearchSet // 绑定父对子表的操作，搜索
  V8.OpenAnyForm = OpenAnyForm; // 绑定打开任意表单
  V8.FieldSet = FieldSet
  let initParentV8 = deepCopyFunction(V8.Init(detail.value, diyFormFields.value, 'View'));
  ParentV8.value = {...initParentV8}; // 保存父级v8环境
  await RunV8Code(DiyTableData.InFormV8) // 表单初始化执行v8code
}
// 父对子表的操作，搜索
const TableSearchAppend = (item, obj) => {
  TableSearchList.value[item.Name] = obj;
}
// 父对子表的操作，搜索
const TableSearchSet = (item, obj) => {
  TableSearchList.value[item.Name] = obj;
}
// 获取自定义表单字段
const getDiyFormFields = async () => {
  Microi.ShowLoading('加载中···')
  const formFields = await diyFormField({TableId: DiyTableId.value}) // 获取表单字段
  diyFormFields.value = formFields
  DiyTableData = await DiyTableModule({Id: DiyTableId.value}) // 获取自定义表单
  getDetail()
  Microi.HideLoading()
}
// 触发按钮
const trigger = async (e) => {
  if (e.item.text === '删除') {
    deleteData()
  }
  else if (e.item.text === '编辑') {
    Microi.RouterPush(`/pages/workbench/work-add/index?DiyTableId=${DiyTableId.value}&Id=${Id.value}&type=Edit`)
  } else {
    V8.Init(detail.value, diyFormFields.value, 'view') // 表单初始化
    await RunV8Code(e.item.V8Code)
  }
}
// 删除方法
const deleteData = async () => {
  // 是否要删除
  uni.showModal({ //提醒用户更新
			title: "提示",
			content: `确认删除？`,
			success: async (res) => {
				if (res.confirm) {
          const resDel = await Microi.FormEngine.DelFormData({
            FormEngineKey: DiyTableData.Name,
            Id: Id.value
          })
          if (resDel.Code == 1) {
            uni.showToast({
							title: '删除成功',
							icon: 'none',
						})
            uni.navigateBack()
          } else {
            uni.showToast({
							title: '删除失败',
							icon: 'none',
						})
          }
        }
      }
    })
}
/**
 * 打开任意表单
**/
const OpenAnyForm = (params) => {
  console.log('OpenAnyForm',params,V8.Form)
  popupTable.value.open()
  OpenAnyFormData.value = params
  V8.DataAppend = params.DataAppend
}
// 子表提交啦
const ChildSubmitOk = async () => {
  popupTable.value.close()
  getDetail()
}
// 同意或拒绝
const clickAgree = async (type) => {
  CurrentApprovalType.value = type
  showNormalPopup.value.open()
}
// 获取流程表单数据
const getFlowFormData = async () => {
  // if (FlowType.value == "ViewWork" || FlowType.value == "") return
  const res = await Microi.FormEngine.GetFormData({
    FormEngineKey: 'WF_Work',
    _SearchEqual: {
      TableRowId: Id.value,
      ReceiverId: Microi.GetCurrentUser().Id
    }
  })
  if (res.Code == 1) {
    WorkId.value = res.Data.Id
    FlowId.value = res.Data.FlowId
    NodeId.value = res.Data.NodeId
    WorkState.value = res.Data.WorkState // 工作状态
  }
}
// 获取流程节点配置
const getFlowConfig = async () => {
  if (!NodeId.value) return 
  const res = await Microi.Post(getApiUrl('getWFNodeModel'), {
    NodeId: NodeId.value,
  }, function(){
  },{DataType: "form"})
  if (res.Code == 1) {
    StartWorkData.value = res.Data // 流程节点数据
    BackNodes.value = JSON.parse(res.Data.BackNodes) ?? [] // 退回节点数据
    ReturnNodeData.value = BackNodes.value.map(i => i.NodeName) // 退回节点数据
    if (FlowState.value != 'End') {
      FieldsConfig.value = JSON.parse(res.Data.FieldsConfig) ?? [] // 表单字段配置
    }
    NoticeFields.value = FieldsConfig.value.filter(i => i.Notice) // 通知字段
    InTableEditFields.value = FieldsConfig.value.filter(i => i.Edit).map(i => i.Id) // 是否开启表内编辑
    if (InTableEditFields.value.length > 0 && FlowType.value == "WFWork" && WorkState.value == "Todo") {
      typeModel.value = 'edit' // 编辑模式
      InTableEdit.value = true // 开启表内编辑
      // 存储子表新增模式
      const obj = {
        DiyTableId: DiyTableId.value,
        AddBtnType: 'InTableFlow',
      }
      store.commit('tableEdit/SET_CHILD_SYS_MENU', obj)
    }
    console.log('FlowType',FlowType.value, diyFormFields.value.length, FlowState.value, StartWorkData.value.AllowRecall)
    // 是否移交
    if (StartWorkData.value.AllowHandOver == 1) {
      getUserInfo()
    }
  }
}
// 获取流程历史记录
const getFlowHistory = async () => {
  if (!FlowId.value) return 
  const res = await Microi.Post(getApiUrl('getWFHistory'), {
    FlowId: FlowId.value,
  }, function(){
  },{DataType: "form"})
  if (res.Code == 1) {
    wkHistoryData.value = res.Data
    GetSysUserPublicInfo()
  }
}
// 获取流程用户信息
const GetSysUserPublicInfo = async () => {
  if (!FlowId.value) return 
  const Ids = wkHistoryData.value.map(i => i.UserId)
  const res = await Microi.Post(Microi.Api.GetSysUserPublicInfo, {
    Ids: Ids,
  }, function(){
  },{DataType: "form"})
  if (res.Code == 1) {
    UserPublicInfo.value = res.Data
  }
}
// 获取流程表单进度状态
const getFlowStatus = async () => {
  if (!FlowType.value) return
  const res = await Microi.FormEngine.GetFormData({
    FormEngineKey: 'WF_Flow',
    _SearchEqual: {
      TableRowId: Id.value
    }
  })
  if (res.Code == 1) {
    FlowState.value = res.Data.FlowState // 流程进度状态
    // if (FlowState.value == 'End') {
    //   FlowType.value = 'ViewWork' // 流程结束，只读
    // }
    FlowId.value = res.Data.FlowId || res.Data.Id // 流程ID
    NodeId.value = res.Data.NodeId
  } else {
    FlowType.value = 'ViewWork'
  }
}
// 表单提交
const sunbmintUptFormData = async () => {
  if (!InTableEdit.value) return // 不是表内编辑模式下，不提交表单数据
  // 提交表单数据
  const formData = handleFormSubmit(detail.value, diyFormFields.value)
  const res = await Microi.FormEngine.UptFormData({
    FormEngineKey: DiyTableData.Name,
    Id: Id.value,
    _FormData: formData
  })
}
// 批量修改子表表单数据
const batchUptChildFormData = async () => {
  return new Promise( async (resolve) => {
    let hasMissingRequiredField = false; // 用于跟踪是否有必填项未填写
    const { Child_TableData_Edit, Child_Table_Required } = store.state.tableEdit
    const currentFormChild = Child_TableData_Edit[Id.value]
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
          if (V8.IsNull(item._FormData[field])) {
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
      let res = await Microi.FormEngine.UptFormDataBatch(arrlist)
      if (res.Code == 1) {
        resolve(true)
      } else {
        uni.showToast({
          title: '批量修改子表数据失败',
          icon: 'none',
        })
      }
    }
  })
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
// 点击提交处理流程
const clickSendWork = async () => {
  // 获取必填项
  const formRules = diyFormFields.value.filter(i => i.NotEmpty && InTableEditFields.value.includes(i.Id))
  // 判断必填项是否填写
  const validateForm = async () => {
    for (let i of formRules) {
      if (V8.IsNull(detail.value[i.Name])) {
        uni.showToast({
          title: `${i.Label}不能为空`,
          icon: 'none'
        })
        return false
      }
    }
    await sunbmintUptFormData()
    const childFormResult = await batchUptChildFormData()
    return childFormResult
  }
  let shouldContinue = await validateForm()
  if (!shouldContinue) return
    let BackNodeId = ''
    if (ReturnNode.value && BackNodes.value.length > 0) {
      BackNodeId = BackNodes.value.filter(i => i.NodeName == ReturnNode.value)[0].Id
    }
		BtnLoading.value = true
    // 开始V8流程
    if (StartWorkData.value.StartV8) {
      await RunV8Code(StartWorkData.value.StartV8)
    }
    const formData = handleFormSubmit(detail.value, diyFormFields.value) // 表单数据
    const obj = {
      WorkId: WorkId.value, // 流程ID
      FormData: JSON.stringify(formData), // 表单数据
      ApprovalType: CurrentApprovalType.value, // 审批类型
      BackNodeId: BackNodeId, // 退回节点ID
      FlowId: FlowId.value, // 流程ID
      ApprovalIdea: Comment.value, // 意见/评论
      ForceSelectUsers: V8.WF.ForceSelectUsers || [], //强制选择的用户，可选
      NoticeFields: JSON.stringify(transformNoticeFields(NoticeFields.value)) // 通知字段
    }
    console.log(obj)
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2]; // 获取上一个页面
    console.log(prevPage,'prevPage')
    // 判断是否为移交操作
    if (CurrentApprovalType.value === 'Transfer') {
      const handoverObj = {
        WorkId: WorkId.value,
        FlowId: FlowId.value,
        ApprovalIdea: Comment.value,
        AddUsers: TransferUserId.value,
        FormData: JSON.stringify(V8.Form)
      }
      
      const res = await Microi.Post(getApiUrl('handOverWork'), handoverObj, function(){}, {DataType: "form"})
      console.log(res, '移交')
      if (res.Code == 1) {
        // 结束V8流程
        if (StartWorkData.value.EndV8) {
          await RunV8Code(StartWorkData.value.EndV8)
        }
        uni.showToast({
          title: '移交成功',
          icon: 'none'
        })
        showNormalPopup.value.close();
        BtnLoading.value = false;
        if (prevPage) {
          uni.navigateBack()
        } else {
          // 如果是大虹crm这返回到工单管理列表
          if (Microi.OsClient == 'dahongcrm' ) {
            uni.redirectTo({ url: '/pages/workbench/work-list/index?MenuId=5a85ae80-37a9-4612-a21d-f6946a5ecf58&MenuName=工单管理' })
          } else {
            uni.redirectTo({ url: '/pages/workbench/work-todo/index' })
          }
        }
      } else {
        uni.showToast({
          title: res.Msg,
          icon: 'none'
        })
        BtnLoading.value = false;
      }
      return
    }

		const res = await Microi.Post(getApiUrl('sendWorkFlow'), {
    ...obj,
    }, function(){
    },{DataType: "form"})
		console.log(res,'提交')
		if (res.Code == 1) {
      // 结束V8流程
      if (StartWorkData.value.EndV8) {
        await RunV8Code(StartWorkData.value.EndV8)
      }
			uni.showToast({
				title: '提交成功',
				icon: 'none'
			})
			showNormalPopup.value.close();
			BtnLoading.value = false;
      if (prevPage) {
        uni.navigateBack()
      } else {
        // 如果是大虹crm这返回到工单管理列表
        if (Microi.OsClient == 'dahongcrm' ) {
          uni.redirectTo({ url: '/pages/workbench/work-list/index?MenuId=5a85ae80-37a9-4612-a21d-f6946a5ecf58&MenuName=工单管理' })
        } else {
          uni.redirectTo({ url: '/pages/workbench/work-todo/index' })
        }
      }
		} else {
			uni.showToast({
				title: res.Msg,
				icon: 'none'
			})
			BtnLoading.value = false;
		}
	}
// 设置字段值的函数
const FieldSet = (fieldName, value, field) => {
  diyFormFields.value = setFormField(fieldName, value, field, V8, diyFormFields.value)
}
// 获取用户信息
const getUserInfo = async () => {
  const res = await Microi.Post(Microi.Api.GetSysUser)
  if (res.Code == 1) {
    UserData.value = res.Data
  }
}
// 选择用户
const handleSelectChange = (e) => {
  TransferUserId.value = e.map(i => i.Id)
}
// 显示撤回弹窗
const showRecallDialog = (item) => {
  recallForm.WorkId = WorkId.value
  recallForm.FlowId = FlowId.value
  recallForm.ApprovalIdea = ''
  recallPopup.value.open()
}
// 关闭撤回弹窗
const closeRecallDialog = () => {
  recallPopup.value.close()
}
// 提交撤回
const submitRecall = async () => {
  // if (!recallForm.ApprovalIdea.trim()) {
  //   uni.showToast({
  //     title: '请输入撤回原因',
  //     icon: 'none'
  //   })
  //   return
  // }
  
  try {
    V8.WF.ApprovalType = 'Recall'
    // 开始V8流程
    if (StartWorkData.value.StartV8) {
      await RunV8Code(StartWorkData.value.StartV8)
    }

    const handoverObj = {
      WorkId: recallForm.WorkId,
      FlowId: recallForm.FlowId,
      ApprovalIdea: recallForm.ApprovalIdea
    }
    
    const res = await Microi.Post(getApiUrl('recallWork'), handoverObj, function(){}, {DataType: "form"})
    
    if (res.Code == 1) {
      // 结束V8流程
      if (StartWorkData.value.EndV8) {
        await RunV8Code(StartWorkData.value.EndV8)
      }
      
      Microi.Tips('撤回成功')
      // 关闭弹窗
      closeRecallDialog()
      // 关闭当前页面，跳到待办列表
      // 如果是大虹crm这返回到工单管理列表
      if (Microi.OsClient == 'dahongcrm' ) {
        uni.redirectTo({ url: '/pages/workbench/work-list/index?MenuId=5a85ae80-37a9-4612-a21d-f6946a5ecf58&MenuName=工单管理' })
      } else {
        uni.redirectTo({ url: '/pages/workbench/work-todo/index' })
      }
    } else {
      closeRecallDialog()
      Microi.Tips(res.Msg || '撤回失败', false)
    }
  } catch (error) {
    console.error('撤回失败:', error)
    uni.showToast({
      title: '撤回失败，请稍后再试',
      icon: 'none'
    })
  }
}
onLoad(async (options) => {
  console.log(options)
  DiyTableId.value = options.DiyTableId // 自定义表单ID
  Id.value = options.Id // 详情ID
  MenuId.value = options.MenuId // 菜单ID
  WorkId.value = options.WorkId // 工作ID
  // FlowId.value = options.FlowId // 流程ID
  FlowType.value = options.FlowType // 流程类型
  // NodeId.value = options.NodeId // 流程节点ID
  if (uni.getStorageSync('FormBtns')) {
    const FormBtns = JSON.parse(uni.getStorageSync('FormBtns')) ?? []
    FormBtns?.forEach(item => {
      content.push({
        iconPath: '/static/icons/fab.png' || item.Icon,
        selectedIconPath: '/static/icons/fab.png' || item.SelectedIcon,
        text: item.Name,
        value: item.Id,
        active: false,
        V8Code: item.V8Code
      })
    })
  }
  getDiyFormFields() // 获取自定义表单字段
  getPageAuth() // 获取当前页面权限
  await getFlowStatus() // 获取流程表单进度状态
  // await getFlowFormData()
  await getFlowHistory() // 获取流程历史记录
  // getFlowConfig() // 获取流程节点配置
})
// 获取当前页面权限
const getPageAuth = () => {
  currentPermission.value = getAuthList(MenuId.value)
  content.map(item => {
    item.show = currentPermission.value.includes(item.value)
  })
  newContent.value = content.filter(item => item.show)
}
</script>

<style lang="scss" scoped>
.container{
  padding: 30rpx;
  min-height: 100vh;
  background-color: #fff;
  background-image: url('@/pages/tools/kaoqin/images/bg.jpg');
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
}
.work-list {
  margin-bottom: 20rpx;
  background: #fff;
  border-radius: 10rpx;
  box-shadow: 0px 20px 60px rgba(102, 127, 191, 0.2);
  padding: 25rpx;
}

.detail_title {
	font-size: 32rpx;
	padding: 15rpx 0;
}
.detail_date {
	font-size: 24rpx;
	margin:15rpx 0;
	padding-left: 20rpx;
	color:#888;
	border-left: orange 10rpx solid;
	border-top-top-radius:20rpx;
	border-bottom-top-radius:20rpx;
	
}
.detail_content {
	padding:30rpx 0;
	margin:30rpx 0;
	border-top: #eee 1rpx solid;
	font-size: 26rpx;
	line-height: 46rpx;
	color:#333;
}
.popup-box{
  height: 100vh;
  display: flex;
  align-items: flex-end;
  width:100%;
}
.popup-content{
width: 100%;
  background: #fff;
  height: 75vh;
  border-radius: 10px 10px 0 0;
  box-sizing: border-box;
}
.popup-close{
  position: relative;
  right: 10px;
  top: 10px;
  text-align: right;
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

/* 撤回弹窗样式 */
.dialog-content {
  padding: 10px 0;
  width: 100%;
}

.input-item {
  margin-bottom: 10px;
}

.recall-textarea {
  width: 100%;
  height: 100px;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 8px;
  margin-top: 5px;
  box-sizing: border-box;
}

.movable-container {
		position: fixed;
		bottom: 0;
		right: 0;
		z-index: 9;
		pointer-events: none; /* Allow touch events to pass through to underlying elements */
    width: 100%;
    height: 100%;
	}

	.movable-fab {
		width: 112rpx;  /* Slightly larger than the FAB button */
		height: 112rpx;
		pointer-events: auto; /* Receive touch events */
		z-index: 10;
	}
</style>