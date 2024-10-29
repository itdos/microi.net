<script lang="ts" setup>
import { reactive, ref } from 'vue'
import { useUniAppSystemRectInfo } from '@tuniao/tnui-vue3-uniapp/hooks'
import TnButton from '@tuniao/tnui-vue3-uniapp/components/button/src/button.vue'
import { useDemoH5Page } from '@/hooks'	
import CustomPage from '@/components/custom-page/src/custom-page.vue'
import TnScrollList from '@tuniao/tnui-vue3-uniapp/components/scroll-list/src/scroll-list.vue'
import { GetServerPath } from '@/utils'
	import TnAvatar from '@tuniao/tnui-vue3-uniapp/components/avatar/src/avatar.vue'
import { tnNavPage } from '@tuniao/tnui-vue3-uniapp/utils'

import { useAbout } from './composables'

import type { CSSProperties } from 'vue'

import {
  formatNumberWithQuantityUnit,
  navMiniProgram,
} from '@/utils'

import { onShow } from '@dcloudio/uni-app'
const { navBarInfo } = useUniAppSystemRectInfo()

const { setData } = useAbout()
const { isDemoH5Page } = useDemoH5Page()

// 自定义按钮样式
const customButtonStyle: CSSProperties = {
  padding: '0rpx',
  borderRadius: '0rpx',
}
const userInfo: any = uni.getStorageSync('userInfo')
console.log(userInfo,'userInfo')
const goJump = (item: { title: string; url: string }) => {
  console.log(item)
  if (item.title ==='退出登陆') {
    uni.showModal({ //提醒用户更新
			title: "提示",
			content: '确认退出登陆？',
			success: (res) => {
        if (res.confirm) {
          // tnNavPage(item.url)
          uni.removeStorageSync('Token') // 清除token
          uni.reLaunch({
            url: item.url
          })
        }
      }
    })
  } else {
    tnNavPage(item.url)
  }
}
</script>

// #ifdef MP-WEIXIN
<script lang="ts">
export default {
  options: {
    // 在微信小程序中将组件节点渲染为虚拟节点，更加接近Vue组件的表现(不会出现shadow节点下再去创建元素)
    virtualHost: true,
  },
}
</script>
// #endif

<template>
	<CustomPage title="我的" :is-h5-demo-page="!isDemoH5Page" padding="0" :navbar-bottom-shadow="false" :navbar-frosted="false" bg-color="#d6f4fa">
    <view class="about-page">
      <!-- 顶部容器 -->
      <view class="about-page__top">
        <!-- 背景毛玻璃 -->
        <view class="bg-frosted-glass" />

        <!-- 信息容器 -->
        <view
          class="info-container tn-flex-center-start"
          :style="{ top: `${navBarInfo.height}px` }"
        >
          <view class="right tn-mr">
            <view class="user-avatar tn-flex-center">
              <TnAvatar :url="GetServerPath(userInfo.Avatar)" icon="my-lack-fill"
              size="150" :icon-config="{ size: '90rpx' }" img-mode="aspectFill" />
            </view>
          </view>
          <view class="left">
            <view class="user-nickname">{{ userInfo.Name }}</view>
            <view class="user-DeptName">{{ userInfo.DeptName }}</view>
          </view>
        </view>

        <!-- #ifndef MP-ALIPAY -->
        <!-- vip信息介绍 -->
        <view class="tuniao-vip tn-flex-center-between" v-if="false">
          <view class="vip-info">
            <view class="icon">
              <TnIcon
                transparent
                transparent-bg="gradient__about-page-vip-icon"
                name="vip-text"
              />
            </view>
            <view class="join-text tn-gray_text">加入会员</view>
          </view>
          <view
            class="operation-btn"
            hover-class="tn-u-btn-hover"
            :hover-stay-time="150"
          >
            立即加入
          </view>
        </view>
        <!-- #endif -->
      </view>

      <view class="about-page__top--placeholder" />

      <!-- #ifndef MP-ALIPAY -->

      <!-- 吾码信息 -->
      <view class="tuniao-info tn-flex-center tn-white_bg" v-if="false">
        <view class="item" @tap.stop="navMiniProgram('wxf3d81a452b88ff4b')">
          <view class="icon tn-bg-image tn-gradient-bg__cool-5">
            <TnIcon name="logo-tuniao" />
          </view>
          <view class="text">吾码</view>
        </view>
        <view class="item">
          <view class="icon tn-bg-image tn-gradient-bg__cool-7">
            <TnIcon name="code" />
          </view>
          <view class="text">吾码模板</view>
        </view>
        <view class="item">
          <view class="icon tn-bg-image tn-gradient-bg__cool-6">
            <TnIcon name="safe-fill" />
          </view>
          <view class="text">会员协议</view>
        </view>
        <view class="item button">
          <TnButton
            text
            hover-class=""
            open-type="share"
            :custom-style="customButtonStyle"
          >
            <view class="item">
              <view class="icon tn-bg-image tn-gradient-bg__cool-8">
                <TnIcon name="share-triangle" />
              </view>
              <view class="text">分享好友</view>
            </view>
          </TnButton>
        </view>
      </view>
      <!-- #endif -->

      <!-- 项目信息 -->
      <view class="project-info tn-white_bg">
        <view
          class="item-container"
          v-for="item in setData"
          :key="item.id"
          @tap.stop="goJump(item)"
          >
          <view class="item">
            <view class="left">
              <view class="left-icon" :class="item.class">
                <TnIcon :name="item.icon" />
              </view>
              <view class="left-text">{{item.title}}</view>
            </view>
            <view class="right">
              <TnIcon name="right" />
            </view>
          </view>
        </view>
        
      </view>
    </view>
  </CustomPage>
</template>

<style lang="scss" scoped>
@import './about.scss';
</style>
