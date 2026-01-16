<template>
  <view class="uni-container">
    <view class="search-box uni-common-mb">
      <view class="search-item uni-flex">
        <view class="search-input">
          <uni-easyinput prefixIcon="search" v-model="keyword" placeholder="搜索" @iconClick="getListData"
            @blur="getListData" @clear="onClear"></uni-easyinput>
        </view>
      </view>
    </view>
    <view v-if="diyFormFields && diyFormFields.length > 0">
      <view class="work-list" v-for="detail, in listData" :key="detail.Id">
        <view v-for="field in diyFormFields" :key="field.Id">
          <!-- 如果是图片 -->
          <view class="work-item" v-if="field.Component == 'ImgUpload' && detail[field.Name] && detail[field.Name].length > 0">
            <view class="work-item-label">{{ field.Label }}</view>
            <view class="uni-flex">
              <block v-for="item in detail[field.Name]" :key="item.Id">
                <image slot='cover' :src="item.url" class="item-Img"></image>
              </block>
            </view>
		  </view>
            <block v-else-if="detail[field.Name] && detail[field.Name].length >0">
				<block v-if="(detail['KaoqinLX'] == '出差考勤' && (field.Name == 'KehuMC' || field.Name == 'KaoqinD')) || (detail['KaoqinLX'] == '上下班考勤' && field.Name == 'KehuMC') || (detail['KaoqinLX'] != '上下班考勤' && field.Name == 'KaoqinD') || field.Name == 'Daka' || field.Name == 'UpdateTime' || field.Name == 'CreateTime' || field.Name == 'DakaRQ'">
				</block>
				<block v-else>
					<view class="work-item" v-if="field.Name != 'Guid'">
						<view class="work-item-label">
							<text v-if="field.Name == 'UserName'">打卡人</text>
							<text v-else>{{ field.Label }}</text>
						</view>
						<view class="item-value uni-flex">{{detail[field.Name]}}</view>
					</view>
				</block>
            </block>
            <block v-else>
              <view class="work-item" v-if="detail[field.Name]">
                <view class="work-item-label">
                  <text v-if="field.Name == 'UserName'">打卡人</text>
                  <text v-else>{{ field.Label }}</text>
                </view>
                <view class="item-value uni-flex">{{ detail[field.Name] }}</view>
              </view>
            </block>
        </view>
      </view>
    </view>
    <uni-load-more :status="status" :content-text="contentText" />
    <uni-fab ref="fab" :popMenu="popMenu" :pattern="pattern" :content="newContent" horizontal="right" vertical="bottom"
      direction="horizontal" @trigger="trigger" @fabClick="handleFab" v-if="newContent.length > 0" />
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
  </view>
</template>

