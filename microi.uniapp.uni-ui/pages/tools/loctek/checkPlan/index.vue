<template>
  <view class="uni-container">
    <view class="search-box">
      <view class="search-item uni-flex uni-common-mb-xs">
        <view class="search-input">
          <uni-easyinput prefixIcon="search" v-model="keyword" placeholder="搜索"
            :styles="{ borderColor: 'rgba(53, 121, 244, 0.4)' }" @iconClick="ClickSearch" @blur="ClickSearch"
            @clear="onClear" />
        </view>
      </view>
      <scroll-view id="tab-bar" class="scroll-h" :scroll-x="true" :show-scrollbar="false">
        <block v-for="(tab, index) in Tabs" :key="tab.id">
          <view class="uni-tab-item" :id="tab" :data-current="index" @click="onClickItem(index)">
            <text class="uni-tab-item-title" :class="Zhuangtai == index ? 'uni-tab-item-title-active' : ''">{{ tab
              }}</text>
          </view>
        </block>
      </scroll-view>
    </view>

    <view class="list-container">
      <view class="list-item" v-for="(item, index) in listData" v-if="listData.length > 0" :key="index"
        @click="onItemClick(item)">
        <view class="uni-flex uni-justify-between uni-common-mb-xs">
          <view class="list-item-name">
            {{ item.LaiyuanJH || item.RenwuM }}
          </view>
          <view class="list-item-progress" v-if="DiyTable == 'GetChckPlanList'">
            {{ calculateProgress(item.checkPoint) }}
          </view>
          <view class="list-item-progress" v-else :class="{
            'Ongoing': (item.Zhuangtai || item.ZhenggaiZT) == '进行中' || (item.Zhuangtai || item.ZhenggaiZT) == '待审核',
            'Expired': (item.Zhuangtai || item.ZhenggaiZT) == '过期未完成' || (item.Zhuangtai || item.ZhenggaiZT) == '已作废' || (item.Zhuangtai || item.ZhenggaiZT) == '已过期'
          }">
            {{ item.Zhuangtai || item.ZhenggaiZT }}
          </view>
        </view>
        <view class="list-item-desc uni-common-mb" style="font-size: 28rpx;">
          {{ item.JianchaKSSJ || item.KaishiSJ1 || item.KaishiSJ }} ~ {{ item.JianchaJSSJ || item.YujiJSSJ ||
            item.JieshuSJ }}
        </view>
        <view class="list-item-desc uni-common-mb inline-between"
          v-if="(item.UserName || item.ZhenggaiRXM) && DiyTable == 'zhengGai_GetChckPlanList'">
          <view class="name-wrap" v-if="item.UserName"
            style="display: flex; flex-direction: row; align-items: center; justify-content: center; background-color: #f0f7ff; min-width: 300rpx; height: 60rpx; line-height: 60rpx; border-radius: 30rpx; font-size: 24rpx; ">
            <image src="/static/image/peopleSimple.svg" class="item-img"
              style="width: 26rpx; min-width: 26rpx; height: 26rpx; min-height: 26rpx; margin-right: 12rpx;"></image>
            <view style=" font-size: 30rpx; color: #444;"> 提出人： {{ item.UserName }}</view>
          </view>
          <view class="name-wrap" v-if="item.ZhenggaiRXM"
            style="display: flex; flex-direction: row; align-items: center; justify-content: center; background-color: #f0f7ff; min-width: 300rpx; height: 60rpx; line-height: 60rpx; border-radius: 30rpx; font-size: 24rpx; ">
            <image src="/static/image/peopleSimple.svg" class="item-img"
              style="width: 26rpx; min-width: 26rpx; height: 26rpx; min-height: 26rpx; margin-right: 12rpx;"></image>
            <view style=" font-size: 30rpx; color: #444;">整改人： {{ item.ZhenggaiRXM.split('/')[1] || '' }}</view>
          </view>
        </view>
        <view class="list-item-content uni-common-mb uni-ellipsis" v-if="DiyTable == 'zhengGai_GetChckPlanList'">
          {{ item.YichangMS }}
        </view>
        <view class="uni-flex uni-flex-wrap" v-else>
          <view class="list-item-tag" v-for="(tag, index) in (item.checkPoint || item.Quyu)" :key="index">
            <uni-icons :type="(tag.over || tag.TibaoWB) ? 'checkbox-filled' : 'circle'" size="22" color="#3579F4"
              class="uni-common-mr-xs"></uni-icons>
            <text>{{ tag.FengxianD || tag.Quyu || tag.QuyuM }}</text>
          </view>
        </view>
      </view>
      <view style="display: flex; flex-direction: column; justify-content: end; align-items: center; height: 40vh;"
        v-else>
        <image src="/static/image/none.gif" style="width: 543rpx; height: 407rpx; "></image>
      </view>
    </view>
    <uni-load-more :status="status" :content-text="contentText" />
    <view class="edit-btn" v-if="DiyTable == 'zhengGai_GetChckPlanList'"
      @click="Microi.RouterPush('/pages/tools/loctek/checkPlan/edit_zhengGai')">
      <image src="/static/loctek/edit1.svg" class="item-edit" />
    </view>
  </view>
