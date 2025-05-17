<template>
  <view class="container">
    <view v-if="data.length > 0">
      <scroll-view id="tab-bar" class="scroll-h" :scroll-x="true" :show-scrollbar="false"
        :scroll-into-view="scrollIntoViewId" :scroll-left="scrollLeft">
        <block v-for="(tab, index) in data" :key="index">
          <view class="uni-tab-item" :id="'tab-' + index" :data-current="index" @click="onClickItem(index)">
            <text class="uni-tab-item-title" :class="current == index ? 'uni-tab-item-title-active' : ''">{{
      tab.list.title }}</text>
          </view>
        </block>
      </scroll-view>
      <view class="uni-margin-wrap uni-common-mb-xs">
        <swiper class="swiper" circular :current="current" @change="onSwiperChange">
          <swiper-item v-for="(tab, index) in data" :key="index">
            <view class="swiper-item ">
              <view class="swiper-item-title">已安全生产 <text class="swiper-item-title-num">{{ tab.roundedDaysDiff }}</text>
                天</view>
              <view class="swiper-item-desc">{{ tab.startDate }} - {{ tab.nowDate }}</view>
            </view>
          </swiper-item>
        </swiper>
      </view>
      <view class="uni-margin-wrap" style="border:1px solid transparent;">
        <picker @change="bindPickerChange" :value="yueValue" :range="array">
          <view class="uni-notice-title uni-flex uni-justify-center">
            <view>{{ array[yueValue] }} - 管理任务统计</view>
            <uni-icons type="down" size="20"></uni-icons>
          </view>
        </picker>
        <view class="notice-list">
          <view class="notice-item" v-for="(item, index) in management" :key="index">
            <view class="vertical-progressbar">
              <view class="progress-bar"
                :style="{ height: progressWidth(SumInfo[item.value]) + '%', background: colorProgress[index] }"></view>
            </view>
            <view class="notice-item-title">{{ item.title }}</view>
            <view class="notice-item-desc">
              <text class="notice-item-desc-num">{{ SumInfo[item.value]?.overCount }}</text> / {{
      SumInfo[item.value]?.AllCount }}
            </view>
          </view>
        </view>
      </view>
      <view class="suggestion-wrap">
        <view class="suggestion-title">
          <image src="/static/loctek/suggestion.svg" class="item-icon" />
          <text>合理化建议</text>
        </view>
        <view class="suggestion-input">
          <uni-easyinput type="textarea" :inputBorder="false" placeholder="请输入您的意见与建议…" v-model="suggestion" autoHeight
            style="width: 100%;margin-right: 10px;" />
          <view class="">
            <uni-file-picker file-mediatype="image" mode="list" @select="upFileSelect($event)">
              <uni-icons type="camera" size="34" color="rgba(206, 206, 206, 1)"></uni-icons>
            </uni-file-picker>
          </view>
        </view>
        <view class="uni-flex uni-flex-wrap" v-if="filesValue.length > 0">
          <view v-for="(item, index) in filesValue" :key="index">
            <image :src="item.url" class="item-files" @click.stop="previewImg(filesValue, index)" />
          </view>
        </view>
        <view class="suggestion-btn">
          <button type="primary" class="btn" hover-class="is-hover" :loading="isLoading"
            @click="onSuggestion">提交</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, inject, onMounted, watch, nextTick } from 'vue'
import { onLoad, onShow, onHide } from '@dcloudio/uni-app';
import { scanCodeH5, uploadFile, previewImg } from '@/utils';
import dayjs from 'dayjs';
const Microi = inject('Microi'); // 使用注入Microi实例
const V8 = inject('V8'); // 使用注入V8实例
const userInfo = ref(Microi.GetCurrentUser()) // 用户信息
const keyword = ref('') // 搜索关键字
const filesValue = ref([])
const data = ref([]) // 搜索关键字
const currentBar = ref(0) // 当前tab索引
const current = ref(0) // 当前tab索引
const suggestion = ref('') // 建议内容
const colorProgress = ref(['rgba(26, 189, 178, 1)', 'rgba(77, 175, 255, 1)', 'rgba(57, 121, 240, 1)', 'rgba(140, 112, 207, 1)']) // 当前tab颜色
const array = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'] // 月份数组
const now = new Date();
const yueValue = ref(now.getMonth()) // 月份
const scrollIntoViewId = ref('') // 滚动到指定元素
const isLoading = ref(false)
const scrollLeft = ref(0) // 滚动条距离左侧的距离
const management = ref([
  {
    title: '安全巡点检',
    value: 'safeMession',
  },
  {
    title: '5S检查',
    value: 'FiveS',
  },
  {
    title: '整改任务',
    value: 'ZhengGaiMession',
  },
  // {
  //   title: '抽查任务',
  //   value: 'ChouChaMession',
  // },
  {
    title: '培训考试',
    value: 'exam',
  }
]) // 管理任务统计
const SumInfo = ref([]) // 统计数据
// 获取当年月份
const bindPickerChange = (e) => {
  yueValue.value = e.detail.value
  getStatistics()
}
// 获取数据
const getData = async () => {
  const title = [
    {
      title: '乐歌人体工学科技股份有限公司'
    },
    {
      title: '注塑车间'
    },
    {
      title: '喷塑车间'
    },
    {
      title: '丝杆车间'
    },
    {
      title: '仓库'
    },
    {
      title: '总装车间'
    },
    {
      title: '木工车间'
    },
    {
      title: '金工车间'
    }
  ]
  const res = await Microi.ApiEngine.Run('safetyManagement_obtainSafeDays', {
  });
  if (res.length > 0) {
    data.value = res;
  }
  getStatistics()
}
// 获取统计数据
const getStatistics = async () => {
  const res = await Microi.ApiEngine.Run('mobild_index_data', {
    Month: yueValue.value + 1,
  });
  if (res.Code == 1) {
    SumInfo.value = res.Data.SumInfo
  }
}
// 计算进度条宽度
const progressWidth = (item) => {
  if (item && item.AllCount == 0) {
    return 0
  }
  return (item?.overCount / item?.AllCount) * 100
}
// 点击主菜单显示子菜单
const navDemoPage = (item) => {
  // 如果是扫码页面，则不跳转
  if (item.Url == 'scanCode') {
    changeScan()
  } else {
    Microi.RouterPush(item.Url, true);
  }
}