<script setup>
import { onLoad, onShow, onPullDownRefresh, onReachBottom, onUnload } from '@dcloudio/uni-app';
import { ref, reactive, inject, nextTick } from 'vue'
import { diyFormField, isBase64, handleFormDetail, getAuthList, RunV8Code, initV8Init, isShowBtn } from '@/utils'
import cardDetail from '@/FormComponents/cardDetail.vue';
import { Base64 } from 'js-base64'
import { provide, computed } from 'vue';
import { TmpEngineTable } from '@/utils'
import childForm from '@/pages/workbench/work-add/index.vue';
const V8 = inject('V8'); // 使用注入V8实例
const Microi = inject('Microi'); // 使用注入Microi实例
const MenuId = ref('') // 当前菜单ID
const status = ref('more')
const contentText = ref({
  contentdown: '查看更多',
  contentrefresh: '加载中',
  contentnomore: '没有更多'
})
// 分页数据
const pageData = reactive({
  pageIndex: 1,
  pageSize: 10,
  totalPage: 0
})
const listData = ref([]) // 列表数据
const DiyTableId = ref('') // 当前表单ID
const diyFormFields = ref([]) // 当前表单字段
const SearchEqual = ref({}) // 搜索条件
// 给表单字段赋值（创建时间、创建人、修改时间）
const createData = [
  {
    Label: '创建时间',
    Name: 'CreateTime',
    Visible: 1,
  }, {
    Label: '创建人',
    Name: 'UserName',
    Visible: 1
  }, {
    Label: '修改时间',
    Name: 'UpdateTime',
    Visible: 1
  }
]
const keyword = ref('') // 搜索关键字
// 更多搜索条件列表
const searchList = ref([])
const MoreBtns = ref([
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
const currentPermission = ref([]) // 当前用户权限
const content = [{
  iconPath: '/static/icons/fab.png',
  selectedIconPath: '/static/icons/fab.png',
  text: '新增',
  value: 'Add',
  active: false
}
]
const popMenu = ref(true) // 弹出菜单
const newContent = ref([]) // 过滤后的按钮
const pattern = {
  color: '#7A7E83',
  backgroundColor: '#fff',
  selectedColor: '#007AFF',
  buttonColor: '#007AFF',
  iconColor: '#fff',
  icon: 'compose'
} // 按钮模式
const popupTable = ref(null) // 新增子表弹窗
const OpenAnyFormData = ref({}) // 打开任意表单数据
// 是否带流程表单
const isWF = ref(false)
const WorkData = ref({}) // 工作流表单数据


// 清空搜索条件
const onClear = () => {
  keyword.value = ''
  getListData()
}
// 获取当前模块设计数据
const getFormMenuData = async () => {
  Microi.ShowLoading('加载中···')
  const res = await Microi.FormEngine.GetFormData({
    FormEngineKey: 'Sys_Menu',
    Id: MenuId.value
  })
  if (res.Code == 1) {
    DiyTableId.value = res.Data.DiyTableId // 表单ID
    const MoreBtns1 = JSON.parse(res.Data.MoreBtns)
    MoreBtns.value = MoreBtns1.concat(MoreBtns.value) // 显示行更多按钮
    const PageBtns = JSON.parse(res.Data.PageBtns) // 页面按钮
    PageBtns.forEach(item => {
      content.push({
        iconPath: '/static/icons/fab.png' || item.Icon,
        selectedIconPath: '/static/icons/fab.png' || item.SelectedIcon,
        text: item.Name,
        value: item.Id,
        active: false,
        V8Code: item.V8Code
      })
    })
    searchList.value = JSON.parse(res.Data.SearchFieldIds) // 搜索条件列表
    const NotShowFields = JSON.parse(res.Data.NotShowFields) // 不显示的字段
    let SelectFields = JSON.parse(res.Data?.SelectFields)?.map(item => item.Id)
    let NotSelectFields = []
    if (SelectFields?.length > 0) {
      NotSelectFields = SelectFields.concat(createData.map(item => item.Name)) // 查询列的字段
    }
    const formFields = await diyFormField({ TableId: DiyTableId.value }) // 获取表单字段
    const arr = formFields?.concat(createData)
    diyFormFields.value = arr
    Microi.HideLoading()
    getPageAuth() // 获取当前页面权限
  }
  Microi.HideLoading()
}
// 获取列表数据
const getListData = async () => {
  const res = await Microi.FormEngine.GetTableData({
    ModuleEngineKey: MenuId.value,
    _PageIndex: pageData.pageIndex,
    _PageSize: pageData.pageSize,
    _SearchEqual: SearchEqual.value,
    _Keyword: keyword.value
  })
  if (res.Code == 1) {
    pageData.totalPage = Math.ceil(res.DataCount / pageData.pageSize)
    var data = await Promise.all(res.Data.map(item => handleFormDetail(item, diyFormFields.value)));
    nextTick(() => {
      if (pageData.pageIndex == 1) {
        listData.value = data
        status.value = 'onmore'
      } else {
        listData.value = listData.value.concat(data)
      }
    })
  }
}
// 去新增
const goAdd = () => {
  Microi.RouterPush(`/pages/workbench/work-add/index?DiyTableId=${DiyTableId.value}&type=Add&isWF=${isWF.value}&WorkData=${JSON.stringify(WorkData.value)}`, true)
}
// 去详情
const goDetail = (item) => {
  Microi.RouterPush(`/pages/workbench/work-detail/index?DiyTableId=${DiyTableId.value}&Id=${item.Id}&MenuId=${MenuId.value}`, true)
}
// 去编辑
const goEdit = (item) => {
  Microi.RouterPush(`/pages/workbench/work-add/index?DiyTableId=${DiyTableId.value}&Id=${item.Id}&type=Edit&isWF=${isWF.value}&WorkData=${JSON.stringify(WorkData.value)}`, true)
}
// 去删除
const goDelete = (item) => {
  uni.showModal({
    title: '提示',
    content: '确定删除吗？',
    success: (res) => {
      if (res.confirm) {
        Microi.ShowLoading('删除中···')
        Microi.FormEngine.DelFormData({
          TableId: DiyTableId.value,
          Id: item.Id
        }).then(res => {
          if (res.Code == 1) {
            Microi.HideLoading()
            uni.showToast({
              title: '删除成功',
              icon: 'none'
            })
            getListData()
          } else {
            Microi.HideLoading()
            uni.showToast({
              title: '删除失败',
              icon: 'none'
            })
          }
        })
      }
    }
  })
}
// 点击更多按钮
const goBtn = async(btn, formData) => {
  if (btn.V8Code) {
    V8.Init(formData, diyFormFields.value);
    await RunV8Code(btn.V8Code);
  }
  // 如果是编辑按钮，则去编辑
  if (btn.Id == 'Edit') {
    goEdit(formData)
  } else if (btn.Id == 'Del') {
    goDelete(formData)
  }
}
// 打开表单
const OpenForm = (formData, type) => {
  console.log('OpenForm', formData, type)
  if (type == 'Add') {
    goAdd()
  } else if (type == 'Edit') {
    goEdit(formData)
  }
}
/**
 * 打开任意表单
**/
const OpenAnyForm = (params) => {
  console.log('OpenAnyForm', params)
  popupTable.value.open()
  OpenAnyFormData.value = params
  V8.DataAppend = params.DataAppend
}
/**
 * 打开工作流表单
**/
const OpenFormWF = (formData, type, value) => {
  isWF.value = true
  console.log('OpenFormWF', formData, type, value)
  WorkData.value = value
  if (type == 'Add') {
    goAdd()
  } else if (type == 'Edit') {
    goEdit()
  } else {
    goDetail(formData)
  }
}
// 子表提交啦
const ChildSubmitOk = async () => {
  popupTable.value.close()
  getListData()
}
// 刷新列表
const RefreshTable = (data) => {
  pageData.pageIndex = data && data._PageIndex
  getListData()
}
// 触发按钮
const trigger = async (e) => {
  // 如果是新增按钮，则去新增
  if (MenuId.value == '38bc3af8-1216-4118-a405-d48d386e9bbe') {
    Microi.RouterPush(`/pages/tools/daka/daka?DiyTableId=${DiyTableId.value}&type=Add`, true)
  } else if (e.item.value == 'Add') {
    goAdd()
  } else {
    await RunV8Code(e.item.V8Code)
  }
}
// 悬浮按钮点击事件
const handleFab = () => {
  //console.log('handleFab', newContent.value);
  // 如果数据只有一条直接执行不用展开弹窗
  if (newContent.value.length <= 1) {
    popMenu.value = false
    trigger({ item: newContent.value[0] })
  }
}
onLoad((options) => {
  popMenu.value = true
  MenuId.value = options.MenuId
  // 主菜单进来的名称
  uni.setNavigationBarTitle({
    title: options.MenuName
  })
  // 搜索条件
  SearchEqual.value = options.SearchEqual ? JSON.parse(options.SearchEqual) : {}
  getFormMenuData()

  V8.OpenForm = OpenForm; // 给V8实例添加OpenForm方法
  V8.OpenFormWF = OpenFormWF; // 给V8实例添加OpenFormWF方法
})
onShow(() => {
  getListData()
  V8.OpenForm = OpenForm;
  V8.OpenAnyForm = OpenAnyForm;
})
// 页面卸载时触发
onUnload(() => {
  Microi.HideLoading()
})
// 下拉刷新
onPullDownRefresh(() => {
  pageData.pageIndex = 1
  getListData()
  setTimeout(function () {
    uni.stopPullDownRefresh()
    console.log('stopPullDownRefresh')
  }, 1000)
})
// 上啦加载
onReachBottom(() => {
  console.log('onReachBottom', pageData)
  if (pageData.pageIndex < pageData.totalPage) {
    status.value = 'loading'
    pageData.pageIndex++
    getListData()
  } else {
    status.value = 'nomore'
  }
})

// 获取当前页面权限
const getPageAuth = () => {
  currentPermission.value = getAuthList(MenuId.value)
  console.log('currentPermission', currentPermission.value)
  content.map(item => {
    item.show = currentPermission.value.includes(item.value)
  })
  newContent.value = content.filter(item => item.show)
  console.log('content', newContent.value)
}
</script>

<style lang="scss" scoped>
.uni-container {
  padding: 30rpx;
}

.work-list {
  margin-bottom: 20rpx;
  background: #fff;
  border-radius: 10rpx;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 25rpx;
}

.work-list-add {
  position: fixed;
  bottom: 90rpx;
  right: 20rpx;
  background: #1890ff;
  border-radius: 50%;
  width: 150rpx;
  height: 150rpx;
  display: flex;
  justify-content: center;
  align-items: center;
}

.search-input {
  flex: 1;
}

.search-btn {
  margin-left: 20rpx;
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
  // padding: 20px;
  box-sizing: border-box;
}

.popup-close {
  position: relative;
  right: 10px;
  top: 10px;
  text-align: right;
}

.work-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 12rpx 0;
  border-bottom: #fafafa 1rpx solid;
}

.work-item-label {
  font-size: 13px;
  color: #666;
  margin-right: 10px;
  width: 25%;
  flex-shrink: 0;
}

.item-value {
  font-size: 14px;
  color: #111;
  width: 75%;
  white-space: pre-wrap;
  word-break: break-word;
}

.table-child {
  overflow: hidden;
}

.item-File {
  width: 100%;
  word-wrap: break-word;
  padding: 10px 0;
  border-bottom: solid 1px #ccc;
}

.item-Img {
  width: 100px;
  height: 100px;
}
</style>
