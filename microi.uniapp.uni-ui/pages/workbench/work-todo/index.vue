<template>
  <view>
    <view class="search-box">
      <uni-segmented-control :current="current" :values="formTabs" style-type="text" @clickItem="onClickItem" />
    </view>
    <view class="work-container">
      <view class="work-list" v-for="item in currentList.list" :key="item.Id" @click.stop="goDetail(item)">
        <view class="work-item">
          <text>标题：</text>
          <text>{{ item.FlowTitle }}</text>
        </view>
        <view class="work-item " v-if="GetNoticeFields(item.NoticeFields).length > 0">
          <text>内容：</text>
          <!-- <text>{{ item.NoticeFields }}</text> -->
          <view class="work-item-content">
            <view v-for="itemNotice in GetNoticeFields(item.NoticeFields)" :key="itemNotice.Label" class="uni-common-mt-xs">
              <!-- <uni-tag type="primary" :text="`${itemNotice.Label} : ${itemNotice.Value}`"></uni-tag> -->
              {{itemNotice.Label}} : {{itemNotice.Value}}
            </view>
          </view>
        </view>
        <view class="work-item" v-if="getCurrentTab == 'Todo'">
          <text>发送人：</text>
          <text>{{ item.FirstSender }}</text>
        </view>
        <view class="work-item">
          <text>发起人：</text>
          <text>{{ item.Sender }}</text>
        </view>
        <view class="work-item" v-if="getCurrentTab != 'Sender'">
          <text>节点名称：</text>
          <text>{{ GetNodeName(item) }}</text>
        </view>
        <view class="work-item" v-if="getCurrentTab != 'Todo'">
          <text>流程状态：</text>
          <!-- <text>{{ GetFlowState(item.FlowState) }}</text> -->
          <uni-tag :text="GetFlowState(item.FlowState)" size="small" circle :type="item.FlowState == 'Running'? 'primary' : item.FlowState == 'End'? 'success' : 'error'"></uni-tag>
        </view>
        <view class="work-item">
          <text>创建时间：</text>
          <text>{{ item.CreateTime }}</text>
        </view>
        <!-- <view v-if="item.FlowState == 'Running' && getCurrentTab != 'Todo'" class="text-right">
          <button @click.stop="showRecallDialog(item)" class="uni-button" size="mini"
            type="primary">撤回</button>
        </view> -->
      </view>
    </view>
    <view style="display: flex; flex-direction: column; justify-content: end; align-items: center; height: 40vh;"
      v-if="currentList.list.length == 0">
      <image src="/static/image/none.gif" style="width: 543rpx; height: 407rpx; "></image>
    </view>
    <uni-load-more :status="currentList.status" :content-text="contentText" />
    
    <!-- 撤回弹窗 -->
    <uni-popup ref="recallPopup" type="dialog">
      <uni-popup-dialog 
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
      </uni-popup-dialog>
    </uni-popup>
  </view>
</template>

<script setup>
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import { ref, onMounted, computed, reactive, inject } from 'vue'
import { getApiUrl } from '@/utils'
const Microi = inject('Microi')
const tabs = reactive([
  {
    label: '我的待办',
    WorkType: 'Todo'
  },
  {
    label: '我发起的',
    WorkType: 'Sender'
  },
  {
    label: '我处理的',
    WorkType: 'Done'
  }
])
const formTabs = computed(() => {
  return tabs.map(item => item.label)
})
const current = ref(0)
const todoList = reactive({
  'Todo': {
    list: [],
    pageIndex: 1,
    pageSize: 10,
    pageTotal: 0,
    status: 'more'
  },
  'Sender': {
    list: [],
    pageIndex: 1,
    pageSize: 10,
    pageTotal: 0,
    status: 'more'
  },
  'Done': {
    list: [],
    pageIndex: 1,
    pageSize: 10,
    pageTotal: 0,
    status: 'more'
  }
})
const contentText = ref({
    contentdown: '查看更多',
    contentrefresh: '加载中',
    contentnomore: '没有更多'
})
// 获取当前选项卡
const getCurrentTab = computed(() => {
  return tabs[current.value].WorkType
})
const currentList = computed(() => {
  return todoList[getCurrentTab.value]
})
// 点击选项卡
const onClickItem = (value) => {
  current.value = value.currentIndex
  getTodoList()
}
// 获取列表数据
const getTodoList = async () => {
  Microi.ShowLoading('加载中···')
  const res = await Microi.Post(getApiUrl(getCurrentTab.value == 'Todo' ? 'getWFWork' : 'getWFFlow'),{ 
    WorkType: getCurrentTab.value,
    _PageIndex: currentList.value.pageIndex,
    _PageSize: currentList.value.pageSize
  }, function(){
  },{DataType: "form"})
  if (res.Code === 1) {
    currentList.value.pageTotal = Math.ceil(res.DataCount/Number(currentList.value.pageSize))
    if (currentList.value.pageIndex === 1) {
      currentList.value.list = res.Data
      currentList.value.status = 'nomore'
    } else {
      currentList.value.list = currentList.value.list.concat(res.Data)
    }
  }
  Microi.HideLoading()
}
// 获取节点名称
const GetNodeName = (item) => {
  if (item.NodeName) {
    return item.NodeName
  }
  if (item.HandlerUsers) {
    const handlerUsers = JSON.parse(item.HandlerUsers)
    return handlerUsers.map(user => user.NodeName).join('、')
  }
  return ''
}
// 处理流程状态
const GetFlowState = (state) => {
  switch (state) {
    case 'Running':
      return '进行中'
    case 'End':
      return '已结束'
    case 'Cancel':
      return '已作废'
    default:
  }
}
// 获取通知字段
const GetNoticeFields = (NoticeFields) => {
		if (!NoticeFields) return []
		const arr = JSON.parse(NoticeFields)
		return arr
	}
