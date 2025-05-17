<template>
  <view class="container">
    <view class="header">
      <view class="title">
        <image src="/static/loctek/edit.svg" class="item-edit" />
        <text class="uni-common-ml-xs">我的任务总数：{{ total }}</text>
      </view>
      <view class="uni-flex uni-common-mt">
        <view class="header-piece">
          <view class="header-piece-num">{{ unfinish }}</view>
          <view class="header-piece-state">待处理</view>
        </view>
        <view class="header-piece">
          <view class="header-piece-num">{{ finish }}</view>
          <view class="header-piece-state wancheng">已完成</view>
        </view>
      </view>
      <view class="header-r">
        <image src="/static/loctek/he.png" class="item-img" />
      </view>
    </view>
    <view class="notice">
      <image src="/static/loctek/horn.svg" class="item-horn" />
      <text class="uni-common-ml">您有{{ unfinish }}条任务待完成，请尽快处理。</text>
    </view>
    <view class="info-container">
      <view class="info-container-item" v-for="(item, index) in loctekWorksData" :key="index" @click="goDetail(item)">
        <view>
          <image src="/static/loctek/xjd.svg" class="item-xjd" v-if="item.Name == '安全巡点检'" />
          <image src="/static/loctek/5S.svg" class="item-5S" v-if="item.Name == '5S检查'" />
          <image src="/static/loctek/zhenggai.svg" class="item-zhenggai" v-if="item.Name == '整改任务'" />
          <image src="/static/loctek/choucha.svg" class="item-zhenggai" v-if="item.Name == '抽查任务'" />
        </view>
        <view class="item-title">{{ item.Name }}</view>
        <view class="item-desc"><text class="item-desc-num">{{ item.Finish }}</text> / {{ item.Total }} 任务数</view>
        <view class="item-dian" v-if="item.Unfinish > 0"></view>
      </view>
    </view>
  </view>
</template>
<script setup>
import { ref, onMounted, inject } from 'vue'
import { onLoad, onShow, onHide } from '@dcloudio/uni-app';
const props = defineProps({
  loctekWorksData: {
    type: Array,
    default: () => []
  }
})
const Microi = inject('Microi'); // 使用注入Microi实例
const Ids = props.loctekWorksData.map(i => i.DiyTableId)
const loctekWorksData = ref([]) // 任务数据
// 任务总数
const total = ref(0)
// 待处理任务数
const unfinish = ref(0)
// 已完成任务数
const finish = ref(0)
// 获取统计数据
const getData = async () => {
  const res = await Microi.ApiEngine.Run('GetTaskCount',{ Ids: JSON.stringify(Ids) })
  if (res.Code != 1) {
    console.error(res.Message)
    return
  }
  loctekWorksData.value = res.Data
  total.value = res.Data.reduce((accumulator, current) => accumulator + current.Total, 0);
  unfinish.value = res.Data.reduce((accumulator, current) => accumulator + current.Unfinish, 0);
  finish.value = total.value - unfinish.value;
}
// 跳转到任务详情页面
const goDetail = (item) => {
  if (item.Id == 'f1780b6b-8e94-40d5-9375-d1f88d43b5ad') { // 检查计划提报
    Microi.RouterPush(`/pages/tools/loctek/checkPlan/index?Zhuangtai=0&DiyTable=GetChckPlanList`,true)
  }
  if (item.Id == "57fcc7a4-45ee-4ff3-be73-566374d3ba92") { // 5S任务提报
    Microi.RouterPush(`/pages/tools/loctek/checkPlan/index?Zhuangtai=0&MenuName=5S任务&DiyTable=5S_GetChckPlanList5S`,true)
  }
  if (item.Id == "5170a423-435d-4c51-9d0a-f087bf59534c") { // 整改任务提报
    Microi.RouterPush(`/pages/tools/loctek/checkPlan/index?Zhuangtai=0&MenuName=整改任务&DiyTable=zhengGai_GetChckPlanList`,true)
  }
  if (item.Id == "cdfaa079-e721-461c-bef4-ba5bf63814d9") { // 抽查任务提报
    Microi.RouterPush(`/pages/tools/loctek/checkPlan/index?Zhuangtai=0&MenuName=抽查任务&DiyTable=ChouCha_GetChckPlanList`,true)
  }
}

onMounted(() => {
  // getData()
})
onShow (() => {
  getData()
})
</script>
<style lang="scss" scoped>
.header {
  height: 115px;
  border-radius: 15px;
  background: linear-gradient(174.33deg, rgba(224, 235, 255, 1) 0%, rgba(255, 255, 255, 0.6) 100%);
  box-shadow: 0px 20px 60px  rgba(102, 127, 191, 0.25);
  position: relative;
  padding: 20px;
  margin: 15px 10px 30px;
  .title {
    font-size: 15px;
    font-weight: 400;
    letter-spacing: 0px;
    line-height: 34px;
    color: rgba(68, 68, 68, 1);
    vertical-align: top;
    display: flex;
    align-items: center;
  }
  &-piece{
    width: 25%;
    text-align: center;
    &-num{
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 0px;
      line-height: 24.65px;
      color: rgba(34, 34, 34, 1);
      margin-bottom: 10px;
    }
    &-state{
      border-radius: 20px;
      background: rgba(57, 121, 240, 1);
      color: white;
      width: 61px;
      margin: auto;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0px;
      line-height: 24.65px;
    }
    .wancheng{
      background: rgba(237, 165, 92, 1);
    }
  }
  &-r{
    position: absolute;
    bottom: -5px;
    right: 15px;
    .item-img{
      width: 125px;
      height: 173.97px;
    }
  }
  .item-edit{
    width: 17px;
    height: 17.49px;
  }
}
.notice{
  border-radius: 30px;
  background: rgba(243, 249, 255, 1);
  border: 0.5px solid rgba(53, 121, 244, 1);
  padding: 5px 8px 5px 20px;
  margin: 0 10px 20px;
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0px;
  line-height: 34px;
  color: rgba(85, 85, 85, 1);
  .item-horn{
    width: 21.37px;
    height: 14.8px;
  }
}
.info-container{
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-gap: 20px;
  padding: 10px;
  &-item{
    opacity: 1;
    border-radius: 15px;
    background: rgba(255, 255, 255, 1);
    box-shadow: 0px 20px 60px  rgba(102, 127, 191, 0.25);
    position: relative;
    padding: 20px;
    .item-title{
      font-size: 17px;
      font-weight: 500;
      letter-spacing: 0px;
      line-height: 24.65px;
      color: rgba(34, 34, 34, 1);
      margin: 15px 0 10px;
    }
    .item-desc{
      font-size: 14px;
      letter-spacing: 0px;
      line-height: 24.65px;
      color: rgba(153, 153, 153, 1);
      &-num{
        font-size: 18px;
        font-weight: 700;
      }
    }
    .item-dian{
      position: absolute;
      top: 20px;
      right: 20px;
      width: 12px;
      height: 12px;
      opacity: 1;
      background: rgba(227, 66, 66, 1);
      border-radius: 50%;
    }
    .item-xjd{
      width: 30px;
      height: 30px;
    }
    .item-5S{
      width: 24.42px;
      height: 26.1px;
    }
    .item-zhenggai{
      width: 30px;
      height: 30px;
    }
  }
}
</style>