// 扫码 - 乐歌跳转到检查提报页面
const changeScan = async () => {
  const code = await scanCodeH5()
  const res = await Microi.ApiEngine.Run('CheckPlan_ScanIn', {
    ScanInfo: code,
    UserId: Microi.GetCurrentUser().Id
  })
  if (res.Code == 1) {
    const { MessionId, checkMession } = res
    if (checkMession.length == 0) return
    const data = checkMession.filter(item => item?.Id == MessionId)[0]
    uni.setStorageSync('checkPlanDetail', JSON.stringify(data))
    Microi.RouterPush('/pages/tools/loctek/checkPlan/detail')
  } else {
    Microi.Tips(res.Msg, false)
  }
}
// 点击分组切换
const onClickItem = (index) => {
  current.value = index;
};
// 切换swiper
const onSwiperChange = function (e) {
  current.value = e.detail.current;
  uni.createSelectorQuery().in(this).selectAll('.uni-tab-item').boundingClientRect(rects => {
    // 计算scroll-view的总长度
    let totalWidth = rects.reduce((acc, curr) => acc + curr.width, 0);
    const currentLeft = rects.slice(0, current.value).reduce((acc, curr) => acc + curr.width, 0);
    // 计算当前current.value的位置
    // 设置滚动条距离左侧的距离
    scrollLeft.value = currentLeft - 110;
  }).exec();
};
// 上传图片
const upFileSelect = async (e) => {
  const url = e.tempFilePaths
  const res = await uploadFile(url, { Component: 'ImgUpload' })
  if (res.Code == 1) {
    // 如果有值，就追加，没有就赋值
    if (filesValue.value) {
      filesValue.value = filesValue.value.concat(res.Data)
    } else {
      filesValue.value = res.Data
    }
  }
}
// 提交建议
const onSuggestion = async () => {
  if (suggestion.value.trim() == '') {
    Microi.Tips('请输入建议内容', false)
    return
  }
  isLoading.value = true
  var obj = {
    JianyiFQR: userInfo.value.Name, // 建议发起人
    FaqiRBM: userInfo.value.DeptName, // 建议人部门
    BumenDM: userInfo.value.DeptId, // 建议人部门代码
    ZhixianLD: userInfo.value.directLeader, // 直线领导
    GaishanJY: suggestion.value, // 改善建议
    ShangchuanTP: JSON.stringify(filesValue.value), // 上传的图片
  }
  const res = await Microi.FormEngine.AddFormData({
    FormEngineKey: 'diy_HeLiHJYCreate',
    _RowModel: obj
  })
  if (res.Code == 1) {
    Microi.Tips('提交成功', true)
    suggestion.value = ''
    filesValue.value = []
    isLoading.value = false
  } else {
    Microi.Tips(res.Msg, false)
    isLoading.value = false
  }
}
onLoad(() => {
  uni.setNavigationBarTitle({
    title: '安全管理'
  })
  // uni.$on('testParam', (data) => {
  // 	console.log('testParamloctekHome',data)
  // 	getData()
  // });
})
onShow(() => {
  getData()
})
onHide(() => {
  // 组件或页面隐藏时，可以移除监听，避免内存泄漏
  // uni.$off('testParam');
})
defineExpose({
  getData
})
</script>

<style lang="scss" scoped>
.container {
  border: 1px solid transparent;
  height: 100%;
  overflow: hidden;
}