// 去详情
const goDetail = (item) => {
  var FlowType = getCurrentTab.value == 'Todo' ? 'WFWork' : 'WFFlow'; //流程类型
  // var NodeId = item.NodeId || item.StartNodeId; //节点ID
  // var FlowId = item.FlowId || item.Id; //流程ID
  // Microi.RouterPush(`/pages/workbench/work-detail/index?DiyTableId=${item.TableId}&Id=${item.TableRowId}&WorkId=${item.Id}&FlowId=${FlowId}&FlowType=${FlowType}&NodeId=${NodeId}`,true)
  Microi.RouterPush(`/pages/workbench/work-detail/index?DiyTableId=${item.TableId}&Id=${item.TableRowId}&WorkId=${item.Id}&FlowType=${FlowType}`,true)
}

// 撤回相关数据
const recallPopup = ref(null)
const recallForm = reactive({
  WorkId: '',
  FlowId: '',
  ApprovalIdea: ''
})

// 显示撤回弹窗
const showRecallDialog = (item) => {
  getFlowFormData(item)
  recallForm.ApprovalIdea = ''
  recallPopup.value.open()
}
// 调用我的工作获取工作id
const getFlowFormData = async (item) => {
  const res = await Microi.FormEngine.GetFormData({
    FormEngineKey: 'WF_Work',
    _Where: [
      { Name: "WorkState", Value: "Done", Type: "=" },
      { Name: "ReceiverId", Value: Microi.GetCurrentUser().Id, Type: "=" },
      // { Name: "NodeId", Value: item.StartNodeId, Type: "=" },
      { Name: "FlowId", Value: item.Id, Type: "=" },
    ]
  })
  if (res.Code === 1) {
    recallForm.WorkId = res.Data.Id
    recallForm.FlowId = res.Data.FlowId
  }
}

// 关闭撤回弹窗
const closeRecallDialog = () => {
  recallPopup.value.close()
}

// 提交撤回
const submitRecall = async () => {
  if (!recallForm.ApprovalIdea.trim()) {
    uni.showToast({
      title: '请输入撤回原因',
      icon: 'none'
    })
    return
  }
  
  try {
    const handoverObj = {
      WorkId: recallForm.WorkId,
      FlowId: recallForm.FlowId,
      ApprovalIdea: recallForm.ApprovalIdea
    }
    
    const res = await Microi.Post(getApiUrl('recallWork'), handoverObj, function(){}, {DataType: "form"})
    
    if (res.Code == 1) {
      Microi.Tips('撤回成功')
      // 关闭弹窗
      closeRecallDialog()
      // 刷新列表
      getTodoList()
    } else {
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

onMounted(() => {
  getTodoList()
})
onShow(() => {
  getTodoList()
})
 // 下拉刷新
onPullDownRefresh (() => {
  currentList.value.pageIndex = 1
  currentList.value.list = []
  getTodoList()
  setTimeout(function() {
    uni.stopPullDownRefresh()
  }, 1000)
})
// 上拉加载
onReachBottom(() => {
  if (currentList.value.pageIndex === currentList.value.pageTotal) {
    currentList.value.status = 'nomore'
    return
  }
  currentList.value.status = 'loading'
  currentList.value.pageIndex++
  getTodoList()
})
</script>

<style scoped>
.work-container{
  margin: 20rpx;
  margin-top: 80px;
}
.work-list {
  margin-bottom: 20rpx;
  background: #fff;
  border-radius: 15rpx;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 25rpx;
}
.work-item{
  margin-bottom: 5px;
  font-size:28rpx;
}
.work-item text:nth-child(1) {
	color:#666;
	font-size: 26rpx;
	margin-right:10rpx;
}
.search-box{
  position: fixed;
  top: 0px;
  left: 0px;
  right: 0px;
  background: white;
  padding: 20px 10px 10px 10px;
  z-index: 2;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
::v-deep .segmented-control__text{
  font-size: 16px;
}
.work-item-content{
  background: #f5f5f5;
  padding: 10px 15px;
  border-radius: 10px;
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
</style>