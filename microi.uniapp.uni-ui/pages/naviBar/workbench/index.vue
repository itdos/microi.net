<template>
  <view class="container bg">
    <view v-if="Microi.OsClient == 'loctek'" class="uni-common-p-xs">
      <loctek-works v-if="loctekWorksData.length > 0" :loctekWorksData="loctekWorksData"></loctek-works>
      <view v-else class="bg-loctek" style="display: flex; flex-direction: column;">
        <image src="/static/image/unauthorized.png" class="item-img"
          style="width: 480rpx; min-width: 480rpx; height: 500rpx; min-height: 500rpx; margin-bottom: 20rpx;"></image>
        <view style="min-height: 380rpx; width: 100%;"></view>
      </view>
    </view>
    <view  v-else class="bg uni-common-p-xs">
      <template v-if="menuData.length > 0">
        <view v-for="item in menuData" :key="item.Id">
          <uni-section :title="item.Name" type="line" titleFontSize="36" v-if="item.AppDisplay" @click="clickHide(item)">
            <view class="example">
              <view class="workData-container" v-if="item.show">
                <block v-for="i in item._Child" :key="i.Id">
                  <view class="workData-item" v-if="i.AppDisplay" @tap.stop="navDemoPage(i)">
                    <image v-if="i.Icon" class="item-img" :src="GetServerPath(i.Icon)" />
                    <!-- <uni-icons v-else type="image-filled" size="35" color="#666" /> -->
                    <image v-else src="/static/img/none.png" class="item-img"></image>
                    <view class="item-ti tle tn-mt-xs w24"> {{ i.Name }} </view>
                  </view>
                </block>
              </view>
            </view>
          </uni-section>
        </view>
      </template>
      <view v-else class="bg-loctek" style="display: flex; flex-direction: column;">
        <image src="/static/image/none.gif" style="width: 543rpx; height: 407rpx; "></image>
      </view>
    </view>
    <view v-if="showPopup" class="popup-container" @click.stop="showPopup = false">
      <view class="popup-box">
        <view class="popup-title">{{ currentName }}</view>
        <view class="popup-content">
          <view class="workData-container">
            <view v-for="i in popupData" :key="i.Id" class="workData-item" @tap.stop="navDemoPage(i)">
              <image v-if="i.Icon" class="item-img" :src="GetServerPath(i.Icon)" />
              <uni-icons v-else type="image-filled" size="35" />
              <view class="item-ti tle tn-mt-xs w24"> {{ i.Name }} </view>
            </view>
          </view>
        </view>
      </view>
    </view>
    <view class="uni-tabbar-height"></view>
    <tab-bar :current="currentBar" backgroundColor="#fff" color="#333" tintColor="rgba(57, 121, 240, 1)"></tab-bar>
  </view>
</template>