/* 导航条tab start */
.scroll-h {
  width: 750rpx;
  /* #ifdef H5 */
  width: 100%;
  /* #endif */
  height: 100rpx;
  flex-direction: row;
  /* #ifndef APP-PLUS */
  white-space: nowrap;
  /* #endif */
  /* flex-wrap: nowrap; */
  /* border-color: #cccccc;
  border-bottom-style: solid;
  border-bottom-width: 1px; */
}

.uni-tab-item {
  /* #ifndef APP-PLUS */
  display: inline-block;
  /* #endif */
  flex-wrap: nowrap;
  padding-left: 28rpx;
  padding-right: 28rpx;
}

.uni-tab-item-title {
  font-size: 15px;
  font-weight: 400;
  letter-spacing: 0px;
  color: rgba(119, 119, 119, 1);
  vertical-align: top;
  line-height: 100rpx;
}

.uni-tab-item-title-active {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0px;
  color: rgba(34, 34, 34, 1);
  vertical-align: top;
}

/* 导航条tab end */
.swiper,
::v-deep .uni-swiper-wrapper,
::v-deep .uni-swiper-slides,
::v-deep .uni-swiper-slide-frame,
::v-deep uni-swiper-item {
  overflow: visible;
}

.swiper-item {
  display: block;
  height: 105px;
  opacity: 1;
  border-radius: 13.52px;
  background: rgba(255, 255, 255, 1);
  box-shadow: 0px 20px 60px rgba(102, 127, 191, 0.25);
  margin: 20px;
  text-align: center;

  &-title {
    font-size: 17px;
    font-weight: 500;
    letter-spacing: 0px;
    line-height: 24.65px;
    color: rgba(34, 34, 34, 1);
    text-align: center;
    vertical-align: top;
    padding-top: 20px;
  }

  &-title-num {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 0px;
    line-height: 24.65px;
    color: rgba(227, 66, 66, 1);
    vertical-align: top;
  }

  &-desc {
    font-size: 15px;
    font-weight: 400;
    letter-spacing: 0px;
    line-height: 24.65px;
    color: rgba(119, 119, 119, 1);
    margin-top: 10px;
  }
}

.uni-notice-title {
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0px;
  line-height: 24.65px;
  color: rgba(34, 34, 34, 1);
  text-align: center;
  vertical-align: top;
}

.notice-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 1fr;
  /* 每行的高度也占据可用空间的一份 */
  grid-gap: 10px;
  margin: 20px;
}

.notice-item {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  height: 150px;

  &-title {
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0px;
    line-height: 24.65px;
    color: rgba(68, 68, 68, 1);
    text-align: center;
    vertical-align: top;
    margin-top: 20rpx;
  }

  &-desc {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0px;
    line-height: 24.65px;
    color: rgba(153, 153, 153, 1);
  }

  &-desc-num {
    font-size: 14px;
  }
}

/* 进度条样式 */
.vertical-progressbar {
  width: 17px;
  /* 进度条的宽度 */
  background-color: #f3f3f3;
  /* 进度条背景颜色 */
  position: relative;
  /* 使内部的进度条可以绝对定位 */
  height: 100%;
  /* 高度为100% */
  border-radius: 10px;
}

.progress-bar {
  width: 100%;
  /* 进度条宽度与外层容器相同 */
  background-color: #4caf50;
  /* 进度条颜色 */
  position: absolute;
  /* 绝对定位 */
  bottom: 0;
  /* 从底部开始 */
  transition: height 0.5s ease;
  /* 高度变化时的过渡效果 */
  border-radius: 10px;
}

.suggestion-wrap {
  border-radius: 15px;
  background: rgba(243, 249, 255, 1);
  border: 0.5px solid rgba(53, 121, 244, 1);
  margin: 10px 20px;
  padding: 10px;

  .suggestion-title {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }

  .item-icon {
    width: 44.5px;
    height: 39.5px;
    margin-right: 10rpx;
  }

  .suggestion-input {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: #ffffff;
    padding: 8px 15px;
    margin-bottom: 20px;
    border-radius: 5px;
  }
}

.btn {
  color: #ffffff;
  background-color: rgba(53, 121, 244, 1);
  border-color: rgba(53, 121, 244, 1);
  border-radius: 30px;
  height: 35px;
  font-size: 17px;
  line-height: 35px;
  margin: 10px 0;
}

.is-hover {
  color: rgba(255, 255, 255, 0.6);
  background-color: rgba(53, 121, 244, 1);
  border-color: rgba(53, 121, 244, 1);
}

::v-deep .is-text-box {
  display: none;
}

.item-files {
  width: 60px;
  height: 60px;
  margin-right: 10rpx;
  border-radius: 10px;
}

::v-deep .uni-easyinput__content-textarea {
  min-height: 20px;
  height: 20px;
}

::v-deep .uni-easyinput__placeholder-class {
  font-size: 15px;
}
</style>