</template>
<script setup>
import { ref, inject, nextTick } from 'vue'
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import { calculateProgress } from './public.js'
const Microi = inject('Microi'); // 使用注入Microi实例
const status = ref('more')
const contentText = ref({
  contentdown: '查看更多',
  contentrefresh: '加载中',
  contentnomore: '没有更多'
})
const keyword = ref('') // 搜索关键字
const MenuId = ref('') // 当前菜单ID
const listData = ref({}) // 页面数据
const Zhuangtai = ref(0) // 状态
const DiyTable = ref('') // 自定义表名
const Tabs = ref(['待完成', '已完成', '已过期']) // 选项卡 // Zhuangtai: 0(未开始、进行中) 1（已完成、已作废）2 （过期未完成）
// 选项卡点击事件
const onClickItem = (index) => {
  Zhuangtai.value = index
  pageData.pageIndex = 1
  getListData()
}
// 页面数据
const pageData = {
  pageIndex: 1,
  pageSize: 10,
  totalPage: 0,
}
// 搜索列表
const ClickSearch = () => {
  pageData.pageIndex = 1
  getListData()
}
// 清空搜索条件
const onClear = () => {
  keyword.value = ''
  getListData()
}
// 获取列表数据
const getListData = async () => {
  Microi.ShowLoading('加载中···')
  let res = {}
  if (DiyTable.value == 'zhengGai_GetChckPlanList') { // 整改任务

    Tabs.value = ['未完成', '已完成']
    let Where = []
    if (Zhuangtai.value == 0) {
      Where = [{ Name: 'ZhenggaiZT', Value: '进行中', Type: '=' }, { AndOr: 'OR', Name: 'ZhenggaiZT', Value: '待审核', Type: '=' }, { AndOr: 'OR', Name: 'ZhenggaiZT', Value: '未开始', Type: '=' }]
    } else if (Zhuangtai.value == 1) {
      Where = [{ Name: 'ZhenggaiZT', Value: '已完成', Type: '=' }, { AndOr: 'OR', Name: 'ZhenggaiZT', Value: '已关闭', Type: '=' }]
    }

    res = await Microi.FormEngine.GetTableData({
      // FormEngineKey: 'diy_zhenggai_list',
      ModuleEngineKey: "feff39f6-3940-41ed-bad1-d770f0e4d547",//整改状态
      _Keyword: keyword.value,
      _PageIndex: pageData.pageIndex,
      _PageSize: pageData.pageSize,
      _Where: Where
    })
  } else {
    res = await Microi.ApiEngine.Run(DiyTable.value, {
      Key: keyword.value,
      PageIndex: pageData.pageIndex,
      PageSize: pageData.pageSize,
      Zhuangtai: Zhuangtai.value,
    })
  }
  if (res.Code == 1) {
    pageData.totalPage = Math.ceil(res.DataCount / pageData.pageSize)
    var data = res.Data
    nextTick(() => {
      if (pageData.pageIndex == 1) {
        listData.value = data
        status.value = 'onmore'
        console.log('listData', listData.value)
      } else {
        listData.value = listData.value.concat(data)
        console.log('listData', listData.value)
      }
    })

  }
  Microi.HideLoading()
}
// 点击列表项
const onItemClick = (item) => {

  // console.log('checkPlanDetail', item)
  // let url = '';
  // if (DiyTable.value == 'GetChckPlanList') {
  //   url = '/pages/tools/loctek/checkPlan/detail?Zhuangtai=' + Zhuangtai.value
  // } else if (DiyTable.value == '5S_GetChckPlanList5S') {
  //   url = '/pages/tools/loctek/checkPlan/detail_5S?Zhuangtai=' + Zhuangtai.value
  // } else if (DiyTable.value == 'zhengGai_GetChckPlanList') {
  //   url = '/pages/tools/loctek/checkPlan/detail_zhengGai?Zhuangtai=' + Zhuangtai.value
  // } else if (DiyTable.value == 'ChouCha_GetChckPlanList') {
  //   url = '/pages/tools/loctek/checkPlan/detail_chouCha?Zhuangtai=' + Zhuangtai.value
  // }
  // console.log(url + "&Id=" + item.Id)
  // Microi.RouterPush(url + "&Id=" + item.Id)

  uni.setStorageSync('checkPlanDetail', JSON.stringify(item))
  uni.setStorageSync('checkPlanDetail', JSON.stringify(item))
  if (DiyTable.value == 'GetChckPlanList') {
    Microi.RouterPush('/pages/tools/loctek/checkPlan/detail?Zhuangtai=' + Zhuangtai.value)
  } else if (DiyTable.value == '5S_GetChckPlanList5S') {
    Microi.RouterPush('/pages/tools/loctek/checkPlan/detail_5S?Zhuangtai=' + Zhuangtai.value)
  } else if (DiyTable.value == 'zhengGai_GetChckPlanList') {
    let url = '/pages/tools/loctek/checkPlan/detail_zhengGai?Zhuangtai=' + Zhuangtai.value
    console.log(url + "&Id=" + item.Id)
    Microi.RouterPush(url + "&Id=" + item.Id)
  } else if (DiyTable.value == 'ChouCha_GetChckPlanList') {
    Microi.RouterPush('/pages/tools/loctek/checkPlan/detail_chouCha?Zhuangtai=' + Zhuangtai.value)
  }


}
onLoad((options) => {
  MenuId.value = options.MenuId
  Zhuangtai.value = options.Zhuangtai
  DiyTable.value = options.DiyTable
  // 主菜单进来的名称
  if (options.MenuName) {
    uni.setNavigationBarTitle({
      title: options.MenuName
    })
  }
  // getListData()
})
onShow(() => {
  // pageData.pageIndex = 1
  getListData()
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
    JSON.parse
  }
})
</script>
<style lang="scss" scoped>
@import './index.scss';

.inline-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.uni-container {
  padding: 30rpx;
}

.search-input {
  flex: 1;

  &::v-deep .is-input-border {
    border-radius: 20px;
    padding-left: 10px;
    background: rgba(243, 249, 255, 1) !important;
  }
}

.edit-btn {
  position: fixed;
  bottom: 60rpx;
  right: 60rpx;
  z-index: 5;
  background: rgba(57, 121, 240, 1);
  box-shadow: 0px 10px 25px rgba(102, 127, 191, 0.45);
  width: 60px;
  height: 60px;
  border-radius: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.item-edit {
  width: 30px;
  height: 30px;
}
</style>