<script setup>
import { getApiUrl, GetServerPath } from '@/utils'
import { ref, inject, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app';
import LoctekWorks from '@/pages/tools/loctek/works/index.vue'
const Microi = inject('Microi'); // 使用注入Microi实例
const menuData = ref([]) // 菜单数据
const showPopup = ref(false) // 是否显示子菜单弹窗
const popupData = ref([]) // 子菜单数据
const currentName = ref('') // 点击主菜单显示名称
const loctekWorks = ref(['3167889e-c512-44d1-b727-807f15f1b438', 'b4c0cc8a-7046-4afe-bc39-8b8b67909f24', 'feff39f6-3940-41ed-bad1-d770f0e4d547', 'a0bcac53-7d9c-4bf8-a9af-0e2356006f3b']) // loctek工作台组件实例 (安全巡点检、5S任务、整改任务、抽查任务)
const loctekWorksData = ref([]) // loctek工作台数据
const currentBar = ref(1) // 当前tab索引
const getLoctek = () => {
  console.log('loctekWorksData', menuData.value)
  console.log('Microi.OsClient', Microi.OsClient)
  let isloctekWork = false
  // 查看menuData.value中下级菜单是否包含loctekWorks之外的数据
  menuData.value.map(item => {
    if (item._Child && item._Child.length > 0) {
      item._Child.map(i => {
        if (!loctekWorks.value.includes(i.Id)) {
          isloctekWork = true
        } else {
          loctekWorksData.value.push(i)
        }
      })
    }
  })
  // 过滤出loctekWorks数据
  // console.log('loctekData',isloctekWork,loctekWorksData.value)
}
// 获取菜单数据
const getMenuData = () => {
  Microi.ShowLoading('加载中···')
  Microi.Post(getApiUrl('getSysMenuStep'), {}).then(res => {
    if (res.Code == 1) {
      res.Data.map(item => {
        if (item.AppDisplay == null || item.AppDisplay == undefined) {
          item.AppDisplay = true
        }
        if (item._Child && item.AppDisplay) {
          item._Child.map(i => {
            if (i.AppDisplay == null || i.AppDisplay == undefined) {
              i.AppDisplay = true
            }
          })
          item._Child = item._Child.filter((i) => i.AppDisplay)
          item.show = true
        } else {
          item._Child = [{...item}]
          item.show = true
        }
        menuData.value.push(item)

      })
      // getLoctek()
    }
    Microi.HideLoading()
  }).catch(err => {
    Microi.HideLoading()
    Microi.Tips(err)
  })
}
// 点击主菜单隐藏菜单弹窗
const clickHide = (item) => {
  item.show = !item.show
}
// 点击主菜单显示子菜单
const navDemoPage = (item) => {
  // console.log('navDemoPage', item)
  // if (item.Id == '38bc3af8-1216-4118-a405-d48d386e9bbe') {
  //   Microi.RouterPush(`/pages/tools/daka/list?MenuId=${item.Id}&MenuName=打卡记录`,true)
  // } else 
  if (item.Id == '17898a96-45b3-49f5-9ca7-698748bd4ae9') {
    Microi.RouterPush(`/pages/workbench/map/index?MenuId=${item.Id}&MenuName=客户地图`, true)
  }
  else if (item.Id == '3167889e-c512-44d1-b727-807f15f1b438') { // 检查计划提报
    Microi.RouterPush(`/pages/tools/loctek/checkPlan/index?Zhuangtai=0&DiyTable=GetChckPlanList`, true)
  } else if (item.Id == '47c96c36-28cf-4a53-81a3-eb908dc01fa6') { // 检查计划提报结果
    Microi.RouterPush(`/pages/tools/loctek/checkPlan/index?Zhuangtai=1&DiyTable=GetChckPlanList`, true)
  }
  else if (item.Id == 'b4c0cc8a-7046-4afe-bc39-8b8b67909f24') { // 5S任务提报
    Microi.RouterPush(`/pages/tools/loctek/checkPlan/index?Zhuangtai=0&MenuName=5S任务&DiyTable=5S_GetChckPlanList5S`, true)
  }
  else if (item.Id == 'feff39f6-3940-41ed-bad1-d770f0e4d547') { // 整改任务提报
    Microi.RouterPush(`/pages/tools/loctek/checkPlan/index?Zhuangtai=0&MenuName=整改任务&DiyTable=zhengGai_GetChckPlanList`, true)
  }
  else if (item.Id == '3f6fca15-d3ce-453c-9dc1-d4dc161644f1') { // 我的待办
    Microi.RouterPush(`/pages/workbench/work-todo/index`, true)
  }
  // 如果有子菜单，则显示子菜单
  else if (item._Child && item._Child.length > 0) {
    currentName.value = item.Name
    popupData.value = item._Child.filter((i) => i.AppDisplay)
    if (popupData.value.length > 0) {
      showPopup.value = true
    }
  } else {
    Microi.RouterPush(`/pages/workbench/work-list/index?MenuId=${item.Id}&MenuName=${item.Name}`, true)
  }
}

onMounted(() => {
  // getMenuData()
})
onShow(() => {
  menuData.value = []
  getMenuData()
})
onLoad(() => {
  uni.$on('clickTabbar', (index) => {
    currentBar.value = index
  });
})
</script>

<style scoped lang="scss">
@import '../../../common/uni-nvue.css';

@mixin flex {
  /* #ifndef APP-NVUE */
  display: flex;
  /* #endif */
  flex-direction: row;
}
.container{
  min-height: 100vh;
}
.bg {
  background-color: #f3f5f4;
}
.bg-loctek{
  display: flex;
  justify-content: center;
  align-items: center;
  height: 90vh;
  background-color: #fff;
}
.workData-container {
  // display: flex;
  // flex-wrap: wrap;
  // justify-content: flex-start;
  // padding: 20rpx;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-gap: 10px;
  padding: 15px;
}

.workData-item {
  text-align: center;
}

.item-img {
  width: 60rpx;
  height: 60rpx;
  margin: 0 0 8rpx;
}

.popup-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 999;
  background: rgba(0, 0, 0, 0.5)
}

.popup-box {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: #fff;
  border-radius: 20rpx;
  padding: 20rpx;
  text-align: center;
  width: 86%;
}

.popup-title {
  font-size: 32rpx;
  font-weight: bold;
  margin-bottom: 20rpx;
  margin-top: 20rpx;
}



.authorized-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.unauthorized {
  width: 420px;
  height: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}
</style>