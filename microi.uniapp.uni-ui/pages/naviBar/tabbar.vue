<template>
<view class="uni-tabbar-bottom">
  <view class="uni-tabbar" :style="{backgroundColor: backgroundColor}">
    <view v-for="(item,index) in tabList" :key="index">
      <view class="uni-tabbar__item text-center" :class="currentTabIndex == index ? 'on' : ''" @tap="switchTab(index)" style="height: 60px;" v-if="item.isShow">
          <view class="icon">
            <uni-badge :text="item.badge" absolute="rightTop" :is-dot="false">
            <image class="uni-tabbar__icon uni-tabbar__icon__diff product-image" :src="currentTabIndex == index ? item.selectedIcon : item.icon"></image>
            </uni-badge>
          </view>
          <block v-if="Microi.OsClient != 'loctek'">
          <view class="uni-tabbar__label" :style="[currentTabIndex == index ? {'color': tintColor} : {'color': color}]">{{item.text}}</view>
          </block>
      </view>
    </view>
  </view>
</view>
</template>

<script setup>
import { ref, watch, inject } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
const Microi = inject('Microi'); // 使用注入Microi实例
const props = defineProps({
  current: {
    type: [Number, String],
    default: 0
  },
  backgroundColor: {
    type: String,
    default: '#fff'
  },
  color: {
    type: String,
    default: '#333'
  },
  tintColor: {
    type: String,
    default: '#333'
  }
})
const tabList = ref([
  {
    icon: '/static/barIcon/home.svg',
    selectedIcon: '/static/barIcon/homeHL.svg',
    text: '首页',
    path: '/pages/naviBar/home/index',
    isShow: true
  },
  {
    icon: '/static/barIcon/work.svg',
    selectedIcon: '/static/barIcon/workHL.svg',
    text: '工作台',
    path: '/pages/naviBar/workbench/index',
    isShow: true
  },
  {
    icon: '/static/barIcon/tz.svg',
    selectedIcon: '/static/barIcon/tzHL.svg',
    text: '消息',
    path: '/pages/naviBar/message/index',
    badge: 0,
    isShow: true
  },
  {
    icon: '/static/barIcon/my.svg',
    selectedIcon: '/static/barIcon/myHL.svg',
    text: '我的',
    path: '/pages/naviBar/mine/index',
    isShow: true
  },
])
const userInfo = ref(Microi.GetCurrentUser()) // 用户信息
const currentTabIndex = ref(props.current)
watch(() => props.current, (value) => {
  currentTabIndex.value = value
})
const switchTab = (index) => {
  currentTabIndex.value = index
  uni.redirectTo({
    url: tabList.value[index].path
  })
  uni.$emit('clickTabbar', index)
}
// 获取消息数量
const getMsgCount = async () => {
  const res = await Microi.ApiEngine.Run('mobile_message_data',{
	  UserId: userInfo.value?.Id
  });
  if (res.Code == 1) {
    localStorage.setItem("message_data", JSON.stringify(res.Data));
    var count = 0;
    // 计算消息数量并更新tabList ，循环data数组，计算Num总和，赋值给badge
    for (var i = 0; i < res.Data.length; i++) {
      count += res.Data[i].Num;
    }
    tabList.value[2].badge = count;
  }
}
onLoad(() => {

})
onShow(() => {
  // 显示消息tab
  if (Microi.SysConfig.XiaoxiTZYC != 1) {
    getMsgCount();
  } else {
    tabList.value[2].isShow = false; // 隐藏消息tab
  }
})
</script>

<style lang="scss" scoped>
.uni-tabbar-bottom {
  position: fixed;
  bottom: 0;
  width: 100%;
  z-index: 999;
  left: 0;
  right: 0;
}

.uni-tabbar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  // height: 60px;
  padding-top: 10rpx;
  padding-bottom: constant(safe-area-inset-bottom); /* iOS 11.0 */
  padding-bottom: env(safe-area-inset-bottom); /* iOS 11.2+ */
  &__label {
    font-size: 13px;
    margin-top: 5px;
  }
}

.product-image {
  width: 24px;
  height: 24px;
}
</style>