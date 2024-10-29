<script setup lang="ts">
import { computed, inject, nextTick, provide, reactive, ref } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { useOrderedChildren } from '@tuniao/tnui-vue3-uniapp/hooks'

import TnTabbar from '@tuniao/tnui-vue3-uniapp/components/tabbar/src/tabbar.vue'
import TnTabbarItem from '@tuniao/tnui-vue3-uniapp/components/tabbar/src/tabbar-item.vue'

import BasicPage from './sub-page/components/basic/basic.vue' // 首页
import ComponentPage from './sub-page/components/component/component.vue' // 工作台
import TemplatePage from './sub-page/components/template/template.vue' // 通讯录
import AboutPage from './sub-page/components/about/about.vue' // 我的

import type { CSSProperties } from 'vue'
import type { IndexSubPageContext } from '@/tokens'

import { useWxShare } from '@/hooks'
import { indexPageContextKey } from '@/tokens'

import { GetServerPath } from '@/utils'
const Microi: any = inject('Microi'); // 使用注入Microi实例
const SysConfig = Microi.SysConfig
// 微信分享
onShareAppMessage(() => ({}))
onShareTimeline(() => ({}))
useWxShare({
  imageUrl: GetServerPath(SysConfig.SysLogo),
})

const {
  children: items,
  addChild: addItem,
  removeChild: removeItem,
} = useOrderedChildren<IndexSubPageContext>()

// 底部导航栏数据
const tabbarData = [
  { text: '首页', icon: 'home-capsule-fill' },
  { text: '工作台', icon: 'menu-more-fill' },
  { text: '通讯录', icon: 'menu-match-fill' },
  { text: '我的', icon: 'my-lack-fill' },
]
// 导航切换事件
const onTabbarChange = (index: string | number) => {
  if (!pageStatus.value?.[index as number]) {
    pageStatus.value[index as number] = true
    nextTick(() => {
      items.value?.[index as number]?.onLoad?.()
    })
  }

  items.value?.[index as number]?.onShow?.()
}

// 记录每个子页面的状态
const pageStatus = ref(Array.from({ length: tabbarData.length }, () => false))

// 当前选中的子页面的索引
const currentTabbarIndex = ref<number>(0)

// pageContainer的样式
const pageContainerStyle = computed<(index: number) => CSSProperties>(() => {
  return (index: number) => {
    const style: CSSProperties = {}

    if (index !== currentTabbarIndex.value) {
      style.display = 'none'
    }

    return style
  }
})
 
onLoad((options: any) => {
  // 获取当前进入的子页面的索引
  const index = Number(options?.index || 0)
  // 设置当前子页面的状态为true
  pageStatus.value[index] = true
  nextTick(() => {
    currentTabbarIndex.value = index
    setTimeout(() => {
      // 执行子页面的onLoad钩子
      items.value?.[index]?.onLoad?.()
    }, 50)
  })
})

provide(
  indexPageContextKey,
  reactive({
    items,
    addItem,
    removeItem,
  })
)
</script>

<template>
  <!-- 虚拟首页 -->
  <view class="page">
    <view
      v-if="pageStatus[0]"
      class="page__container"
      :style="pageContainerStyle(0)"
    >
      <scroll-view class="scroll-view" scroll-y>
        <BasicPage />
      </scroll-view>
    </view>
    <view
      v-if="pageStatus[1]"
      class="page__container"
      :style="pageContainerStyle(1)"
    >
      <scroll-view class="scroll-view" scroll-y>
        <ComponentPage />
      </scroll-view>
    </view>
    <view
      v-if="pageStatus[2]"
      class="page__container"
      :style="pageContainerStyle(2)"
    >
      <scroll-view class="scroll-view" scroll-y>
        <TemplatePage />
      </scroll-view>
    </view>
    <view
      v-if="pageStatus[3]"
      class="page__container"
      :style="pageContainerStyle(3)"
    >
      <scroll-view class="scroll-view" scroll-y>
        <AboutPage />
      </scroll-view>
    </view>
  </view>
  <TnTabbar
    v-model="currentTabbarIndex"
    fixed
    :placeholder="false"
    switch-animation
    frosted
    @change="onTabbarChange"
	
  >
    <TnTabbarItem
      v-for="(item, index) in tabbarData"
      :key="index"
      :name="index"
      :text="item.text"
      inactive-color="#c5cad5"
      :icon="item.icon"
      :active-icon="item.icon"
    />
  </TnTabbar>
</template>

<style lang="scss" scoped>
@import './style/index.scss';
</style>
